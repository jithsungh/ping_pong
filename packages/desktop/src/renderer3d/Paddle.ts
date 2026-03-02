import * as THREE from 'three';

const TABLE_HEIGHT = 0.76;
const TABLE_LENGTH = 2.74;

export class Paddle {
  private group: THREE.Group;
  private paddle: THREE.Group;
  private glowRing!: THREE.Mesh;
  private isActive = false;
  
  // Quaternion-based pose (Magic Remote style)
  private targetQuaternion = new THREE.Quaternion();
  private currentQuaternion = new THREE.Quaternion();
  private angularVelocity = new THREE.Vector3(0, 0, 0);
  
  // Legacy Euler angles (for compatibility)
  private targetYaw = 0;
  private targetPitch = 0;
  private currentYaw = 0;
  private currentPitch = 0;
  
  // Animation state
  private swingAnimation = 0;  // 0 = none, 1 = full swing
  private useQuaternionMode = false; // Switch between legacy and quaternion
  
  // Base rotation to orient paddle correctly
  private baseRotation = new THREE.Quaternion();
  
  constructor() {
    this.group = new THREE.Group();
    this.paddle = new THREE.Group();
    
    this.createPaddle();
    this.createGlowRing();
    
    // Position at player's side
    this.group.position.set(0, TABLE_HEIGHT + 0.2, TABLE_LENGTH / 2 - 0.3);
    this.group.add(this.paddle);
    
    // Set base rotation so paddle face is vertical and facing opponent
    // When phone is held flat, paddle should face forward
    this.baseRotation.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  }
  
  private createPaddle(): void {
    // Paddle face (circular)
    const faceGeometry = new THREE.CircleGeometry(0.08, 32);
    
    // Red rubber side
    const redMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9
    });
    
    const redFace = new THREE.Mesh(faceGeometry, redMaterial);
    redFace.rotation.x = -Math.PI / 2; // Face up initially
    this.paddle.add(redFace);
    
    // Black rubber side (back)
    const blackMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9
    });
    
    const blackFace = new THREE.Mesh(faceGeometry, blackMaterial);
    blackFace.rotation.x = Math.PI / 2;
    blackFace.position.y = -0.005;
    this.paddle.add(blackFace);
    
    // Paddle edge
    const edgeGeometry = new THREE.TorusGeometry(0.08, 0.005, 8, 32);
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.8
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.rotation.x = Math.PI / 2;
    this.paddle.add(edge);
    
    // Handle
    const handleGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.7
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, 0, 0.12);
    handle.rotation.x = Math.PI / 2;
    this.paddle.add(handle);
  }
  
  private createGlowRing(): void {
    // Glow ring that shows when player can hit
    const ringGeometry = new THREE.RingGeometry(0.1, 0.15, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    
    this.glowRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.glowRing.rotation.x = -Math.PI / 2;
    this.glowRing.position.y = -0.01;
    this.group.add(this.glowRing);
  }
  
  /**
   * Set pose from quaternion (Magic Remote style)
   * This is the primary method for pose-based control
   */
  setQuaternion(q: [number, number, number, number], angularVel: [number, number, number]): void {
    this.useQuaternionMode = true;
    
    // Set target quaternion from mobile sensor
    this.targetQuaternion.set(q[0], q[1], q[2], q[3]);
    
    // Store angular velocity for swing detection
    this.angularVelocity.set(angularVel[0], angularVel[1], angularVel[2]);
  }
  
  /**
   * Legacy: Set rotation from yaw/pitch (for compatibility)
   */
  setRotation(yaw: number, pitch: number): void {
    this.useQuaternionMode = false;
    this.targetYaw = yaw;
    this.targetPitch = pitch;
  }
  
  /**
   * Get paddle forward direction (where the face is pointing)
   * Used for shot direction calculation
   */
  getForwardDirection(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.currentQuaternion);
    forward.applyQuaternion(this.baseRotation);
    return forward;
  }
  
  /**
   * Get paddle right direction (for spin calculation)
   */
  getRightDirection(): THREE.Vector3 {
    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(this.currentQuaternion);
    right.applyQuaternion(this.baseRotation);
    return right;
  }
  
  /**
   * Get angular velocity magnitude (for swing strength)
   */
  getAngularVelocityMagnitude(): number {
    return this.angularVelocity.length();
  }
  
  /**
   * Get angular velocity vector
   */
  getAngularVelocity(): THREE.Vector3 {
    return this.angularVelocity.clone();
  }
  
  /**
   * Update animation (call each frame)
   */
  update(deltaTime: number): void {
    if (this.useQuaternionMode) {
      // Quaternion mode: slerp toward target (smooth, no gimbal lock)
      const slerpSpeed = 15 * deltaTime; // Aggressive smoothing for responsiveness
      this.currentQuaternion.slerp(this.targetQuaternion, Math.min(1, slerpSpeed));
      
      // Apply combined rotation: base + current
      const combined = new THREE.Quaternion();
      combined.multiplyQuaternions(this.baseRotation, this.currentQuaternion);
      this.paddle.quaternion.copy(combined);
    } else {
      // Legacy Euler mode
      const lerpSpeed = 12 * deltaTime;
      
      this.currentYaw += (this.targetYaw - this.currentYaw) * Math.min(1, lerpSpeed);
      this.currentPitch += (this.targetPitch - this.currentPitch) * Math.min(1, lerpSpeed);
      
      // Convert degrees to radians
      const yawRad = (this.currentYaw * Math.PI) / 180;
      const pitchRad = (this.currentPitch * Math.PI) / 180;
      
      // Apply rotation to paddle with swing effect
      const swingOffset = Math.sin(this.swingAnimation * Math.PI) * 0.3;
      this.paddle.rotation.y = yawRad;
      this.paddle.rotation.x = -Math.PI / 2 + pitchRad * 0.5 - swingOffset;
      
      // Update currentQuaternion for direction calculations
      this.currentQuaternion.setFromEuler(this.paddle.rotation);
    }
    
    // Swing animation decay
    if (this.swingAnimation > 0) {
      this.swingAnimation = Math.max(0, this.swingAnimation - deltaTime * 5);
      
      // Move paddle forward during swing (visual feedback)
      const swingOffset = Math.sin(this.swingAnimation * Math.PI) * 0.15;
      this.paddle.position.z = -swingOffset;
      this.paddle.position.y = swingOffset * 0.5;
    } else {
      // Return to rest position
      this.paddle.position.z *= 0.9;
      this.paddle.position.y *= 0.9;
    }
  }
  
  setActive(active: boolean): void {
    this.isActive = active;
    const material = this.glowRing.material as THREE.MeshBasicMaterial;
    
    if (active) {
      material.opacity = 0.5;
      material.color.setHex(0x00ff00);
    } else {
      material.opacity = 0;
    }
  }
  
  triggerSwingEffect(): void {
    // Trigger swing animation
    this.swingAnimation = 1.0;
    
    // Flash effect on swing
    const material = this.glowRing.material as THREE.MeshBasicMaterial;
    material.opacity = 0.8;
    material.color.setHex(0xff6600);
    
    // Fade back
    const fadeOut = () => {
      material.opacity = Math.max(this.isActive ? 0.5 : 0, material.opacity - 0.1);
      if (material.opacity > (this.isActive ? 0.5 : 0)) {
        requestAnimationFrame(fadeOut);
      } else if (this.isActive) {
        material.color.setHex(0x00ff00);
      }
    };
    setTimeout(fadeOut, 50);
  }
  
  getMesh(): THREE.Group {
    return this.group;
  }
}
