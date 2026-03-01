import { RENDER } from '@paddlelink/shared';

interface SlashPoint {
  x: number;
  y: number;
  alpha: number;
  time: number;
}

export interface RenderState {
  ball: { x: number; y: number; visible: boolean };
  playerHitZoneActive: boolean;
  opponentHitZoneActive: boolean;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private tableWidth = 0;
  private tableHeight = 0;
  private tableX = 0;
  private tableY = 0;
  
  // Slash effect state
  private slashPoints: SlashPoint[] = [];
  private slashActive = false;
  private slashStartTime = 0;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  /**
   * Resize canvas and recalculate table dimensions
   */
  resize(): void {
    // Full canvas size
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // Calculate table dimensions maintaining aspect ratio
    const targetRatio = RENDER.TABLE_ASPECT_RATIO;
    const screenRatio = this.width / this.height;
    
    if (screenRatio > targetRatio) {
      // Screen is wider than table
      this.tableHeight = this.height * 0.9;
      this.tableWidth = this.tableHeight * targetRatio;
    } else {
      // Screen is taller than table
      this.tableWidth = this.width * 0.9;
      this.tableHeight = this.tableWidth / targetRatio;
    }
    
    // Center the table
    this.tableX = (this.width - this.tableWidth) / 2;
    this.tableY = (this.height - this.tableHeight) / 2;
  }
  
  /**
   * Render a frame
   */
  render(state: RenderState): void {
    // Auto-resize if canvas has no dimensions (hidden parent)
    if (this.width === 0 || this.height === 0) {
      this.resize();
    }
    
    // Skip rendering if still no dimensions
    if (this.width === 0 || this.height === 0) {
      return;
    }
    
    // Clear
    this.ctx.fillStyle = '#121212';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw table
    this.drawTable();
    
    // Draw hit zones
    this.drawHitZones(state.playerHitZoneActive, state.opponentHitZoneActive);
    
    // Draw ball
    if (state.ball.visible) {
      this.drawBall(state.ball.x, state.ball.y);
    }
    
    // Draw slash effect on top
    this.drawSlash();
  }
  
