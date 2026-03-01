Perfect — this is a **serious, buildable idea**, and I’ll treat it like a **real PRD you could hand to GitHub Copilot / AI agents and start executing**.

Below is a **FULL PRODUCT REQUIREMENTS DOCUMENT**, followed by **architecture**, **implementation details**, and **phase-wise steps** written in a way that works extremely well with **GitHub Copilot (Opus 4.5)** or similar coding agents.

No prior game-dev knowledge assumed.

---

# 📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Product Name (Working)

**PaddleLink Ping Pong**

---

## 1. Product Vision

Create a **physical, motion-controlled table tennis game** where:

* The **laptop / TV displays**:

  * The table
  * Ball physics
  * Opponent
* The **mobile phone acts as a paddle** using motion sensors
* Gameplay feels **fast, physical, and social**
* No VR headset, no console — just phone + screen

---

## 2. Target Users

* Casual gamers
* College students / tech demos
* Party & social gaming
* Fitness-lite players (short active sessions)

---

## 3. Key Differentiators

* Physical motion using phone sensors
* Large shared screen experience
* No special hardware required
* Easy to learn, hard to master
* Not just another touchscreen game

---

## 4. Platform Scope (MVP)

### Required

* 📱 Android phone (sensor support)
* 💻 Laptop OR TV (via browser or desktop app)
* 🌐 Local Wi-Fi network

### Optional (later)

* iOS
* Internet multiplayer
* Video opponent view

---

## 5. Core Gameplay Loop

1. Player swings phone
2. Phone detects swing + orientation
3. Data sent to laptop
4. Laptop checks hit timing
5. Ball trajectory updated
6. Score updated
7. Repeat

---

## 6. Functional Requirements

### 6.1 Mobile App (Paddle Controller)

**Inputs**

* Accelerometer
* Gyroscope
* Touch input (optional)

**Responsibilities**

* Detect swing gesture
* Calculate:

  * Swing speed
  * Swing angle
  * Paddle orientation
* Send data packets to laptop

**Constraints**

* Low latency
* No heavy UI
* Battery efficient

---

### 6.2 Laptop / TV App (Game Engine)

**Responsibilities**

* Render table and ball
* Run game loop
* Apply ball physics
* Handle scoring
* Show opponent (AI or remote)

---

### 6.3 Networking

**Requirements**

* Latency < 50 ms (local)
* Reliable packet delivery
* Simple protocol

---

## 7. Non-Functional Requirements

* Easy setup (< 30 seconds)
* Works on mid-range devices
* Graceful handling of packet loss
* Simple calibration

---

# 🧠 SYSTEM ARCHITECTURE

```
[ Mobile Phone ]
  - Sensor Reader
  - Gesture Detector
  - Data Sender
        |
        | WebSocket / UDP
        |
[ Laptop / TV ]
  - Game Loop
  - Physics Engine
  - Renderer
  - Scoring System
```

---

# 🛠️ TECH STACK (Beginner + AI-Friendly)

### Mobile

* Platform: Android
* Language: Kotlin
* Sensors: SensorManager
* Networking: WebSocket

### Laptop / TV

* Platform: Browser (recommended)
* Language: JavaScript / TypeScript
* Engine: Canvas / simple 2D loop
* Networking: WebSocket Server

> ⚠️ Avoid heavy 3D engines initially

---

# 🎮 GAME MECHANICS (IMPORTANT)

## 1. Hit Detection (KEY DESIGN)

No real collision detection.

Instead:

* Define a **“hit zone”** near the paddle
* If swing occurs while ball is inside zone → HIT
* Else → MISS

This makes gameplay stable and predictable.

---

## 2. Swing Detection Algorithm (Mobile)

### Signals Used

* Linear acceleration magnitude
* Gyroscope rotation

### Detection Logic

```
if acceleration_peak > THRESHOLD
  and forward_direction
  and cooldown_passed
then
  swing_detected
```

### Data Packet Sent

```json
{
  "speed": 0.82,
  "angle": -15,
  "spin": 0.2,
  "timestamp": 12345678
}
```

---

## 3. Ball Physics (Laptop)

Simplified physics (NOT real-world):

* Constant gravity
* Elastic bounce
* Spin affects horizontal drift

This keeps gameplay fun, not chaotic.

---

# 📦 PHASE-WISE IMPLEMENTATION PLAN

This is **exactly how you should proceed with Copilot**.

---

## 🟢 PHASE 0 — Repo Setup

**Goal:** Empty project boots correctly

**Tasks**

* Create GitHub repo
* Two folders:

  * `/mobile`
  * `/desktop`

**Copilot Prompt**

> “Create a basic Android app that logs accelerometer data to the screen.”

---

## 🟢 PHASE 1 — Mobile Sensor Prototype

**Goal:** Detect swings

**Deliverables**

* Live sensor values
* Swing detected indicator
* Speed number

**Copilot Prompts**

* “Implement accelerometer + gyroscope listener”
* “Detect acceleration spike for swing gesture”
* “Add cooldown to avoid double detection”

✅ No networking yet

---

## 🟢 PHASE 2 — Desktop Table Simulation

**Goal:** Visual game world

**Deliverables**

* 2D table
* Ball moving automatically
* Bounce off walls

**Copilot Prompts**

* “Create HTML canvas ping pong table”
* “Implement basic game loop with requestAnimationFrame”
* “Add simple ball physics”

---

## 🟢 PHASE 3 — Networking (Critical Phase)

**Goal:** Phone talks to laptop

**Deliverables**

* WebSocket server
* Phone sends dummy hit data
* Desktop logs received data

**Copilot Prompts**

* “Create WebSocket server in Node.js”
* “Send JSON packets from Android to WebSocket”
* “Handle reconnect logic”

---

## 🟢 PHASE 4 — Hit Integration

**Goal:** Swing affects ball

**Deliverables**

* Hit zone logic
* Ball direction changes on swing
* Miss detection

**Copilot Prompts**

* “Apply impulse to ball velocity based on input”
* “Implement hit window timing”
* “Clamp velocity to max speed”

---

## 🟢 PHASE 5 — Gameplay Polish

**Goal:** Make it FUN

**Add**

* Sound effects
* Visual feedback
* Scoring
* Difficulty ramp

**Copilot Prompts**

* “Add score counter UI”
* “Add hit/miss sound effects”
* “Add AI opponent movement”

---

## 🟡 PHASE 6 — Optional Enhancements

* Spin via wrist twist
* Online multiplayer
* Calibration screen
* Paddle skins

---

# ⚠️ COMMON PITFALLS (READ THIS)

❌ Trying real physics
❌ Starting with multiplayer
❌ Over-smoothing sensors
❌ Overengineering networking
❌ Ignoring latency compensation

---

# 🧠 HOW TO USE COPILOT EFFECTIVELY

### DO

* Ask for **small components**
* Paste errors directly
* Iterate fast

### DON’T

* Ask for “entire game”
* Trust first output blindly
* Skip manual testing

---

# 🏁 FINAL VERDICT

✅ **Yes, this is absolutely buildable**
✅ **AI agents are perfect for this**
✅ **Great college project or MVP**
✅ **Technically impressive but realistic**

