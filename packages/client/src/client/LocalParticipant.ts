/**
 * LocalParticipant implementation
 */

import type { ParticipantInfo, ConnectionState, TrackSource } from '@bytepulse/pulsewave-shared';
import type {
  LocalParticipant,
  LocalParticipantEvents,
  LocalTrackPublication,
  TrackPublishOptions,
  LocalTrack as LocalTrackType,
} from '../types';
import { LocalTrack } from './LocalTrack';
import { LocalTrackPublicationImpl } from './TrackPublication';
import { MediaManager } from '../media/MediaManager';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('local-participant');

/**
 * LocalParticipant implementation
 */
export class LocalParticipantImpl implements LocalParticipant {
  public readonly sid: string;
  public readonly identity: string;
  public name: string;
  public state: ConnectionState;
  public metadata: Record<string, unknown>;
  public readonly isLocal = true as const;

  public tracks: Map<string, LocalTrackPublicationImpl> = new Map();
  protected listeners: Map<keyof LocalParticipantEvents, Set<(data: unknown) => void>> = new Map();

  private publishCallback?: (track: LocalTrack, options?: TrackPublishOptions) => Promise<void>;
  private unpublishCallback?: (sid: string) => Promise<void>;
  private publishDataCallback?: (data: unknown, kind: 'reliable' | 'lossy') => Promise<void>;
  private enableCameraCallback?: (deviceId?: string) => Promise<void>;
  private disableCameraCallback?: () => Promise<void>;
  private enableMicrophoneCallback?: (deviceId?: string) => Promise<void>;
  private disableMicrophoneCallback?: () => Promise<void>;
  private mediaManager: MediaManager;

  constructor(info: ParticipantInfo) {
    this.sid = info.sid;
    this.identity = info.identity;
    this.name = info.name || info.identity;
    this.state = info.state;
    this.metadata = info.metadata || {};
    this.mediaManager = new MediaManager();

    // Initialize tracks from server info
    info.tracks.forEach((trackInfo) => {
      // Note: Local tracks are created by the client, not from server info
      // This is just a placeholder for tracks that were already published
      const publication = new LocalTrackPublicationImpl(trackInfo, trackInfo.sid, null);
      this.tracks.set(trackInfo.sid, publication);
    });
  }

