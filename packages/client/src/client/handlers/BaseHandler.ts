/**
 * Base handler for client message handlers
 *
 * Provides common functionality for all message handlers.
 */

import type { MessageHandler, HandlerContext, EmitFunction } from './types';

export abstract class BaseHandler implements MessageHandler {
  public abstract readonly type: string;
  public abstract handle(context: HandlerContext, message: any): void;

  /**
   * Emit an event through the client
   */
  protected emit(context: HandlerContext, event: string, data?: unknown): void {
    (context.client as any).emit(event, data);
  }

  /**
   * Get the emit function from client
   */
  protected getEmitFunction(context: HandlerContext): EmitFunction {
    return (event: any, data?: unknown) => this.emit(context, event, data);
  }
}
