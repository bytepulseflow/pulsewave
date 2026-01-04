/**
 * Participant classes
 */

import type { ParticipantInfo, ConnectionState } from '@bytepulse/pulsewave-shared';
import type {
  Participant,
  ParticipantEvents,
  RemoteParticipant,
  RemoteTrackPublication,
  TrackSubscribeOptions,
} from '../types';
import { RemoteTrackPublicationImpl } from './TrackPublication';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('participant');

/**
 * Base Participant implementation
 */
export class ParticipantImpl implements Participant {
  public readonly sid: string;
  public readonly identity: string;
  public name: string;
  public state: ConnectionState;
  public metadata: Record<string, unknown>;
  public readonly isLocal: boolean = false;

  protected tracks: Map<string, RemoteTrackPublicationImpl> = new Map();
  protected listeners: Map<keyof ParticipantEvents, Set<(data: unknown) => void>> = new Map();
  protected info: ParticipantInfo;

  constructor(info: ParticipantInfo) {
    this.info = info;
    this.sid = info.sid;
    this.identity = info.identity;
    this.name = info.name || info.identity;
    this.state = info.state;
    this.metadata = info.metadata || {};

    // Initialize tracks with subscription callback
    info.tracks.forEach((trackInfo) => {
      const publication = new RemoteTrackPublicationImpl(trackInfo, trackInfo.sid);
      publication.setTrackSubscribedCallback(this.handleTrackSubscribed.bind(this));
      this.tracks.set(trackInfo.sid, publication);
    });
  }

  /**
   * Handle track subscribed callback from publication
   */
  private handleTrackSubscribed(publication: RemoteTrackPublicationImpl): void {
    logger.debug('Track subscribed', { sid: publication.sid, hasTrack: !!publication.track });
    this.emit('track-subscribed', publication);
  }

  /**
   * Get all track publications
   */
  getTracks(): RemoteTrackPublication[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Get track publication by SID
   */
  getTrack(sid: string): RemoteTrackPublication | undefined {
    return this.tracks.get(sid);
  }

  /**
   * Get track publication by name
   */
  getTrackByName(name: string): RemoteTrackPublication | undefined {
    return Array.from(this.tracks.values()).find((track) => track.name === name);
  }

  /**
   * Set metadata
   */
  async setMetadata(metadata: Record<string, unknown>): Promise<void> {
    this.metadata = metadata;
    this.emit('metadata-updated', metadata);
  }

  /**
   * Update participant info
   */
  updateInfo(info: ParticipantInfo): void {
    this.info = info;
    this.name = info.name || info.identity;
    this.state = info.state;
    this.metadata = info.metadata || {};

    // Update tracks
    info.tracks.forEach((trackInfo) => {
      let publication = this.tracks.get(trackInfo.sid);
      if (!publication) {
        publication = new RemoteTrackPublicationImpl(trackInfo, trackInfo.sid);
        publication.setTrackSubscribedCallback(this.handleTrackSubscribed.bind(this));
        this.tracks.set(trackInfo.sid, publication);
        this.emit('track-published', publication);
      } else {
        publication.setMuted(trackInfo.muted);
      }
    });

    // Remove tracks that no longer exist
    const currentTrackSids = new Set(info.tracks.map((t) => t.sid));
    for (const [sid, publication] of this.tracks.entries()) {
      if (!currentTrackSids.has(sid)) {
        this.tracks.delete(sid);
        publication.clearTrack();
        this.emit('track-unpublished', publication);
      }
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof ParticipantEvents>(event: K, listener: ParticipantEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.add(listener as (data: unknown) => void);
    }
  }

  /**
   * Remove event listener
   */
  off<K extends keyof ParticipantEvents>(event: K, listener: ParticipantEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as (data: unknown) => void);
    }
  }

  /**
   * Emit event
   */
  protected emit<K extends keyof ParticipantEvents>(event: K, data?: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          logger.error(`Error in ${String(event)} listener`, { error });
        }
      });
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.tracks.forEach((track) => track.clearTrack());
    this.tracks.clear();
  }
}

/**
 * RemoteParticipant implementation
 */
export class RemoteParticipantImpl extends ParticipantImpl implements RemoteParticipant {
  public readonly isLocal = false as const;

  private subscribeCallback?: (
    sid: string,
    subscribed: boolean,
    options?: TrackSubscribeOptions
  ) => Promise<void>;

  constructor(info: ParticipantInfo) {
    super(info);
  }

  /**
   * Get participant info
   */
  getInfo(): ParticipantInfo {
    return { ...this.info };
  }

  /**
   * Set subscribe callback
   */
  setSubscribeCallback(
    callback: (sid: string, subscribed: boolean, options?: TrackSubscribeOptions) => Promise<void>
  ): void {
    this.subscribeCallback = callback;
  }

  /**
   * Subscribe to a track
   */
  async subscribeToTrack(sid: string, options?: TrackSubscribeOptions): Promise<void> {
    const publication = this.tracks.get(sid);
    if (!publication) {
      throw new Error(`Track ${sid} not found`);
    }

    if (this.subscribeCallback) {
      await this.subscribeCallback(sid, true, options);
    }
    await publication.setSubscribed(true, options);
  }

  /**
   * Unsubscribe from a track
   */
  async unsubscribeFromTrack(sid: string): Promise<void> {
    const publication = this.tracks.get(sid);
    if (!publication) {
      throw new Error(`Track ${sid} not found`);
    }

    if (this.subscribeCallback) {
      await this.subscribeCallback(sid, false);
    }
    await publication.setSubscribed(false);
  }

  /**
   * Subscribe to all tracks
   */
  async subscribeToAllTracks(options?: TrackSubscribeOptions): Promise<void> {
    const promises = Array.from(this.tracks.values()).map((track) =>
      this.subscribeToTrack(track.sid, options)
    );
    await Promise.all(promises);
  }

  /**
   * Unsubscribe from all tracks
   */
  async unsubscribeFromAllTracks(): Promise<void> {
    const promises = Array.from(this.tracks.keys()).map((sid) => this.unsubscribeFromTrack(sid));
    await Promise.all(promises);
  }
}
