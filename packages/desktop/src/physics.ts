import { PHYSICS } from '@paddlelink/shared';
import type { BallState } from '@paddlelink/shared';

export class Physics {
  private ball: BallState;
  private spin = 0; // Current ball spin
  
  constructor() {
    this.ball = this.createBall();
  }
  
  private createBall(): BallState {
    return {
      x: 0.5,
      y: 0.5,
      vx: 0,
      vy: 0,
      visible: true,
    };
  }
  
  /**
   * Get current ball state
   */
  getBall(): BallState {
    return { ...this.ball };
  }
  
  /**
   * Update physics for one frame
   * @param deltaTime Time since last frame in seconds
   */
  update(deltaTime: number): void {
    // Apply velocity
    this.ball.x += this.ball.vx * deltaTime;
    this.ball.y += this.ball.vy * deltaTime;
    
    // Apply spin (horizontal curve)
    this.ball.vx += this.spin * PHYSICS.SPIN_CURVE_FACTOR * deltaTime;
    
    // Apply friction
    this.ball.vx *= PHYSICS.BALL_FRICTION;
    this.ball.vy *= PHYSICS.BALL_FRICTION;
    
    // Decay spin
    this.spin *= 0.99;
    
    // Wall bounces (left/right)
    if (this.ball.x < 0.05) {
      this.ball.x = 0.05;
      this.ball.vx = Math.abs(this.ball.vx) * PHYSICS.BALL_BOUNCE_DAMPING;
    } else if (this.ball.x > 0.95) {
      this.ball.x = 0.95;
      this.ball.vx = -Math.abs(this.ball.vx) * PHYSICS.BALL_BOUNCE_DAMPING;
    }
  }
  
  /**
   * Check if ball is in player's hit zone
   */
  isInPlayerHitZone(): boolean {
    return this.ball.y > (1 - PHYSICS.HIT_ZONE_HEIGHT) && this.ball.vy > 0;
  }
  
  /**
   * Check if ball is in opponent's hit zone
   */
  isInOpponentHitZone(): boolean {
    return this.ball.y < PHYSICS.HIT_ZONE_HEIGHT && this.ball.vy < 0;
  }
  
  /**
   * Check if ball went past player (opponent scores)
   */
  isPlayerMiss(): boolean {
    return this.ball.y > 1.1;
  }
  
  /**
   * Check if ball went past opponent (player scores)
   */
  isOpponentMiss(): boolean {
    return this.ball.y < -0.1;
  }
  
  /**
   * Apply player hit
   */
  applyPlayerHit(speed: number, angle: number, spinInput: number): void {
    // Base velocity toward opponent
    const baseSpeed = PHYSICS.BALL_DEFAULT_SPEED + (speed * PHYSICS.SWING_SPEED_MULTIPLIER);
    
    // Clamp speed
    const clampedSpeed = Math.min(Math.max(baseSpeed, PHYSICS.BALL_MIN_SPEED), PHYSICS.BALL_MAX_SPEED);
    
    // Calculate velocity components
    // Angle affects horizontal direction (-45 to +45 degrees)
    const angleRad = (angle * PHYSICS.ANGLE_INFLUENCE) * (Math.PI / 180);
    
    this.ball.vy = -clampedSpeed; // Toward opponent (negative Y)
    this.ball.vx = Math.sin(angleRad) * clampedSpeed * 0.5;
    
    // Apply spin
    this.spin = spinInput;
    
    // Ensure ball is visible
    this.ball.visible = true;
  }
  
  /**
   * Apply opponent hit (AI or remote player)
   */
  applyOpponentHit(speed: number, angle: number, spinInput: number): void {
    const baseSpeed = PHYSICS.BALL_DEFAULT_SPEED + (speed * PHYSICS.SWING_SPEED_MULTIPLIER * 0.8);
    const clampedSpeed = Math.min(Math.max(baseSpeed, PHYSICS.BALL_MIN_SPEED), PHYSICS.BALL_MAX_SPEED);
    
    const angleRad = (angle * PHYSICS.ANGLE_INFLUENCE) * (Math.PI / 180);
    
    this.ball.vy = clampedSpeed; // Toward player (positive Y)
    this.ball.vx = Math.sin(angleRad) * clampedSpeed * 0.5;
    
    this.spin = -spinInput;
    this.ball.visible = true;
  }
  
  /**
   * Reset ball for serving
   */
  resetForServe(server: 'player' | 'opponent'): void {
    this.ball.x = 0.5;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.spin = 0;
    this.ball.visible = true;
    
    if (server === 'player') {
      this.ball.y = 0.85; // Near player
    } else {
      this.ball.y = 0.15; // Near opponent
    }
  }
  
  /**
   * Hide ball (between points)
   */
  hideBall(): void {
    this.ball.visible = false;
  }
  
  /**
   * Start ball moving for serve
   */
  startServe(server: 'player' | 'opponent'): void {
    this.resetForServe(server);
    const speed = PHYSICS.BALL_DEFAULT_SPEED;
    
    if (server === 'player') {
      this.ball.vy = -speed;
    } else {
      this.ball.vy = speed;
    }
    
    // Slight random horizontal movement
    this.ball.vx = (Math.random() - 0.5) * 0.1;
  }
}
