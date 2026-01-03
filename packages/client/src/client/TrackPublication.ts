/**
 * TrackPublication classes
 */

import type { TrackInfo, TrackKind, TrackSource } from '@bytepulse/pulsewave-shared';
import type {
  TrackPublication,
  LocalTrackPublication,
  RemoteTrackPublication,
  TrackSubscribeOptions,
} from '../types';
import { LocalTrack } from './LocalTrack';
import { RemoteTrack } from './RemoteTrack';

/**
 * Base TrackPublication implementation
 */
export class TrackPublicationImpl implements TrackPublication {
  public readonly sid: string;
  public readonly kind: TrackKind;
  public readonly name: string;
  public readonly source: TrackSource;
  public muted: boolean;
  public subscribed: boolean;
  public readonly simulcast: boolean;

  constructor(info: TrackInfo, name: string) {
    this.sid = info.sid;
    this.kind = info.kind;
    this.name = name;
    this.source = info.source;
    this.muted = info.muted;
    this.subscribed = false;
    this.simulcast = info.simulcast || false;
  }

  /**
   * Update muted state
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * Update subscribed state
   */
  setSubscribed(subscribed: boolean): void {
    this.subscribed = subscribed;
  }
}

/**
 * LocalTrackPublication implementation
 */
export class LocalTrackPublicationImpl
  extends TrackPublicationImpl
  implements LocalTrackPublication
{
  public track: LocalTrack | null;
  private unpublishCallback?: () => Promise<void>;

  constructor(info: TrackInfo, name: string, track: LocalTrack | null) {
    super(info, name);
    this.track = track;
  }

  /**
   * Set unpublish callback
   */
  setUnpublishCallback(callback: () => Promise<void>): void {
    this.unpublishCallback = callback;
  }

  /**
   * Unpublish the track
   */
  async unpublish(): Promise<void> {
    if (this.unpublishCallback) {
      await this.unpublishCallback();
    }
  }
}

/**
 * RemoteTrackPublication implementation
 */
export class RemoteTrackPublicationImpl
  extends TrackPublicationImpl
  implements RemoteTrackPublication
{
  public track: RemoteTrack | null = null;
  public enabled: boolean = true;
  private subscribeCallback?: (
    subscribed: boolean,
    options?: TrackSubscribeOptions
  ) => Promise<void>;
  private trackSubscribedCallback?: (publication: RemoteTrackPublicationImpl) => void;

  constructor(info: TrackInfo, name: string) {
    super(info, name);
  }

  /**
   * Set the remote track
   */
  setTrack(track: RemoteTrack): void {
    this.track = track;
    this.subscribed = true;
    // Notify participant that track was subscribed
    if (this.trackSubscribedCallback) {
      this.trackSubscribedCallback(this);
    }
  }

  /**
   * Set callback for when track is subscribed
   */
  setTrackSubscribedCallback(callback: (publication: RemoteTrackPublicationImpl) => void): void {
    this.trackSubscribedCallback = callback;
  }

  /**
   * Clear the remote track
   */
  clearTrack(): void {
    if (this.track) {
      this.track.removeAllListeners();
      this.track.stop();
    }
    this.track = null;
    this.subscribed = false;
  }

  /**
   * Set subscribe callback
   */
  setSubscribeCallback(
    callback: (subscribed: boolean, options?: TrackSubscribeOptions) => Promise<void>
  ): void {
    this.subscribeCallback = callback;
  }

  /**
   * Set subscription status
   */
  async setSubscribed(subscribed: boolean, options?: TrackSubscribeOptions): Promise<void> {
    if (this.subscribeCallback) {
      await this.subscribeCallback(subscribed, options);
    }
    this.subscribed = subscribed;
  }

  /**
   * Update enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
