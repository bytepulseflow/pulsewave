/**
 * MediaController - Manages media device operations
 *
 * Handles media device enumeration, track creation, and device switching.
 */

import { TrackKind, TrackSource } from '@bytepulse/pulsewave-shared';
import { MediaManager } from '../../media/MediaManager';
import type { LocalTrack } from '../../types';
import { LocalTrack as LocalTrackImpl } from '../LocalTrack';

/**
 * MediaController - Manages media device operations
 */
export class MediaController {
  private mediaManager: MediaManager | null = null;
  private isInitialized = false;

  /**
   * Initialize media manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.mediaManager = new MediaManager();
    await this.mediaManager.initialize();
    this.isInitialized = true;
  }

  /**
   * Create video track
   */
  async createVideoTrack(): Promise<LocalTrack> {
    if (!this.mediaManager) {
      await this.initialize();
    }

    const track = await this.mediaManager!.createVideoTrack();
    return new LocalTrackImpl(
      {
        sid: '',
        kind: TrackKind.Video,
        source: TrackSource.Camera,
        muted: false,
      },
      track.mediaTrack
    );
  }

  /**
   * Create audio track
   */
  async createAudioTrack(): Promise<LocalTrack> {
    if (!this.mediaManager) {
      await this.initialize();
    }

    const track = await this.mediaManager!.createAudioTrack();
    return new LocalTrackImpl(
      {
        sid: '',
        kind: TrackKind.Audio,
        source: TrackSource.Microphone,
        muted: false,
      },
      track.mediaTrack
    );
  }

  /**
   * Switch video device
   */
  async switchVideoDevice(deviceId: string): Promise<LocalTrack> {
    if (!this.mediaManager) {
      await this.initialize();
    }

    const track = await this.mediaManager!.switchVideoDevice(deviceId);
    return new LocalTrackImpl(
      {
        sid: '',
        kind: TrackKind.Video,
        source: TrackSource.Camera,
        muted: false,
      },
      track.mediaTrack
    );
  }

  /**
   * Switch audio device
   */
  async switchAudioDevice(deviceId: string): Promise<LocalTrack> {
    if (!this.mediaManager) {
      await this.initialize();
    }

    const track = await this.mediaManager!.switchAudioDevice(deviceId);
    return new LocalTrackImpl(
      {
        sid: '',
        kind: TrackKind.Audio,
        source: TrackSource.Microphone,
        muted: false,
      },
      track.mediaTrack
    );
  }

  /**
   * List available microphones
   */
  async listAvailableMicrophones(): Promise<MediaDeviceInfo[]> {
    if (!this.mediaManager) {
      await this.initialize();
    }
    return this.mediaManager!.getAudioInputDevices();
  }

  /**
   * List available cameras
   */
  async listAvailableCameras(): Promise<MediaDeviceInfo[]> {
    if (!this.mediaManager) {
      await this.initialize();
    }
    return this.mediaManager!.getVideoInputDevices();
  }

  /**
   * Stop all tracks
   */
  stopAllTracks(): void {
    if (this.mediaManager) {
      this.mediaManager.stopAllTracks();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAllTracks();
    this.mediaManager = null;
    this.isInitialized = false;
  }
}
