/**
 * Base handler class for WebSocket messages
 *
 * Provides common functionality for all handlers including:
 * - Message validation
 * - Error sending
 * - Message sending helpers
 */

import type { WebSocketConnection, HandlerContext } from './types';
import type { ClientIntent, ServerResponse } from '@bytepulse/pulsewave-shared';
import { ErrorCode } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../../utils/logger';

const logger = createModuleLogger('handler:base');

/**
 * Base handler class for intent-based messages
 */
export abstract class BaseHandler {
  /**
   * Message type this handler handles
   */
  public abstract readonly type: string;

  /**
   * Handle the message
   */
  public abstract handle(context: HandlerContext, message: ClientIntent): Promise<void>;

  /**
   * Send a message to the client
   */
  protected send(ws: WebSocketConnection, message: ServerResponse): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      logger.warn(`Attempted to send message to closed socket: ${ws.socketId}`);
    }
  }

  /**
   * Send an error to the client
   */
  protected sendError(ws: WebSocketConnection, code: ErrorCode, message: string): void {
    this.send(ws, {
      type: 'error',
      error: {
        code,
        message,
      },
    });
  }

  /**
   * Get the application room from context
   */
  protected getApplicationRoom(context: HandlerContext) {
    if (!context.ws.roomSid) {
      return null;
    }
    return context.applicationRoomManager.getRoom(context.ws.roomSid);
  }

  /**
   * Get the application participant from context
   */
  protected getApplicationParticipant(context: HandlerContext) {
    const room = this.getApplicationRoom(context);
    if (!room || !context.ws.participantSid) {
      return null;
    }
    return room.getParticipant(context.ws.participantSid);
  }

  /**
   * Get the mediasoup adapter for the current room
   */
  protected async getAdapter(context: HandlerContext) {
    if (!context.ws.roomSid) {
      return null;
    }
    return context.adapterManager.getAdapter(context.ws.roomSid);
  }

  /**
   * Create a mediasoup adapter for the current room
   */
  protected async createAdapter(context: HandlerContext) {
    if (!context.ws.roomSid) {
      throw new Error('Room SID not found');
    }
    return context.adapterManager.createAdapter(context.ws.roomSid);
  }
}
