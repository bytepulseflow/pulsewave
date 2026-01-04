/**
 * Error message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { ErrorMessage } from '@bytepulse/pulsewave-shared';

export class ErrorHandler extends BaseHandler {
  public readonly type = 'error';

  public handle(context: HandlerContext, message: ErrorMessage): void {
    const errorMessage = message.error?.message || 'Unknown error';
    this.emit(context, 'error', new Error(errorMessage));
  }
}
