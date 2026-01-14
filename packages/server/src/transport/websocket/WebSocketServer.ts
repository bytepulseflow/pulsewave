/**
 * WebSocketServer - WebSocket server for signaling
 *
 * Using Command pattern with HandlerRegistry for better maintainability.
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';

import { AdapterManager } from '../../adapter';
import { RoomManager as ApplicationRoomManager, CallManager } from '../../application';
import { createModuleLogger } from '../../utils/logger';
import { RateLimiter, createDefaultRateLimiter } from '../../utils/RateLimiter';

import { handlerRegistry, type WebSocketConnection } from './handlers';
import { validateClientIntent, formatZodError } from './handlers/validation';

import type { ApplicationRoom } from '../../application/services/types';
import type { IncomingMessage, Server as HTTPServer } from 'http';
import type { JwtConfig } from '../../config';
import type { RedisManager } from '../../redis';
import type { ServerResponse } from '@bytepulse/pulsewave-shared';

const logger = createModuleLogger('websocket');

/**
 * WebSocketServer class
 *
 * Manages WebSocket connections and delegates message handling to registered handlers.
 */
export class WebSocketServer {
  private wss: WSServer;
  // Application Layer
  private applicationRoomManager: ApplicationRoomManager;
  private callManager: CallManager;
  // Adapter Layer
  private adapterManager: AdapterManager;
  // Other
  private redisManager: RedisManager | null;
  private jwtConfig: JwtConfig;
  private connections: Map<string, WebSocketConnection>;
  // Rate limiting
  private rateLimiter: RateLimiter;

  constructor(
    httpServer: HTTPServer,
    redisManager: RedisManager | null,
    jwtConfig: JwtConfig,
    adapterManager: AdapterManager
  ) {
    this.redisManager = redisManager;
    this.jwtConfig = jwtConfig;
    this.adapterManager = adapterManager;
    this.connections = new Map();

    // Initialize Application Layer
    this.applicationRoomManager = new ApplicationRoomManager();
    this.callManager = new CallManager();

    // Initialize rate limiter
    this.rateLimiter = createDefaultRateLimiter();

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
      // Check rate limit
      const rateLimitCheck = this.rateLimiter.check(ws.socketId);
      if (!rateLimitCheck.allowed) {
        logger.warn(
          `Rate limit exceeded for ${ws.socketId}, retry after ${rateLimitCheck.retryAfter}ms`
        );
        this.sendError(ws, 1, 'Rate limit exceeded');
        return;
      }

      // Parse and validate message
      const parsed = JSON.parse(data.toString());
      const validation = validateClientIntent(parsed);

      if (!validation.success) {
        logger.warn(`Invalid message from ${ws.socketId}: ${formatZodError(validation.error)}`);
        this.sendError(ws, 1, formatZodError(validation.error));
        return;
      }

      const message = validation.data;
      logger.debug(`Received intent: ${message.type} from ${ws.socketId}`);

      // Create handler context with layered architecture
      const context = {
        ws,
        // Application Layer
        applicationRoomManager: this.applicationRoomManager,
        callManager: this.callManager,
        // Adapter Layer
        adapterManager: this.adapterManager,
        redisManager: this.redisManager,
        jwtConfig: this.jwtConfig,
        connections: this.connections,
        broadcast: this.broadcastToRoom.bind(this),
      };

      // Handle message through registry
      await handlerRegistry.handle(context, message);
    } catch (error) {
      logger.error({ error }, 'Error handling message');
      this.sendError(ws, 0, 'Failed to process message');
    }
  }

  /**
   * Handle WebSocket close
   */
  private async handleClose(ws: WebSocketConnection): Promise<void> {
    logger.info(`WebSocket disconnected: ${ws.socketId}`);

    // Clean up rate limiter data for this connection
    this.rateLimiter.reset(ws.socketId);

    // Handle leave if participant was in a room
    if (ws.roomSid && ws.participantSid) {
      // Remove from Application Layer
      const appRoom = this.applicationRoomManager.getRoom(ws.roomSid);
      if (appRoom) {
        const appParticipant = appRoom.getParticipant(ws.participantSid);
        if (appParticipant) {
          // Notify other participants
          this.broadcastToRoom(
            appRoom,
            {
              type: 'participant_left',
              participantSid: appParticipant.sid,
            },
            ws.socketId
          );

          // Remove participant
          appRoom.removeParticipant(appParticipant.sid);

          logger.info(`Participant ${appParticipant.identity} left room ${appRoom.name}`);
        }
      }
    }

    this.connections.delete(ws.socketId);
  }

  /**
   * Send message to client
   */
  public send(ws: WebSocketConnection, message: ServerResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  public sendError(ws: WebSocketConnection, code: number, message: string): void {
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
  public broadcastToRoom(
    room: ApplicationRoom,
    message: ServerResponse,
    excludeSocketId?: string
  ): void {
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
