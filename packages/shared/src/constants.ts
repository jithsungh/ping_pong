// ========================================
// PHYSICS CONSTANTS
// ========================================

export const PHYSICS = {
  // Ball speed limits
  BALL_MIN_SPEED: 0.3,
  BALL_MAX_SPEED: 1.2,
  BALL_DEFAULT_SPEED: 0.6,
  
  // Ball physics
  BALL_GRAVITY: 0.001,      // Pull toward net (center)
  BALL_FRICTION: 0.999,     // Slight slowdown per frame
  BALL_BOUNCE_DAMPING: 0.9, // Energy loss on wall bounce
  
  // Hit mechanics
  HIT_ZONE_HEIGHT: 0.15,    // Height of hit zone (from edge)
  HIT_WINDOW_MS: 400,       // Time window to hit (ms)
  HIT_COOLDOWN_MS: 300,     // Minimum time between hits
  
  // Speed multipliers
  SWING_SPEED_MULTIPLIER: 1.5,
  ANGLE_INFLUENCE: 0.5,     // How much swing angle affects direction
  SPIN_CURVE_FACTOR: 0.3,   // How much spin curves the ball
} as const;

// ========================================
// GAME RULES
// ========================================

export const RULES = {
  POINTS_TO_WIN: 11,
  WIN_BY: 2,               // Must win by 2 points
  SERVE_SWITCH_POINTS: 2,  // Switch server every N points
  POINT_PAUSE_MS: 1500,    // Pause after point scored
} as const;

// ========================================
// SENSOR THRESHOLDS (Mobile)
// ========================================

export const SENSOR = {
  // Swing detection
  ACCELERATION_THRESHOLD: 12,   // m/s², minimum to detect swing
  ACCELERATION_MAX: 30,         // m/s², cap for normalization
  
  // Cooldowns
  SWING_COOLDOWN_MS: 300,       // Minimum between swings
  
  // Calibration
  CALIBRATION_SAMPLES: 30,      // Samples for calibration average
  
  // Smoothing
  SMOOTHING_FACTOR: 0.3,        // Low-pass filter strength (0-1)
} as const;

// ========================================
// NETWORK
// ========================================

export const NETWORK = {
  DEFAULT_PORT: 3000,
  HEARTBEAT_INTERVAL_MS: 5000,
  RECONNECT_DELAY_MS: 1000,
  RECONNECT_MAX_ATTEMPTS: 5,
  GAME_STATE_BROADCAST_MS: 16,  // ~60 FPS state updates
} as const;

// ========================================
// RENDERING
// ========================================

export const RENDER = {
  // Table dimensions (aspect ratio)
  TABLE_ASPECT_RATIO: 9 / 16,  // Vertical orientation
  
  // Colors
  COLOR_TABLE: '#1B5E20',       // Dark green
  COLOR_LINE: '#FFFFFF',
  COLOR_BALL: '#FF6F00',        // Orange
  COLOR_HIT_ZONE: 'rgba(76, 175, 80, 0.3)',
  COLOR_HIT_ZONE_ACTIVE: 'rgba(76, 175, 80, 0.6)',
  
  // Ball size (relative to table width)
  BALL_RADIUS: 0.025,
  
  // Line width
  LINE_WIDTH: 2,
  NET_WIDTH: 4,
} as const;

// ========================================
// ROOM CODES
// ========================================

export const ROOM = {
  CODE_LENGTH: 4,
  CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // No confusing chars
} as const;
