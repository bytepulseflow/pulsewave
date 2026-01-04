/**
 * Unsubscribe from track handler
 */

import { CLIENT_EVENTS } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { UnsubscribeMessage } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:unsubscribe');

export class UnsubscribeHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.UNSUBSCRIBE;

  public async handle(context: HandlerContext, message: UnsubscribeMessage): Promise<void> {
    if (!this.validateParticipant(context)) {
      return;
    }

    const room = this.getRoom(context);
    if (!room) {
      return;
    }

    const participant = this.getParticipant(context);
    if (!participant) {
      return;
    }

    try {
      const { consumerId } = message;

      // Remove consumer
      participant.removeConsumer(consumerId);

      logger.info(`Track unsubscribed: ${consumerId}`);
    } catch (error) {
      logger.error({ error }, 'Failed to unsubscribe from track');
    }
  }
}
