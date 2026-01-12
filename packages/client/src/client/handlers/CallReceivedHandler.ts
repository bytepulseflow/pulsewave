/**
 * Call received message handler
 */

import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { CallReceivedMessage } from '@bytepulse/pulsewave-shared';
import type { CallInfo, Participant } from '../../types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:call-received');

export class CallReceivedHandler extends BaseHandler {
  public readonly type = 'call_received';

  public handle(context: HandlerContext, message: CallReceivedMessage): void {
    const { callId, caller, metadata } = message;

    // Get or create participant from store
    let participant: Participant | null = context.client.getParticipant(caller.sid);

    if (!participant) {
      // Create a new participant entry for the caller
      participant = {
        sid: caller.sid,
        identity: caller.identity,
        name: caller.name || caller.identity,
        state: caller.state,
        metadata: caller.metadata || {},
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
      context.client.addParticipant(participant as any);
    }

    // Create call info
    const callInfo: CallInfo = {
      callId,
      callerSid: caller.sid,
      targetSid: context.client.getLocalParticipant()?.sid || '',
      caller: participant,
      metadata,
      state: 'pending',
      startTime: Date.now(),
    };

    // Emit call received event
    context.client.emit('call-received', callInfo);

    logger.info(`Call received from ${caller.identity} (callId: ${callId})`);
  }
}
