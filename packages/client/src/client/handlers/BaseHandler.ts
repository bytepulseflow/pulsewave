/**
 * Base handler for client message handlers
 *
 * Provides common functionality for all message handlers.
 */

import type { MessageHandler, HandlerContext, EmitFunction } from './types';
import { ServerMessage } from '@bytepulse/pulsewave-shared';

export abstract class BaseHandler implements MessageHandler {
  public abstract readonly type: string;
  public abstract handle(
    context: HandlerContext,
    message: ServerMessage | Record<string, unknown>
  ): void;

  /**
   * Emit an event through the client
   */
  protected emit(context: HandlerContext, event: string, data?: unknown): void {
    (context.client as { emit: (event: string, data?: unknown) => void }).emit(event, data);
  }

  /**
   * Get the emit function from client
   */
  protected getEmitFunction(context: HandlerContext): EmitFunction {
    return (event: string, data?: unknown) => this.emit(context, event, data);
  }
}
