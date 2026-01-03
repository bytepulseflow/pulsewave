/**
 * Base message handler class
 */

import type { HandlerContext, MessageHandler, WebSocketConnection } from './types';
import type { ClientMessage, ServerMessage } from '@bytepulse/pulsewave-shared';

/**
 * Abstract base class for message handlers
 * Provides common functionality for all handlers
 */
export abstract class BaseHandler implements MessageHandler {
  public abstract readonly type: string;

  /**
   * Handle the message
   */
  public abstract handle(context: HandlerContext, message: ClientMessage): Promise<void>;

  /**
   * Send a message to the client
   */
  protected send(ws: WebSocketConnection, message: ServerMessage): void {
    if (ws.readyState === 1) {
      // WebSocket.OPEN = 1
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send an error to the client
   */
  protected sendError(ws: WebSocketConnection, code: number, message: string): void {
    this.send(ws, {
      type: 'error',
      error: {
        code,
        message,
      },
    });
  }

  /**
   * Get room from context
   */
  protected getRoom(context: HandlerContext) {
    if (!context.ws.roomSid) {
      return null;
    }
    return context.roomManager.getRoom(context.ws.roomSid);
  }

  /**
   * Get participant from context
   */
  protected getParticipant(context: HandlerContext) {
    const room = this.getRoom(context);
    if (!room || !context.ws.participantSid) {
      return null;
    }
    return room.getParticipant(context.ws.participantSid);
  }

  /**
   * Validate that participant is in a room
   */
  protected validateParticipant(context: HandlerContext): boolean {
    if (!context.ws.roomSid || !context.ws.participantSid) {
      return false;
    }
    return true;
  }
}