  /**
   * Get all track publications
   */
  getTracks(): LocalTrackPublication[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Get track publication by SID
   */
  getTrack(sid: string): LocalTrackPublication | undefined {
    return this.tracks.get(sid);
  }

  /**
   * Get track publication by name
   */
  getTrackByName(name: string): LocalTrackPublication | undefined {
    return Array.from(this.tracks.values()).find((track) => track.name === name);
  }

  /**
   * Publish a track
   */
  async publishTrack(
    track: LocalTrackType,
    options?: TrackPublishOptions
  ): Promise<LocalTrackPublication> {
    // Create track info
    const trackInfo = {
      sid: this.generateTrackSid(),
      kind: track.kind,
      source: track.source as TrackSource,
      muted: track.isMuted,
      simulcast: options?.simulcast || false,
    };

    // Create publication
    const publication = new LocalTrackPublicationImpl(
      trackInfo,
      trackInfo.sid,
      track as LocalTrack
    );
    publication.setUnpublishCallback(async () => {
      if (this.unpublishCallback) {
        await this.unpublishCallback(trackInfo.sid);
      }
    });

    // Add to tracks
    this.tracks.set(trackInfo.sid, publication);

    // Call publish callback
    if (this.publishCallback) {
      await this.publishCallback(track as LocalTrack, options);
    }

    // Emit event
    this.emit('track-published', publication);

    return publication;
  }

  /**
   * Unpublish a track
   */
  async unpublishTrack(sid: string): Promise<void> {
    const publication = this.tracks.get(sid);
    if (!publication) {
      throw new Error(`Track ${sid} not found`);
    }

    // Call unpublish callback
    if (this.unpublishCallback) {
      await this.unpublishCallback(sid);
    }

    // Remove from tracks
    this.tracks.delete(sid);

    // Emit event
    this.emit('track-unpublished', publication);
  }

  /**
   * Publish data
   */
  async publishData(data: unknown, kind: 'reliable' | 'lossy' = 'reliable'): Promise<void> {
    if (this.publishDataCallback) {
      await this.publishDataCallback(data, kind);
    }
  }

  /**
   * Enable camera (video)
   * @param deviceId - Optional specific device ID to use. If not provided, uses default camera.
   */
  async enableCamera(deviceId?: string): Promise<void> {
    if (this.enableCameraCallback) {
      await this.enableCameraCallback(deviceId);
    }
  }

  /**
   * Disable camera (video)
   */
  async disableCamera(): Promise<void> {
    if (this.disableCameraCallback) {
      await this.disableCameraCallback();
    }
  }

  /**
   * Enable microphone (audio)
   * @param deviceId - Optional specific device ID to use. If not provided, uses default microphone.
   */
  async enableMicrophone(deviceId?: string): Promise<void> {
    if (this.enableMicrophoneCallback) {
      await this.enableMicrophoneCallback(deviceId);
    }
  }

  /**
   * Disable microphone (audio)
   */
  async disableMicrophone(): Promise<void> {
    if (this.disableMicrophoneCallback) {
      await this.disableMicrophoneCallback();
    }
  }

  /**
   * List available microphones
   */
  async listAvailableMicrophones(): Promise<MediaDeviceInfo[]> {
    await this.mediaManager.initialize();
    return this.mediaManager.getAudioInputDevices();
  }

  /**
   * List available cameras
   */
  async listAvailableCameras(): Promise<MediaDeviceInfo[]> {
    await this.mediaManager.initialize();
    return this.mediaManager.getVideoInputDevices();
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
    this.name = info.name || info.identity;
    this.state = info.state;
    this.metadata = info.metadata || {};

    // Update tracks
    info.tracks.forEach((trackInfo) => {
      const publication = this.tracks.get(trackInfo.sid);
      if (publication) {
        publication.setMuted(trackInfo.muted);
      }
    });

    // Remove tracks that no longer exist
    const currentTrackSids = new Set(info.tracks.map((t) => t.sid));
    for (const [sid, publication] of this.tracks.entries()) {
      if (!currentTrackSids.has(sid)) {
        this.tracks.delete(sid);
        this.emit('track-unpublished', publication);
      }
    }
  }

  /**
   * Set publish callback
   */
  setPublishCallback(
    callback: (track: LocalTrack, options?: TrackPublishOptions) => Promise<void>
  ): void {
    this.publishCallback = callback;
  }

  /**
   * Set unpublish callback
   */
  setUnpublishCallback(callback: (sid: string) => Promise<void>): void {
    this.unpublishCallback = callback;
  }

  /**
   * Set publish data callback
   */
  setPublishDataCallback(
    callback: (data: unknown, kind: 'reliable' | 'lossy') => Promise<void>
  ): void {
    this.publishDataCallback = callback;
  }

  /**
   * Set enable camera callback
   */
  setEnableCameraCallback(callback: (deviceId?: string) => Promise<void>): void {
    this.enableCameraCallback = callback;
  }

  /**
   * Set disable camera callback
   */
  setDisableCameraCallback(callback: () => Promise<void>): void {
    this.disableCameraCallback = callback;
  }

  /**
   * Set enable microphone callback
   */
  setEnableMicrophoneCallback(callback: (deviceId?: string) => Promise<void>): void {
    this.enableMicrophoneCallback = callback;
  }

  /**
   * Set disable microphone callback
   */
  setDisableMicrophoneCallback(callback: () => Promise<void>): void {
    this.disableMicrophoneCallback = callback;
  }

  /**
   * Add event listener
   */
  on<K extends keyof LocalParticipantEvents>(event: K, listener: LocalParticipantEvents[K]): void {
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
  off<K extends keyof LocalParticipantEvents>(event: K, listener: LocalParticipantEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as (data: unknown) => void);
    }
  }

  /**
   * Emit event
   */
  protected emit<K extends keyof LocalParticipantEvents>(event: K, data?: unknown): void {
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
    this.mediaManager.stopAllTracks();
    this.tracks.forEach((track) => {
      if (track.track) {
        track.track.removeAllListeners();
        track.track.stop();
      }
    });
    this.tracks.clear();
  }

  /**
   * Generate a unique track SID
   */
  private generateTrackSid(): string {
    return `TR_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
