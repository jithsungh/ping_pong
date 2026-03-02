/**
 * 3D Physics Engine for PaddleLink
 * 
 * Coordinate system:
 * - X: Left/Right (negative = left, positive = right)
 * - Y: Up/Down (height above floor)
 * - Z: Forward/Back (negative = opponent side, positive = player side)
 */

// Table dimensions in meters
const TABLE = {
  length: 2.74,    // Z axis extent
  width: 1.525,    // X axis extent
  height: 0.76,    // Y position of table surface
  netHeight: 0.1525
};

const BALL_RADIUS = 0.02;
const GRAVITY = 9.81;
const AIR_RESISTANCE = 0.006;          // Realistic air drag for 40mm ping pong ball
const BOUNCE_COEFFICIENT = 0.85;      // Slightly elastic table bounce
const SPIN_MAGNUS = 0.25;
const MIN_BOUNCE_VELOCITY = 0.25;     // Minimum velocity to bounce (prevents infinite small bounces)
const FRICTION_COEFFICIENT = 0.25;    // Table friction on bounce
const VELOCITY_DECAY_THRESHOLD = 0.15; // Below this, ball stops
const MAX_RALLY_TIME_MS = 30000;      // Maximum rally duration before forcing point end

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface BallState {
  position: Vector3;
  velocity: Vector3;
  spin: Vector3;
  visible: boolean;
}

export class Physics3D {
  private ball: BallState;
  private lastBounceTime = 0;
  private rallyStartTime = 0;           // Track when rally started
  private playerMissed = false;
  private opponentMissed = false;
  private netHit = false;
  private netHitBy: 'player' | 'opponent' | null = null; // Who hit ball into net
  private waitingForServe = true;       // Freeze physics until serve starts
  private lastHitter: 'player' | 'opponent' = 'player'; // Track who hit last
  
  // Ball offset from paddle during serve (ball sits in front of paddle face)
  private serveBallOffset = { x: 0, y: 0.05, z: -0.08 };
  
  // Collision callbacks for sound effects
  private onTableBounce: (() => void) | null = null;
  private onNetHit: (() => void) | null = null;
  private onOut: (() => void) | null = null;
  
  constructor() {
    this.ball = this.createInitialBall();
  }
  
  /**
   * Set callback for table bounce
   */
  setOnTableBounce(callback: () => void): void {
    this.onTableBounce = callback;
  }
  
  /**
   * Set callback for net hit
   */
  setOnNetHit(callback: () => void): void {
    this.onNetHit = callback;
  }
  
  /**
   * Set callback for ball out
   */
  setOnOut(callback: () => void): void {
    this.onOut = callback;
  }
  
  /**
   * Get time since last bounce (for timing calculations)
   */
  getTimeSinceLastBounce(): number {
    return performance.now() - this.lastBounceTime;
  }
  
