import { RULES, PHYSICS } from '@paddlelink/shared';
import type { GamePhase, Score } from '@paddlelink/shared';
import { Physics } from './physics';
import { Renderer } from './renderer';
import { AIOpponent } from './ai';

export class Game {
  private physics: Physics;
  private renderer: Renderer;
  private ai: AIOpponent;
  
  private phase: GamePhase = 'waiting';
  private score: Score = { player: 0, opponent: 0 };
  private server: 'player' | 'opponent' = 'player';
  private serveCount = 0;
  private canPlayerHit = false;
  private lastHitTime = 0;
  
  private lastFrameTime = 0;
  private animationId: number | null = null;
  
  // Callbacks
  private onScoreChange: ((score: Score) => void) | null = null;
  private onPhaseChange: ((phase: GamePhase) => void) | null = null;
  private onGameOver: ((winner: 'player' | 'opponent', score: Score) => void) | null = null;
  
  constructor(canvas: HTMLCanvasElement) {
    this.physics = new Physics();
    this.renderer = new Renderer(canvas);
    this.ai = new AIOpponent('medium');
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
  
  // ========================================
  // Game Control
  // ========================================
  
  /**
   * Start the game
   */
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
  
  /**
   * Stop the game
   */
  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * Handle player swing input
   */
  handlePlayerSwing(speed: number, angle: number, spin: number): void {
    const now = performance.now();
    
    // Check if player can hit
    if (this.phase !== 'playing' && this.phase !== 'serving') {
      return;
    }
    
    // Check cooldown
    if (now - this.lastHitTime < PHYSICS.HIT_COOLDOWN_MS) {
      return;
    }
    
    // If serving, start the serve
    if (this.phase === 'serving' && this.server === 'player') {
      this.physics.applyPlayerHit(speed, angle, spin);
      this.setPhase('playing');
      this.lastHitTime = now;
      return;
    }
    
    // If playing and ball is in hit zone
    if (this.phase === 'playing' && this.canPlayerHit) {
      this.physics.applyPlayerHit(speed, angle, spin);
      this.lastHitTime = now;
      this.canPlayerHit = false;
    }
  }
  
  /**
   * Reset for new game
   */
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
    const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.1); // Cap delta to prevent huge jumps
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
    
    const ball = this.physics.getBall();
    
    // Check hit zones
    this.canPlayerHit = this.physics.isInPlayerHitZone();
    
    // AI opponent
    if (this.phase === 'playing') {
      const aiHit = this.ai.update(ball, currentTime);
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
    
    this.renderer.render({
      ball: { x: ball.x, y: ball.y, visible: ball.visible },
      playerHitZoneActive: this.canPlayerHit,
      opponentHitZoneActive: this.physics.isInOpponentHitZone(),
    });
  }
  
  // ========================================
  // Scoring
  // ========================================
  
  private scorePoint(scorer: 'player' | 'opponent'): void {
    // Update score
    this.score[scorer]++;
    this.onScoreChange?.(this.score);
    
    // Flash effect
    this.renderer.flashPoint(scorer);
    
    // Check for game over
    if (this.checkGameOver()) {
      const winner = this.score.player > this.score.opponent ? 'player' : 'opponent';
      this.setPhase('gameOver');
      this.onGameOver?.(winner, this.score);
      return;
    }
    
    // Prepare next point
    this.setPhase('point');
    
    // Update serve
    this.serveCount++;
    if (this.serveCount >= RULES.SERVE_SWITCH_POINTS) {
      this.server = this.server === 'player' ? 'opponent' : 'player';
      this.serveCount = 0;
    }
    
    // Brief pause then serve
    setTimeout(() => {
      if (this.phase === 'point') {
        this.ai.reset();
        this.setPhase('serving');
        this.physics.resetForServe(this.server);
      }
    }, RULES.POINT_PAUSE_MS);
  }
  
  private checkGameOver(): boolean {
    const { player, opponent } = this.score;
    const maxScore = Math.max(player, opponent);
    const minScore = Math.min(player, opponent);
    
    // Must reach POINTS_TO_WIN
    if (maxScore < RULES.POINTS_TO_WIN) {
      return false;
    }
    
    // Must win by WIN_BY
    return (maxScore - minScore) >= RULES.WIN_BY;
  }
  
  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.onPhaseChange?.(phase);
  }
  
  // ========================================
  // Getters
  // ========================================
  
  getScore(): Score {
    return { ...this.score };
  }
  
  getPhase(): GamePhase {
    return this.phase;
  }
  
  canHit(): boolean {
    return this.canPlayerHit;
  }
}
