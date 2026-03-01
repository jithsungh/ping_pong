# PaddleLink 3D Upgrade Plan

## Overview

Transform the current 2D top-down table tennis game into a **realistic 3D POV experience** where the player sees the table from their end, with proper perspective, 3D ball physics, and immersive visuals.

---

## Visual Target

```
         ╔═══════════════════════════════════════════╗
         ║              OPPONENT SIDE                ║
         ║    ┌─────────────────────────────────┐    ║
         ║   /                                   \   ║
         ║  /              NET                    \  ║
         ╠═/═════════════════════════════════════\═══╣
         ║/                                       \  ║
        /│              TABLE SURFACE              │\ 
       / │                 (green)                 │ \
      /  │                                         │  \
     /   │                    ●                    │   \
    /    │                  (ball)                 │    \
   /     └─────────────────────────────────────────┘     \
  /                     PLAYER SIDE                       \
 ╚═════════════════════════════════════════════════════════╝
                     [Player's POV]
```

---

## Technology Stack

### Recommended: Three.js
- **Why**: Most mature, best documented, huge community
- **Size**: ~150KB gzipped
- **Learning curve**: Medium
- **3D Features**: Full scene graph, materials, lighting, shadows

### Alternative Options:
| Library | Size | Pros | Cons |
|---------|------|------|------|
| Three.js | 150KB | Full-featured, huge ecosystem | Learning curve |
| Babylon.js | 300KB | Great physics built-in | Larger bundle |
| PlayCanvas | 200KB | Game-focused | Less flexible |
| Raw WebGL | 0KB | Smallest | Hardest to develop |

**Recommendation**: Use **Three.js** for best balance of features and community support.

---

## Phase 1: Scene Setup (4-6 hours)

### 1.1 Install Dependencies
```bash
npm install three @types/three -w @paddlelink/desktop
```

### 1.2 Create 3D Scene Structure
```
packages/desktop/src/
├── renderer3d/
│   ├── Scene3D.ts        # Main scene setup
│   ├── Table.ts          # 3D table mesh
│   ├── Ball.ts           # 3D ball with shadow
│   ├── Net.ts            # Net mesh
│   ├── Paddle.ts         # Paddle visualization
│   ├── Camera.ts         # POV camera
│   └── Lighting.ts       # Lights and shadows
```

### 1.3 Camera Setup (Player POV)
```typescript
// POV from player's end of table
camera.position.set(0, 1.5, 3);  // 1.5m height, 3m back
camera.lookAt(0, 0.76, -1.37);   // Look at table center
camera.fov = 60;
```

### 1.4 Table Dimensions (Real-world scale)
```typescript
const TABLE = {
  length: 2.74,    // meters (9 feet)
  width: 1.525,    // meters (5 feet)
  height: 0.76,    // meters (2.5 feet)
  thickness: 0.03, // table top thickness
  netHeight: 0.1525 // 15.25 cm
};
```

---

## Phase 2: 3D Models (6-8 hours)

### 2.1 Table Model
- Green playing surface with white lines
- Dark brown wooden legs
- Slight glossy reflection
- Baked ambient occlusion for realism

### 2.2 Net Model
- Metal posts on sides
- White mesh texture (can use plane with transparency)
- Slight droop in middle

### 2.3 Ball Model
- White sphere with orange stripe
- Real-time shadows
- Motion blur effect during fast movement

### 2.4 Paddle Model (Visual feedback)
- Show ghost paddle on player's side
- Follows swing direction from phone
- Transparent/glowing when ready to hit

---

## Phase 3: 3D Physics Integration (8-10 hours)

### 3.1 Convert 2D Physics to 3D
```typescript
interface Ball3D {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  spin: { x: number; y: number; z: number };
}

// Y is now vertical (height)
// Z is depth (toward/away from player)
// X is left/right
```

### 3.2 Ball Trajectory
```typescript
// Gravity pulls down (negative Y)
velocity.y -= GRAVITY * deltaTime;

// Spin affects curve
velocity.x += spin.y * MAGNUS_COEFFICIENT * deltaTime;
velocity.z += spin.x * MAGNUS_COEFFICIENT * deltaTime;

// Position update
position.x += velocity.x * deltaTime;
position.y += velocity.y * deltaTime;
position.z += velocity.z * deltaTime;
```

### 3.3 Table Collision
```typescript
// Ball bounces on table surface
if (position.y <= TABLE.height + BALL_RADIUS) {
  if (isOverTable(position.x, position.z)) {
    position.y = TABLE.height + BALL_RADIUS;
    velocity.y = -velocity.y * BOUNCE_COEFFICIENT;
    // Add spin effect on bounce
    velocity.x += spin.x * SPIN_TRANSFER;
  }
}
```

### 3.4 Net Collision
```typescript
// Check if ball crosses net plane
if (Math.abs(position.z) < NET_THICKNESS && 
    position.y < TABLE.height + NET_HEIGHT) {
  // Ball hits net - lose point
  triggerNetHit();
}
```

---

## Phase 4: Visual Effects (4-6 hours)

