import * as THREE from 'three';

const TABLE_HEIGHT = 0.76;
const TABLE_LENGTH = 2.74;
const TABLE_WIDTH = 1.525;

// Paddle movement bounds (world coordinates relative to base)
const PADDLE_X_RANGE = TABLE_WIDTH / 2 + 0.1;  // Full table width + small margin
const PADDLE_Y_RANGE = 0.4;    // Up/down range above table
const PADDLE_Z_RANGE = 0.6;    // Forward/back range

export class Paddle {
  private group: THREE.Group;
  private paddle: THREE.Group;
  private glowRing!: THREE.Mesh;
  private isActive = false;
  
  // Quaternion-based pose (Magic Remote style)
  private targetQuaternion = new THREE.Quaternion();
  private angularVelocity = new THREE.Vector3(0, 0, 0);
  
  // Position tracking from phone orientation  
  private targetPosition = new THREE.Vector3(0, 0, 0);
  private currentPosition = new THREE.Vector3(0, 0, 0);
  // Base: player's end of table, slightly above, slightly behind edge
  private basePosition = new THREE.Vector3(0, TABLE_HEIGHT + 0.15, TABLE_LENGTH / 2 - 0.2);
  
  // Continuous orientation from pose stream (Euler degrees for mapping)
  private phoneYaw = 0;    // Phone horizontal rotation (alpha mapped)
  private phonePitch = 0;  // Phone forward/back tilt (beta)
  private phoneRoll = 0;   // Phone left/right tilt (gamma)
  
  // Target tilt for paddle face angle (yaw in game terms)
  private targetTiltX = 0;  // Forward/back tilt of paddle face
  private targetTiltY = 0;  // Left/right rotation of paddle
  private currentTiltX = 0;
  private currentTiltY = 0;
  
  // Legacy Euler angles (for swing-based fallback)
  private targetYaw = 0;
  private targetPitch = 0;
  private currentYaw = 0;
  private currentPitch = 0;
  
  // Animation state
  private swingAnimation = 0;  // 0 = none, 1 = full swing
  private useQuaternionMode = false; // Switch between legacy and quaternion
  
