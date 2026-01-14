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
import { toDomainError, RateLimitError } from '../../domain';

import { handlerRegistry, type WebSocketConnection } from './handlers';
import { validateClientIntent, formatZodError } from './handlers/validation';

import type { ApplicationRoom } from '../../application/services/types';
import type { IncomingMessage, Server as HTTPServer } from 'http';
import type { JwtConfig } from '../../config';
import type { StateStore } from '../../state';
import type { ServerResponse } from '@bytepulse/pulsewave-shared';

const logger = createModuleLogger('websocket');

/**
 * Broadcast delivery statistics
 */
export interface BroadcastResult {
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  skippedDeliveries: number;
  failureRate: number;
  failures: Array<{
    participantSid: string;
    socketId: string;
    reason: string;
  }>;
}

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
  private stateStore: StateStore | null;
  private jwtConfig: JwtConfig;
  private connections: Map<string, WebSocketConnection>;
  // Rate limiting
  private rateLimiter: RateLimiter;
  // Broadcast metrics
  private broadcastMetrics: {
    totalBroadcasts: number;
    totalDeliveries: number;
    totalFailures: number;
  };

  constructor(
    httpServer: HTTPServer,
    stateStore: StateStore | null,
    jwtConfig: JwtConfig,
    adapterManager: AdapterManager
  ) {
    this.stateStore = stateStore;
    this.jwtConfig = jwtConfig;
    this.adapterManager = adapterManager;
    this.connections = new Map();

    // Initialize Application Layer
    this.applicationRoomManager = new ApplicationRoomManager();
    this.callManager = new CallManager();

    // Initialize rate limiter
    this.rateLimiter = createDefaultRateLimiter();

    // Initialize broadcast metrics
    this.broadcastMetrics = {
      totalBroadcasts: 0,
      totalDeliveries: 0,
      totalFailures: 0,
    };

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
        // Use RateLimitError for consistent error handling
        const rateLimitError = new RateLimitError(
          100, // Default limit from createDefaultRateLimiter
          60 * 1000, // Default window from createDefaultRateLimiter
          rateLimitCheck.retryAfter ?? 0,
          { socketId: ws.socketId }
        );
        this.sendDomainError(ws, rateLimitError);
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
        stateStore: this.stateStore,
        jwtConfig: this.jwtConfig,
        connections: this.connections,
        broadcast: this.broadcastToRoom.bind(this),
      };

      // Handle message through registry
      await handlerRegistry.handle(context, message);
    } catch (error) {
      const domainError = toDomainError(error);
      logger.error({ error: domainError }, 'Error handling message');
      this.sendDomainError(ws, domainError);
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
   * Send domain error to client with proper error code mapping
   */
  private sendDomainError(ws: WebSocketConnection, error: ReturnType<typeof toDomainError>): void {
    // Map domain error codes to numeric error codes
    let errorCode = 0; // Default: Unknown error
    switch (error.code) {
      case 'RESOURCE_NOT_FOUND':
        errorCode = 404;
        break;
      case 'RESOURCE_EXISTS':
        errorCode = 409;
        break;
      case 'INVALID_STATE':
        errorCode = 400;
        break;
      case 'VALIDATION_ERROR':
        errorCode = 400;
        break;
      case 'RATE_LIMIT_EXCEEDED':
        errorCode = 429;
        break;
      case 'AUTHENTICATION_FAILED':
        errorCode = 401;
        break;
      case 'AUTHORIZATION_FAILED':
        errorCode = 403;
        break;
      case 'TIMEOUT':
        errorCode = 504;
        break;
      case 'CIRCUIT_BREAKER_OPEN':
        errorCode = 503;
        break;
      case 'MEDIA_ERROR':
        errorCode = 500;
        break;
      case 'NETWORK_ERROR':
        errorCode = 502;
        break;
      case 'INTERNAL_ERROR':
      default:
        errorCode = 500;
        break;
    }

    this.sendError(ws, errorCode, error.message);
  }

  /**
   * Broadcast message to all participants in a room
   * Returns delivery statistics for monitoring
   */
  public broadcastToRoom(
    room: ApplicationRoom,
    message: ServerResponse,
    excludeSocketId?: string
  ): BroadcastResult {
    this.broadcastMetrics.totalBroadcasts++;

    const result: BroadcastResult = {
      totalRecipients: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      skippedDeliveries: 0,
      failureRate: 0,
      failures: [],
    };

    const participants = room.getParticipants();
    result.totalRecipients = participants.length;

    for (const participant of participants) {
      // Skip excluded socket
      if (participant.socketId === excludeSocketId) {
        result.skippedDeliveries++;
        continue;
      }

      const ws = this.connections.get(participant.socketId);

      if (!ws) {
        // Connection not found - participant disconnected
        result.failedDeliveries++;
        result.failures.push({
          participantSid: participant.sid,
          socketId: participant.socketId,
          reason: 'Connection not found',
        });
        continue;
      }

      // Check if connection is open
      if (ws.readyState !== WebSocket.OPEN) {
        result.failedDeliveries++;
        result.failures.push({
          participantSid: participant.sid,
          socketId: participant.socketId,
          reason: `Connection not ready (state: ${ws.readyState})`,
        });
        continue;
      }

      // Attempt to send message
      try {
        ws.send(JSON.stringify(message));
        result.successfulDeliveries++;
        this.broadcastMetrics.totalDeliveries++;
      } catch (error) {
        result.failedDeliveries++;
        result.failures.push({
          participantSid: participant.sid,
          socketId: participant.socketId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
        this.broadcastMetrics.totalFailures++;
      }
    }

    // Calculate failure rate
    const deliveredCount = result.successfulDeliveries + result.failedDeliveries;
    result.failureRate = deliveredCount > 0 ? result.failedDeliveries / deliveredCount : 0;

    // Log if there were failures
    if (result.failedDeliveries > 0) {
      logger.warn(
        {
          roomSid: room.sid,
          roomName: room.name,
          result,
        },
        `Broadcast had ${result.failedDeliveries} failures out of ${result.totalRecipients} recipients`
      );
    }

    // Alert on high failure rate (>10%)
    if (result.failureRate > 0.1 && result.totalRecipients > 5) {
      logger.error(
        {
          roomSid: room.sid,
          roomName: room.name,
          failureRate: result.failureRate,
          failures: result.failures,
          messageType: message.type,
        },
        `High broadcast failure rate: ${(result.failureRate * 100).toFixed(1)}%`
      );
    }

    return result;
  }

  /**
   * Get broadcast metrics
   */
  public getBroadcastMetrics() {
    return {
      ...this.broadcastMetrics,
      overallFailureRate:
        this.broadcastMetrics.totalDeliveries > 0
          ? this.broadcastMetrics.totalFailures / this.broadcastMetrics.totalDeliveries
          : 0,
    };
  }

  /**
   * Reset broadcast metrics
   */
  public resetBroadcastMetrics(): void {
    this.broadcastMetrics = {
      totalBroadcasts: 0,
      totalDeliveries: 0,
      totalFailures: 0,
    };
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
