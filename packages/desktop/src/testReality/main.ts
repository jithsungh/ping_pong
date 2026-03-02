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
const calibrationOverlay = document.getElementById('calibration-overlay')!;
const calibrationStatus = document.getElementById('calibration-status')!;
const calibrationIcon = document.getElementById('calibration-icon')!;
const desktopCalibrateBtn = document.getElementById('desktop-calibrate-btn') as HTMLButtonElement;
const overlayCalibrateBtn = document.getElementById('overlay-calibrate-btn') as HTMLButtonElement;
const overlayHint = document.getElementById('overlay-hint')!;
const debugLogEl = document.getElementById('debug-log')!;

// ========================================
// State
// ========================================
let ws: WebSocket | null = null;
let roomCode = '';
let msgCount = 0;
let dataReceived = false;
let lastFrameTime = performance.now();
let frameTimes: number[] = [];

// ========================================
// 3D Scene
// ========================================
const roomScene = new RoomScene(canvas);

// ========================================
// Debug logging
// ========================================
function debugLog(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = document.createElement('div');
  line.className = level === 'error' ? 'log-error' : level === 'warn' ? 'log-warn' : 'log-info';
  line.textContent = `[${time}] ${msg}`;
  debugLogEl.appendChild(line);
  while (debugLogEl.children.length > 30) debugLogEl.removeChild(debugLogEl.firstChild!);
  debugLogEl.scrollTop = debugLogEl.scrollHeight;
  console.log(`[TestReality] ${msg}`);
}

// ========================================
// Calibrate helpers
// ========================================
function showCalibrateButtons(): void {
  desktopCalibrateBtn.disabled = false;
  overlayCalibrateBtn.classList.add('visible');
  overlayHint.classList.add('visible');
}

function hideCalibrateButtons(): void {
  desktopCalibrateBtn.disabled = true;
  overlayCalibrateBtn.classList.remove('visible');
  overlayHint.classList.remove('visible');
}

// ========================================
// WebSocket
// ========================================

function getServerUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (window.location.hostname.includes('railway.app')) {
    return 'wss://paddlelinkserver-production.up.railway.app';
  }
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
  const savedGame = sessionStorage.getItem('paddlelink_room');
  const savedTest = sessionStorage.getItem('paddlelink_test_room');
  roomCode = savedGame || savedTest || generateRoomCode();
  sessionStorage.setItem('paddlelink_test_room', roomCode);
  roomCodeEl.textContent = roomCode;

  const url = getServerUrl();
  debugLog(`Connecting to ${url}...`);
  setStatus(false, 'Connecting...');

  ws = new WebSocket(url);

  ws.onopen = () => {
    debugLog(`WS opened, joining room ${roomCode} as display`);
    setStatus(false, 'Waiting for phone...');
    waitingEl.textContent = 'Open PaddleLink on iPhone and enter the room code';

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
        debugLog('Phone connected! Waiting for calibration...');
        setStatus(true, 'Phone connected!');
        calibrationStatus.textContent = 'Phone connected! Place it flat, screen up, then tap Calibrate — or click the button below.';
        calibrationIcon.textContent = '📱';
        waitingEl.textContent = 'Waiting for calibration...';
        waitingEl.classList.add('connected');
        // Show calibrate buttons immediately on connect
        showCalibrateButtons();
      } else if (msg.type === 'waiting') {
        debugLog('Server says: waiting for phone');
        setStatus(false, 'Waiting for phone...');
        calibrationStatus.textContent = 'Waiting for phone to connect...';
        calibrationIcon.textContent = '📡';
        hideCalibrateButtons();
      } else if (msg.type === 'opponentDisconnected') {
        debugLog('Phone disconnected!', 'warn');
        setStatus(false, 'Phone disconnected');
        waitingEl.textContent = 'Phone disconnected — reconnect to continue';
        waitingEl.classList.remove('connected');
        calibrationOverlay.classList.remove('hidden');
        calibrationStatus.textContent = 'Phone disconnected. Reconnect to continue.';
        calibrationIcon.textContent = '❌';
        hideCalibrateButtons();
        dataReceived = false;
      } else if (msg.type === 'calibrate') {
        debugLog('✓ Calibrate message received from phone!');
        handleCalibrate();
      } else if (msg.type === 'orientation') {
        if (!dataReceived) {
          dataReceived = true;
          debugLog(`First orientation: α=${msg.alpha?.toFixed(1)} β=${msg.beta?.toFixed(1)} γ=${msg.gamma?.toFixed(1)}`);
          showCalibrateButtons();
        }
        handleOrientation(msg as OrientationMessage);
      } else if (msg.type === 'pose') {
        if (!dataReceived) {
          dataReceived = true;
          debugLog('First pose data received');
          showCalibrateButtons();
        }
        handlePose(msg as PoseMessage);
      } else {
        debugLog(`Unknown msg type: ${msg.type}`, 'warn');
      }
    } catch (e) {
      debugLog(`Parse error: ${e}`, 'error');
    }
  };

  ws.onclose = () => {
    debugLog('WS closed, reconnecting in 2s...', 'warn');
    setStatus(false, 'Reconnecting...');
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    debugLog('WS error!', 'error');
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

function handleCalibrate(): void {
  debugLog('✓ Calibrating now!');
  roomScene.calibrate();
  calibrationOverlay.classList.add('hidden');
  waitingEl.textContent = 'Calibrated! Move your phone — the 3D model mirrors it.';
  desktopCalibrateBtn.textContent = '✅ Calibrated — Re-calibrate';
}

// Manual calibrate buttons (side panel + overlay)
desktopCalibrateBtn.addEventListener('click', () => {
  debugLog('Manual calibrate clicked (side panel)');
  handleCalibrate();
});
overlayCalibrateBtn.addEventListener('click', () => {
  debugLog('Manual calibrate clicked (overlay)');
  handleCalibrate();
});

// ========================================
// Render / HUD loop
// ========================================

function updateHUD(): void {
  const debug = roomScene.getDebugData();
  alphaEl.textContent = debug.alpha.toFixed(1) + '°';
  betaEl.textContent = debug.beta.toFixed(1) + '°';
  gammaEl.textContent = debug.gamma.toFixed(1) + '°';
  accelXEl.textContent = debug.accel.x.toFixed(2);
  accelYEl.textContent = debug.accel.y.toFixed(2);
  accelZEl.textContent = debug.accel.z.toFixed(2);
  msgCountEl.textContent = String(msgCount);

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

debugLog(`Room code: ${roomCode}`);
debugLog('Waiting for WebSocket connection...');
