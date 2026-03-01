import * as THREE from 'three';

const TABLE_HEIGHT = 0.76;
const TABLE_LENGTH = 2.74;

export class Paddle {
  private group: THREE.Group;
  private paddle: THREE.Group;
  private glowRing!: THREE.Mesh;
  private isActive = false;
  
  // Animation state
  private targetYaw = 0;
  private targetPitch = 0;
  private currentYaw = 0;
  private currentPitch = 0;
  private swingAnimation = 0;  // 0 = none, 1 = full swing
  
  constructor() {
    this.group = new THREE.Group();
    this.paddle = new THREE.Group();
    
    this.createPaddle();
    this.createGlowRing();
    
    // Position at player's side
    this.group.position.set(0, TABLE_HEIGHT + 0.2, TABLE_LENGTH / 2 - 0.3);
    this.group.add(this.paddle);
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
      opacity: 0.8
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
      opacity: 0.8
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
  
  setRotation(yaw: number, pitch: number): void {
    // Set target rotation (smooth animation)
    this.targetYaw = yaw;
    this.targetPitch = pitch;
  }
  
  /**
   * Update animation (call each frame)
   */
  update(deltaTime: number): void {
    // Smooth interpolation toward target rotation
    const lerpSpeed = 12 * deltaTime;
    
    this.currentYaw += (this.targetYaw - this.currentYaw) * Math.min(1, lerpSpeed);
    this.currentPitch += (this.targetPitch - this.currentPitch) * Math.min(1, lerpSpeed);
    
    // Swing animation decay
    if (this.swingAnimation > 0) {
      this.swingAnimation = Math.max(0, this.swingAnimation - deltaTime * 5);
    }
    
    // Convert degrees to radians
    const yawRad = (this.currentYaw * Math.PI) / 180;
    const pitchRad = (this.currentPitch * Math.PI) / 180;
    
    // Apply rotation to paddle with swing effect
    const swingOffset = Math.sin(this.swingAnimation * Math.PI) * 0.3;
    this.paddle.rotation.y = yawRad;
    this.paddle.rotation.x = -Math.PI / 2 + pitchRad * 0.5 - swingOffset;
    
    // Move paddle forward during swing
    this.paddle.position.z = -swingOffset * 0.15;
    this.paddle.position.y = swingOffset * 0.1;
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
