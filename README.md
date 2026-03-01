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

## Deployment (Railway)

Deploy all 3 services to Railway for free.

### Quick Setup

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. Create new **Project**
3. Add **3 services** from the same GitHub repo

### Service 1: WebSocket Server (Deploy First!)

1. **New Service** → **GitHub Repo** → Select `ping_pong`
2. Go to **Settings** tab → **Build** section:
   - **Builder**: Select **Dockerfile** (IMPORTANT - don't use Nixpacks)
   - **Dockerfile Path**: `packages/server/Dockerfile`
   - **Root Directory**: Leave empty (uses repo root)
3. Click **Deploy**
4. Once deployed, go to **Settings** → **Networking** → **Generate Domain**
5. Copy the URL (e.g., `paddlelink-server-production.up.railway.app`)

### Service 2: Desktop Game

1. **New Service** → **GitHub Repo** → Select `ping_pong`
2. Go to **Settings** tab → **Build** section:
   - **Builder**: Select **Dockerfile**
   - **Dockerfile Path**: `packages/desktop/Dockerfile`
   - **Root Directory**: Leave empty
3. Go to **Variables** tab → Add:
   ```
   VITE_WS_URL=wss://paddlelink-server-production.up.railway.app
   ```
   (Replace with YOUR server URL from Step 1)
4. Click **Deploy**
5. Generate domain in Settings → Networking

### Service 3: Mobile PWA

1. **New Service** → **GitHub Repo** → Select `ping_pong`
2. Go to **Settings** tab → **Build** section:
   - **Builder**: Select **Dockerfile**
   - **Dockerfile Path**: `packages/mobile/Dockerfile`
   - **Root Directory**: Leave empty
3. Go to **Variables** tab → Add:
   ```
   VITE_WS_URL=wss://paddlelink-server-production.up.railway.app
   ```
4. Click **Deploy**
5. Generate domain in Settings → Networking

### Troubleshooting Railway Deployment

**Build fails with "Cannot find module '@paddlelink/shared'":**
- This means Railway is using Nixpacks instead of Dockerfile
- Go to **Settings** → **Build** → Change **Builder** to **Dockerfile**
- Ensure **Dockerfile Path** is set correctly (e.g., `packages/server/Dockerfile`)

**Variables not working:**
- Add variables BEFORE deploying, or redeploy after adding them
- For `VITE_WS_URL`, use `wss://` prefix (not `https://`)

### Final URLs

After deployment, you'll have 3 URLs:

| Service | Example URL |
|---------|-------------|
| Server | `wss://paddlelink-server-xxx.up.railway.app` |
| Desktop | `https://paddlelink-desktop-xxx.up.railway.app` |
| Mobile | `https://paddlelink-mobile-xxx.up.railway.app` |

### Environment Variables

| Variable | Value | Services |
|----------|-------|----------|
| `VITE_WS_URL` | `wss://your-server.up.railway.app` | Desktop, Mobile |
| `PORT` | Auto-set by Railway | All |

## License

MIT


