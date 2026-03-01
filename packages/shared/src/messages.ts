// ========================================
// MESSAGE TYPES - Communication Protocol
// ========================================

/** Client -> Server: Join a game room */
export interface JoinMessage {
  type: 'join';
  roomCode: string;
  playerType: 'paddle' | 'display';
}

/** Client -> Server: Player swing detected */
export interface SwingMessage {
  type: 'swing';
  speed: number;      // 0-1 normalized swing speed
  angle: number;      // -45 to 45 degrees, horizontal direction
  spin: number;       // -1 to 1, topspin/backspin
  timestamp: number;  // Performance.now() on client
}

/** Server -> Client: Full game state update */
export interface GameStateMessage {
  type: 'gameState';
  ball: BallState;
  score: Score;
  phase: GamePhase;
  canHit: boolean;  // True when ball is in player's hit zone
}

/** Server -> Client: Connection status */
export interface ConnectionMessage {
  type: 'connected' | 'waiting' | 'roomFull' | 'opponentDisconnected';
  roomCode?: string;
}

/** Server -> Client: Point scored */
export interface PointMessage {
  type: 'point';
  scorer: 'player' | 'opponent';
  score: Score;
}

/** Server -> Client: Game over */
export interface GameOverMessage {
  type: 'gameOver';
  winner: 'player' | 'opponent';
  finalScore: Score;
}

/** Client -> Server: Request new game */
export interface RematchMessage {
  type: 'rematch';
}

// Union type for all messages
export type ClientMessage = JoinMessage | SwingMessage | RematchMessage;
export type ServerMessage = GameStateMessage | ConnectionMessage | PointMessage | GameOverMessage;
export type Message = ClientMessage | ServerMessage;

// ========================================
// GAME STATE TYPES
// ========================================

export interface BallState {
  x: number;       // 0-1 normalized, left to right
  y: number;       // 0-1 normalized, player side to opponent side
  vx: number;      // Velocity x component
  vy: number;      // Velocity y component
  visible: boolean;
}

export interface Score {
  player: number;
  opponent: number;
}

export type GamePhase = 
  | 'waiting'      // Waiting for players
  | 'serving'      // Player about to serve
  | 'playing'      // Ball in play
  | 'point'        // Point just scored, brief pause
  | 'gameOver';    // Match finished

// ========================================
// SENSOR DATA TYPES (Mobile)
// ========================================

export interface SensorData {
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    alpha: number;  // Z-axis rotation (0-360)
    beta: number;   // X-axis rotation (-180 to 180)
    gamma: number;  // Y-axis rotation (-90 to 90)
  };
  timestamp: number;
}

export interface SwingDetection {
  detected: boolean;
  speed: number;
  angle: number;
  spin: number;
}
