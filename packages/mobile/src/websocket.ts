import { NETWORK } from '@paddlelink/shared';
import type { SwingMessage, PoseMessage, OrientationMessage, CalibrateMessage, ClientMessage, ServerMessage } from '@paddlelink/shared';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'waiting' | 'ready';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private roomCode: string = '';
  private serverUrl: string = '';
  private reconnectAttempts = 0;
  private state: ConnectionState = 'disconnected';
  
  // Pose streaming throttle
  private lastPoseSendTime = 0;
  private lastOrientationSendTime = 0;
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
    
    // Persist room code and server URL for reconnect on refresh
    sessionStorage.setItem('paddlelink_mobile_room', this.roomCode);
    if (this.serverUrl) {
      sessionStorage.setItem('paddlelink_mobile_server', this.serverUrl);
    }
    
    this.doConnect();
  }
  
  /**
   * Disconnect from server (keeps room saved for auto-reconnect)
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
   * Leave room permanently and clear saved state
   */
  leaveRoom(): void {
    sessionStorage.removeItem('paddlelink_mobile_room');
    sessionStorage.removeItem('paddlelink_mobile_server');
    this.disconnect();
    this.roomCode = '';
  }
  
  /**
   * Get saved room code from previous session
   */
  getSavedRoom(): string | null {
    return sessionStorage.getItem('paddlelink_mobile_room');
  }
  
  /**
   * Get saved server URL from previous session
   */
  getSavedServerUrl(): string | null {
    return sessionStorage.getItem('paddlelink_mobile_server');
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
   * Send raw orientation data (for test reality room)
   * Streams alpha/beta/gamma + acceleration at ~30Hz
   */
  sendOrientation(alpha: number, beta: number, gamma: number, accel: { x: number; y: number; z: number }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Throttle to ~30Hz (test room doesn't need 60Hz)
    const now = performance.now();
    if (now - this.lastOrientationSendTime < 33) {
      return;
    }
    this.lastOrientationSendTime = now;
    
    const message: OrientationMessage = {
      type: 'orientation',
      alpha,
      beta,
      gamma,
      accel,
      timestamp: now
    };
    
    this.ws.send(JSON.stringify(message));
  }
  
  /**
   * Send calibration event to server/desktop
   */
  sendCalibrate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] sendCalibrate: ws not open, readyState =', this.ws?.readyState);
      return;
    }
    
    const message: CalibrateMessage = {
      type: 'calibrate',
      timestamp: performance.now()
    };
    
    console.log('[WS] Sending calibrate message');
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
    
    // Auto-reconnect if we still have a saved room
    if (this.state !== 'disconnected' || sessionStorage.getItem('paddlelink_mobile_room')) {
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
