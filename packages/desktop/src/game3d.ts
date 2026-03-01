import { RULES } from '@paddlelink/shared';
import type { GamePhase, Score, SwingMessage } from '@paddlelink/shared';
import { Scene3D, RenderState3D } from './renderer3d';
import { Physics3D } from './physics3d';
import { AIOpponent } from './ai';

// Hit timing window in milliseconds
const HIT_WINDOW_MS = 150;

export class Game3D {
  private scene: Scene3D;
  private physics: Physics3D;
  private ai: AIOpponent;
  
  private phase: GamePhase = 'waiting';
  private score: Score = { player: 0, opponent: 0 };
  private server: 'player' | 'opponent' = 'player';
  private serveCount = 0;
  private canPlayerHit = false;
  private lastHitTime = 0;
  private lastSwingTimestamp = 0;
  
  private lastFrameTime = 0;
  private animationId: number | null = null;
  
  // Callbacks
  private onScoreChange: ((score: Score) => void) | null = null;
  private onPhaseChange: ((phase: GamePhase) => void) | null = null;
  private onGameOver: ((winner: 'player' | 'opponent', score: Score) => void) | null = null;
  
  constructor(canvas: HTMLCanvasElement) {
    this.physics = new Physics3D();
    this.scene = new Scene3D(canvas);
    this.ai = new AIOpponent('medium');
    
    // Initial render
    this.render();
  }
  
  // ========================================
  // Event Registration
  // ========================================
  
  setOnScoreChange(callback: (score: Score) => void): void {
    this.onScoreChange = callback;
  }
  
  setOnPhaseChange(callback: (phase: GamePhase) => void): void {
    this.onPhaseChange = callback;
  }
  
  setOnGameOver(callback: (winner: 'player' | 'opponent', score: Score) => void): void {
    this.onGameOver = callback;
  }
  
  /**
   * Force resize (call when canvas becomes visible)
   */
  resizeCanvas(): void {
    this.scene.resize();
    this.render();
  }
  
  // ========================================
  // Game Control
  // ========================================
  
  start(): void {
    this.score = { player: 0, opponent: 0 };
    this.server = 'player';
    this.serveCount = 0;
    this.ai.reset();
    
    this.setPhase('serving');
    this.physics.resetForServe(this.server);
    
    // Start game loop
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }
  
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * Handle player swing with 3D orientation
   */
  handlePlayerSwing(swing: SwingMessage): void {
    const now = performance.now();
    
    // Extract values with defaults
    const speed = swing.speed;
    const yaw = swing.yaw ?? swing.angle;
    const pitch = swing.pitch ?? 0;
    const spin = swing.spin;
    
    // Check if player can hit (phase check)
    if (this.phase !== 'playing' && this.phase !== 'serving') {
      return;
    }
    
    // Hit timing window (per realistic.md)
    const swingTime = swing.timestamp;
    if (Math.abs(swingTime - this.lastSwingTimestamp) < HIT_WINDOW_MS) {
      // Too soon after last swing
      return;
    }
    this.lastSwingTimestamp = swingTime;
    
    // Cooldown between hits
    if (now - this.lastHitTime < 200) {
      return;
    }
    
    // If serving, start the serve
    if (this.phase === 'serving' && this.server === 'player') {
      this.physics.applyPlayerHit(speed, yaw, pitch, spin);
      this.setPhase('playing');
      this.lastHitTime = now;
      this.scene.triggerHitEffect(0, 0, 0, speed);
      return;
    }
    
    // If playing and ball is in hit zone
    if (this.phase === 'playing' && this.canPlayerHit) {
      // Calculate timing quality (per realistic.md)
      const quality = this.computeTimingQuality();
      
      // Apply hit with quality scaling
      this.physics.applyPlayerHit(speed * quality, yaw, pitch, spin);
      this.lastHitTime = now;
      this.canPlayerHit = false;
      
      // Visual feedback
      this.scene.triggerHitEffect(0, 0, 0, speed * quality);
    }
  }
  
  /**
   * Compute timing quality (0.5 - 1.0)
   * Better timing = stronger hit
   */
  private computeTimingQuality(): number {
    // For now, return full quality
    // Can be enhanced to check ball position within hit zone
    return 1.0;
  }
  
  reset(): void {
    this.stop();
    this.score = { player: 0, opponent: 0 };
    this.setPhase('waiting');
    this.physics.hideBall();
    this.render();
  }
  
  // ========================================
  // Game Loop
  // ========================================
  
  private gameLoop = (): void => {
    const now = performance.now();
    const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;
    
    this.update(deltaTime, now);
    this.render();
    
    this.animationId = requestAnimationFrame(this.gameLoop);
  };
  
  private update(deltaTime: number, currentTime: number): void {
    if (this.phase !== 'playing' && this.phase !== 'serving') {
      return;
    }
    
    // Update physics
    this.physics.update(deltaTime);
    
    // Check hit zones
    this.canPlayerHit = this.physics.isInPlayerHitZone();
    
    // AI opponent
    if (this.phase === 'playing' && this.physics.isInOpponentHitZone()) {
      const ball3d = this.physics.getBall3D();
      // Convert to the BallState format AI expects
      const aiBall = {
        x: (ball3d.position.x / 1.525) + 0.5,
        y: (ball3d.position.z / 2.74) + 0.5,
        vx: ball3d.velocity.x,
        vy: ball3d.velocity.z,
        visible: ball3d.visible
      };
      const aiHit = this.ai.update(aiBall, currentTime);
      if (aiHit) {
        this.physics.applyOpponentHit(aiHit.speed, aiHit.angle, aiHit.spin);
      }
    }
    
    // If serving as opponent, auto-serve after delay
    if (this.phase === 'serving' && this.server === 'opponent') {
      this.physics.startServe('opponent');
      this.setPhase('playing');
    }
    
    // Check for points
    if (this.physics.isPlayerMiss()) {
      this.scorePoint('opponent');
    } else if (this.physics.isOpponentMiss()) {
      this.scorePoint('player');
    }
  }
  
  private render(): void {
    const ball = this.physics.getBall();
    
    const state: RenderState3D = {
      ball: { 
        x: ball.x, 
        y: ball.y, 
        z: ball.z,
        visible: ball.visible 
      },
      playerHitZoneActive: this.canPlayerHit
    };
    
    this.scene.render(state);
  }
  
  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.onPhaseChange?.(phase);
  }
  
  private scorePoint(scorer: 'player' | 'opponent'): void {
    if (scorer === 'player') {
      this.score.player++;
    } else {
      this.score.opponent++;
    }
    
    this.onScoreChange?.({ ...this.score });
    
    // Check for game over
    const { player, opponent } = this.score;
    const maxScore = Math.max(player, opponent);
    const minScore = Math.min(player, opponent);
    
    if (maxScore >= RULES.POINTS_TO_WIN && maxScore - minScore >= RULES.WIN_BY) {
      const winner = player > opponent ? 'player' : 'opponent';
      this.setPhase('gameOver');
      this.onGameOver?.(winner, { ...this.score });
      return;
    }
    
    // Switch server every 2 points (or every point after 10-10)
    this.serveCount++;
    const totalPoints = player + opponent;
    const switchEvery = totalPoints >= 20 ? 1 : RULES.SERVE_SWITCH_POINTS;
    
    if (this.serveCount >= switchEvery) {
      this.server = this.server === 'player' ? 'opponent' : 'player';
      this.serveCount = 0;
    }
    
    // Brief pause then serve
    this.setPhase('point');
    setTimeout(() => {
      this.setPhase('serving');
      this.physics.resetForServe(this.server);
    }, 1500);
  }
}
