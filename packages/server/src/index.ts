import { WebSocketServer as WSServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { NETWORK } from '@paddlelink/shared';
import { RoomManager } from './rooms.js';
import type { ClientMessage, JoinMessage, SwingMessage, PoseMessage } from '@paddlelink/shared';

const PORT = Number(process.env.PORT) || NETWORK.DEFAULT_PORT;

// Create WebSocket server
const wss = new WSServer({ port: PORT });
const roomManager = new RoomManager();

console.log(`PaddleLink WebSocket Server starting on port ${PORT}...`);

wss.on('listening', () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
  console.log(`Active rooms: ${roomManager.getActiveRoomsCount()}`);
});

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`New connection from: ${clientIp}`);
  
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      handleMessage(ws, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  
  ws.on('close', () => {
    console.log(`Connection closed: ${clientIp}`);
    roomManager.handleDisconnect(ws);
  });
  
  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws: WebSocket, message: ClientMessage): void {
  switch (message.type) {
    case 'join':
      handleJoin(ws, message);
      break;
      
    case 'swing':
      handleSwing(ws, message);
      break;
      
    case 'pose':
      handlePose(ws, message);
      break;
      
    case 'rematch':
      handleRematch(ws);
      break;
      
    default:
      console.warn('Unknown message type:', (message as any).type);
  }
}

function handleJoin(ws: WebSocket, message: JoinMessage): void {
  const { roomCode, playerType } = message;
  
  console.log(`Join request: room=${roomCode}, type=${playerType}`);
  
  const result = roomManager.joinRoom(roomCode, ws, playerType);
  
  if (!result.success) {
    ws.send(JSON.stringify({ type: 'roomFull', message: result.message }));
    return;
  }
  
  // Send connection status
  ws.send(JSON.stringify({ 
    type: result.message, // 'connected' or 'waiting'
    roomCode 
  }));
  
  // If both connected, notify the other player
  if (result.message === 'connected') {
    const room = result.room;
    const otherPlayer = playerType === 'paddle' ? room.display : room.paddle;
    
    if (otherPlayer && otherPlayer.ws.readyState === 1) {
      otherPlayer.ws.send(JSON.stringify({ type: 'connected', roomCode }));
    }
  }
}

function handleSwing(ws: WebSocket, message: SwingMessage): void {
  // Find the room this paddle is in
  const room = roomManager.findRoomBySocket(ws);
  
  if (!room) {
    console.warn('Swing from unknown socket');
    return;
  }
  
  // Forward swing to display
  if (room.display && room.display.ws.readyState === 1) {
    room.display.ws.send(JSON.stringify(message));
  }
  
  room.lastActivity = Date.now();
}

function handlePose(ws: WebSocket, message: PoseMessage): void {
  // Find the room this paddle is in
  const room = roomManager.findRoomBySocket(ws);
  
  if (!room) {
    return; // Silent fail for streaming - don't spam console
  }
  
  // Forward pose to display (low latency critical)
  if (room.display && room.display.ws.readyState === 1) {
    room.display.ws.send(JSON.stringify(message));
  }
  
  // Update activity (but don't log pose messages - too frequent)
  room.lastActivity = Date.now();
}

function handleRematch(ws: WebSocket): void {
  const room = roomManager.findRoomBySocket(ws);
  
  if (!room) return;
  
  // Broadcast rematch to both players
  const rematchMsg = JSON.stringify({ type: 'rematch' });
  
  if (room.paddle && room.paddle.ws.readyState === 1) {
    room.paddle.ws.send(rematchMsg);
  }
  if (room.display && room.display.ws.readyState === 1) {
    room.display.ws.send(rematchMsg);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Log stats periodically
setInterval(() => {
  const stats = {
    connections: wss.clients.size,
    rooms: roomManager.getActiveRoomsCount(),
  };
  console.log(`Stats: ${stats.connections} connections, ${stats.rooms} rooms`);
}, 60000);
