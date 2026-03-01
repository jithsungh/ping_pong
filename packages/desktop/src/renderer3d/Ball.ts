import * as THREE from 'three';

const BALL_RADIUS = 0.02; // 40mm diameter = 0.02m radius

export class Ball {
  private group: THREE.Group;
  private ball: THREE.Mesh;
  private trail: THREE.Line;
  private trailPositions: THREE.Vector3[] = [];
  private maxTrailLength = 15;
  
  constructor() {
    this.group = new THREE.Group();
    
    // Create ball
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0xff6600,
      emissiveIntensity: 0.1
    });
    
    this.ball = new THREE.Mesh(geometry, material);
    this.ball.castShadow = true;
    this.group.add(this.ball);
    
    // Create trail
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.4,
      linewidth: 2
    });
    this.trail = new THREE.Line(trailGeometry, trailMaterial);
    this.group.add(this.trail);
    
    // Initialize trail positions
    for (let i = 0; i < this.maxTrailLength; i++) {
      this.trailPositions.push(new THREE.Vector3());
    }
  }
  
  setPosition(x: number, y: number, z: number): void {
    // Update ball position
    this.ball.position.set(x, y, z);
    
    // Update trail
    this.trailPositions.unshift(new THREE.Vector3(x, y, z));
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.pop();
    }
    
    // Update trail geometry
    const positions = new Float32Array(this.trailPositions.length * 3);
    this.trailPositions.forEach((pos, i) => {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
    });
    
    this.trail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trail.geometry.attributes.position.needsUpdate = true;
  }
  
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
  
  triggerHitEffect(power: number): void {
    // Flash the ball brighter on hit
    const material = this.ball.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.5 + power * 0.5;
    
    // Fade back
    const fadeOut = () => {
      material.emissiveIntensity = Math.max(0.1, material.emissiveIntensity - 0.05);
      if (material.emissiveIntensity > 0.15) {
        requestAnimationFrame(fadeOut);
      }
    };
    requestAnimationFrame(fadeOut);
  }
  
  clearTrail(): void {
    this.trailPositions = [];
    for (let i = 0; i < this.maxTrailLength; i++) {
      this.trailPositions.push(new THREE.Vector3());
    }
  }
  
  getMesh(): THREE.Group {
    return this.group;
  }
}
