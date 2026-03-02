import { NETWORK } from '@paddlelink/shared';
import type { SwingMessage, PoseMessage, ClientMessage, ServerMessage } from '@paddlelink/shared';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'waiting' | 'ready';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private roomCode: string = '';
  private serverUrl: string = '';
  private reconnectAttempts = 0;
  private state: ConnectionState = 'disconnected';
  
  // Pose streaming throttle
  private lastPoseSendTime = 0;
  private POSE_SEND_INTERVAL = 16; // ~60Hz
  
  private onStateChangeCallback: ((state: ConnectionState, message?: string) => void) | null = null;
  private onMessageCallback: ((message: ServerMessage) => void) | null = null;
  
  /**
   * Get the WebSocket server URL
   */
  private getServerUrl(): string {
    // 1. Use manually set server URL (from UI input)
    if (this.serverUrl) {
      return this.serverUrl;
    }
    // 2. Use deployed URL if set via env var
    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    // 3. Production default (Railway)
    if (window.location.hostname.includes('railway.app')) {
      return 'wss://paddlelinkserver-production.up.railway.app';
    }
    // 4. Local development fallback
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const port = import.meta.env.VITE_WS_PORT || NETWORK.DEFAULT_PORT;
    return `${protocol}//${host}:${port}`;
  }
  
  /**
   * Set custom server URL (for Railway deployment)
   */
  setServerUrl(url: string): void {
    this.serverUrl = url;
  }
  
  /**
   * Register state change callback
   */
  onStateChange(callback: (state: ConnectionState, message?: string) => void): void {
    this.onStateChangeCallback = callback;
  }
  
  /**
   * Register message callback
   */
  onMessage(callback: (message: ServerMessage) => void): void {
    this.onMessageCallback = callback;
  }
  
  /**
   * Connect to server and join room
   */
  connect(roomCode: string): void {
    this.roomCode = roomCode.toUpperCase();
    this.reconnectAttempts = 0;
    this.doConnect();
  }
  
  /**
   * Disconnect from server
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
   * Send swing data to server (legacy event-based)
   */
  sendSwing(speed: number, angle: number, spin: number, yaw?: number, pitch?: number, roll?: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send swing: not connected');
      return;
    }
    
    const message: SwingMessage = {
      type: 'swing',
      speed,
      angle,
      spin,
      timestamp: performance.now(),
      yaw,
      pitch,
      roll
    };
    
    this.ws.send(JSON.stringify(message));
  }
  
  /**
   * Send continuous pose data (Magic Remote style)
   * Streams quaternion + angular velocity at ~60Hz
   */
  sendPose(quaternion: [number, number, number, number], angularVelocity: [number, number, number]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return; // Silent fail for streaming - don't spam console
    }
    
    // Throttle to ~60Hz
    const now = performance.now();
    if (now - this.lastPoseSendTime < this.POSE_SEND_INTERVAL) {
      return;
    }
    this.lastPoseSendTime = now;
    
    const message: PoseMessage = {
      type: 'pose',
      q: quaternion,
      angularVel: angularVelocity,
      timestamp: now
    };
    
    this.ws.send(JSON.stringify(message));
  }
  
  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }
  
  private doConnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    
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
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }
  
  private handleOpen(): void {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    
    // Send join message
    const joinMessage: ClientMessage = {
      type: 'join',
      roomCode: this.roomCode,
      playerType: 'paddle',
    };
    
    this.ws?.send(JSON.stringify(joinMessage));
    
    this.state = 'waiting';
    this.onStateChangeCallback?.(this.state, 'Joining room...');
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ServerMessage;
      
      // Handle connection status messages
      if (message.type === 'connected') {
        this.state = 'connected';
        this.onStateChangeCallback?.(this.state, 'Connected!');
      } else if (message.type === 'waiting') {
        this.state = 'waiting';
        this.onStateChangeCallback?.(this.state, 'Waiting for game display...');
      } else if (message.type === 'gameState') {
        this.state = 'ready';
        this.onStateChangeCallback?.(this.state);
      }
      
      this.onMessageCallback?.(message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }
  
  private handleClose(event: CloseEvent): void {
    console.log('WebSocket closed:', event.code, event.reason);
    
    if (this.state !== 'disconnected') {
      this.scheduleReconnect();
    }
  }
  
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= NETWORK.RECONNECT_MAX_ATTEMPTS) {
      this.state = 'disconnected';
      this.onStateChangeCallback?.(this.state, 'Connection failed');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = NETWORK.RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    
    this.state = 'connecting';
    this.onStateChangeCallback?.(this.state, `Reconnecting (${this.reconnectAttempts})...`);
    
    setTimeout(() => {
      if (this.state !== 'disconnected') {
        this.doConnect();
      }
    }, delay);
  }
}
