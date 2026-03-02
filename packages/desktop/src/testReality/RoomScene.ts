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

type CalibrationState = 'waiting' | 'calibrated';

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

  // === CALIBRATION ===
  private calibrationState: CalibrationState = 'waiting';
  // Inverse of the reference quaternion captured at calibration time
  private calibrationRefInverse = new THREE.Quaternion();
  // The "flat on table, screen up" pose in Three.js world = phone screen faces +Y
  // PhoneModel's screen is on the +Z face of the geometry, so to have screen face +Y
  // we rotate -90° around X.
  private flatPose = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2
  );
  // Smoothed quaternion for SLERP
  private currentQuat = new THREE.Quaternion();
  private targetQuat = new THREE.Quaternion();

  // Callback for calibration state changes
  private onCalibrationChangeCallback: ((state: CalibrationState) => void) | null = null;

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

  /** XYZ axis arrows at phone origin for orientation reference
   *  Colored to match WORLD-intuitive axes after flat pose:
   *  Red  (X) = local X = right edge of phone
   *  Green(Y) = local Z = screen normal → points UP when flat
   *  Blue (Z) = local Y = phone long axis → points FORWARD when flat
   */
  private createAxisHelper(): void {
    this.axisGroup = new THREE.Group();
    
    const axisLength = 0.25;
    const arrowHeadLength = 0.04;
    const arrowHeadWidth = 0.015;

    // X axis (red) — phone's right edge → world right
    const xDir = new THREE.Vector3(1, 0, 0);
    const xArrow = new THREE.ArrowHelper(xDir, new THREE.Vector3(), axisLength, 0xff4444, arrowHeadLength, arrowHeadWidth);
    this.axisGroup.add(xArrow);

    // Y axis (green) — screen normal (local Z) → world UP when flat
    const yDir = new THREE.Vector3(0, 0, 1);
    const yArrow = new THREE.ArrowHelper(yDir, new THREE.Vector3(), axisLength, 0x44ff44, arrowHeadLength, arrowHeadWidth);
    this.axisGroup.add(yArrow);

    // Z axis (blue) — phone long axis (local Y) → world FORWARD when flat
    const zDir = new THREE.Vector3(0, 1, 0);
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
   * Register callback for calibration state changes
   */
  onCalibrationChange(callback: (state: CalibrationState) => void): void {
    this.onCalibrationChangeCallback = callback;
  }

  /**
   * Get current calibration state
   */
  getCalibrationState(): CalibrationState {
    return this.calibrationState;
  }

  /**
   * Called when the mobile sends a calibrate event.
   * Captures the current device orientation as the "flat on table" reference.
   * All future orientations are relative to this reference.
   */
  calibrate(): void {
    // The last received raw quaternion becomes our reference
    // We store its inverse so we can compute: q_relative = q_refInverse * q_current
    const currentRaw = PhoneModel.deviceOrientationToQuaternion(
      this.smoothedAlpha,
      this.smoothedBeta,
      this.smoothedGamma
    );
    this.calibrationRefInverse.copy(currentRaw).invert();
    
    // Start pose from flat
    this.currentQuat.copy(this.flatPose);
    this.targetQuat.copy(this.flatPose);

    this.calibrationState = 'calibrated';
    this.onCalibrationChangeCallback?.('calibrated');
    console.log('[RoomScene] Calibrated! Reference orientation captured.');
  }

  /**
   * Update phone orientation from raw device orientation data
   */
  updateOrientation(data: OrientationData): void {
    this.dataReceived = true;

    // Smooth incoming values (low-pass)
    const s = 0.4;
    this.smoothedAlpha = s * data.alpha + (1 - s) * this.smoothedAlpha;
    this.smoothedBeta = s * data.beta + (1 - s) * this.smoothedBeta;
    this.smoothedGamma = s * data.gamma + (1 - s) * this.smoothedGamma;
    this.smoothedAccel.x = s * data.accel.x + (1 - s) * this.smoothedAccel.x;
    this.smoothedAccel.y = s * data.accel.y + (1 - s) * this.smoothedAccel.y;
    this.smoothedAccel.z = s * data.accel.z + (1 - s) * this.smoothedAccel.z;

    if (this.calibrationState !== 'calibrated') {
      // Not calibrated yet — show idle animation, don't apply
      return;
    }

    // Convert raw device orientation → Three.js quaternion
    const rawQuat = PhoneModel.deviceOrientationToQuaternion(
      this.smoothedAlpha,
      this.smoothedBeta,
      this.smoothedGamma
    );

    // Compute relative rotation from calibration reference
    // q_relative = q_refInverse * q_current
    const relativeQuat = new THREE.Quaternion()
      .copy(this.calibrationRefInverse)
      .multiply(rawQuat);

    // Apply relative rotation to the flat pose
    // Final = flatPose * relative
    this.targetQuat.copy(this.flatPose).multiply(relativeQuat);
  }

  /**
   * Update phone orientation from quaternion (pose message)
   */
  updatePose(q: [number, number, number, number]): void {
    this.dataReceived = true;

    // Convert to Three.js quat
    const rawQuat = new THREE.Quaternion(q[0], q[1], q[2], q[3]);

    // Extract approximate euler for debug HUD (ZXY matches mobile's convention)
    const euler = new THREE.Euler().setFromQuaternion(rawQuat, 'ZXY');
    this.smoothedAlpha = THREE.MathUtils.radToDeg(euler.z);
    this.smoothedBeta = THREE.MathUtils.radToDeg(euler.x);
    this.smoothedGamma = THREE.MathUtils.radToDeg(euler.y);

    if (this.calibrationState !== 'calibrated') {
      return;
    }

    // Same relative rotation approach as updateOrientation
    const relativeQuat = new THREE.Quaternion()
      .copy(this.calibrationRefInverse)
      .multiply(rawQuat);

    this.targetQuat.copy(this.flatPose).multiply(relativeQuat);
  }

  /**
   * Get current smoothed values for debug HUD
   */
  getDebugData(): { alpha: number; beta: number; gamma: number; accel: { x: number; y: number; z: number }; connected: boolean; calibrated: boolean } {
    return {
      alpha: this.smoothedAlpha,
      beta: this.smoothedBeta,
      gamma: this.smoothedGamma,
      accel: { ...this.smoothedAccel },
      connected: this.dataReceived,
      calibrated: this.calibrationState === 'calibrated',
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
    if (this.calibrationState === 'calibrated') {
      // SLERP toward target for buttery-smooth motion
      this.currentQuat.slerp(this.targetQuat, 0.25);
      this.phone.setQuaternion(this.currentQuat);
      this.axisGroup.quaternion.copy(this.currentQuat);
    } else {
      // Gentle idle animation — waiting for calibration
      const t = performance.now() * 0.001;
      this.phone.getMesh().rotation.set(
        -Math.PI / 2 + Math.sin(t * 0.5) * 0.08,  // Mostly flat, gentle wobble
        t * 0.15,                                     // Slow spin
        Math.cos(t * 0.7) * 0.05
      );
      this.axisGroup.rotation.copy(this.phone.getMesh().rotation);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
