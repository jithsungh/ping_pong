import { SENSOR } from '@paddlelink/shared';
import type { SwingDetection, SensorData } from '@paddlelink/shared';

// Extend DeviceMotionEvent for iOS permission API
declare global {
  interface DeviceMotionEvent {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }
  interface DeviceOrientationEvent {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }
}

/** Pose data for streaming (quaternion + angular velocity) */
export interface PoseData {
  quaternion: [number, number, number, number]; // [x, y, z, w]
  angularVelocity: [number, number, number];    // [x, y, z] rad/s
  timestamp: number;
}

export class SensorManager {
  private lastSwingTime = 0;
  private swingCount = 0;
  private calibrationOffset = { x: 0, y: 0, z: 0 };
  private smoothedAccel = { x: 0, y: 0, z: 0 };
  private currentRotation = { alpha: 0, beta: 0, gamma: 0 };
  
  // Pose streaming state
  private currentQuaternion: [number, number, number, number] = [0, 0, 0, 1];
  private angularVelocity: [number, number, number] = [0, 0, 0];
  private lastAngularVelocity: [number, number, number] = [0, 0, 0];
  private poseStreamInterval: number | null = null;
  
  private onSwingCallback: ((swing: SwingDetection) => void) | null = null;
  private onSensorUpdateCallback: ((data: SensorData) => void) | null = null;
  private onPoseCallback: ((pose: PoseData) => void) | null = null;
  
  /**
   * Check if device supports motion sensors
   */
  static isSupported(): boolean {
    return 'DeviceMotionEvent' in window && 'DeviceOrientationEvent' in window;
  }
  
