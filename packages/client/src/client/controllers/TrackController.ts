/**
 * TrackController - Manages track publishing and subscription
 *
 * Handles track publication, subscription, and state management.
 * Provides high-level methods for enabling/disabling camera and microphone.
 */

import { TrackSource, TrackKind } from '@bytepulse/pulsewave-shared';
import type {
  RemoteTrack,
  RemoteTrackPublication,
  TrackSubscribeOptions,
  LocalTrackPublication,
} from '../../types';
import { RemoteTrack as RemoteTrackImpl } from '../RemoteTrack';
import { LocalTrack as LocalTrackImpl } from '../LocalTrack';
import { LocalTrackPublicationImpl } from '../TrackPublication';
import type { types } from 'mediasoup-client';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('track-controller');

/**
 * Local track state
 */
interface LocalTrackState {
  track: MediaStreamTrack | null;
  producer: types.Producer | null;
  publicationSid: string | null;
}

/**
 * TrackController - Manages track publishing and subscription
 */
export class TrackController {
  private localAudioTrack: LocalTrackState = {
    track: null,
    producer: null,
    publicationSid: null,
  };
  private localVideoTrack: LocalTrackState = {
    track: null,
    producer: null,
    publicationSid: null,
  };

  constructor(
    private readonly webRTCController: {
      publishTrack: (
        track: MediaStreamTrack,
        options: { source: string }
      ) => Promise<types.Producer>;
      unpublishTrack: (producerId: string) => Promise<void>;
      subscribeToTrack: (producerId: string) => Promise<types.Consumer>;
      unsubscribeFromTrack: (consumerId: string) => Promise<void>;
    },
    private readonly participantStore: {
      findTrackPublication: (sid: string) => RemoteTrackPublication | null;
      getParticipantFromPublication: (publication: RemoteTrackPublication) => {
        sid: string;
        identity: string;
      } | null;
      addLocalTrack: (publication: LocalTrackPublication) => void;
      removeLocalTrackByProducerId: (producerId: string) => LocalTrackPublication | null;
    },
    private readonly emitEvent: (event: string, data: unknown) => void
  ) {}

  /**
   * Publish local track
   */
  async publishLocalTrack(
    track: MediaStreamTrack,
    kind: TrackKind,
    source: TrackSource
  ): Promise<{ sid: string; producer: types.Producer }> {
    const producer = await this.webRTCController.publishTrack(track, { source });
    const sid = producer.id;

    if (kind === 'audio') {
      this.localAudioTrack = { track, producer, publicationSid: sid };
    } else {
      this.localVideoTrack = { track, producer, publicationSid: sid };
    }

    return { sid, producer };
  }

  /**
   * Unpublish local track
   */
  async unpublishLocalTrack(kind: TrackKind): Promise<void> {
    const state = kind === 'audio' ? this.localAudioTrack : this.localVideoTrack;

    if (state.track) {
      state.track.stop();
    }

    if (state.producer) {
      await this.webRTCController.unpublishTrack(state.producer.id);
    }

    if (kind === 'audio') {
      this.localAudioTrack = { track: null, producer: null, publicationSid: null };
    } else {
      this.localVideoTrack = { track: null, producer: null, publicationSid: null };
    }
  }

  /**
   * Get local track state
   */
  getLocalTrackState(kind: TrackKind): LocalTrackState {
    return kind === 'audio' ? this.localAudioTrack : this.localVideoTrack;
  }

  /**
   * Subscribe to remote track
   */
  async subscribeToTrack(
    sid: string,
    _options?: TrackSubscribeOptions
  ): Promise<RemoteTrack | null> {
    const publication = this.participantStore.findTrackPublication(sid);
    if (!publication) {
      throw new Error(`Track ${sid} not found`);
    }

    const consumer = await this.webRTCController.subscribeToTrack(sid);

    if (!consumer.track) {
      return null;
    }

    const track = new RemoteTrackImpl(
      {
        sid,
        kind: consumer.kind as TrackKind,
        source: publication.source as TrackSource,
        muted: false,
      },
      consumer.track
    );

    // Update publication with track
    (publication as unknown as { setTrack: (track: RemoteTrack) => void }).setTrack(track);

    // Emit subscribed event
    track.emitSubscribed();
    this.emitEvent('track-subscribed', {
      track,
      publication,
      participant: this.participantStore.getParticipantFromPublication(publication),
    });

    return track;
  }

