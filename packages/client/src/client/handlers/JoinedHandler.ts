/**
 * Joined message handler
 */

import type { ParticipantInfo, JoinedMessage, ServerMessage } from '@bytepulse/pulsewave-shared';
import type { TrackSubscribeOptions } from '../../types';
import { BaseHandler } from './BaseHandler';
import type { HandlerContext } from './types';
import { LocalParticipantImpl } from '../LocalParticipant';
import { RemoteParticipantImpl } from '../Participant';
import type { RoomClient } from '../RoomClient';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('handler:joined');

export class JoinedHandler extends BaseHandler {
  public readonly type = 'joined';

  public handle(context: HandlerContext, message: ServerMessage | Record<string, unknown>): void {
    const joinedMessage = message as unknown as JoinedMessage;
    const client = context.client as RoomClient;

    // Set room info and RTP capabilities
    client.setRoomInfo(joinedMessage.room);
    client.setRtpCapabilities(joinedMessage.rtpCapabilities ?? null);

    // Create local participant
    const localParticipant = new LocalParticipantImpl(joinedMessage.participant);
    client.setLocalParticipant(localParticipant);

    localParticipant.setPublishDataCallback(async (data: unknown, kind: 'reliable' | 'lossy') => {
      client.send({
        type: 'data',
        kind,
        value: data,
      });
    });

    // Set camera/microphone callbacks
    localParticipant.setEnableCameraCallback((deviceId?: string) => client.enableCamera(deviceId));
    localParticipant.setDisableCameraCallback(() => client.disableCamera());
    localParticipant.setEnableMicrophoneCallback((deviceId?: string) =>
      client.enableMicrophone(deviceId)
    );
    localParticipant.setDisableMicrophoneCallback(() => client.disableMicrophone());

    this.emit(context, 'local-participant-joined', localParticipant);

    // Add existing participants
    joinedMessage.otherParticipants.forEach((info: ParticipantInfo) => {
      const participant = new RemoteParticipantImpl(info);
      participant.setSubscribeCallback(
        async (sid: string, subscribed: boolean, options?: TrackSubscribeOptions) => {
          if (subscribed) {
            await client.subscribeToTrack(sid, options);
          } else {
            await client.unsubscribeFromTrack(sid);
          }
        }
      );
      client.addParticipant(participant);
      this.emit(context, 'participant-joined', participant);
    });

    // Auto-subscribe to all existing tracks if enabled
    if ((client.options as { autoSubscribe?: boolean }).autoSubscribe !== false) {
      // Initialize WebRTC first
      client
        .ensureWebRTCInitialized()
        .then(async () => {
          // Initialize WebRTC data provider if configured
          // This will trigger transport connection via produceData()
          await client.initializeWebRTCDataProvider();

          // Subscribe to all tracks
          await client.subscribeToAllTracks();
          logger.info('Auto-subscribed to all existing tracks');
        })
        .catch((error: Error) =>
          logger.error('Failed to auto-subscribe to existing tracks', { error })
        );
    }
  }
}
