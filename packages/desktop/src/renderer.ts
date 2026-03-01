import { RENDER } from '@paddlelink/shared';

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
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  private resize(): void {
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
}
