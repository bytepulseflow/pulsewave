/**
 * Error message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';

export class ErrorHandler extends BaseHandler {
  public readonly type = 'error';

  public handle(context: HandlerContext, message: any): void {
    this.emit(context, 'error', new Error(message.error || 'Unknown error'));
  }
}
