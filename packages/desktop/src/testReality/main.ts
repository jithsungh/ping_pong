import { RoomScene } from './RoomScene';
import { NETWORK, ROOM } from '@paddlelink/shared';
import type { OrientationMessage, PoseMessage } from '@paddlelink/shared';

// ========================================
// DOM elements
// ========================================
const canvas = document.getElementById('room-canvas') as HTMLCanvasElement;
const roomCodeEl = document.getElementById('room-code')!;
const waitingEl = document.getElementById('waiting-status')!;
const alphaEl = document.getElementById('val-alpha')!;
const betaEl = document.getElementById('val-beta')!;
const gammaEl = document.getElementById('val-gamma')!;
const accelXEl = document.getElementById('val-ax')!;
const accelYEl = document.getElementById('val-ay')!;
const accelZEl = document.getElementById('val-az')!;
const fpsEl = document.getElementById('val-fps')!;
const msgCountEl = document.getElementById('val-msgs')!;
const statusDot = document.getElementById('status-dot')!;
const statusText = document.getElementById('status-text')!;

// ========================================
// State
// ========================================
let ws: WebSocket | null = null;
let roomCode = '';
let msgCount = 0;
let lastFrameTime = performance.now();
let frameTimes: number[] = [];

// ========================================
// 3D Scene
// ========================================
const roomScene = new RoomScene(canvas);

// ========================================
// WebSocket
// ========================================

function getServerUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || window.location.hostname;
  const port = import.meta.env.VITE_WS_PORT || NETWORK.DEFAULT_PORT;
  return `${protocol}//${host}:${port}`;
}

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM.CODE_LENGTH; i++) {
    code += ROOM.CODE_CHARS.charAt(Math.floor(Math.random() * ROOM.CODE_CHARS.length));
  }
  return code;
}

function setStatus(connected: boolean, text: string): void {
  statusDot.className = 'status-dot' + (connected ? ' connected' : '');
  statusText.textContent = text;
}

function connect(): void {
  // Re-use saved room code or generate new one
  const saved = sessionStorage.getItem('paddlelink_test_room');
  roomCode = saved || generateRoomCode();
  sessionStorage.setItem('paddlelink_test_room', roomCode);
  roomCodeEl.textContent = roomCode;

  const url = getServerUrl();
  console.log('[TestReality] Connecting to:', url);
  setStatus(false, 'Connecting...');

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[TestReality] WS connected');
    setStatus(false, 'Waiting for phone...');
    waitingEl.textContent = 'Open PaddleLink on iPhone and enter the room code';

    // Join room as display
    ws!.send(JSON.stringify({
      type: 'join',
      roomCode,
      playerType: 'display',
    }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'connected') {
        setStatus(true, 'Phone connected!');
        waitingEl.textContent = 'Receiving sensor data \u2014 move your phone!';
        waitingEl.classList.add('connected');
      } else if (msg.type === 'waiting') {
        setStatus(false, 'Waiting for phone...');
      } else if (msg.type === 'opponentDisconnected') {
        setStatus(false, 'Phone disconnected');
        waitingEl.textContent = 'Phone disconnected \u2014 reconnect to continue';
        waitingEl.classList.remove('connected');
      } else if (msg.type === 'orientation') {
        handleOrientation(msg as OrientationMessage);
      } else if (msg.type === 'pose') {
        handlePose(msg as PoseMessage);
      }
    } catch (e) {
      console.error('[TestReality] Parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('[TestReality] WS closed, reconnecting...');
    setStatus(false, 'Reconnecting...');
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    console.error('[TestReality] WS error');
  };
}

function handleOrientation(msg: OrientationMessage): void {
  msgCount++;
  roomScene.updateOrientation({
    alpha: msg.alpha,
    beta: msg.beta,
    gamma: msg.gamma,
    accel: msg.accel,
  });
}

function handlePose(msg: PoseMessage): void {
  msgCount++;
  roomScene.updatePose(msg.q);
}

// ========================================
// Render / HUD loop
// ========================================

function updateHUD(): void {
  const debug = roomScene.getDebugData();
  alphaEl.textContent = debug.alpha.toFixed(1) + '\u00B0';
  betaEl.textContent = debug.beta.toFixed(1) + '\u00B0';
  gammaEl.textContent = debug.gamma.toFixed(1) + '\u00B0';
  accelXEl.textContent = debug.accel.x.toFixed(2);
  accelYEl.textContent = debug.accel.y.toFixed(2);
  accelZEl.textContent = debug.accel.z.toFixed(2);
  msgCountEl.textContent = String(msgCount);

  // FPS
  const now = performance.now();
  frameTimes.push(now - lastFrameTime);
  if (frameTimes.length > 60) frameTimes.shift();
  lastFrameTime = now;
  const avgMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  fpsEl.textContent = (1000 / avgMs).toFixed(0);
}

function animate(): void {
  requestAnimationFrame(animate);
  roomScene.render();
  updateHUD();
}

// ========================================
// Init
// ========================================

connect();
animate();

console.log('[TestReality] Initialized — room code:', roomCode);
