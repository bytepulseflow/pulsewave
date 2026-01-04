/**
 * Handler Registry
 *
 * Central registry for managing all WebSocket message handlers.
 * Implements the Registry pattern for easy handler management and lookup.
 */

import type { MessageHandler, HandlerContext } from './types';
import type { ClientMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';
import { JoinHandler } from './JoinHandler';
import { LeaveHandler } from './LeaveHandler';
import { CreateWebRtcTransportHandler } from './CreateWebRtcTransportHandler';
import { ConnectTransportHandler } from './ConnectTransportHandler';
import { PublishHandler } from './PublishHandler';
import { UnpublishHandler } from './UnpublishHandler';
import { SubscribeHandler } from './SubscribeHandler';
import { UnsubscribeHandler } from './UnsubscribeHandler';
import { ResumeConsumerHandler } from './ResumeConsumerHandler';
import { MuteHandler } from './MuteHandler';
import { DataHandler } from './DataHandler';

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
    this.register(new JoinHandler());
    this.register(new LeaveHandler());
    this.register(new CreateWebRtcTransportHandler());
    this.register(new ConnectTransportHandler());
    this.register(new PublishHandler());
    this.register(new UnpublishHandler());
    this.register(new SubscribeHandler());
    this.register(new UnsubscribeHandler());
    this.register(new ResumeConsumerHandler());
    this.register(new MuteHandler());
    this.register(new DataHandler());
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
  public async handle(context: HandlerContext, message: ClientMessage): Promise<void> {
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
