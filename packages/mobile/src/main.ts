import { SensorManager } from './sensors';
import { WebSocketManager } from './websocket';
import type { SensorData, SwingDetection } from '@paddlelink/shared';

// DOM Elements
const permissionScreen = document.getElementById('permission-screen')!;
const connectScreen = document.getElementById('connect-screen')!;
const gameScreen = document.getElementById('game-screen')!;
const requestPermissionBtn = document.getElementById('request-permission')!;
const roomCodeInput = document.getElementById('room-code') as HTMLInputElement;
const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn')!;
const calibrateBtn = document.getElementById('calibrate-btn')!;
const disconnectBtn = document.getElementById('disconnect-btn')!;
const statusDot = document.getElementById('status-dot')!;
const statusText = document.getElementById('status-text')!;
const swingIndicator = document.getElementById('swing-indicator')!;
const accelValue = document.getElementById('accel-value')!;
const speedValue = document.getElementById('speed-value')!;
const angleValue = document.getElementById('angle-value')!;
const swingCountEl = document.getElementById('swing-count')!;

// Managers
const sensorManager = new SensorManager();
const wsManager = new WebSocketManager();

// State
let swingIndicatorTimeout: number | null = null;

// ========================================
// Screen Navigation
// ========================================

function showScreen(screen: 'permission' | 'connect' | 'game'): void {
  permissionScreen.classList.add('hidden');
  connectScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  
  switch (screen) {
    case 'permission':
      permissionScreen.classList.remove('hidden');
      break;
    case 'connect':
      connectScreen.classList.remove('hidden');
      break;
    case 'game':
      gameScreen.classList.remove('hidden');
      break;
  }
}

// ========================================
// Sensor Handling
// ========================================

function handleSensorUpdate(data: SensorData): void {
  const magnitude = Math.sqrt(
    data.acceleration.x ** 2 +
    data.acceleration.y ** 2 +
    data.acceleration.z ** 2
  );
  
  accelValue.textContent = magnitude.toFixed(1);
  swingCountEl.textContent = String(sensorManager.getSwingCount());
}

function handleSwing(swing: SwingDetection): void {
  console.log('Swing detected:', swing);
  
  // Update UI
  speedValue.textContent = swing.speed.toFixed(2);
  angleValue.textContent = `${swing.angle.toFixed(0)}°`;
  swingCountEl.textContent = String(sensorManager.getSwingCount());
  
  // Flash indicator
  swingIndicator.textContent = 'SWING!';
  swingIndicator.classList.add('swing-detected');
  
  if (swingIndicatorTimeout) {
    clearTimeout(swingIndicatorTimeout);
  }
  
  swingIndicatorTimeout = window.setTimeout(() => {
    swingIndicator.textContent = 'READY';
    swingIndicator.classList.remove('swing-detected');
  }, 200);
  
  // Send to server
  wsManager.sendSwing(swing.speed, swing.angle, swing.spin);
}

// ========================================
// Connection Handling
// ========================================

function updateConnectionStatus(state: string, message?: string): void {
  statusText.textContent = message || state;
  
  if (state === 'connected' || state === 'ready') {
    statusDot.classList.add('connected');
  } else {
    statusDot.classList.remove('connected');
  }
}

// ========================================
// Event Handlers
// ========================================

async function handlePermissionRequest(): Promise<void> {
  if (!SensorManager.isSupported()) {
    alert('Motion sensors are not supported on this device.');
    return;
  }
  
  const granted = await sensorManager.requestPermission();
  
  if (granted) {
    showScreen('connect');
    sensorManager.start();
    sensorManager.onSensorUpdate(handleSensorUpdate);
    sensorManager.onSwing(handleSwing);
  } else {
    alert('Motion permission denied. Please enable in device settings.');
  }
}

function handleConnect(): void {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  const serverUrl = serverUrlInput.value.trim();
  
  if (roomCode.length !== 4) {
    alert('Please enter a 4-character room code');
    return;
  }
  
  // Blur inputs to prevent shake-to-undo on form history
  roomCodeInput.blur();
  serverUrlInput.blur();
  
  // Set server URL if provided
  if (serverUrl) {
    wsManager.setServerUrl(serverUrl);
  }
  
  wsManager.connect(roomCode);
  showScreen('game');
}

function handleDisconnect(): void {
  wsManager.disconnect();
  showScreen('connect');
}

function handleCalibrate(): void {
  sensorManager.calibrate();
  calibrateBtn.textContent = 'Calibrated!';
  setTimeout(() => {
    calibrateBtn.textContent = 'Calibrate (Hold Flat)';
  }, 1000);
}

// ========================================
// Initialization
// ========================================

function init(): void {
  // Set up WebSocket callbacks
  wsManager.onStateChange(updateConnectionStatus);
  
  // Set up event listeners
  requestPermissionBtn.addEventListener('click', handlePermissionRequest);
  connectBtn.addEventListener('click', handleConnect);
  disconnectBtn.addEventListener('click', handleDisconnect);
  calibrateBtn.addEventListener('click', handleCalibrate);
  
  // Auto-uppercase room code
  roomCodeInput.addEventListener('input', () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase();
  });
  
  // Check if we need permission or can start directly
  // On Android/desktop, permission is usually not required
  if (typeof (DeviceMotionEvent as any).requestPermission !== 'function') {
    // No permission needed, start sensors and show connect screen
    showScreen('connect');
    sensorManager.start();
    sensorManager.onSensorUpdate(handleSensorUpdate);
    sensorManager.onSwing(handleSwing);
  } else {
    // iOS - show permission screen
    showScreen('permission');
  }
  
  // Prevent bounce scrolling on iOS
  document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
  
  // Disable iOS Shake to Undo
  // 1. Prevent undo/redo input events
  document.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
      e.preventDefault();
    }
  });
  
  // 2. Clear any undo history on window focus
  window.addEventListener('focus', () => {
    // Clear selection to reset undo stack
    window.getSelection()?.removeAllRanges();
  });
  
  // 3. Blur any focused input to prevent undo on form elements
  document.addEventListener('visibilitychange', () => {
    if (document.activeElement instanceof HTMLInputElement) {
      document.activeElement.blur();
    }
  });
  
  console.log('PaddleLink Mobile initialized');
}

// Start app
init();
