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
    
    // Create camera (player POV)
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.camera.position.set(0, 1.8, 2.5);
    this.camera.lookAt(0, 0.76, -0.5);
    
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
    
    // Update paddle visualization
    if (state.paddleYaw !== undefined && state.paddlePitch !== undefined) {
      this.paddle.setRotation(state.paddleYaw, state.paddlePitch);
    }
    this.paddle.setActive(state.playerHitZoneActive);
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Trigger hit effect
   */
  triggerHitEffect(_x: number, _y: number, _z: number, power: number): void {
    this.ball.triggerHitEffect(power);
  }
  
  /**
   * Get scene for external additions
   */
  getScene(): THREE.Scene {
    return this.scene;
  }
}
