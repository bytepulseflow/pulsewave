/**
 * Mute/Unmute track handler
 */

import { CLIENT_EVENTS } from '@bytepulse/pulsewave-shared';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import type { MuteMessage } from '@bytepulse/pulsewave-shared';

export class MuteHandler extends BaseHandler {
  public readonly type = CLIENT_EVENTS.MUTE;

  public async handle(context: HandlerContext, message: MuteMessage): Promise<void> {
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
      const { trackSid, muted } = message;

      if (muted) {
        participant.muteTrack(trackSid);
      } else {
        participant.unmuteTrack(trackSid);
      }

      // Notify other participants
      context.broadcast(
        room,
        {
          type: 'track_muted',
          participantSid: participant.sid,
          trackSid,
          muted,
        },
        context.ws.socketId
      );

      console.log(`Track ${trackSid} ${muted ? 'muted' : 'unmuted'}`);
    } catch (error) {
      console.error('Failed to mute track:', error);
    }
  }
}
