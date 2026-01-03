/**
 * Resume consumer handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { ResumeConsumerMessage } from '@bytepulse/pulsewave-shared';

export class ResumeConsumerHandler extends BaseHandler {
  public readonly type = 'resume_consumer';

  public async handle(context: HandlerContext, message: ResumeConsumerMessage): Promise<void> {
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
      const consumer = participant.getConsumer(consumerId);

      if (consumer) {
        await consumer.resume();
        console.log(`Consumer resumed: ${consumerId}`);
      }
    } catch (error) {
      console.error('Failed to resume consumer:', error);
    }
  }
}
