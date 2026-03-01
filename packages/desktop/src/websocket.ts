import { NETWORK, ROOM } from '@paddlelink/shared';
import type { ClientMessage, SwingMessage } from '@paddlelink/shared';

type ConnectionState = 'disconnected' | 'connecting' | 'waiting' | 'connected';

export class WebSocketServer {
  private ws: WebSocket | null = null;
  private roomCode: string = '';
  private state: ConnectionState = 'disconnected';
  
  private onStateChangeCallback: ((state: ConnectionState) => void) | null = null;
  private onSwingCallback: ((swing: SwingMessage) => void) | null = null;
  
  /**
   * Generate a random room code
   */
  private generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM.CODE_LENGTH; i++) {
      code += ROOM.CODE_CHARS.charAt(Math.floor(Math.random() * ROOM.CODE_CHARS.length));
    }
    return code;
  }
  
  /**
   * Get WebSocket server URL
   */
  private getServerUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const port = import.meta.env.VITE_WS_PORT || NETWORK.DEFAULT_PORT;
    return `${protocol}//${host}:${port}`;
  }
  
  /**
   * Register state change callback
   */
  onStateChange(callback: (state: ConnectionState) => void): void {
    this.onStateChangeCallback = callback;
  }
  
  /**
   * Register swing callback
   */
  onSwing(callback: (swing: SwingMessage) => void): void {
    this.onSwingCallback = callback;
  }
  
  /**
   * Connect and create room
   */
  connect(): void {
    this.roomCode = this.generateRoomCode();
    this.doConnect();
  }
  
  /**
   * Disconnect
   */
  disconnect(): void {
    this.state = 'disconnected';
    this.onStateChangeCallback?.(this.state);
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  /**
   * Get current room code
   */
  getRoomCode(): string {
    return this.roomCode;
  }
  
  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }
  
  private doConnect(): void {
    this.state = 'connecting';
    this.onStateChangeCallback?.(this.state);
    
    try {
      const url = this.getServerUrl();
      console.log('Connecting to:', url);
      this.ws = new WebSocket(url);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('WebSocket error:', error);
      this.state = 'disconnected';
      this.onStateChangeCallback?.(this.state);
    }
  }
  
  private handleOpen(): void {
    console.log('WebSocket connected');
    
    // Join as display
    const joinMessage: ClientMessage = {
      type: 'join',
      roomCode: this.roomCode,
      playerType: 'display',
    };
    
    this.ws?.send(JSON.stringify(joinMessage));
    
    this.state = 'waiting';
    this.onStateChangeCallback?.(this.state);
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'connected') {
        this.state = 'connected';
        this.onStateChangeCallback?.(this.state);
      } else if (message.type === 'swing') {
        this.onSwingCallback?.(message as SwingMessage);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }
  
  private handleClose(): void {
    console.log('WebSocket closed');
    this.state = 'disconnected';
    this.onStateChangeCallback?.(this.state);
  }
  
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
  }
}