  /**
   * Unsubscribe from remote track
   */
  async unsubscribeFromTrack(sid: string): Promise<void> {
    const publication = this.participantStore.findTrackPublication(sid);
    if (!publication) {
      throw new Error(`Track ${sid} not found`);
    }

    const track = publication.track;
    (publication as unknown as { clearTrack: () => void }).clearTrack();

    if (track) {
      (track as RemoteTrackImpl).emitUnsubscribed();
      this.emitEvent('track-unsubscribed', {
        track,
        publication,
        participant: this.participantStore.getParticipantFromPublication(publication),
      });
    }
  }

  /**
   * Stop all local tracks
   */
  stopAllLocalTracks(): void {
    if (this.localAudioTrack.track) {
      this.localAudioTrack.track.stop();
    }
    if (this.localVideoTrack.track) {
      this.localVideoTrack.track.stop();
    }
    this.localAudioTrack = { track: null, producer: null, publicationSid: null };
    this.localVideoTrack = { track: null, producer: null, publicationSid: null };
  }

  /**
   * Get local audio track
   */
  getLocalAudioTrack(): MediaStreamTrack | null {
    return this.localAudioTrack.track;
  }

  /**
   * Get local video track
   */
  getLocalVideoTrack(): MediaStreamTrack | null {
    return this.localVideoTrack.track;
  }

  /**
   * Get local audio producer
   */
  getLocalAudioProducer(): types.Producer | null {
    return this.localAudioTrack.producer;
  }

  /**
   * Get local video producer
   */
  getLocalVideoProducer(): types.Producer | null {
    return this.localVideoTrack.producer;
  }

  /**
   * Enable camera (video)
   * High-level method that handles all domain construction logic
   * @param mediaTrack - The media track to publish
   * @returns The publication SID
   */
  async enableCamera(mediaTrack: MediaStreamTrack): Promise<string> {
    // Publish via WebRTC
    const { sid } = await this.publishLocalTrack(mediaTrack, TrackKind.Video, TrackSource.Camera);

    // Create domain objects (LocalTrack and LocalTrackPublication)
    const localTrack = new LocalTrackImpl(
      {
        sid,
        kind: TrackKind.Video,
        source: TrackSource.Camera,
        muted: false,
      },
      mediaTrack
    );

    const publication = new LocalTrackPublicationImpl(
      {
        sid,
        kind: TrackKind.Video,
        source: TrackSource.Camera,
        muted: false,
        simulcast: false,
      },
      'camera',
      localTrack
    );

    // Add to participant store
    this.participantStore.addLocalTrack(publication);

    logger.info('Camera enabled, track SID:', sid);
    return sid;
  }

  /**
   * Disable camera (video)
   * High-level method that handles cleanup
   */
  async disableCamera(): Promise<void> {
    // Unpublish via WebRTC
    await this.unpublishLocalTrack(TrackKind.Video);

    // Remove from participant store
    const producer = this.getLocalVideoProducer();
    if (producer) {
      this.participantStore.removeLocalTrackByProducerId(producer.id);
    }

    logger.info('Camera disabled');
  }

  /**
   * Enable microphone (audio)
   * High-level method that handles all domain construction logic
   * @param mediaTrack - The media track to publish
   * @returns The publication SID
   */
  async enableMicrophone(mediaTrack: MediaStreamTrack): Promise<string> {
    // Publish via WebRTC
    const { sid } = await this.publishLocalTrack(
      mediaTrack,
      TrackKind.Audio,
      TrackSource.Microphone
    );

    // Create domain objects (LocalTrack and LocalTrackPublication)
    const localTrack = new LocalTrackImpl(
      {
        sid,
        kind: TrackKind.Audio,
        source: TrackSource.Microphone,
        muted: false,
      },
      mediaTrack
    );

    const publication = new LocalTrackPublicationImpl(
      {
        sid,
        kind: TrackKind.Audio,
        source: TrackSource.Microphone,
        muted: false,
        simulcast: false,
      },
      'microphone',
      localTrack
    );

    // Add to participant store
    this.participantStore.addLocalTrack(publication);

    logger.info('Microphone enabled, track SID:', sid);
    return sid;
  }

  /**
   * Disable microphone (audio)
   * High-level method that handles cleanup
   */
  async disableMicrophone(): Promise<void> {
    // Unpublish via WebRTC
    await this.unpublishLocalTrack(TrackKind.Audio);

    // Remove from participant store
    const producer = this.getLocalAudioProducer();
    if (producer) {
      this.participantStore.removeLocalTrackByProducerId(producer.id);
    }

    logger.info('Microphone disabled');
  }
}
