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
    reactionDelay: 300,
    accuracy: 0.5,
    speedVariance: 0.3,
  },
  medium: {
    reactionDelay: 150,
    accuracy: 0.75,
    speedVariance: 0.2,
  },
  hard: {
    reactionDelay: 50,
    accuracy: 0.9,
    speedVariance: 0.1,
  },
} as const;

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
   * @returns Hit data if AI decides to hit, null otherwise
   */
  update(ball: BallState, currentTime: number): { speed: number; angle: number; spin: number } | null {
    // Check if there's a pending hit ready to execute
    if (this.pendingHit && currentTime >= this.pendingHit.time) {
      const hit = this.pendingHit;
      this.pendingHit = null;
      this.lastHitTime = currentTime;
      return { speed: hit.speed, angle: hit.angle, spin: hit.spin };
    }
    
    // Check if ball is in opponent zone and heading toward opponent
    if (ball.y < PHYSICS.HIT_ZONE_HEIGHT && ball.vy < 0) {
      // Check cooldown
      if (currentTime - this.lastHitTime < PHYSICS.HIT_COOLDOWN_MS) {
        return null;
      }
      
      // If no pending hit, schedule one
      if (!this.pendingHit) {
        this.pendingHit = this.calculateHit(ball, currentTime);
      }
    }
    
    return null;
  }
  
  private calculateHit(ball: BallState, currentTime: number): { time: number; speed: number; angle: number; spin: number } {
    // Add reaction delay
    const hitTime = currentTime + this.config.reactionDelay;
    
    // Calculate aim based on accuracy
    let targetAngle = 0;
    
    // Aim toward opposite side of where ball came from
    if (ball.vx > 0) {
      targetAngle = -20; // Aim left
    } else if (ball.vx < 0) {
      targetAngle = 20; // Aim right
    }
    
    // Add inaccuracy
    const inaccuracy = (1 - this.config.accuracy) * 30;
    targetAngle += (Math.random() - 0.5) * inaccuracy;
    
    // Calculate speed
    const baseSpeed = 0.5 + Math.random() * 0.3;
    const speedVariation = (Math.random() - 0.5) * this.config.speedVariance;
    const speed = Math.max(0.3, Math.min(1, baseSpeed + speedVariation));
    
    // Calculate spin (somewhat random)
    const spin = (Math.random() - 0.5) * 0.5;
    
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