  constructor() {
    this.group = new THREE.Group();
    this.paddle = new THREE.Group();
    
    this.createPaddle();
    this.createGlowRing();
    
    // Position at player's side
    this.group.position.copy(this.basePosition);
    this.group.add(this.paddle);
    
    // Default pose: paddle at ~45° angle, handle pointing down-right
    // Like holding a paddle ready to serve
    this.setDefaultPose();
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
   * Set default ready-to-serve pose:
   * - Paddle face at ~45° (tilted slightly forward)
   * - Handle pointing downward
   * - Slight rightward tilt (natural grip)
   */
  private setDefaultPose(): void {
    // Default rotation: 
    //  X: -45° (paddle face tilted forward at 45 degrees, red side facing opponent)
    //  Y: 0° (centered)
    //  Z: -15° (slight rightward handle tilt, natural grip)
    this.paddle.rotation.set(
      -Math.PI / 4,        // 45° forward tilt (face angled toward table)
      0,                    // No left/right rotation
      -Math.PI / 12         // ~15° handle tilt to the right
    );
    this.currentTiltX = -Math.PI / 4;
    this.currentTiltY = 0;
  }
  
  /**
   * Set pose from quaternion (Magic Remote style)
   * This is the primary method for continuous pose-based control
   * 
   * Maps phone orientation to 4D paddle control:
   *  - Phone tilt left/right (gamma) → Paddle X position (left/right on table)
   *  - Phone tilt forward/back (beta) → Paddle Z position (forward/back) + face tilt
   *  - Phone horizontal rotation (alpha) → Paddle Y rotation (aim left/right)
   *  - Phone roll → Paddle face angle (yaw/tilt)
   */
  setQuaternion(q: [number, number, number, number], angularVel: [number, number, number]): void {
    this.useQuaternionMode = true;
    
    // Store raw quaternion for direction calculations
    this.targetQuaternion.set(q[0], q[1], q[2], q[3]);
    
    // Store angular velocity for swing detection
    this.angularVelocity.set(angularVel[0], angularVel[1], angularVel[2]);
    
    // Extract Euler angles from quaternion — use ZXY to match mobile's convention
    // Mobile builds quaternion as Rz(alpha) * Rx(beta) * Ry(gamma) [ZXY intrinsic]
    // So ZXY extraction recovers the original device angles:
    //   euler.z = alpha (compass heading / yaw)
    //   euler.x = beta  (forward-back tilt / pitch)
    //   euler.y = gamma (left-right tilt / roll)
    const euler = new THREE.Euler();
    euler.setFromQuaternion(this.targetQuaternion, 'ZXY');
    
    this.phoneYaw = euler.z;    // alpha: horizontal rotation (compass)
    this.phonePitch = euler.x;  // beta: forward/back tilt
    this.phoneRoll = euler.y;   // gamma: left/right tilt
    
    // === POSITION MAPPING (2D table movement + forward/back) ===
    
    // X position: phone roll (gamma/tilt left-right) → paddle left-right
    // When phone tilts left, paddle goes left; right → right
    const xNorm = Math.sin(this.phoneRoll);  // -1 to 1
    const xTarget = xNorm * PADDLE_X_RANGE;
    
    // Z position: phone pitch (beta/tilt forward-back) → paddle forward-back
    // Tilt phone forward = paddle reaches forward over table
    const zNorm = -Math.sin(this.phonePitch); // negative = forward
    const zTarget = zNorm * PADDLE_Z_RANGE;
    
    // Y position: slight height from pitch (reaching forward = slightly lower)
    const yTarget = Math.cos(this.phonePitch) * 0.1 - 0.05;
    
    this.targetPosition.set(
      Math.max(-PADDLE_X_RANGE, Math.min(PADDLE_X_RANGE, xTarget)),
      Math.max(-0.1, Math.min(PADDLE_Y_RANGE, yTarget)),
      Math.max(-PADDLE_Z_RANGE, Math.min(PADDLE_Z_RANGE, zTarget))
    );
    
    // === ROTATION MAPPING (paddle face tilt/angle) ===
    
    // Paddle face tilt (X rotation): phone pitch controls how open/closed the face is
    // More forward tilt = more closed face (drives ball down)
    // More backward = more open face (lobs/lifts)
    this.targetTiltX = -Math.PI / 4 + this.phonePitch * 0.6; // Base 45° + pitch influence
    
    // Paddle left/right aim (Y rotation): phone yaw for directional aim
    this.targetTiltY = this.phoneYaw * 0.8; // Horizontal aim
  }
  
  /**
   * Legacy: Set rotation from yaw/pitch (for swing-event compatibility)
   */
  setRotation(yaw: number, pitch: number): void {
    // Only use legacy if quaternion mode isn't active
    if (!this.useQuaternionMode) {
      this.targetYaw = yaw;
      this.targetPitch = pitch;
    }
  }
  
  /**
   * Get paddle forward direction (where the face is pointing)
   * Used for shot direction calculation
   */
  getForwardDirection(): THREE.Vector3 {
    // Forward = where red face points = local -Z after rotations
    const forward = new THREE.Vector3(0, 0, -1);
    const paddleWorldQuat = new THREE.Quaternion();
    this.paddle.getWorldQuaternion(paddleWorldQuat);
    forward.applyQuaternion(paddleWorldQuat);
    return forward.normalize();
  }
  
  /**
   * Get paddle right direction (for spin calculation)
   */
  getRightDirection(): THREE.Vector3 {
    const right = new THREE.Vector3(1, 0, 0);
    const paddleWorldQuat = new THREE.Quaternion();
    this.paddle.getWorldQuaternion(paddleWorldQuat);
    right.applyQuaternion(paddleWorldQuat);
    return right.normalize();
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
   * Smoothly interpolates position and rotation toward targets
   */
  update(deltaTime: number): void {
    const lerpSpeed = 12 * deltaTime;  // Responsive but smooth
    const clampedLerp = Math.min(1, lerpSpeed);
    
    if (this.useQuaternionMode) {
      // === POSITION: Smooth lerp toward target ===
      this.currentPosition.lerp(this.targetPosition, clampedLerp);
      
      // Apply position offset to group (moves the whole paddle in space)
      this.group.position.set(
        this.basePosition.x + this.currentPosition.x,
        this.basePosition.y + this.currentPosition.y,
        this.basePosition.z + this.currentPosition.z
      );
      
      // === ROTATION: Smooth lerp toward target tilt ===
      this.currentTiltX += (this.targetTiltX - this.currentTiltX) * clampedLerp;
      this.currentTiltY += (this.targetTiltY - this.currentTiltY) * clampedLerp;
      
      // Apply rotation to paddle sub-group
      // X = face angle (forward/back tilt) 
      // Y = aim direction (left/right turn)
      // Z = slight grip tilt (cosmetic)
      this.paddle.rotation.set(
        this.currentTiltX,
        this.currentTiltY,
        -Math.PI / 12  // Constant slight grip tilt
      );
      
    } else {
      // Legacy Euler mode (from swing events only)
      this.currentYaw += (this.targetYaw - this.currentYaw) * clampedLerp;
      this.currentPitch += (this.targetPitch - this.currentPitch) * clampedLerp;
      
      const yawRad = (this.currentYaw * Math.PI) / 180;
      const pitchRad = (this.currentPitch * Math.PI) / 180;
      
      // Apply rotation with swing effect
      const swingOff = Math.sin(this.swingAnimation * Math.PI) * 0.3;
      this.paddle.rotation.set(
        -Math.PI / 4 + pitchRad * 0.3 - swingOff,  // Base 45° + pitch
        yawRad * 0.5,                                // Yaw for aim
        -Math.PI / 12                                // Grip tilt
      );
      
      // Also move paddle based on yaw/pitch in legacy mode
      this.group.position.set(
        this.basePosition.x + Math.sin(yawRad) * PADDLE_X_RANGE * 0.3,
        this.basePosition.y,
        this.basePosition.z + Math.sin(pitchRad) * PADDLE_Z_RANGE * 0.2
      );
    }
    
    // Swing animation decay (forward lunge on hit)
    if (this.swingAnimation > 0) {
      this.swingAnimation = Math.max(0, this.swingAnimation - deltaTime * 5);
      
      // Move paddle forward during swing (visual feedback)
      const swingOffset = Math.sin(this.swingAnimation * Math.PI) * 0.15;
      this.paddle.position.z = -swingOffset;
      this.paddle.position.y = swingOffset * 0.3;
    } else {
      // Ease back to neutral local position
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
  
  /**
   * Get paddle's current world position
   */
  getWorldPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }
  
  /**
   * Get paddle's current position offset from base
   */
  getPositionOffset(): THREE.Vector3 {
    return this.currentPosition.clone();
  }
  
  getMesh(): THREE.Group {
    return this.group;
  }
}
