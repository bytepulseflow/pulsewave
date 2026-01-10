/**
 * WebSocketServer - WebSocket server for signaling
 *
 * Using Command pattern with HandlerRegistry for better maintainability.
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { IncomingMessage } from 'http';
import type { RoomManager } from '../sfu';
import type { RedisManager } from '../redis';
import type { JwtConfig } from '../config';
import type { ServerMessage, ClientMessage } from '@bytepulse/pulsewave-shared';
import { ErrorCode } from '@bytepulse/pulsewave-shared';
import type { Room } from '../sfu/Room';
import { handlerRegistry, type WebSocketConnection } from './handlers';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('websocket');

/**
 * WebSocketServer class
 *
 * Manages WebSocket connections and delegates message handling to registered handlers.
 */
export class WebSocketServer {
  private wss: WSServer;
  private roomManager: RoomManager;
  private redisManager: RedisManager | null;
  private jwtConfig: JwtConfig;
  private connections: Map<string, WebSocketConnection>;

  constructor(
    httpServer: HTTPServer,
    roomManager: RoomManager,
    redisManager: RedisManager | null,
    jwtConfig: JwtConfig
  ) {
    this.roomManager = roomManager;
    this.redisManager = redisManager;
    this.jwtConfig = jwtConfig;
    this.connections = new Map();

    this.wss = new WSServer({ server: httpServer });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    const socketId = this.generateSocketId();
    (ws as WebSocketConnection).socketId = socketId;
    this.connections.set(socketId, ws as WebSocketConnection);

    logger.info(`WebSocket connected: ${socketId}`);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws as WebSocketConnection, data);
    });

    ws.on('close', () => {
      this.handleClose(ws as WebSocketConnection);
    });

    ws.on('error', (error) => {
      logger.error({ error, socketId }, 'WebSocket error');
    });
  }

  /**
   * Handle incoming message
   *
   * Delegates message handling to the HandlerRegistry.
   */
  private async handleMessage(ws: WebSocketConnection, data: Buffer): Promise<void> {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      logger.debug(`Received message: ${message.type} from ${ws.socketId}`);

      // Create handler context
      const context = {
        ws,
        roomManager: this.roomManager,
        redisManager: this.redisManager,
        jwtConfig: this.jwtConfig,
        connections: this.connections,
        broadcast: this.broadcastToRoom.bind(this),
      };

      // Handle message through registry
      await handlerRegistry.handle(context, message);
    } catch (error) {
      logger.error({ error }, 'Error handling message');
      this.sendError(ws, ErrorCode.Unknown, 'Failed to process message');
    }
  }

  /**
   * Handle WebSocket close
   */
  private async handleClose(ws: WebSocketConnection): Promise<void> {
    logger.info(`WebSocket disconnected: ${ws.socketId}`);

    // Handle leave if participant was in a room
    if (ws.roomSid && ws.participantSid) {
      const room = this.roomManager.getRoom(ws.roomSid);
      if (room) {
        const participant = room.getParticipant(ws.participantSid);
        if (participant) {
          // Notify other participants
          this.broadcastToRoom(
            room,
            {
              type: 'participant_left',
              participantSid: participant.sid,
            },
            ws.socketId
          );

          // Remove participant
          room.removeParticipant(participant.sid);

          logger.info(`Participant ${participant.identity} left room ${room.name}`);
        }
      }
    }

    this.connections.delete(ws.socketId);
  }

  /**
   * Send message to client
   */
  public send(ws: WebSocketConnection, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  public sendError(ws: WebSocketConnection, code: ErrorCode, message: string): void {
    this.send(ws, {
      type: 'error',
      error: {
        code,
        message,
      },
    });
  }

  /**
   * Broadcast message to all participants in a room
   */
  public broadcastToRoom(room: Room, message: ServerMessage, excludeSocketId?: string): void {
    for (const participant of room.getParticipants()) {
      const ws = this.connections.get(participant.socketId);
      if (ws && ws.socketId !== excludeSocketId) {
        this.send(ws, message);
      }
    }
  }

  /**
   * Generate socket ID
   */
  private generateSocketId(): string {
    return `socket_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Close the server
   */
  public close(): void {
    this.wss.close();
  }
}
