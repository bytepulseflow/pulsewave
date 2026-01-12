/**
 * Call accepted message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { CallAcceptedMessage } from '@bytepulse/pulsewave-shared';
import type { CallInfo } from '../../types';
import { RemoteParticipantImpl } from '../Participant';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:call-accepted');

export class CallAcceptedHandler extends BaseHandler {
  public readonly type = 'call_accepted';

  public handle(context: HandlerContext, message: CallAcceptedMessage): void {
    const { callId, participant, metadata } = message;

    // Get or create participant from store
    let targetParticipant = context.client.getParticipant(participant.sid);

    if (!targetParticipant) {
      // Create a new participant entry for the target
      const newParticipant = new RemoteParticipantImpl({
        sid: participant.sid,
        identity: participant.identity,
        name: participant.name || participant.identity,
        state: participant.state,
        metadata: participant.metadata || {},
        tracks: [],
      });
      context.client.addParticipant(newParticipant);
      targetParticipant = newParticipant;
    }

    // Create call info
    const callInfo: CallInfo = {
      callId,
      callerSid: context.client.getLocalParticipant()?.sid || '',
      targetSid: participant.sid,
      participant: targetParticipant || undefined,
      metadata,
      state: 'accepted',
      startTime: Date.now(),
    };

    // Emit call accepted event
    context.client.emit('call-accepted', callInfo);

    logger.info(`Call accepted by ${participant.identity} (callId: ${callId})`);
  }
}