  /**
   * Request permission for motion sensors (required on iOS 13+)
   */
  async requestPermission(): Promise<boolean> {
    // iOS 13+ requires explicit permission
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const motionPermission = await (DeviceMotionEvent as any).requestPermission();
        if (motionPermission !== 'granted') {
          return false;
        }
      } catch (e) {
        console.error('Motion permission denied:', e);
        return false;
      }
    }
    
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const orientationPermission = await (DeviceOrientationEvent as any).requestPermission();
        if (orientationPermission !== 'granted') {
          return false;
        }
      } catch (e) {
        console.error('Orientation permission denied:', e);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Start listening to sensors and streaming pose
   */
  start(): void {
    window.addEventListener('devicemotion', this.handleMotion.bind(this), true);
    window.addEventListener('deviceorientation', this.handleOrientation.bind(this), true);
    
    // Start pose streaming at ~60Hz
    this.poseStreamInterval = window.setInterval(() => {
      this.streamPose();
    }, 16); // ~60fps
  }
  
  /**
   * Stop listening to sensors
   */
  stop(): void {
    window.removeEventListener('devicemotion', this.handleMotion.bind(this), true);
    window.removeEventListener('deviceorientation', this.handleOrientation.bind(this), true);
    
    if (this.poseStreamInterval !== null) {
      clearInterval(this.poseStreamInterval);
      this.poseStreamInterval = null;
    }
  }
  
  /**
   * Register swing detection callback (legacy)
   */
  onSwing(callback: (swing: SwingDetection) => void): void {
    this.onSwingCallback = callback;
  }
  
  /**
   * Register continuous pose callback (new: Magic Remote style)
   */
  onPose(callback: (pose: PoseData) => void): void {
    this.onPoseCallback = callback;
  }
  
  /**
   * Register sensor update callback (for debug display)
   */
  onSensorUpdate(callback: (data: SensorData) => void): void {
    this.onSensorUpdateCallback = callback;
  }
  
  /**
   * Calibrate sensors (call when phone is held flat)
   */
  calibrate(): void {
    this.calibrationOffset = { ...this.smoothedAccel };
    console.log('Calibrated with offset:', this.calibrationOffset);
  }
  
  /**
   * Get current swing count
   */
  getSwingCount(): number {
    return this.swingCount;
  }
  
  /**
   * Convert Euler angles (alpha, beta, gamma) to quaternion
   * Using ZXY rotation order which matches device orientation convention
   */
  private eulerToQuaternion(alpha: number, beta: number, gamma: number): [number, number, number, number] {
    // Convert to radians
    const a = (alpha * Math.PI) / 180;
    const b = (beta * Math.PI) / 180;
    const g = (gamma * Math.PI) / 180;
    
    // ZXY intrinsic Tait-Bryan angles (common for device orientation)
    const c1 = Math.cos(a / 2);
    const c2 = Math.cos(b / 2);
    const c3 = Math.cos(g / 2);
    const s1 = Math.sin(a / 2);
    const s2 = Math.sin(b / 2);
    const s3 = Math.sin(g / 2);
    
    // Quaternion components
    const x = s1 * c2 * c3 - c1 * s2 * s3;
    const y = c1 * s2 * c3 + s1 * c2 * s3;
    const z = c1 * c2 * s3 + s1 * s2 * c3;
    const w = c1 * c2 * c3 - s1 * s2 * s3;
    
    return [x, y, z, w];
  }
  
  /**
   * Stream current pose to callback
   */
  private streamPose(): void {
    if (!this.onPoseCallback) return;
    
    const pose: PoseData = {
      quaternion: [...this.currentQuaternion],
      angularVelocity: [...this.angularVelocity],
      timestamp: performance.now()
    };
    
    this.onPoseCallback(pose);
  }
  
  private handleMotion(event: DeviceMotionEvent): void {
    const accel = event.accelerationIncludingGravity;
    const rotationRate = event.rotationRate;
    
    if (!accel || accel.x === null || accel.y === null || accel.z === null) {
      return;
    }
    
    // Capture angular velocity from gyroscope (rad/s)
    if (rotationRate && rotationRate.alpha !== null && rotationRate.beta !== null && rotationRate.gamma !== null) {
      // Convert deg/s to rad/s and smooth slightly
      const smoothing = 0.3;
      this.angularVelocity[0] = smoothing * (rotationRate.beta * Math.PI / 180) + (1 - smoothing) * this.lastAngularVelocity[0];
      this.angularVelocity[1] = smoothing * (rotationRate.gamma * Math.PI / 180) + (1 - smoothing) * this.lastAngularVelocity[1];
      this.angularVelocity[2] = smoothing * (rotationRate.alpha * Math.PI / 180) + (1 - smoothing) * this.lastAngularVelocity[2];
      
      this.lastAngularVelocity = [...this.angularVelocity];
    }
    
    // Apply low-pass filter for smoothing acceleration
    const alpha = SENSOR.SMOOTHING_FACTOR;
    this.smoothedAccel.x = alpha * accel.x + (1 - alpha) * this.smoothedAccel.x;
    this.smoothedAccel.y = alpha * accel.y + (1 - alpha) * this.smoothedAccel.y;
    this.smoothedAccel.z = alpha * accel.z + (1 - alpha) * this.smoothedAccel.z;
    
    // Apply calibration offset
    const calibratedAccel = {
      x: this.smoothedAccel.x - this.calibrationOffset.x,
      y: this.smoothedAccel.y - this.calibrationOffset.y,
      z: this.smoothedAccel.z - this.calibrationOffset.z,
    };
    
    // Calculate total acceleration magnitude (excluding gravity baseline ~9.8)
    const magnitude = Math.sqrt(
      calibratedAccel.x ** 2 + 
      calibratedAccel.y ** 2 + 
      calibratedAccel.z ** 2
    );
    
    // Remove gravity component (~9.8 m/s²)
    const netAcceleration = Math.abs(magnitude - 9.8);
    
    // Publish sensor data for debug UI
    const sensorData: SensorData = {
      acceleration: calibratedAccel,
      rotation: this.currentRotation,
      timestamp: performance.now(),
    };
    this.onSensorUpdateCallback?.(sensorData);
    
    // Detect swing using ANGULAR VELOCITY (not acceleration)
    // This is more accurate for paddle swings
    this.detectSwingFromAngularVelocity(netAcceleration);
  }
  
  private handleOrientation(event: DeviceOrientationEvent): void {
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
      // Store raw rotation for legacy compatibility
      this.currentRotation = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      };
      
      // Convert to quaternion for pose streaming
      this.currentQuaternion = this.eulerToQuaternion(event.alpha, event.beta, event.gamma);
    }
  }
  
  /**
   * Detect swing using angular velocity magnitude (more accurate than acceleration)
   * Real paddles rotate more than they translate
   */
  private detectSwingFromAngularVelocity(accelerationMagnitude: number): void {
    const now = performance.now();
    
    // Check cooldown
    if (now - this.lastSwingTime < SENSOR.SWING_COOLDOWN_MS) {
      return;
    }
    
    // Angular velocity magnitude (rad/s)
    const angularMagnitude = Math.sqrt(
      this.angularVelocity[0] ** 2 +
      this.angularVelocity[1] ** 2 +
      this.angularVelocity[2] ** 2
    );
    
    // Threshold for swing detection (rad/s) - about 3-4 rad/s is a moderate swing
    const ANGULAR_THRESHOLD = 3.0; // rad/s
    const ANGULAR_MAX = 15.0;      // rad/s for max power
    
    // Must have both angular velocity AND some acceleration
    if (angularMagnitude < ANGULAR_THRESHOLD || accelerationMagnitude < 2.0) {
      return;
    }
    
    // Swing detected!
    this.lastSwingTime = now;
    this.swingCount++;
    
    // Calculate swing power from angular velocity (more intuitive)
    const speed = Math.min(angularMagnitude / ANGULAR_MAX, 1.0);
    
    // Direction from quaternion - yaw component
    const yaw = this.currentRotation.gamma; // -90 to 90
    const angle = this.currentRotation.gamma * 0.5; // Scale to -45 to 45
    
    // Spin from angular velocity around forward axis
    // Positive = topspin, negative = backspin
    const spin = Math.max(-1, Math.min(1, this.angularVelocity[0] / 5.0));
    
    const pitch = Math.max(-45, Math.min(45, this.currentRotation.beta));
    const roll = this.currentRotation.alpha;
    
    const swingData: SwingDetection = {
      detected: true,
      speed,
      angle,
      spin,
      yaw,
      pitch,
      roll
    };
    
    this.onSwingCallback?.(swingData);
    
    // Vibrate feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }
}
