/**
 * Track subscribed message handler
 */

import type { ServerMessage, TrackSubscribedMessage } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:track-subscribed');

export class TrackSubscribedHandler extends BaseHandler {
  public readonly type = 'track_subscribed';

  public handle(_context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const trackSubscribedMessage = message as unknown as TrackSubscribedMessage;
    // This is handled by subscribeToTrack method
    logger.debug('Track subscribed:', trackSubscribedMessage);
  }
}