  private createInitialBall(): BallState {
    return {
      position: { x: 0, y: TABLE.height + 0.3, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      spin: { x: 0, y: 0, z: 0 },
      visible: false
    };
  }
  
  /**
   * Update ball position to follow paddle during serve
   * Called every frame when waitingForServe is true
   */
  updateServeBallPosition(paddleX: number, paddleY: number, paddleZ: number): void {
    if (!this.waitingForServe || !this.ball.visible) return;
    
    // Ball sits in front of and slightly above the paddle
    this.ball.position.x = paddleX + this.serveBallOffset.x;
    this.ball.position.y = paddleY + this.serveBallOffset.y;
    this.ball.position.z = paddleZ + this.serveBallOffset.z;
  }
  
  /**
   * Check if we're in serve-wait mode
   */
  isWaitingForServe(): boolean {
    return this.waitingForServe;
  }
  
  /**
   * Reset ball for a new serve
   */
  resetForServe(server: 'player' | 'opponent'): void {
    this.ball.visible = true;
    this.playerMissed = false;
    this.opponentMissed = false;
    this.netHit = false;
    this.netHitBy = null;
    this.lastHitter = server;
    this.waitingForServe = true;  // Ball frozen until serve starts
    this.rallyStartTime = 0; // Reset rally timer
    
    // Position ball above server's side
    const zPos = server === 'player' 
      ? TABLE.length / 2 - 0.3  // Player side
      : -TABLE.length / 2 + 0.3; // Opponent side
    
    this.ball.position = {
      x: 0,
      y: TABLE.height + 0.3,
      z: zPos
    };
    
    this.ball.velocity = { x: 0, y: 0, z: 0 };
    this.ball.spin = { x: 0, y: 0, z: 0 };
  }
  
  /**
   * Start a serve with initial velocity
   * More realistic serve trajectory
   */
  startServe(server: 'player' | 'opponent'): void {
    this.waitingForServe = false;  // Physics now active
    this.rallyStartTime = performance.now(); // Start rally timer
    
    const direction = server === 'player' ? -1 : 1; // Player serves toward opponent (-Z)
    
    // Realistic serve: toss up, then forward with proper arc
    const serveSpeed = 4.5 + Math.random() * 0.8; // Fast enough to cross table
    const sideAngle = (Math.random() - 0.5) * 0.3; // Small random side angle
    
    this.ball.velocity = {
      x: sideAngle * serveSpeed * 0.2,
      y: 2.2 + Math.random() * 0.3, // Toss up with good arc over net
      z: direction * serveSpeed  // Forward motion
    };
    
    // Add spin to serve for realism
    this.ball.spin = {
      x: (Math.random() - 0.5) * 1.0,
      y: 0,
      z: direction * Math.random() * 0.5
    };
  }
  
  /**
   * Apply player hit to ball (legacy Euler-based)
   */
  applyPlayerHit(power: number, yaw: number, pitch: number, spin: number): void {
    // Start physics if this is a serve
    if (this.waitingForServe) {
      this.waitingForServe = false;
      this.rallyStartTime = performance.now();
    }
    this.lastHitter = 'player';
    
    // Intent-based mapping - tuned for realistic ping pong
    const POWER_SCALE = 7.0;       // Strong enough to cross the table
    const ANGLE_SCALE = 0.35;      // Directional control
    const LIFT_BASE = 2.5;         // Base upward velocity for proper arc over net
    const LIFT_SCALE = 1.0;        // How much pitch affects lift  
    const SPIN_SCALE = 1.5;
    
    // Clamp and scale power
    const shotPower = Math.min(1.0, Math.max(0.35, power)) * POWER_SCALE;
    
    // Direction: negative Z = toward opponent
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    
    // Calculate arc to ensure ball goes over net and lands on opponent's side
    const forwardSpeed = shotPower * 0.8; // Forward component
    const sideSpeed = Math.sin(yawRad) * shotPower * ANGLE_SCALE;
    const upSpeed = LIFT_BASE + Math.sin(pitchRad) * LIFT_SCALE + (power * 0.3);
    
    this.ball.velocity = {
      x: sideSpeed,
      y: upSpeed,
      z: -forwardSpeed // Toward opponent
    };
    
    this.ball.spin = {
      x: spin * SPIN_SCALE,
      y: yaw * 0.05,
      z: -spin * 0.5 // Forward spin affects trajectory
    };
  }
  
  /**
   * Apply player hit using paddle direction vector (Magic Remote style)
   * This is the primary method for pose-based control
   * 
   * @param direction - Paddle forward direction (normalized, from quaternion)
   * @param power - Hit power (0-1)
   * @param spinAxis - Paddle right axis for spin calculation
   * @param angularVel - Angular velocity for spin
   */
  applyPlayerHitFromDirection(
    direction: { x: number; y: number; z: number },
    power: number,
    spinAxis: { x: number; y: number; z: number },
    angularVel: number
  ): void {
    // Start physics if this is a serve
    if (this.waitingForServe) {
      this.waitingForServe = false;
      this.rallyStartTime = performance.now();
    }
    this.lastHitter = 'player';
    
    // Power scaling - feel-good curve
    const POWER_SCALE = 7.0;
    const MIN_POWER = 0.45;
    const shotPower = Math.min(1.0, Math.max(MIN_POWER, power)) * POWER_SCALE;
    
    // Direction from paddle face - this is where the ball actually goes
    // Ensure it goes toward opponent (negative Z component)
    let dirX = direction.x;
    let dirY = direction.y;
    let dirZ = direction.z;
    
    // Normalize and ensure it goes forward (toward opponent = -Z)
    const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    if (len > 0.001) {
      dirX /= len;
      dirY /= len;
      dirZ /= len;
    }
    
    // If paddle is pointed wrong way, flip it
    if (dirZ > 0) {
      dirZ = -dirZ;
    }
    
    // Ensure minimum forward velocity
    if (Math.abs(dirZ) < 0.3) {
      dirZ = -0.7;
    }
    
    // Add arc to ensure ball goes over net and lands on opponent's side
    // More power = slightly flatter shot, but always enough arc
    const arcBoost = 2.5 + Math.abs(dirY) * 0.5 - (power * 0.2);
    
    this.ball.velocity = {
      x: dirX * shotPower * 0.6,
      y: dirY * shotPower * 0.3 + arcBoost, // Add upward arc
      z: dirZ * shotPower
    };
    
    // Spin from angular velocity and paddle orientation
    // Topspin: paddle rotating down (positive angular velocity around X)
    // Sidespin: paddle rotating left/right
    const spinScale = Math.min(1.0, angularVel / 8.0); // Normalized spin
    
    this.ball.spin = {
      x: spinAxis.x * spinScale * 2.0,  // Topspin/backspin
      y: spinAxis.y * spinScale * 1.0,  // Sidespin
      z: spinAxis.z * spinScale * 0.5   // Cork spin
    };
  }
  
  /**
   * Apply opponent hit to ball
   */
  applyOpponentHit(power: number, angle: number, spin: number): void {
    this.lastHitter = 'opponent';
    const POWER_SCALE = 6.0;  // Strong enough to cross table
    const shotPower = Math.min(1.0, Math.max(0.4, power)) * POWER_SCALE;
    const angleRad = (angle * Math.PI) / 180;
    
    // Calculate realistic arc toward player
    const forwardSpeed = shotPower * 0.85;
    const sideSpeed = Math.sin(angleRad) * shotPower * 0.3;
    const upSpeed = 2.2 + Math.random() * 0.4 + (power * 0.3); // Strong arc over net
    
    this.ball.velocity = {
      x: sideSpeed,
      y: upSpeed,
      z: forwardSpeed // Toward player (+Z)
    };
    
    this.ball.spin = {
      x: spin * 1.2,
      y: -angle * 0.03,
      z: spin * 0.4
    };
  }
  
  /**
   * Update physics simulation
   */
  update(deltaTime: number): void {
    if (!this.ball.visible) return;
    if (this.waitingForServe) return;  // Ball frozen until serve
    
    // Clamp delta time for stability (prevents physics explosion on lag)
    const dt = Math.min(deltaTime, 0.05);
    
    // Apply gravity
    this.ball.velocity.y -= GRAVITY * dt;
    
    // Apply air resistance (time-based for framerate independence)
    const airDrag = Math.exp(-AIR_RESISTANCE * dt * 60); // Normalized to ~60fps
    this.ball.velocity.x *= airDrag;
    this.ball.velocity.y *= Math.exp(-AIR_RESISTANCE * 0.5 * dt * 60);
    this.ball.velocity.z *= airDrag;
    
    // Apply Magnus effect (spin curves the ball)
    this.ball.velocity.x += this.ball.spin.y * SPIN_MAGNUS * dt;
    this.ball.velocity.z += this.ball.spin.x * SPIN_MAGNUS * dt;
    
    // Spin decays over time due to air resistance
    const spinDecay = Math.exp(-0.5 * dt);
    this.ball.spin.x *= spinDecay;
    this.ball.spin.y *= spinDecay;
    this.ball.spin.z *= spinDecay;
    
    // Update position
    this.ball.position.x += this.ball.velocity.x * dt;
    this.ball.position.y += this.ball.velocity.y * dt;
    this.ball.position.z += this.ball.velocity.z * dt;
    
    // Check collisions
    this.checkTableCollision();
    this.checkNetCollision();
    this.checkBoundaries();
  }
  
  private checkTableCollision(): void {
    const ballBottom = this.ball.position.y - BALL_RADIUS;
    
    if (ballBottom <= TABLE.height && this.ball.velocity.y < 0) {
      // Check if ball is over the table
      if (Math.abs(this.ball.position.x) <= TABLE.width / 2 &&
          Math.abs(this.ball.position.z) <= TABLE.length / 2) {
        
        // Bounce!
        this.ball.position.y = TABLE.height + BALL_RADIUS;
        
        // Only bounce if velocity is above threshold, otherwise stop
        if (Math.abs(this.ball.velocity.y) < MIN_BOUNCE_VELOCITY) {
          // Ball has lost too much energy - it rolls/stops
          this.ball.velocity.y = 0;
          // Apply strong friction to horizontal velocity
          this.ball.velocity.x *= 0.5;
          this.ball.velocity.z *= 0.5;
        } else {
          this.ball.velocity.y = -this.ball.velocity.y * BOUNCE_COEFFICIENT;
        }
        
        // Apply table friction to horizontal velocity
        this.ball.velocity.x *= (1 - FRICTION_COEFFICIENT * 0.3);
        this.ball.velocity.z *= (1 - FRICTION_COEFFICIENT * 0.2);
        
        // Transfer some spin to velocity on bounce
        this.ball.velocity.x += this.ball.spin.x * 0.08;
        this.ball.velocity.z += this.ball.spin.z * 0.05;
        
        // Reduce spin on bounce
        this.ball.spin.x *= 0.6;
        this.ball.spin.y *= 0.6;
        this.ball.spin.z *= 0.6;
        
        this.lastBounceTime = performance.now();
        
        // Trigger sound callback
        this.onTableBounce?.();
      }
    }
    
    // Ball fell below floor or stopped on table
    if (this.ball.position.y < 0) {
      this.determinePointWinner();
    }
    
    // Ball stopped on table (rolling to a halt)
    const totalVelocity = Math.sqrt(
      this.ball.velocity.x ** 2 + 
      this.ball.velocity.y ** 2 + 
      this.ball.velocity.z ** 2
    );
    if (this.ball.position.y <= TABLE.height + BALL_RADIUS + 0.01 && 
        totalVelocity < VELOCITY_DECAY_THRESHOLD) {
      // Ball has essentially stopped on the table
      this.determinePointWinner();
    }
  }
  
  private checkNetCollision(): void {
    // Net is at Z = 0, extends from table height to table height + netHeight
    const netTop = TABLE.height + TABLE.netHeight;
    
    // Only check when ball is near the net plane and below net height
    if (Math.abs(this.ball.position.z) < 0.05 && 
        this.ball.position.y < netTop &&
        this.ball.position.y > TABLE.height - 0.05) {
      
      // Ball is at the net plane and below net height = net hit
      if (!this.netHit) {
        this.netHit = true;
        this.netHitBy = this.lastHitter;
        
        // Ball bounces back slightly and falls
        this.ball.velocity.z = -this.ball.velocity.z * 0.1; // Weak bounce back
        this.ball.velocity.y = -0.5; // Falls down
        this.ball.velocity.x *= 0.3;
        
        // Trigger sound callback
        this.onNetHit?.();
      }
    }
  }
  
  private checkBoundaries(): void {
    // Ball went past player's end (positive Z = player side)
    if (this.ball.position.z > TABLE.length / 2 + 1) {
      if (!this.playerMissed && !this.opponentMissed) {
        this.playerMissed = true;
      }
    }
    
    // Ball went past opponent's end (negative Z = opponent side)
    if (this.ball.position.z < -TABLE.length / 2 - 1) {
      if (!this.playerMissed && !this.opponentMissed) {
        this.opponentMissed = true;
      }
    }
    
    // Ball went too far to the sides
    if (Math.abs(this.ball.position.x) > TABLE.width + 1) {
      if (!this.playerMissed && !this.opponentMissed) {
        // Last hitter is at fault for out-of-bounds
        if (this.lastHitter === 'player') {
          this.playerMissed = true;
        } else {
          this.opponentMissed = true;
        }
      }
    }
    
    // Ball fell below floor
    if (this.ball.position.y < -0.5) {
      if (!this.playerMissed && !this.opponentMissed) {
        // Assign point based on ball position or who hit last
        if (this.ball.position.z > 0) {
          this.playerMissed = true;
        } else {
          this.opponentMissed = true;
        }
      }
    }
    
    // Rally timeout - prevent infinite rallies
    if (this.rallyStartTime > 0 && 
        performance.now() - this.rallyStartTime > MAX_RALLY_TIME_MS) {
      if (this.ball.position.z > 0) {
        this.playerMissed = true;
      } else {
        this.opponentMissed = true;
      }
    }
  }
  
  private determinePointWinner(): void {
    // Only determine once
    if (this.playerMissed || this.opponentMissed || this.netHit) {
      return; // Already determined
    }
    
    // Determine who loses the point based on ball position and lastHitter
    // Ball on player's side (z > 0) = player lost it
    // Ball on opponent's side (z < 0) = opponent lost it
    // Ball near center = last hitter is at fault (they hit it poorly)
    if (this.ball.position.z > 0.1) {
      this.playerMissed = true;
    } else if (this.ball.position.z < -0.1) {
      this.opponentMissed = true;
    } else {
      // Near the net - person who hit it last is at fault
      if (this.lastHitter === 'player') {
        this.playerMissed = true;
      } else {
        this.opponentMissed = true;
      }
    }
    
    // Trigger out sound
    this.onOut?.();
  }
  
  /**
   * Check if ball is in player's hit zone
   * Expanded for better player experience
   */
  isInPlayerHitZone(): boolean {
    const hitZoneStart = TABLE.length / 2 - 0.8;  // Extended toward center
    const hitZoneEnd = TABLE.length / 2 + 0.3;    // Extended past table edge
    
    // Ball must be heading toward player (positive Z velocity) or just arrived
    const isApproaching = this.ball.velocity.z > -0.5;
    
    return this.ball.position.z >= hitZoneStart &&
           this.ball.position.z <= hitZoneEnd &&
           this.ball.position.y >= TABLE.height - 0.1 &&
           this.ball.position.y <= TABLE.height + 0.6 &&
           isApproaching;
  }
  
  /**
   * Check if ball is in opponent's hit zone
   * Expanded zone for more reliable AI hits
   */
  isInOpponentHitZone(): boolean {
    const hitZoneStart = -TABLE.length / 2 + 0.8;  // Extended toward center
    const hitZoneEnd = -TABLE.length / 2 - 0.3;    // Extended past table edge
    
    // Ball must be heading toward opponent (negative Z velocity) or just arrived
    const isApproaching = this.ball.velocity.z < 0.5; // Allow slight positive (just hit)
    
    return this.ball.position.z <= hitZoneStart &&
           this.ball.position.z >= hitZoneEnd &&
           this.ball.position.y >= TABLE.height - 0.1 && // Allow slightly below table height
           this.ball.position.y <= TABLE.height + 0.6 && // Extended height range
           isApproaching;
  }
  
  isPlayerMiss(): boolean {
    return this.playerMissed || (this.netHit && this.netHitBy === 'player');
  }
  
  isOpponentMiss(): boolean {
    return this.opponentMissed || (this.netHit && this.netHitBy === 'opponent');
  }
  
  /**
   * Clear miss flags (call after scoring)
   */
  clearMissFlags(): void {
    this.playerMissed = false;
    this.opponentMissed = false;
    this.netHit = false;
    this.netHitBy = null;
  }
  
  hideBall(): void {
    this.ball.visible = false;
  }
  
  /**
   * Get ball state for rendering
   * Returns normalized coordinates (0-1) for compatibility
   */
  getBall(): { x: number; y: number; z: number; visible: boolean } {
    // Convert world coordinates to normalized (0-1) for renderer
    return {
      x: (this.ball.position.x / TABLE.width) + 0.5,
      y: (this.ball.position.z / TABLE.length) + 0.5,
      z: (this.ball.position.y - TABLE.height) / 0.5, // Height as Z for 3D render
      visible: this.ball.visible
    };
  }
  
  /**
   * Get raw 3D ball position for direct renderer use
   */
  getBall3D(): BallState {
    return { ...this.ball };
  }
}
