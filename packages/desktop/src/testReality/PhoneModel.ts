import * as THREE from 'three';

/**
 * 3D iPhone 12 model (to-scale proportions)
 * 
 * iPhone 12 dimensions: 146.7 × 71.5 × 7.4 mm
 * We scale to ~1:10 for the scene (so ~0.147 × 0.0715 × 0.0074 meters)
 * Bumped up ×2 for visibility: 0.294 × 0.143 × 0.015
 */
const PHONE_WIDTH = 0.143;    // x
const PHONE_HEIGHT = 0.294;   // y
const PHONE_DEPTH = 0.015;    // z (thickness)
const SCREEN_BEZEL = 0.006;
const NOTCH_WIDTH = 0.05;
const NOTCH_HEIGHT = 0.012;
const CAMERA_BUMP_SIZE = 0.035;

export class PhoneModel {
  private group: THREE.Group;

  // Screen material for dynamic glow
  private screenMaterial!: THREE.MeshStandardMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.createBody();
    this.createScreen();
    this.createNotch();
    this.createCameraBump();
    this.createButtons();
  }

  /** Phone body — rounded-edge box in Space Black */
  private createBody(): void {
    // Main body
    const bodyGeo = new THREE.BoxGeometry(PHONE_WIDTH, PHONE_HEIGHT, PHONE_DEPTH);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c1e,
      roughness: 0.25,
      metalness: 0.9,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Aluminium frame (slightly larger, thin band around edges)
    const framePadding = 0.002;
    const frameGeo = new THREE.BoxGeometry(
      PHONE_WIDTH + framePadding * 2,
      PHONE_HEIGHT + framePadding * 2,
      PHONE_DEPTH + 0.001
    );
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4c,
      roughness: 0.15,
      metalness: 1.0,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.0005;
    this.group.add(frame);
  }

  /** OLED screen on front face */
  private createScreen(): void {
    const screenW = PHONE_WIDTH - SCREEN_BEZEL * 2;
    const screenH = PHONE_HEIGHT - SCREEN_BEZEL * 2;
    const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
    this.screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a84ff,    // iOS-blue glow
      roughness: 0.1,
      metalness: 0.0,
      emissive: 0x0a84ff,
      emissiveIntensity: 0.5,
    });
    const screen = new THREE.Mesh(screenGeo, this.screenMaterial);
    screen.position.z = PHONE_DEPTH / 2 + 0.001;
    this.group.add(screen);

    // Status bar at top (small dark bar)
    const statusGeo = new THREE.PlaneGeometry(screenW, 0.008);
    const statusMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.1,
      emissive: 0x222222,
      emissiveIntensity: 0.2,
    });
    const statusBar = new THREE.Mesh(statusGeo, statusMat);
    statusBar.position.set(0, screenH / 2 - 0.004, PHONE_DEPTH / 2 + 0.0015);
    this.group.add(statusBar);
  }

  /** Face ID notch */
  private createNotch(): void {
    const notchGeo = new THREE.BoxGeometry(NOTCH_WIDTH, NOTCH_HEIGHT, 0.003);
    const notchMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.5,
    });
    const notch = new THREE.Mesh(notchGeo, notchMat);
    notch.position.set(0, PHONE_HEIGHT / 2 - NOTCH_HEIGHT / 2 - SCREEN_BEZEL + 0.002, PHONE_DEPTH / 2 + 0.0015);
    this.group.add(notch);

    // Camera dot inside notch
    const camGeo = new THREE.CircleGeometry(0.003, 16);
    const camMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const cam = new THREE.Mesh(camGeo, camMat);
    cam.position.set(-0.006, PHONE_HEIGHT / 2 - NOTCH_HEIGHT / 2 - SCREEN_BEZEL + 0.002, PHONE_DEPTH / 2 + 0.003);
    this.group.add(cam);

    // Speaker grille
    const speakerGeo = new THREE.BoxGeometry(0.015, 0.002, 0.001);
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const speaker = new THREE.Mesh(speakerGeo, speakerMat);
    speaker.position.set(0.005, PHONE_HEIGHT / 2 - NOTCH_HEIGHT / 2 - SCREEN_BEZEL + 0.002, PHONE_DEPTH / 2 + 0.003);
    this.group.add(speaker);
  }

  /** Rear camera bump (dual camera square layout for iPhone 12) */
  private createCameraBump(): void {
    // Camera bump square background
    const bumpGeo = new THREE.BoxGeometry(CAMERA_BUMP_SIZE, CAMERA_BUMP_SIZE, 0.004);
    const bumpMat = new THREE.MeshStandardMaterial({
      color: 0x2c2c2e,
      roughness: 0.2,
      metalness: 0.8,
    });
    const bump = new THREE.Mesh(bumpGeo, bumpMat);
    bump.position.set(
      -PHONE_WIDTH / 2 + CAMERA_BUMP_SIZE / 2 + 0.01,
      PHONE_HEIGHT / 2 - CAMERA_BUMP_SIZE / 2 - 0.01,
      -PHONE_DEPTH / 2 - 0.002
    );
    bump.castShadow = true;
    this.group.add(bump);

    // Two camera lenses (diagonal layout)
    const lensGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.003, 16);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x111133,
      roughness: 0.05,
      metalness: 0.8,
    });
    const lensRingGeo = new THREE.TorusGeometry(0.007, 0.001, 8, 16);
    const lensRingMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 1.0,
      roughness: 0.1,
    });

    // Top-left lens
    const lens1 = new THREE.Mesh(lensGeo, lensMat);
    lens1.rotation.x = Math.PI / 2;
    lens1.position.set(
      -PHONE_WIDTH / 2 + 0.02,
      PHONE_HEIGHT / 2 - 0.02,
      -PHONE_DEPTH / 2 - 0.004
    );
    this.group.add(lens1);

    const ring1 = new THREE.Mesh(lensRingGeo, lensRingMat);
    ring1.position.copy(lens1.position);
    ring1.position.z -= 0.001;
    this.group.add(ring1);

    // Bottom-right lens
    const lens2 = new THREE.Mesh(lensGeo, lensMat);
    lens2.rotation.x = Math.PI / 2;
    lens2.position.set(
      -PHONE_WIDTH / 2 + 0.035,
      PHONE_HEIGHT / 2 - 0.035,
      -PHONE_DEPTH / 2 - 0.004
    );
    this.group.add(lens2);

    const ring2 = new THREE.Mesh(lensRingGeo, lensRingMat);
    ring2.position.copy(lens2.position);
    ring2.position.z -= 0.001;
    this.group.add(ring2);

    // Flash LED
    const flashGeo = new THREE.CircleGeometry(0.003, 8);
    const flashMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      emissive: 0xffffcc,
      emissiveIntensity: 0.2,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.rotation.y = Math.PI;  // Face backward
    flash.position.set(
      -PHONE_WIDTH / 2 + 0.035,
      PHONE_HEIGHT / 2 - 0.02,
      -PHONE_DEPTH / 2 - 0.005
    );
    this.group.add(flash);
  }

  /** Side buttons (volume + power) */
  private createButtons(): void {
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4c,
      roughness: 0.15,
      metalness: 1.0,
    });

    // Power button (right side)
    const powerGeo = new THREE.BoxGeometry(0.002, 0.025, 0.004);
    const power = new THREE.Mesh(powerGeo, btnMat);
    power.position.set(PHONE_WIDTH / 2 + 0.001, 0.04, 0);
    this.group.add(power);

    // Volume up (left side)
    const volUpGeo = new THREE.BoxGeometry(0.002, 0.018, 0.004);
    const volUp = new THREE.Mesh(volUpGeo, btnMat);
    volUp.position.set(-PHONE_WIDTH / 2 - 0.001, 0.06, 0);
    this.group.add(volUp);

    // Volume down (left side)
    const volDown = new THREE.Mesh(volUpGeo, btnMat);
    volDown.position.set(-PHONE_WIDTH / 2 - 0.001, 0.03, 0);
    this.group.add(volDown);

    // Silent switch (left side, above volume)
    const switchGeo = new THREE.BoxGeometry(0.002, 0.008, 0.003);
    const silentSwitch = new THREE.Mesh(switchGeo, btnMat);
    silentSwitch.position.set(-PHONE_WIDTH / 2 - 0.001, 0.085, 0);
    this.group.add(silentSwitch);
  }

  /**
   * Set phone orientation from quaternion (already in Three.js space)
   */
  setQuaternion(q: THREE.Quaternion): void {
    this.group.quaternion.copy(q);
  }

  /**
   * Convert W3C DeviceOrientation (alpha/beta/gamma) → Three.js quaternion
   * 
   * The standard conversion from device coords to Three.js world:
   * 1. Build quaternion from ZXY euler (device convention)
   * 2. Rotate -90° around X to convert from "screen faces Z" to "screen faces Y" 
   *    (device looks at ceiling when flat → Three.js Y-up)
   * 
   * Returns a quaternion suitable for use in Three.js world space.
   */
  static deviceOrientationToQuaternion(alpha: number, beta: number, gamma: number): THREE.Quaternion {
    const degToRad = THREE.MathUtils.degToRad;

    // Step 1: Build quaternion from device ZXY euler angles
    const euler = new THREE.Euler(
      degToRad(beta),     // X rotation (front/back tilt)
      degToRad(alpha),    // Y rotation (compass heading)
      -degToRad(gamma),   // Z rotation (left/right tilt, negated for Three.js)
      'YXZ'
    );
    const q = new THREE.Quaternion().setFromEuler(euler);

    // Step 2: Device orientation has "screen facing ceiling" as default.
    // Three.js has Z-forward. Rotate -90° around X to make flat phone = screen facing +Y (up).
    const screenAdjust = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    q.multiply(screenAdjust);

    return q;
  }

  /**
   * Set phone orientation from device euler angles (alpha/beta/gamma)
   * Uses proper W3C → Three.js quaternion conversion
   */
  setOrientation(alpha: number, beta: number, gamma: number): void {
    const q = PhoneModel.deviceOrientationToQuaternion(alpha, beta, gamma);
    this.group.quaternion.copy(q);
  }

  /**
   * Set screen glow color (visual feedback)
   */
  setScreenColor(color: number, intensity: number = 0.5): void {
    this.screenMaterial.color.setHex(color);
    this.screenMaterial.emissive.setHex(color);
    this.screenMaterial.emissiveIntensity = intensity;
  }

  getMesh(): THREE.Group {
    return this.group;
  }
}
