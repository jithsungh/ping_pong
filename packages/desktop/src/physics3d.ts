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
const AIR_RESISTANCE = 0.02;           // Increased for more realistic air drag
const BOUNCE_COEFFICIENT = 0.8;       // Slightly lower for more realistic energy loss
const SPIN_MAGNUS = 0.25;
const MIN_BOUNCE_VELOCITY = 0.3;      // Minimum velocity to bounce (prevents infinite small bounces)
const FRICTION_COEFFICIENT = 0.4;     // Table friction on bounce
const VELOCITY_DECAY_THRESHOLD = 0.1; // Below this, ball stops
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
   * Reset ball for a new serve
   */
  resetForServe(server: 'player' | 'opponent'): void {
    this.ball.visible = true;
    this.playerMissed = false;
    this.opponentMissed = false;
    this.netHit = false;
    this.rallyStartTime = performance.now(); // Track rally start
    
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
    const direction = server === 'player' ? -1 : 1; // Player serves toward opponent (-Z)
    
    // Realistic serve: toss up, then forward with proper arc
    const serveSpeed = 3.0 + Math.random() * 0.5; // Slight variation
    const sideAngle = (Math.random() - 0.5) * 0.4; // Small random side angle
    
    this.ball.velocity = {
      x: sideAngle * serveSpeed * 0.3,
      y: 1.8 + Math.random() * 0.3, // Toss up with slight variation
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
   * Apply player hit to ball
   */
  applyPlayerHit(power: number, yaw: number, pitch: number, spin: number): void {
    // Intent-based mapping - tuned for realistic ping pong
    const POWER_SCALE = 4.5;       // Reduced for more controllable speed
    const ANGLE_SCALE = 0.3;       // Increased for better directional control
    const LIFT_BASE = 1.8;         // Base upward velocity for proper arc over net
    const LIFT_SCALE = 0.8;        // How much pitch affects lift  
    const SPIN_SCALE = 1.5;
    
    // Clamp and scale power
    const shotPower = Math.min(1.0, Math.max(0.3, power)) * POWER_SCALE;
    
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
   * Apply opponent hit to ball
   */
  applyOpponentHit(power: number, angle: number, spin: number): void {
    const POWER_SCALE = 4.0;  // Slightly lower than player for balance
    const shotPower = Math.min(1.0, Math.max(0.4, power)) * POWER_SCALE;
    const angleRad = (angle * Math.PI) / 180;
    
    // Calculate realistic arc toward player
    const forwardSpeed = shotPower * 0.85;
    const sideSpeed = Math.sin(angleRad) * shotPower * 0.35;
    const upSpeed = 1.6 + Math.random() * 0.4 + (power * 0.3); // Good arc over net
    
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
    // Net is at Z = 0
    const wasOnOpponentSide = this.ball.velocity.z < 0 && this.ball.position.z > 0;
    const wasOnPlayerSide = this.ball.velocity.z > 0 && this.ball.position.z < 0;
    
    // Check if crossing net plane
    if ((wasOnOpponentSide && this.ball.position.z <= 0) ||
        (wasOnPlayerSide && this.ball.position.z >= 0)) {
      
      // Check if ball is below net height
      if (this.ball.position.y < TABLE.height + TABLE.netHeight) {
        this.netHit = true;
        // Ball hits net - stop it
        this.ball.velocity = { x: 0, y: -1, z: 0 };
        
        // Trigger sound callback
        this.onNetHit?.();
      }
    }
  }
  
  private checkBoundaries(): void {
    // Ball went past player's end
    if (this.ball.position.z > TABLE.length / 2 + 1) {
      this.playerMissed = true;
    }
    
    // Ball went past opponent's end
    if (this.ball.position.z < -TABLE.length / 2 - 1) {
      this.opponentMissed = true;
    }
    
    // Ball went too far to the sides
    if (Math.abs(this.ball.position.x) > TABLE.width + 1) {
      this.determinePointWinner();
    }
    
    // Rally timeout - prevent infinite rallies
    if (this.rallyStartTime > 0 && 
        performance.now() - this.rallyStartTime > MAX_RALLY_TIME_MS) {
      // Force point end - whoever had it last loses
      // Determine based on ball position
      if (this.ball.position.z > 0) {
        this.playerMissed = true;
      } else {
        this.opponentMissed = true;
      }
    }
  }
  
  private determinePointWinner(): void {
    // Reset ball visibility
    this.ball.visible = false;
    
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
    return this.playerMissed || (this.netHit && this.ball.velocity.z < 0);
  }
  
  isOpponentMiss(): boolean {
    return this.opponentMissed || (this.netHit && this.ball.velocity.z > 0);
  }
  
  /**
   * Clear miss flags (call after scoring)
   */
  clearMissFlags(): void {
    this.playerMissed = false;
    this.opponentMissed = false;
    this.netHit = false;
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
