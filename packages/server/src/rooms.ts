import type WebSocket from 'ws';

export interface Player {
  ws: WebSocket;
  type: 'paddle' | 'display';
  joinedAt: number;
}

export interface Room {
  code: string;
  paddle: Player | null;
  display: Player | null;
  createdAt: number;
  lastActivity: number;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  
  /** Room expires after 1 hour of inactivity */
  private readonly ROOM_TIMEOUT_MS = 60 * 60 * 1000;
  
  constructor() {
    // Cleanup stale rooms every 5 minutes
    setInterval(() => this.cleanupStaleRooms(), 5 * 60 * 1000);
  }
  
  /**
   * Create or get a room
   */
  getOrCreateRoom(code: string): Room {
    let room = this.rooms.get(code);
    
    if (!room) {
      room = {
        code,
        paddle: null,
        display: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      this.rooms.set(code, room);
      console.log(`Room created: ${code}`);
    }
    
    room.lastActivity = Date.now();
    return room;
  }
  
  /**
   * Join a room
   */
  joinRoom(code: string, ws: WebSocket, playerType: 'paddle' | 'display'): { room: Room; success: boolean; message: string } {
    const room = this.getOrCreateRoom(code);
    
    const player: Player = {
      ws,
      type: playerType,
      joinedAt: Date.now(),
    };
    
    if (playerType === 'paddle') {
      if (room.paddle && room.paddle.ws.readyState === 1) {
        return { room, success: false, message: 'Room already has a paddle connected' };
      }
      room.paddle = player;
      console.log(`Paddle joined room: ${code}`);
    } else {
      if (room.display && room.display.ws.readyState === 1) {
        return { room, success: false, message: 'Room already has a display connected' };
      }
      room.display = player;
      console.log(`Display joined room: ${code}`);
    }
    
    room.lastActivity = Date.now();
    
    // Check if both players are now connected
    const bothConnected = this.isRoomReady(room);
    
    return { 
      room, 
      success: true, 
      message: bothConnected ? 'connected' : 'waiting'
    };
  }
  
  /**
   * Check if room has both players
   */
  isRoomReady(room: Room): boolean {
    return !!(
      room.paddle && 
      room.display && 
      room.paddle.ws.readyState === 1 && 
      room.display.ws.readyState === 1
    );
  }
  
  /**
   * Handle player disconnect
   */
  handleDisconnect(ws: WebSocket): void {
    for (const [code, room] of this.rooms) {
      if (room.paddle?.ws === ws) {
        room.paddle = null;
        console.log(`Paddle left room: ${code}`);
        
        // Notify display
        if (room.display && room.display.ws.readyState === 1) {
          room.display.ws.send(JSON.stringify({ type: 'opponentDisconnected' }));
        }
      }
      
      if (room.display?.ws === ws) {
        room.display = null;
        console.log(`Display left room: ${code}`);
        
        // Notify paddle
        if (room.paddle && room.paddle.ws.readyState === 1) {
          room.paddle.ws.send(JSON.stringify({ type: 'opponentDisconnected' }));
        }
      }
      
      // Delete empty rooms
      if (!room.paddle && !room.display) {
        this.rooms.delete(code);
        console.log(`Room deleted: ${code}`);
      }
    }
  }
  
  /**
   * Get room by code
   */
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }
  
  /**
   * Find room containing a WebSocket
   */
  findRoomBySocket(ws: WebSocket): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.paddle?.ws === ws || room.display?.ws === ws) {
        return room;
      }
    }
    return undefined;
  }
  
  /**
   * Get all active rooms count
   */
  getActiveRoomsCount(): number {
    return this.rooms.size;
  }
  
  /**
   * Cleanup stale rooms
   */
  private cleanupStaleRooms(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > this.ROOM_TIMEOUT_MS) {
        // Close any remaining connections
        room.paddle?.ws.close();
        room.display?.ws.close();
        
        this.rooms.delete(code);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} stale rooms`);
    }
  }
}
