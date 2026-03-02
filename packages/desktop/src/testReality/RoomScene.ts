import * as THREE from 'three';
import { PhoneModel } from './PhoneModel';

// Room dimensions (meters)
const ROOM_WIDTH = 5;
const ROOM_HEIGHT = 3;
const ROOM_DEPTH = 5;

export interface OrientationData {
  alpha: number;
  beta: number;
  gamma: number;
  accel: { x: number; y: number; z: number };
}

export class RoomScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private phone: PhoneModel;

  // Camera orbit state
  private cameraOrbitX = 0.3;
  private cameraOrbitY = 0.25;
  private cameraDistance = 1.8;
  private cameraTarget = new THREE.Vector3(0, 1.2, 0);
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Smoothed orientation for display
  private smoothedAlpha = 0;
  private smoothedBeta = 0;
  private smoothedGamma = 0;
  private smoothedAccel = { x: 0, y: 0, z: 0 };
  private dataReceived = false;

  // Axis helpers
  private axisGroup!: THREE.Group;

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.FogExp2(0x0d1117, 0.08);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.updateCameraPosition();

    // Build scene
    this.setupLighting();
    this.createRoom();
    this.createAxisHelper();

    // Phone model
    this.phone = new PhoneModel();
    this.phone.getMesh().position.set(0, 1.2, 0); // Hovering at eye level
    this.scene.add(this.phone.getMesh());

    // Mouse controls
    this.setupMouseControls(canvas);

    // Initial resize
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private setupLighting(): void {
    // Soft ambient
    const ambient = new THREE.AmbientLight(0x4466aa, 0.4);
    this.scene.add(ambient);

    // Hemisphere light (sky/ground coloring)
    const hemi = new THREE.HemisphereLight(0x88aadd, 0x443322, 0.5);
    this.scene.add(hemi);

    // Main overhead spotlight
    const mainLight = new THREE.SpotLight(0xffffff, 2.5);
    mainLight.position.set(0, ROOM_HEIGHT - 0.1, 0);
    mainLight.angle = Math.PI / 3;
    mainLight.penumbra = 0.5;
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(mainLight);
    mainLight.target.position.set(0, 1.2, 0);
    this.scene.add(mainLight.target);

    // Accent lights on walls
    const accent1 = new THREE.PointLight(0x0a84ff, 0.8, 6);
    accent1.position.set(-ROOM_WIDTH / 2 + 0.3, 1.5, -ROOM_DEPTH / 2 + 0.3);
    this.scene.add(accent1);

    const accent2 = new THREE.PointLight(0xff6b35, 0.6, 6);
    accent2.position.set(ROOM_WIDTH / 2 - 0.3, 1.5, ROOM_DEPTH / 2 - 0.3);
    this.scene.add(accent2);
  }

  private createRoom(): void {
    const hw = ROOM_WIDTH / 2;
    const hh = ROOM_HEIGHT;
    const hd = ROOM_DEPTH / 2;

    // --- Floor ---
    const floorGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.7,
      metalness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid on floor
    const grid = new THREE.GridHelper(ROOM_WIDTH, 20, 0x333366, 0x222244);
    grid.position.y = 0.005;
    this.scene.add(grid);

    // --- Walls (all four + ceiling) ---
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x16213e,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.BackSide,
    });

    // Back wall (-Z)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), wallMat.clone());
    backWall.position.set(0, hh / 2, -hd);
    this.scene.add(backWall);

    // Front wall (+Z) — with window hole (translucent panel)
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), wallMat.clone());
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, hh / 2, hd);
    this.scene.add(frontWall);

    // Left wall (-X)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat.clone());
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-hw, hh / 2, 0);
    this.scene.add(leftWall);

    // Right wall (+X)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat.clone());
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(hw, hh / 2, 0);
    this.scene.add(rightWall);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), wallMat.clone());
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = hh;
    this.scene.add(ceiling);

    // --- Decorative elements ---

    // Floating neon ring around where phone will be
    const ringGeo = new THREE.TorusGeometry(0.35, 0.005, 8, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x0a84ff,
      emissive: 0x0a84ff,
      emissiveIntensity: 1.0,
      roughness: 0.0,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.7, 0);
    this.scene.add(ring);

    // Standing pedestal (cylinder)
    const pedestalGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.7, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x222244,
      roughness: 0.5,
      metalness: 0.7,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, 0.35, 0);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    this.scene.add(pedestal);
  }

  /** XYZ axis arrows at phone origin for orientation reference */
  private createAxisHelper(): void {
    this.axisGroup = new THREE.Group();
    
    const axisLength = 0.25;
    const arrowHeadLength = 0.04;
    const arrowHeadWidth = 0.015;

    // X axis (red)
    const xDir = new THREE.Vector3(1, 0, 0);
    const xArrow = new THREE.ArrowHelper(xDir, new THREE.Vector3(), axisLength, 0xff4444, arrowHeadLength, arrowHeadWidth);
    this.axisGroup.add(xArrow);

    // Y axis (green)
    const yDir = new THREE.Vector3(0, 1, 0);
    const yArrow = new THREE.ArrowHelper(yDir, new THREE.Vector3(), axisLength, 0x44ff44, arrowHeadLength, arrowHeadWidth);
    this.axisGroup.add(yArrow);

    // Z axis (blue)
    const zDir = new THREE.Vector3(0, 0, 1);
    const zArrow = new THREE.ArrowHelper(zDir, new THREE.Vector3(), axisLength, 0x4444ff, arrowHeadLength, arrowHeadWidth);
    this.axisGroup.add(zArrow);

    this.axisGroup.position.set(0, 1.2, 0);
    this.scene.add(this.axisGroup);
  }

  private setupMouseControls(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.cameraOrbitX -= dx * 0.005;
      this.cameraOrbitY += dy * 0.003;
      this.cameraOrbitY = Math.max(-0.3, Math.min(0.8, this.cameraOrbitY));
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.updateCameraPosition();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance += e.deltaY * 0.002;
      this.cameraDistance = Math.max(0.6, Math.min(5, this.cameraDistance));
      this.updateCameraPosition();
    }, { passive: false });

    canvas.style.cursor = 'grab';
  }

  private updateCameraPosition(): void {
    const x = Math.sin(this.cameraOrbitX) * this.cameraDistance;
    const z = Math.cos(this.cameraOrbitX) * this.cameraDistance;
    const y = this.cameraTarget.y + this.cameraOrbitY * this.cameraDistance;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  /**
   * Update phone orientation from raw device orientation data
   */
  updateOrientation(data: OrientationData): void {
    this.dataReceived = true;

    // Smooth incoming values (low-pass)
    const s = 0.35;
    this.smoothedAlpha = s * data.alpha + (1 - s) * this.smoothedAlpha;
    this.smoothedBeta = s * data.beta + (1 - s) * this.smoothedBeta;
    this.smoothedGamma = s * data.gamma + (1 - s) * this.smoothedGamma;
    this.smoothedAccel.x = s * data.accel.x + (1 - s) * this.smoothedAccel.x;
    this.smoothedAccel.y = s * data.accel.y + (1 - s) * this.smoothedAccel.y;
    this.smoothedAccel.z = s * data.accel.z + (1 - s) * this.smoothedAccel.z;

    // Apply to phone model
    this.phone.setOrientation(this.smoothedAlpha, this.smoothedBeta, this.smoothedGamma);

    // Update axis helper to match phone orientation
    this.axisGroup.rotation.copy(this.phone.getMesh().rotation);
  }

  /**
   * Update phone orientation from quaternion (pose message)
   */
  updatePose(q: [number, number, number, number]): void {
    this.dataReceived = true;
    const quat = new THREE.Quaternion(q[0], q[1], q[2], q[3]);
    this.phone.setQuaternion(quat);
    
    // Extract euler for debug display
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    this.smoothedAlpha = THREE.MathUtils.radToDeg(euler.y);
    this.smoothedBeta = THREE.MathUtils.radToDeg(euler.x);
    this.smoothedGamma = -THREE.MathUtils.radToDeg(euler.z);

    // Sync axis helper
    this.axisGroup.quaternion.copy(quat);
  }

  /**
   * Get current smoothed values for debug HUD
   */
  getDebugData(): { alpha: number; beta: number; gamma: number; accel: { x: number; y: number; z: number }; connected: boolean } {
    return {
      alpha: this.smoothedAlpha,
      beta: this.smoothedBeta,
      gamma: this.smoothedGamma,
      accel: { ...this.smoothedAccel },
      connected: this.dataReceived,
    };
  }

  resize(): void {
    const container = this.renderer.domElement.parentElement;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(): void {
    // Gentle idle animation if no data yet
    if (!this.dataReceived) {
      const t = performance.now() * 0.001;
      this.phone.getMesh().rotation.set(
        Math.sin(t * 0.5) * 0.15,
        t * 0.3,
        Math.cos(t * 0.7) * 0.1
      );
      this.axisGroup.rotation.copy(this.phone.getMesh().rotation);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
