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
const AIR_RESISTANCE = 0.01;
const BOUNCE_COEFFICIENT = 0.85;
const SPIN_MAGNUS = 0.3;

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
   */
  startServe(server: 'player' | 'opponent'): void {
    const direction = server === 'player' ? -1 : 1; // Player serves toward opponent (-Z)
    
    // Toss the ball up slightly
    this.ball.velocity = {
      x: 0,
      y: 2.0, // Toss up
      z: direction * 3.0 // Forward motion
    };
  }
  
  /**
   * Apply player hit to ball
   */
  applyPlayerHit(power: number, yaw: number, pitch: number, spin: number): void {
    // Intent-based mapping (per realistic.md)
    const POWER_SCALE = 6.0;
    const ANGLE_SCALE = 0.08;
    const LIFT_SCALE = 0.05;
    const SPIN_SCALE = 2.0;
    
    // Clamp and scale power
    const shotPower = Math.min(1.0, Math.max(0.2, power)) * POWER_SCALE;
    
    // Direction: negative Z = toward opponent
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    
    this.ball.velocity = {
      x: Math.sin(yawRad) * shotPower * ANGLE_SCALE * shotPower,
      y: 1.5 + pitchRad * LIFT_SCALE * shotPower, // Arc over net
      z: -shotPower // Toward opponent
    };
    
    this.ball.spin = {
      x: spin * SPIN_SCALE,
      y: yaw * 0.1,
      z: 0
    };
  }
  
  /**
   * Apply opponent hit to ball
   */
  applyOpponentHit(power: number, angle: number, spin: number): void {
    const POWER_SCALE = 5.0;
    const shotPower = Math.min(1.0, Math.max(0.3, power)) * POWER_SCALE;
    const angleRad = (angle * Math.PI) / 180;
    
    this.ball.velocity = {
      x: Math.sin(angleRad) * shotPower * 0.3,
      y: 1.2 + Math.random() * 0.3,
      z: shotPower // Toward player (+Z)
    };
    
    this.ball.spin = {
      x: spin * 1.5,
      y: -angle * 0.05,
      z: 0
    };
  }
  
  /**
   * Update physics simulation
   */
  update(deltaTime: number): void {
    if (!this.ball.visible) return;
    
    // Apply gravity
    this.ball.velocity.y -= GRAVITY * deltaTime;
    
    // Apply air resistance
    this.ball.velocity.x *= (1 - AIR_RESISTANCE);
    this.ball.velocity.y *= (1 - AIR_RESISTANCE * 0.5);
    this.ball.velocity.z *= (1 - AIR_RESISTANCE);
    
    // Apply Magnus effect (spin curves)
    this.ball.velocity.x += this.ball.spin.y * SPIN_MAGNUS * deltaTime;
    this.ball.velocity.z += this.ball.spin.x * SPIN_MAGNUS * deltaTime;
    
    // Update position
    this.ball.position.x += this.ball.velocity.x * deltaTime;
    this.ball.position.y += this.ball.velocity.y * deltaTime;
    this.ball.position.z += this.ball.velocity.z * deltaTime;
    
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
        this.ball.velocity.y = -this.ball.velocity.y * BOUNCE_COEFFICIENT;
        
        // Transfer some spin to velocity on bounce
        this.ball.velocity.x += this.ball.spin.x * 0.1;
        
        // Reduce spin on bounce
        this.ball.spin.x *= 0.7;
        this.ball.spin.y *= 0.7;
        
        this.lastBounceTime = performance.now();
        
        // Trigger sound callback
        this.onTableBounce?.();
      }
    }
    
    // Ball fell below floor
    if (this.ball.position.y < 0) {
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
  }
  
  private determinePointWinner(): void {
    // Reset ball visibility
    this.ball.visible = false;
    
    // Trigger out sound
    this.onOut?.();
  }
  
  /**
   * Check if ball is in player's hit zone
   */
  isInPlayerHitZone(): boolean {
    const hitZoneStart = TABLE.length / 2 - 0.5;
    const hitZoneEnd = TABLE.length / 2 + 0.2;
    
    return this.ball.position.z >= hitZoneStart &&
           this.ball.position.z <= hitZoneEnd &&
           this.ball.position.y >= TABLE.height &&
           this.ball.position.y <= TABLE.height + 0.5;
  }
  
  /**
   * Check if ball is in opponent's hit zone
   */
  isInOpponentHitZone(): boolean {
    const hitZoneStart = -TABLE.length / 2 + 0.5;
    const hitZoneEnd = -TABLE.length / 2 - 0.2;
    
    return this.ball.position.z <= hitZoneStart &&
           this.ball.position.z >= hitZoneEnd &&
           this.ball.position.y >= TABLE.height &&
           this.ball.position.y <= TABLE.height + 0.5;
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
