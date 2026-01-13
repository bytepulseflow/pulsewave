/**
 * VideoTrack - Helper class for video track management
 */

import type { TrackInfo } from '@bytepulse/pulsewave-shared';
import { TrackKind, TrackSource } from '@bytepulse/pulsewave-shared';
import { LocalTrack } from '../domain/LocalTrack';

/**
 * VideoTrack - Helper class for video track management
 */
export class VideoTrack extends LocalTrack {
  /**
   * Get video track settings
   */
  getSettings(): MediaTrackSettings {
    return this.mediaTrack.getSettings();
  }

  /**
   * Get video track capabilities
   */
  async getCapabilities(): Promise<MediaTrackCapabilities> {
    return this.mediaTrack.getCapabilities();
  }

  /**
   * Apply video constraints
   */
  async applyConstraints(constraints: MediaTrackConstraints): Promise<void> {
    await this.mediaTrack.applyConstraints(constraints);
  }

  /**
   * Get current video dimensions
   */
  getDimensions(): { width: number; height: number } {
    const settings = this.getSettings();
    return {
      width: settings.width || 0,
      height: settings.height || 0,
    };
  }

  /**
   * Get current frame rate
   */
  getFrameRate(): number {
    const settings = this.getSettings();
    return settings.frameRate || 0;
  }

  /**
   * Get current facing mode
   */
  getFacingMode(): string | undefined {
    const settings = this.getSettings();
    return settings.facingMode;
  }

  /**
   * Set video resolution
   */
  async setResolution(width: number, height: number): Promise<void> {
    await this.applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
    });
  }

  /**
   * Set frame rate
   */
  async setFrameRate(frameRate: number): Promise<void> {
    await this.applyConstraints({
      frameRate: { ideal: frameRate },
    });
  }

  /**
   * Set facing mode (for mobile devices)
   */
  async setFacingMode(facingMode: 'user' | 'environment' | 'left' | 'right'): Promise<void> {
    await this.applyConstraints({
      facingMode: { ideal: facingMode },
    });
  }

  /**
   * Switch camera (toggle between front and back)
   */
  async switchCamera(): Promise<void> {
    const currentFacingMode = this.getFacingMode();
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await this.setFacingMode(newFacingMode);
  }

  /**
   * Enable/disable video
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.mediaTrack.enabled = enabled;
  }

  /**
   * Create a video track from a media stream track
   */
  static fromMediaTrack(
    track: MediaStreamTrack,
    source: TrackSource = TrackSource.Camera
  ): VideoTrack {
    const trackInfo: TrackInfo = {
      sid: `TR_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      kind: TrackKind.Video,
      source,
      muted: track.enabled === false,
      simulcast: false,
      width: track.getSettings().width,
      height: track.getSettings().height,
    };

    return new VideoTrack(trackInfo, track);
  }
}
