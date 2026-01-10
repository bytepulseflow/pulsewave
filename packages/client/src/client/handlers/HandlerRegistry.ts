/**
 * Client Handler Registry
 *
 * Central registry for managing all WebSocket message handlers on the client side.
 * Implements the Registry pattern for easy handler management and lookup.
 */

import type { MessageHandler, HandlerContext } from './types';
import type { ServerMessage } from '@bytepulse/pulsewave-shared';
import { JoinedHandler } from './JoinedHandler';
import { ParticipantJoinedHandler } from './ParticipantJoinedHandler';
import { ParticipantLeftHandler } from './ParticipantLeftHandler';
import { TrackPublishedHandler } from './TrackPublishedHandler';
import { TrackUnpublishedHandler } from './TrackUnpublishedHandler';
import { TrackSubscribedHandler } from './TrackSubscribedHandler';
import { TrackUnsubscribedHandler } from './TrackUnsubscribedHandler';
import { TrackMutedHandler } from './TrackMutedHandler';
import { TrackUnmutedHandler } from './TrackUnmutedHandler';
import { TransportCreatedHandler } from './TransportCreatedHandler';
import { TransportConnectedHandler } from './TransportConnectedHandler';
import { DataHandler } from './DataHandler';
import { DataConsumerCreatedHandler } from './DataConsumerCreatedHandler';
import { DataConsumerClosedHandler } from './DataConsumerClosedHandler';
import { DataProducerCreatedHandler } from './DataProducerCreatedHandler';
import { ErrorHandler } from './ErrorHandler';
import { createModuleLogger } from '../../utils/logger';

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
    this.register(new JoinedHandler());
    this.register(new ParticipantJoinedHandler());
    this.register(new ParticipantLeftHandler());
    this.register(new TrackPublishedHandler());
    this.register(new TrackUnpublishedHandler());
    this.register(new TrackSubscribedHandler());
    this.register(new TrackUnsubscribedHandler());
    this.register(new TrackMutedHandler());
    this.register(new TrackUnmutedHandler());
    this.register(new TransportCreatedHandler());
    this.register(new TransportConnectedHandler());
    this.register(new DataHandler());
    this.register(new DataConsumerCreatedHandler());
    this.register(new DataConsumerClosedHandler());
    this.register(new DataProducerCreatedHandler());
    this.register(new ErrorHandler());
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
  public handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const messageType =
      typeof message === 'object' && message !== null && 'type' in message
        ? (message.type as string)
        : undefined;

    if (!messageType) {
      logger.warn('Invalid message: missing type');
      return;
    }

    const handler = this.get(messageType);

    if (!handler) {
      logger.warn(`No handler registered for message type: ${messageType}`);
      return;
    }

    try {
      handler.handle(context, message);
    } catch (error) {
      logger.error(`Error handling message type ${messageType}`, { error });
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
