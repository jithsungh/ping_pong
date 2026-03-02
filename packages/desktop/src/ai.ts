import { PHYSICS } from '@paddlelink/shared';
import type { BallState } from '@paddlelink/shared';

export interface AIConfig {
  /** Reaction time in ms (higher = easier) */
  reactionDelay: number;
  /** Accuracy (0-1, lower = more random) */
  accuracy: number;
  /** Hit speed variance */
  speedVariance: number;
}

export const AI_DIFFICULTY = {
  easy: {
    reactionDelay: 200,    // Faster reaction for less frustrating gameplay
    accuracy: 0.6,
    speedVariance: 0.25,
  },
  medium: {
    reactionDelay: 100,    // Quick reaction
    accuracy: 0.8,
    speedVariance: 0.15,
  },
  hard: {
    reactionDelay: 30,     // Very fast
    accuracy: 0.95,
    speedVariance: 0.08,
  },
} as const;

/** Extended ball state for 3D game */
export interface Ball3DState {
  x: number;      // X position
  y: number;      // Normalized Y (0 = opponent end, 1 = player end)
  z: number;      // Height (Y in 3D space)
  vx: number;     // X velocity
  vy: number;     // Z velocity (toward/away from player)
  vz: number;     // Y velocity (up/down)
  visible: boolean;
  inHitZone: boolean;  // Pre-computed by physics engine
}

export class AIOpponent {
  private config: AIConfig;
  private lastHitTime = 0;
  private pendingHit: { time: number; speed: number; angle: number; spin: number } | null = null;
  
  constructor(difficulty: keyof typeof AI_DIFFICULTY = 'medium') {
    this.config = AI_DIFFICULTY[difficulty];
  }
  
  /**
   * Set difficulty
   */
  setDifficulty(difficulty: keyof typeof AI_DIFFICULTY): void {
    this.config = AI_DIFFICULTY[difficulty];
  }
  
  /**
   * Update AI and check if it should hit
   * Now uses pre-computed hit zone from physics engine
   * @returns Hit data if AI decides to hit, null otherwise
   */
  update(ball: Ball3DState, currentTime: number): { speed: number; angle: number; spin: number } | null {
    // Check if there's a pending hit ready to execute
    if (this.pendingHit && currentTime >= this.pendingHit.time) {
      const hit = this.pendingHit;
      this.pendingHit = null;
      this.lastHitTime = currentTime;
      return { speed: hit.speed, angle: hit.angle, spin: hit.spin };
    }
    
    // Use pre-computed hit zone check - more reliable than coordinate checks
    if (ball.inHitZone && ball.visible) {
      // Check cooldown to prevent double hits
      if (currentTime - this.lastHitTime < PHYSICS.HIT_COOLDOWN_MS) {
        return null;
      }
      
      // If no pending hit, schedule one immediately
      if (!this.pendingHit) {
        this.pendingHit = this.calculateHit(ball, currentTime);
      }
    } else {
      // Ball left hit zone without being hit - clear any pending hit
      // This prevents delayed hits after ball has passed
      if (this.pendingHit && currentTime - this.pendingHit.time > 500) {
        this.pendingHit = null;
      }
    }
    
    return null;
  }
  
  /**
   * Legacy update for 2D game compatibility
   */
  updateLegacy(ball: BallState, currentTime: number): { speed: number; angle: number; spin: number } | null {
    // Convert to new format with inHitZone computed from Y position
    const ball3d: Ball3DState = {
      x: ball.x,
      y: ball.y,
      z: 0,
      vx: ball.vx,
      vy: ball.vy,
      vz: 0,
      visible: ball.visible,
      inHitZone: ball.y < PHYSICS.HIT_ZONE_HEIGHT && ball.vy < 0
    };
    return this.update(ball3d, currentTime);
  }
  
  private calculateHit(ball: Ball3DState, currentTime: number): { time: number; speed: number; angle: number; spin: number } {
    // Add reaction delay based on difficulty
    const hitTime = currentTime + this.config.reactionDelay;
    
    // Calculate aim based on accuracy - try to hit toward opposite side
    let targetAngle = 0;
    
    // Aim toward opposite side of where ball came from
    if (ball.vx > 0.1) {
      targetAngle = -25; // Aim left
    } else if (ball.vx < -0.1) {
      targetAngle = 25; // Aim right
    } else {
      // Ball coming straight - pick a random side
      targetAngle = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 15);
    }
    
    // Add inaccuracy based on difficulty
    const inaccuracy = (1 - this.config.accuracy) * 40;
    targetAngle += (Math.random() - 0.5) * inaccuracy;
    
    // Clamp angle to reasonable range
    targetAngle = Math.max(-45, Math.min(45, targetAngle));
    
    // Calculate speed - higher difficulty = more consistent power
    const baseSpeed = 0.55 + Math.random() * 0.25;
    const speedVariation = (Math.random() - 0.5) * this.config.speedVariance;
    const speed = Math.max(0.4, Math.min(0.9, baseSpeed + speedVariation));
    
    // Calculate spin - add some variation for realism
    const spin = (Math.random() - 0.5) * 0.6;
    
    return {
      time: hitTime,
      speed,
      angle: targetAngle,
      spin,
    };
  }
  
  /**
   * Reset AI state (between points/games)
   */
  reset(): void {
    this.pendingHit = null;
    this.lastHitTime = 0;
  }
}
