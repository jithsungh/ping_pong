import { Game } from './game';
import { WebSocketServer } from './websocket';
import type { GamePhase, Score } from '@paddlelink/shared';

// DOM Elements
const startScreen = document.getElementById('start-screen')!;
const gameScreen = document.getElementById('game-screen')!;
const gameOverOverlay = document.getElementById('game-over-overlay')!;
const roomCodeEl = document.getElementById('room-code')!;
const roomCodeSmallEl = document.getElementById('room-code-small')!;
const waitingStatusEl = document.getElementById('waiting-status')!;
const playerScoreEl = document.getElementById('player-score')!;
const opponentScoreEl = document.getElementById('opponent-score')!;
const gameStatusEl = document.getElementById('game-status')!;
const connectionInfoEl = document.getElementById('connection-info')!;
const winnerTextEl = document.getElementById('winner-text')!;
const finalScoreEl = document.getElementById('final-score')!;
const rematchBtn = document.getElementById('rematch-btn')!;
const gameCanvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// Game instance
let game: Game | null = null;
const wsServer = new WebSocketServer();

// ========================================
// Screen Management
// ========================================

function showStartScreen(): void {
  startScreen.style.display = 'block';
  gameScreen.classList.remove('active');
  gameOverOverlay.classList.remove('active');
}

function showGameScreen(): void {
  startScreen.style.display = 'none';
  gameScreen.classList.add('active');
  gameOverOverlay.classList.remove('active');
}

function showGameOver(winner: 'player' | 'opponent', score: Score): void {
  gameOverOverlay.classList.add('active');
  winnerTextEl.textContent = winner === 'player' ? 'You Win!' : 'You Lose!';
  finalScoreEl.textContent = `${score.player} - ${score.opponent}`;
}

// ========================================
// Game Event Handlers
// ========================================

function handleScoreChange(score: Score): void {
  playerScoreEl.textContent = String(score.player);
  opponentScoreEl.textContent = String(score.opponent);
}

function handlePhaseChange(phase: GamePhase): void {
  const statusMap: Record<GamePhase, string> = {
    waiting: 'Waiting for player...',
    serving: 'Swing to serve!',
    playing: 'Playing',
    point: 'Point!',
    gameOver: 'Game Over',
  };
  gameStatusEl.textContent = statusMap[phase];
}

function handleGameOver(winner: 'player' | 'opponent', score: Score): void {
  showGameOver(winner, score);
}

// ========================================
// WebSocket Handlers
// ========================================

function handleConnectionStateChange(state: string): void {
  const statusMap: Record<string, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    waiting: 'Waiting for paddle to connect...',
    connected: 'Paddle connected!',
  };
  
  waitingStatusEl.textContent = statusMap[state] || state;
  connectionInfoEl.textContent = statusMap[state] || state;
  
  if (state === 'waiting') {
    waitingStatusEl.classList.remove('connected');
  }
  
  if (state === 'connected') {
    waitingStatusEl.classList.add('connected');
    
    // Start game after brief delay
    setTimeout(() => {
      showGameScreen();
      if (game) {
        game.start();
      }
    }, 1000);
  }
}

// ========================================
// Initialization
// ========================================

function init(): void {
  // Create game
  game = new Game(gameCanvas);
  game.setOnScoreChange(handleScoreChange);
  game.setOnPhaseChange(handlePhaseChange);
  game.setOnGameOver(handleGameOver);
  
  // Set up WebSocket callbacks
  wsServer.onStateChange(handleConnectionStateChange);
  wsServer.onSwing((swing) => {
    console.log('Swing received:', swing);
    game?.handlePlayerSwing(swing.speed, swing.angle, swing.spin);
  });
  
  // Connect to server
  wsServer.connect();
  
  // Display room code
  const roomCode = wsServer.getRoomCode();
  roomCodeEl.textContent = roomCode;
  roomCodeSmallEl.textContent = roomCode;
  
  // Rematch button
  rematchBtn.addEventListener('click', () => {
    gameOverOverlay.classList.remove('active');
    game?.start();
  });
  
  // Keyboard controls for testing (without phone)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      // Simulate swing
      const speed = 0.5 + Math.random() * 0.3;
      const angle = (Math.random() - 0.5) * 30;
      game?.handlePlayerSwing(speed, angle, 0);
    }
  });
  
  // Show start screen
  showStartScreen();
  
  console.log('PaddleLink Desktop initialized');
  console.log('Room code:', roomCode);
  console.log('Press SPACE to simulate swing (for testing)');
}

// Start
init();
