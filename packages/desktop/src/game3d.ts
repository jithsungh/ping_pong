import { RULES } from '@paddlelink/shared';
import type { GamePhase, Score, SwingMessage, PoseMessage } from '@paddlelink/shared';
import { Scene3D, RenderState3D } from './renderer3d';
import { Physics3D } from './physics3d';
import { AIOpponent } from './ai';
import { audioManager } from './audio';

// Hit timing window in milliseconds
const HIT_WINDOW_MS = 150;
// Angular velocity threshold for swing detection (rad/s)
// Lower threshold so serves actually trigger
const ANGULAR_SWING_THRESHOLD = 2.0;  // Lowered from 4.0 for easier swing detection
const ANGULAR_SWING_MAX = 10.0;

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
  private lastDeltaTime = 0.016;
  private animationId: number | null = null;
  
  // Paddle orientation (from last swing)
  private paddleYaw = 0;
  private paddlePitch = 0;
  
  // Pose-based control (Magic Remote style)
  private lastPoseSwingTime = 0;
  
  // Prevent double-scoring
  private isScoring = false;
  
  // Callbacks
  private onScoreChange: ((score: Score) => void) | null = null;
  private onPhaseChange: ((phase: GamePhase) => void) | null = null;
  private onGameOver: ((winner: 'player' | 'opponent', score: Score) => void) | null = null;
  
  constructor(canvas: HTMLCanvasElement) {
    this.physics = new Physics3D();
    this.scene = new Scene3D(canvas);
    this.ai = new AIOpponent('medium');
    
    // Set up physics sound callbacks
    this.physics.setOnTableBounce(() => audioManager.playTableBounce());
    this.physics.setOnNetHit(() => audioManager.playNetHit());
    this.physics.setOnOut(() => audioManager.playOut());
    
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
    this.isScoring = false;
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
   * Handle continuous pose streaming (Magic Remote style)
   * Called at ~60Hz from mobile device
   */
  handlePose(pose: PoseMessage): void {
    // Forward pose to scene for paddle visualization
    this.scene.setPaddlePose(pose.q, pose.angularVel);
    
    // Detect swing from angular velocity spike
    const angularMag = Math.sqrt(
      pose.angularVel[0] ** 2 +
      pose.angularVel[1] ** 2 +
      pose.angularVel[2] ** 2
    );
    
    const now = performance.now();
    
    // Check for swing (angular velocity spike)
    if (angularMag >= ANGULAR_SWING_THRESHOLD) {
      // Check cooldown
      if (now - this.lastPoseSwingTime < HIT_WINDOW_MS * 2) {
        return;
      }
      
      // Check game phase
      if (this.phase !== 'playing' && this.phase !== 'serving') {
        return;
      }
      
      // Check hit cooldown
      if (now - this.lastHitTime < 200) {
        return;
      }
      
      // Calculate power from angular velocity
      const power = Math.min(1.0, (angularMag - ANGULAR_SWING_THRESHOLD) / 
                                  (ANGULAR_SWING_MAX - ANGULAR_SWING_THRESHOLD) + 0.3);
      
      // If serving, start the serve
      if (this.phase === 'serving' && this.server === 'player') {
        this.executeHitFromPose(power);
        this.setPhase('playing');
        audioManager.playServe();
        this.lastPoseSwingTime = now;
        return;
      }
      
      // If playing and ball is in hit zone
      if (this.phase === 'playing' && this.canPlayerHit) {
        const quality = this.computeTimingQuality();
        this.executeHitFromPose(power * quality);
        this.lastPoseSwingTime = now;
      }
    }
  }
  
  /**
   * Execute hit using paddle direction from pose
   */
  private executeHitFromPose(power: number): void {
    const now = performance.now();
    
    // Get paddle direction from scene (quaternion-derived)
    const forward = this.scene.getPaddleForward();
    const right = this.scene.getPaddleRight();
    const angularVel = this.scene.getPaddleAngularVelocity();
    
    // Apply hit using direction
    this.physics.applyPlayerHitFromDirection(
      { x: forward.x, y: forward.y, z: forward.z },
      power,
      { x: right.x, y: right.y, z: right.z },
      angularVel
    );
    
    this.lastHitTime = now;
    this.canPlayerHit = false;
    
    // Visual and audio feedback
    this.scene.triggerHitEffect(0, 0, 0, power);
    audioManager.playPaddleHit(power);
  }
  
  /**
   * Handle player swing with 3D orientation (legacy event-based)
   */
  handlePlayerSwing(swing: SwingMessage): void {
    const now = performance.now();
    
    // Extract values with defaults
    const speed = swing.speed;
    const yaw = swing.yaw ?? swing.angle;
    const pitch = swing.pitch ?? 0;
    const spin = swing.spin;
    
    // Always update paddle orientation for visual feedback
    this.paddleYaw = yaw;
    this.paddlePitch = pitch;
    
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
      audioManager.playPaddleHit(speed);
      audioManager.playServe();
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
      
      // Visual and audio feedback
      this.scene.triggerHitEffect(0, 0, 0, speed * quality);
      audioManager.playPaddleHit(speed * quality);
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
    this.lastDeltaTime = deltaTime;
    
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
    
    // AI opponent - check every frame when ball is in play
    if (this.phase === 'playing') {
      const isInOpponentZone = this.physics.isInOpponentHitZone();
      const ball3d = this.physics.getBall3D();
      
      // Pass 3D ball state with pre-computed hit zone to AI
      const aiBall = {
        x: ball3d.position.x,
        y: (ball3d.position.z / 2.74) + 0.5,  // Normalized Z position
        z: ball3d.position.y,                  // Height (Y in 3D)
        vx: ball3d.velocity.x,
        vy: ball3d.velocity.z,                 // Z velocity
        vz: ball3d.velocity.y,                 // Y velocity (vertical)
        visible: ball3d.visible,
        inHitZone: isInOpponentZone            // Pre-computed by physics
      };
      
      const aiHit = this.ai.update(aiBall, currentTime);
      if (aiHit) {
        this.physics.applyOpponentHit(aiHit.speed, aiHit.angle, aiHit.spin);
        audioManager.playPaddleHit(aiHit.speed);
      }
    }
    
    // If serving as opponent, auto-serve after delay
    if (this.phase === 'serving' && this.server === 'opponent') {
      this.physics.startServe('opponent');
      this.setPhase('playing');
    }
    
    // Check for points (only if not already scored this round)
    if (this.phase === 'playing') {
      if (this.physics.isPlayerMiss()) {
        this.scorePoint('opponent');
      } else if (this.physics.isOpponentMiss()) {
        this.scorePoint('player');
      }
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
      playerHitZoneActive: this.canPlayerHit,
      paddleYaw: this.paddleYaw,
      paddlePitch: this.paddlePitch,
      deltaTime: this.lastDeltaTime
    };
    
    this.scene.render(state);
  }
  
  private setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.onPhaseChange?.(phase);
  }
  
  private scorePoint(scorer: 'player' | 'opponent'): void {
    // Prevent double-triggering
    if (this.isScoring) return;
    this.isScoring = true;
    
    // Immediately clear miss flags to prevent re-triggering
    this.physics.clearMissFlags();
    this.physics.hideBall();
    
    if (scorer === 'player') {
      this.score.player++;
    } else {
      this.score.opponent++;
    }
    
    this.onScoreChange?.({ ...this.score });
    
    // Play score sound
    audioManager.playScore(scorer === 'player');
    
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
      this.isScoring = false;
      this.setPhase('serving');
      this.physics.resetForServe(this.server);
    }, 1500);
  }
}
