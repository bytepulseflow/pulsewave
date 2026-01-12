/**
 * Call received message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { CallReceivedMessage } from '@bytepulse/pulsewave-shared';
import type { CallInfo } from '../../types';
import { RemoteParticipantImpl } from '../Participant';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:call-received');

export class CallReceivedHandler extends BaseHandler {
  public readonly type = 'call_received';

  public handle(context: HandlerContext, message: CallReceivedMessage): void {
    const { callId, caller, metadata } = message;

    // Get or create participant from store
    let participant = context.client.getParticipant(caller.sid);

    if (!participant) {
      // Create a new participant entry for the caller
      const newParticipant = new RemoteParticipantImpl({
        sid: caller.sid,
        identity: caller.identity,
        name: caller.name || caller.identity,
        state: caller.state,
        metadata: caller.metadata || {},
        tracks: [],
      });
      context.client.addParticipant(newParticipant);
      participant = newParticipant;
    }

    // Create call info
    const callInfo: CallInfo = {
      callId,
      callerSid: caller.sid,
      targetSid: context.client.getLocalParticipant()?.sid || '',
      caller: participant || undefined,
      metadata,
      state: 'pending',
      startTime: Date.now(),
    };

    // Emit call received event
    context.client.emit('call-received', callInfo);

    logger.info(`Call received from ${caller.identity} (callId: ${callId})`);
  }
}