  private drawTable(): void {
    const ctx = this.ctx;
    
    // Table background
    ctx.fillStyle = RENDER.COLOR_TABLE;
    ctx.fillRect(this.tableX, this.tableY, this.tableWidth, this.tableHeight);
    
    // Outer border
    ctx.strokeStyle = RENDER.COLOR_LINE;
    ctx.lineWidth = RENDER.LINE_WIDTH * 2;
    ctx.strokeRect(this.tableX, this.tableY, this.tableWidth, this.tableHeight);
    
    // Center line (net)
    ctx.strokeStyle = RENDER.COLOR_LINE;
    ctx.lineWidth = RENDER.NET_WIDTH;
    ctx.beginPath();
    ctx.moveTo(this.tableX, this.tableY + this.tableHeight / 2);
    ctx.lineTo(this.tableX + this.tableWidth, this.tableY + this.tableHeight / 2);
    ctx.stroke();
    
    // Center circle (decorative)
    ctx.strokeStyle = RENDER.COLOR_LINE;
    ctx.lineWidth = RENDER.LINE_WIDTH;
    ctx.beginPath();
    ctx.arc(
      this.tableX + this.tableWidth / 2,
      this.tableY + this.tableHeight / 2,
      this.tableWidth * 0.1,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    
    // Service lines
    const serviceLineY = this.tableHeight * 0.15;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    // Player service line
    ctx.moveTo(this.tableX + this.tableWidth * 0.2, this.tableY + this.tableHeight - serviceLineY);
    ctx.lineTo(this.tableX + this.tableWidth * 0.8, this.tableY + this.tableHeight - serviceLineY);
    // Opponent service line
    ctx.moveTo(this.tableX + this.tableWidth * 0.2, this.tableY + serviceLineY);
    ctx.lineTo(this.tableX + this.tableWidth * 0.8, this.tableY + serviceLineY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  private drawHitZones(playerActive: boolean, opponentActive: boolean): void {
    const ctx = this.ctx;
    const zoneHeight = this.tableHeight * 0.12;
    
    // Player hit zone (bottom)
    ctx.fillStyle = playerActive ? RENDER.COLOR_HIT_ZONE_ACTIVE : RENDER.COLOR_HIT_ZONE;
    ctx.fillRect(
      this.tableX,
      this.tableY + this.tableHeight - zoneHeight,
      this.tableWidth,
      zoneHeight
    );
    
    // Opponent hit zone (top)
    ctx.fillStyle = opponentActive ? RENDER.COLOR_HIT_ZONE_ACTIVE : RENDER.COLOR_HIT_ZONE;
    ctx.fillRect(
      this.tableX,
      this.tableY,
      this.tableWidth,
      zoneHeight
    );
  }
  
  private drawBall(x: number, y: number): void {
    const ctx = this.ctx;
    
    // Convert normalized coords to screen coords
    const screenX = this.tableX + x * this.tableWidth;
    const screenY = this.tableY + y * this.tableHeight;
    const radius = this.tableWidth * RENDER.BALL_RADIUS;
    
    // Ball shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(screenX + 3, screenY + 3, radius, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball
    ctx.fillStyle = RENDER.COLOR_BALL;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(screenX - radius * 0.3, screenY - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  /**
   * Show point scored flash effect
   */
  flashPoint(scorer: 'player' | 'opponent'): void {
    const ctx = this.ctx;
    const flashColor = scorer === 'player' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
    
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, this.width, this.height);
  }
  
  /**
   * Trigger a Fruit Ninja style slash effect
   */
  triggerSlash(speed: number, angle: number): void {
    this.slashActive = true;
    this.slashStartTime = performance.now();
    this.slashPoints = [];
    
    // Only show slash for meaningful swings (speed > 0.3)
    if (speed < 0.3) {
      this.slashActive = false;
      return;
    }
    
    // Scale slash based on swing intensity
    const intensity = Math.min(1, speed / 0.8); // Normalize speed to 0-1
    
    // Randomize starting position slightly for variety
    const randomOffsetX = (Math.random() - 0.5) * this.tableWidth * 0.3;
    const centerX = this.tableX + this.tableWidth / 2 + randomOffsetX;
    const centerY = this.tableY + this.tableHeight * 0.8;
    
    // Scale slash length with swing speed
    const baseLength = this.tableWidth * 0.3;
    const slashLength = baseLength + intensity * this.tableWidth * 0.4;
    
    // Map the swing angle to slash direction
    // angle: -45 to 45 degrees from phone -> slash direction
    const angleRad = (angle * Math.PI) / 180;
    
    // Calculate slash endpoints based on actual swing direction
    const startX = centerX - Math.cos(angleRad) * slashLength / 2;
    const startY = centerY + Math.sin(angleRad) * slashLength / 4;
    const endX = centerX + Math.cos(angleRad) * slashLength / 2;
    const endY = centerY - Math.sin(angleRad) * slashLength / 4;
    
    // Create blade points with dynamic curve based on speed
    const numPoints = 8 + Math.floor(intensity * 6);
    const arcHeight = 20 + intensity * 40;
    
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t - Math.sin(t * Math.PI) * arcHeight;
      this.slashPoints.push({
        x,
        y,
        alpha: intensity,
        time: this.slashStartTime + i * 10
      });
    }
  }
  
  /**
   * Draw the slash effect (call this in render loop)
   */
  private drawSlash(): void {
    if (!this.slashActive || this.slashPoints.length < 2) return;
    
    const ctx = this.ctx;
    const now = performance.now();
    const elapsed = now - this.slashStartTime;
    
    // Fade out slash over 300ms
    const fadeStart = 100;
    const fadeDuration = 200;
    const globalAlpha = elapsed > fadeStart 
      ? Math.max(0, 1 - (elapsed - fadeStart) / fadeDuration)
      : 1;
    
    if (globalAlpha <= 0) {
      this.slashActive = false;
      this.slashPoints = [];
      return;
    }
    
    // Draw glow effect
    ctx.save();
    ctx.globalAlpha = globalAlpha * 0.6;
    ctx.shadowColor = '#FF6F00';
    ctx.shadowBlur = 30;
    
    // Draw main slash trail
    ctx.beginPath();
    ctx.moveTo(this.slashPoints[0].x, this.slashPoints[0].y);
    
    for (let i = 1; i < this.slashPoints.length; i++) {
      const point = this.slashPoints[i];
      if (now >= point.time) {
        ctx.lineTo(point.x, point.y);
      }
    }
    
    // Create gradient for blade
    const gradient = ctx.createLinearGradient(
      this.slashPoints[0].x, this.slashPoints[0].y,
      this.slashPoints[this.slashPoints.length - 1].x, this.slashPoints[this.slashPoints.length - 1].y
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.5, 'rgba(255, 111, 0, 1)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0.8)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 8 * globalAlpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Inner white core
    ctx.globalAlpha = globalAlpha * 0.8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.restore();
    
    // Draw sparkles
    this.drawSparkles(globalAlpha);
  }
  
  /**
   * Draw sparkle particles around slash
   */
  private drawSparkles(alpha: number): void {
    const ctx = this.ctx;
    const now = performance.now();
    const elapsed = now - this.slashStartTime;
    
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    
    for (let i = 0; i < this.slashPoints.length; i += 2) {
      const point = this.slashPoints[i];
      if (now < point.time) continue;
      
      const sparkleOffset = elapsed * 0.3;
      const numSparkles = 3;
      
      for (let j = 0; j < numSparkles; j++) {
        const angle = (i + j) * 0.7 + elapsed * 0.01;
        const dist = 10 + sparkleOffset * (0.5 + Math.random() * 0.5);
        const sparkleX = point.x + Math.cos(angle) * dist;
        const sparkleY = point.y + Math.sin(angle) * dist;
        const size = 2 + Math.random() * 2;
        
        ctx.fillStyle = j % 2 === 0 ? '#FFEB3B' : '#FF6F00';
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  }
}
