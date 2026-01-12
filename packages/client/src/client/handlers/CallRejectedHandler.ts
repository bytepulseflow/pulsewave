/**
 * Call rejected message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { CallRejectedMessage } from '@bytepulse/pulsewave-shared';
import type { CallInfo, Participant } from '../../types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:call-rejected');

export class CallRejectedHandler extends BaseHandler {
  public readonly type = 'call_rejected';

  public handle(context: HandlerContext, message: CallRejectedMessage): void {
    const { callId, participant, reason } = message;

    // Get or create participant from store
    let targetParticipant: Participant | null = context.client.getParticipant(participant.sid);

    if (!targetParticipant) {
      // Create a new participant entry for the target
      targetParticipant = {
        sid: participant.sid,
        identity: participant.identity,
        name: participant.name || participant.identity,
        state: participant.state,
        metadata: participant.metadata || {},
        isLocal: false,
        tracks: new Map(),
        getTracks: () => [],
        getTrack: () => undefined,
        getTrackByName: () => undefined,
        setMetadata: async () => {},
        on: () => {},
        off: () => {},
        removeAllListeners: () => {},
      };
      context.client.addParticipant(targetParticipant as any);
    }

    // Create call info with reason in metadata
    const callInfo: CallInfo = {
      callId,
      callerSid: context.client.getLocalParticipant()?.sid || '',
      targetSid: participant.sid,
      participant: targetParticipant,
      metadata: reason ? { reason } : undefined,
      state: 'rejected',
      startTime: Date.now(),
      endTime: Date.now(),
    };

    // Emit call rejected event
    context.client.emit('call-rejected', callInfo);

    logger.info(
      `Call rejected by ${participant.identity} (callId: ${callId}, reason: ${reason || 'No reason provided'})`
    );
  }
}
