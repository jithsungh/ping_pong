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

export class SensorManager {
  private lastSwingTime = 0;
  private swingCount = 0;
  private calibrationOffset = { x: 0, y: 0, z: 0 };
  private smoothedAccel = { x: 0, y: 0, z: 0 };
  private currentRotation = { alpha: 0, beta: 0, gamma: 0 };
  
  private onSwingCallback: ((swing: SwingDetection) => void) | null = null;
  private onSensorUpdateCallback: ((data: SensorData) => void) | null = null;
  
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
   * Start listening to sensors
   */
  start(): void {
    window.addEventListener('devicemotion', this.handleMotion.bind(this), true);
    window.addEventListener('deviceorientation', this.handleOrientation.bind(this), true);
  }
  
  /**
   * Stop listening to sensors
   */
  stop(): void {
    window.removeEventListener('devicemotion', this.handleMotion.bind(this), true);
    window.removeEventListener('deviceorientation', this.handleOrientation.bind(this), true);
  }
  
  /**
   * Register swing detection callback
   */
  onSwing(callback: (swing: SwingDetection) => void): void {
    this.onSwingCallback = callback;
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
  
  private handleMotion(event: DeviceMotionEvent): void {
    const accel = event.accelerationIncludingGravity;
    if (!accel || accel.x === null || accel.y === null || accel.z === null) {
      return;
    }
    
    // Apply low-pass filter for smoothing
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
    
    // Check for swing
    this.detectSwing(netAcceleration, calibratedAccel);
  }
  
  private handleOrientation(event: DeviceOrientationEvent): void {
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
      this.currentRotation = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      };
    }
  }
  
  private detectSwing(magnitude: number, _accel: { x: number; y: number; z: number }): void {
    const now = performance.now();
    
    // Check cooldown
    if (now - this.lastSwingTime < SENSOR.SWING_COOLDOWN_MS) {
      return;
    }
    
    // Check if acceleration exceeds threshold
    if (magnitude < SENSOR.ACCELERATION_THRESHOLD) {
      return;
    }
    
    // Swing detected!
    this.lastSwingTime = now;
    this.swingCount++;
    
    // Calculate swing parameters
    const speed = Math.min(magnitude / SENSOR.ACCELERATION_MAX, 1.0);
    
    // Angle based on horizontal tilt (gamma: -90 to 90)
    const angle = this.currentRotation.gamma * 0.5; // Scale to -45 to 45
    
    // Spin based on rotation rate (approximated from beta change)
    // Positive beta = phone tilting forward = topspin
    const spin = Math.max(-1, Math.min(1, this.currentRotation.beta / 90));
    
    const swingData: SwingDetection = {
      detected: true,
      speed,
      angle,
      spin,
    };
    
    this.onSwingCallback?.(swingData);
    
    // Vibrate feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }
}
