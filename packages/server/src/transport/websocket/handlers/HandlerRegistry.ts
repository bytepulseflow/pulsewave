/**
 * Handler Registry
 *
 * Central registry for managing all WebSocket message handlers.
 * Implements the Registry pattern for easy handler management and lookup.
 */

import type { MessageHandler, HandlerContext } from './types';
import type { ClientIntent } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../../utils/logger';

// Import handlers from domain folders
import { JoinRoomHandler, LeaveRoomHandler } from './room';
import { StartCallHandler, AcceptCallHandler, RejectCallHandler, EndCallHandler } from './call';
import {
  EnableCameraHandler,
  DisableCameraHandler,
  EnableMicrophoneHandler,
  DisableMicrophoneHandler,
  MuteTrackHandler,
  UnmuteTrackHandler,
  SubscribeToParticipantHandler,
  UnsubscribeFromParticipantHandler,
} from './media';
import { SendDataHandler } from './data';

const logger = createModuleLogger('handler-registry');

export class HandlerRegistry {
  private handlers: Map<string, MessageHandler> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    // Room domain handlers
    this.register(new JoinRoomHandler());
    this.register(new LeaveRoomHandler());

    // Call domain handlers
    this.register(new StartCallHandler());
    this.register(new AcceptCallHandler());
    this.register(new RejectCallHandler());
    this.register(new EndCallHandler());

    // Media domain handlers
    this.register(new EnableCameraHandler());
    this.register(new DisableCameraHandler());
    this.register(new EnableMicrophoneHandler());
    this.register(new DisableMicrophoneHandler());
    this.register(new MuteTrackHandler());
    this.register(new UnmuteTrackHandler());
    this.register(new SubscribeToParticipantHandler());
    this.register(new UnsubscribeFromParticipantHandler());

    // Data domain handlers
    this.register(new SendDataHandler());
  }

  /**
   * Register a new handler
   */
  public register(handler: MessageHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Unregister a handler by type
   */
  public unregister(type: string): void {
    this.handlers.delete(type);
  }

  /**
   * Get a handler by message type
   */
  public get(type: string): MessageHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Check if a handler exists for a message type
   */
  public has(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Get all registered handler types
   */
  public getTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Handle a message using the appropriate handler
   */
  public async handle(context: HandlerContext, message: ClientIntent): Promise<void> {
    const handler = this.get(message.type);

    if (!handler) {
      logger.warn(`No handler registered for message type: ${message.type}`);
      return;
    }

    try {
      await handler.handle(context, message);
    } catch (error) {
      logger.error({ error }, `Error handling message type ${message.type}`);
      // Send error to client
      if (context.ws.readyState === 1) {
        context.ws.send(
          JSON.stringify({
            type: 'error',
            error: {
              code: 500,
              message: 'Internal server error',
            },
          })
        );
      }
    }
  }

  /**
   * Clear all handlers
   */
  public clear(): void {
    this.handlers.clear();
  }
}

// Export singleton instance for convenience
export const handlerRegistry = new HandlerRegistry();