### 4.1 Lighting Setup
```typescript
// Main directional light (sun)
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(5, 10, 5);
sunLight.castShadow = true;

// Ambient light (fill)
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);

// Rim light (dramatic effect)
const rimLight = new THREE.PointLight(0xff6600, 0.3);
rimLight.position.set(-3, 2, -3);
```

### 4.2 Shadows
```typescript
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Ball casts shadow on table
ball.castShadow = true;
table.receiveShadow = true;
```

### 4.3 Ball Trail Effect
```typescript
// Ghost trail showing ball path
const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  opacity: 0.3,
  transparent: true
});
```

### 4.4 Hit Impact Effect
```typescript
// Particle burst on paddle hit
function createHitEffect(position: Vector3) {
  const particles = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xff6600, size: 0.05 })
  );
  // Animate particles outward
}
```

---

## Phase 5: Camera & Atmosphere (3-4 hours)

### 5.1 Dynamic Camera
```typescript
// Slight camera movement following ball
camera.position.x = lerp(camera.position.x, ball.position.x * 0.1, 0.05);

// Camera shake on powerful hits
if (hitPower > 0.8) {
  cameraShake(intensity: 0.02, duration: 200);
}
```

### 5.2 Background Environment
- Dark gradient background (sports arena feel)
- Optional: Blurred crowd/audience texture
- Floor reflection under table

### 5.3 Post-Processing (Optional)
```typescript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { BloomPass } from 'three/examples/jsm/postprocessing/BloomPass';

// Subtle bloom on bright areas
const bloomPass = new BloomPass(0.5, 25, 4, 256);
composer.addPass(bloomPass);
```

---

## Phase 6: Audio (2-3 hours)

### 6.1 Sound Effects
| Event | Sound |
|-------|-------|
| Ball hits table | Short "pok" |
| Ball hits paddle | Satisfying "thwack" |
| Ball hits net | Soft "thud" |
| Score point | Celebratory chime |
| Opponent scores | Sad trombone |

### 6.2 Implementation
```typescript
// Web Audio API or Howler.js
const sounds = {
  tableHit: new Howl({ src: ['/sounds/table-hit.mp3'] }),
  paddleHit: new Howl({ src: ['/sounds/paddle-hit.mp3'] }),
  score: new Howl({ src: ['/sounds/score.mp3'] })
};
```

---

## Implementation Timeline

| Phase | Task | Hours | Dependencies |
|-------|------|-------|--------------|
| 1 | Scene Setup | 4-6 | None |
| 2 | 3D Models | 6-8 | Phase 1 |
| 3 | 3D Physics | 8-10 | Phase 1, 2 |
| 4 | Visual Effects | 4-6 | Phase 2, 3 |
| 5 | Camera & Atmosphere | 3-4 | Phase 1-4 |
| 6 | Audio | 2-3 | Phase 3 |
| **Total** | | **27-37 hours** | |

---

## File Structure After 3D Upgrade

```
packages/desktop/src/
├── main.ts
├── game.ts
├── websocket.ts
├── physics3d.ts          # 3D physics engine
├── renderer3d/
│   ├── index.ts          # Main 3D renderer
│   ├── Scene3D.ts        # Scene management
│   ├── Table.ts          # Table mesh + materials
│   ├── Ball.ts           # Ball with trail effect
│   ├── Net.ts            # Net mesh
│   ├── Paddle.ts         # Ghost paddle visualization
│   ├── Camera.ts         # POV camera controller
│   ├── Lighting.ts       # Lights + shadows
│   ├── Effects.ts        # Particles, trails
│   └── Skybox.ts         # Background environment
├── audio/
│   ├── SoundManager.ts   # Audio controller
│   └── sounds/           # Audio files
└── ai3d.ts               # AI adapted for 3D
```

---

## Migration Strategy

### Option A: Gradual Migration
1. Keep 2D renderer working
2. Build 3D renderer in parallel
3. Add toggle switch: "2D Mode / 3D Mode"
4. Deprecate 2D after 3D is stable

### Option B: Full Rewrite (Recommended)
1. Create new `renderer3d/` folder
2. Rewrite physics for 3D coordinates
3. Replace 2D renderer entirely
4. Faster to implement, cleaner codebase

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS on mid-range laptop |
| Load time | < 3 seconds |
| Memory | < 100MB |
| Mobile (phone) | No changes needed |

---

## Optional Enhancements

### After Core 3D Works:
1. **Multiple camera angles** (broadcast view, overhead)
2. **Paddle customization** (colors, designs) 
3. **Table skins** (wood, concrete, neon)
4. **Slow-motion replay** on match point
5. **Spectator mode** for additional viewers
6. **VR support** (WebXR for future)

---

## Quick Start Commands

```bash
# Install Three.js
cd packages/desktop
npm install three @types/three

# Create 3D renderer folder
mkdir -p src/renderer3d

# Start development
npm run dev:desktop
```

---

## Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Three.js Examples](https://threejs.org/examples/)
- [Table Tennis Table Dimensions](https://en.wikipedia.org/wiki/Table_tennis#Equipment)
- [Physics of Ping Pong](https://www.real-world-physics-problems.com/physics-of-ping-pong.html)
