# PaddleLink Ping Pong

Motion-controlled table tennis game where your phone becomes the paddle.

## How It Works

1. **Desktop/TV** displays the game (table, ball, opponent)
2. **Phone** acts as your paddle using motion sensors
3. Swing your phone to hit the ball!

## Quick Start

### Prerequisites

- Node.js 18+
- A phone with motion sensors (any modern smartphone)
- Both devices on the same WiFi network

### Installation

```bash
# Install dependencies
npm install

# Build shared package first
npm run build -w @paddlelink/shared
```

### Running the Game

Open 3 terminals:

```bash
# Terminal 1: Start WebSocket server
npm run dev:server

# Terminal 2: Start desktop game
npm run dev:desktop

# Terminal 3: Start mobile PWA
npm run dev:mobile
```

### Connecting

1. Open `http://localhost:5174` on your laptop/TV — this shows the game
2. Note the 4-letter room code displayed
3. On your phone, open `http://<your-laptop-ip>:5173`
4. Enter the room code and tap "Connect"
5. Swing your phone to play!

**Finding your laptop IP:**
```bash
# Linux/Mac
hostname -I | awk '{print $1}'

# Or check network settings
```

## Controls

- **Swing forward**: Hit the ball
- **Tilt left/right**: Aim direction
- **Wrist twist**: Add spin (coming soon)

**Keyboard (testing):** Press SPACE to simulate a swing

## Project Structure

```
packages/
├── shared/     # Shared types and constants
├── mobile/     # Phone PWA (paddle controller)
├── desktop/    # Browser game (table display)
└── server/     # WebSocket server (connects them)
```

## Tech Stack

- **TypeScript** across all packages
- **Vite** for mobile + desktop apps
- **HTML Canvas** for rendering
- **WebSocket** for real-time communication
- **DeviceMotion API** for phone sensors

## Development

```bash
# Run all services at once
npm run dev

# Build for production
npm run build
```

## Troubleshooting

### Motion sensors not working on iPhone

iOS requires HTTPS for sensor access. For local development:
1. Use `ngrok` or similar to get HTTPS URL
2. Or test on Android Chrome which works over HTTP

### Can't connect phone to game

1. Ensure both devices are on same WiFi
2. Check firewall allows port 3000 (server), 5173 (mobile), 5174 (desktop)
3. Use laptop's actual IP, not `localhost`

### High latency

- Ensure good WiFi signal
- Close other apps using network
- Try moving closer to router

## Deployment

### Architecture

Vercel doesn't support persistent WebSocket connections, so we deploy to multiple services:

| Service | Platform | Why |
|---------|----------|-----|
| Mobile PWA | Vercel | Static site |
| Desktop Game | Vercel | Static site |
| WebSocket Server | Railway/Render | Persistent connections |

### Step 1: Deploy WebSocket Server (Railway)

1. Create account at [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub repo
3. Set root directory to `/` (monorepo root)
4. Railway will auto-detect the Dockerfile at `packages/server/Dockerfile`
5. Copy the deployed URL (e.g., `your-app.railway.app`)

### Step 2: Deploy Frontends (Vercel)

**Mobile PWA:**
```bash
cd packages/mobile
vercel --prod
```

When prompted, set environment variable:
```
VITE_WS_URL=wss://your-app.railway.app
```

**Desktop Game:**
```bash
cd packages/desktop
vercel --prod
```

Set the same `VITE_WS_URL` environment variable.

### Alternative: Deploy to Vercel Dashboard

1. Import GitHub repo to Vercel
2. Create two projects (one for mobile, one for desktop)
3. For each project:
   - Set **Root Directory** to `packages/mobile` or `packages/desktop`
   - Add **Environment Variable**: `VITE_WS_URL=wss://your-server.railway.app`
   - Build command: `cd ../.. && npm install && npm run build -w @paddlelink/shared && npm run build -w @paddlelink/mobile`

### Environment Variables

| Variable | Value | Where |
|----------|-------|-------|
| `VITE_WS_URL` | `wss://your-server.railway.app` | Vercel (mobile & desktop) |
| `PORT` | `3000` (auto-set) | Railway |

## License

MIT

