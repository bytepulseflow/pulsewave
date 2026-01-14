/**
 * Participant classes
 */

import type { ParticipantInfo, ConnectionState, TrackInfo } from '@bytepulse/pulsewave-shared';
import type {
  Participant,
  ParticipantEvents,
  RemoteParticipant,
  RemoteTrackPublication,
  TrackSubscribeOptions,
} from '../types';
import { RemoteTrackPublicationImpl } from './TrackPublication';
import { createModuleLogger, EventEmitter } from '../utils';

const logger = createModuleLogger('participant');

/**
 * Base Participant implementation
 */
export class ParticipantImpl extends EventEmitter<ParticipantEvents> implements Participant {
  public readonly sid: string;
  public readonly identity: string;
  public state: ConnectionState;
  public metadata: Record<string, unknown>;
  public readonly isLocal: boolean = false;

  /**
   * Track publications map - accessible by components
   */
  public readonly tracks: Map<string, RemoteTrackPublicationImpl> = new Map();

  protected info: ParticipantInfo;
  private _name: string;

  constructor(info: ParticipantInfo) {
    super({ name: 'Participant' });
    this.info = info;
    this.sid = info.sid;
    this.identity = info.identity;
    this._name = info.name || info.identity;
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
   * Get participant name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Set participant name
   */
  set name(value: string) {
    this._name = value;
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
    const oldName = this._name;
    const oldState = this.state;
    const oldMetadata = this.metadata;

    this.info = info;
    this._name = info.name || info.identity;
    this.state = info.state;
    this.metadata = info.metadata || {};

    // Emit events for state changes
    if (oldName !== this._name) {
      this.emit('name-changed', this._name);
    }
    if (oldState !== this.state) {
      this.emit('state-changed', this.state);
    }
    if (JSON.stringify(oldMetadata) !== JSON.stringify(this.metadata)) {
      this.emit('metadata-updated', this.metadata);
    }

    // First, remove tracks that no longer exist in info.tracks
    const currentTrackSids = new Set(info.tracks.map((t) => t.sid));
    for (const [sid, publication] of this.tracks.entries()) {
      if (!currentTrackSids.has(sid)) {
        this.tracks.delete(sid);
        publication.clearTrack();
        this.emit('track-unpublished', publication);
      }
    }

    // Then, update/add tracks from info.tracks
    // Group tracks by source and kind to ensure only one track per source-kind combination
    const tracksBySourceKind = new Map<string, TrackInfo>();
    info.tracks.forEach((trackInfo) => {
      const key = `${trackInfo.source}-${trackInfo.kind}`;
      // Only keep the last track for each source-kind combination
      tracksBySourceKind.set(key, trackInfo);
    });

    // Remove old tracks that have been replaced by new tracks of the same source-kind
    for (const trackInfo of tracksBySourceKind.values()) {
      // Find other publications with the same source-kind
      for (const [sid, publication] of this.tracks.entries()) {
        if (
          sid !== trackInfo.sid &&
          publication.source === trackInfo.source &&
          publication.kind === trackInfo.kind
        ) {
          this.tracks.delete(sid);
          publication.clearTrack();
          this.emit('track-unpublished', publication);
        }
      }
    }

    // Now process the remaining tracks - only the latest track for each source-kind combination
    const tracksToProcess = Array.from(tracksBySourceKind.values());
    tracksToProcess.forEach((trackInfo) => {
      let publication = this.tracks.get(trackInfo.sid);

      if (!publication) {
        // New publication
        publication = new RemoteTrackPublicationImpl(trackInfo, trackInfo.sid);
        publication.setTrackSubscribedCallback(this.handleTrackSubscribed.bind(this));
        this.tracks.set(trackInfo.sid, publication);
        this.emit('track-published', publication);
      } else if (!publication.track) {
        // Re-publication: publication exists but track was cleared
        // Recreate the publication to ensure all track info is updated
        publication = new RemoteTrackPublicationImpl(trackInfo, trackInfo.sid);
        publication.setTrackSubscribedCallback(this.handleTrackSubscribed.bind(this));
        this.tracks.set(trackInfo.sid, publication);
        this.emit('track-published', publication);
      } else {
        // Existing publication with track, just update muted state
        publication.setMuted(trackInfo.muted);
      }
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    super.removeAllListeners();
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
