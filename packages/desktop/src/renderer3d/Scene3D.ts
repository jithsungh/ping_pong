import * as THREE from 'three';
import { Table } from './Table';
import { Ball } from './Ball';
import { Net } from './Net';
import { Paddle } from './Paddle';

export interface RenderState3D {
  ball: { x: number; y: number; z: number; visible: boolean };
  playerHitZoneActive: boolean;
  paddleYaw?: number;
  paddlePitch?: number;
  deltaTime?: number;
}

export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  
  private table: Table;
  private ball: Ball;
  private net: Net;
  private paddle: Paddle;
  
  private width = 0;
  private height = 0;
  
  // Camera orbit controls
  private cameraOrbitX = 0;       // Horizontal rotation (left/right)
  private cameraOrbitY = 0.15;    // Vertical angle (up/down), start slightly elevated
  private cameraDistance = 3.2;   // Distance from table center
  private cameraTarget = new THREE.Vector3(0, 0.76, -0.3); // Look at center of table
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  
  constructor(canvas: HTMLCanvasElement) {
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: true,
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    // Create camera (player POV - better default angle)
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    this.updateCameraPosition();
    
    // Set up mouse controls
    this.setupMouseControls(canvas);
    
    // Add lighting
    this.setupLighting();
    
    // Add floor
    this.setupFloor();
    
    // Create game objects
    this.table = new Table();
    this.scene.add(this.table.getMesh());
    
    this.net = new Net();
    this.scene.add(this.net.getMesh());
    
    this.ball = new Ball();
    this.scene.add(this.ball.getMesh());
    
    this.paddle = new Paddle();
    this.scene.add(this.paddle.getMesh());
    
    // Handle resize
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
    
    // Main overhead light
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(0, 8, 2);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 20;
    mainLight.shadow.camera.left = -3;
    mainLight.shadow.camera.right = 3;
    mainLight.shadow.camera.top = 3;
    mainLight.shadow.camera.bottom = -3;
    this.scene.add(mainLight);
    
    // Fill light from front
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(0, 2, 5);
    this.scene.add(fillLight);
    
    // Rim light for drama
    const rimLight = new THREE.PointLight(0xff6600, 0.4, 10);
    rimLight.position.set(-2, 2, -2);
    this.scene.add(rimLight);
  }
  
  private setupFloor(): void {
    // Dark floor with grid pattern
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f0f1a,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    // Grid lines
    const gridHelper = new THREE.GridHelper(20, 40, 0x333355, 0x222244);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);
  }
  
  private setupMouseControls(canvas: HTMLCanvasElement): void {
    // Mouse down - start dragging
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
      }
    });
    
    // Mouse move - rotate camera
    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;
      
      // Horizontal rotation (orbit around table)
      this.cameraOrbitX -= deltaX * 0.005;
      
      // Vertical rotation (tilt up/down) - clamped
      this.cameraOrbitY += deltaY * 0.003;
      this.cameraOrbitY = Math.max(0.05, Math.min(0.6, this.cameraOrbitY));
      
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      
      this.updateCameraPosition();
    });
    
    // Mouse up - stop dragging
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    });
    
    // Mouse wheel - zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance += e.deltaY * 0.003;
      this.cameraDistance = Math.max(1.5, Math.min(6, this.cameraDistance));
      this.updateCameraPosition();
    }, { passive: false });
    
    // Set default cursor
    canvas.style.cursor = 'grab';
  }
  
  private updateCameraPosition(): void {
    // Calculate camera position based on orbit angles
    const x = Math.sin(this.cameraOrbitX) * this.cameraDistance;
    const z = Math.cos(this.cameraOrbitX) * this.cameraDistance;
    const y = 0.76 + this.cameraOrbitY * this.cameraDistance + 0.5;
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }
  
  /**
   * Reset camera to default player view
   */
  resetCamera(): void {
    this.cameraOrbitX = 0;
    this.cameraOrbitY = 0.15;
    this.cameraDistance = 3.2;
    this.updateCameraPosition();
  }
  
  resize(): void {
    const container = this.renderer.domElement.parentElement;
    if (!container) return;
    
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    
    if (this.width === 0 || this.height === 0) return;
    
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }
  
  render(state: RenderState3D): void {
    // Auto-resize if needed
    if (this.width === 0 || this.height === 0) {
      this.resize();
    }
    
    // Update ball position
    // Convert normalized coords (0-1) to 3D world coords
    // Z: 0 = opponent side, 1 = player side
    // X: 0 = left, 1 = right
    // Y: height above table
    const ballX = (state.ball.x - 0.5) * 1.525; // Table width
    const ballZ = (state.ball.y - 0.5) * 2.74;  // Table length (y in 2D = z in 3D)
    const ballY = 0.76 + 0.15 + (state.ball.z || 0) * 0.5; // Table height + ball height
    
    this.ball.setPosition(ballX, ballY, ballZ);
    this.ball.setVisible(state.ball.visible);
    
    // Update paddle visualization (legacy Euler mode)
    if (state.paddleYaw !== undefined && state.paddlePitch !== undefined) {
      this.paddle.setRotation(state.paddleYaw, state.paddlePitch);
    }
    this.paddle.setActive(state.playerHitZoneActive);
    this.paddle.update(state.deltaTime ?? 0.016);
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Set paddle pose from quaternion (Magic Remote style)
   */
  setPaddlePose(q: [number, number, number, number], angularVel: [number, number, number]): void {
    this.paddle.setQuaternion(q, angularVel);
  }
  
  /**
   * Get paddle forward direction (where it's pointing)
   */
  getPaddleForward(): THREE.Vector3 {
    return this.paddle.getForwardDirection();
  }
  
  /**
   * Get paddle right direction (for spin)
   */
  getPaddleRight(): THREE.Vector3 {
    return this.paddle.getRightDirection();
  }
  
  /**
   * Get paddle angular velocity magnitude
   */
  getPaddleAngularVelocity(): number {
    return this.paddle.getAngularVelocityMagnitude();
  }
  
  /**
   * Get paddle angular velocity vector
   */
  getPaddleAngularVelocityVec(): THREE.Vector3 {
    return this.paddle.getAngularVelocity();
  }
  
  /**
   * Trigger hit effect
   */
  triggerHitEffect(_x: number, _y: number, _z: number, power: number): void {
    this.ball.triggerHitEffect(power);
    this.paddle.triggerSwingEffect();
  }
  
  /**
   * Get scene for external additions
   */
  getScene(): THREE.Scene {
    return this.scene;
  }
}
