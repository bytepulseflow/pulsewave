/**
 * AudioTrack - Helper class for audio track management
 */

import type { TrackInfo } from '@bytepulse/pulsewave-shared';
import { TrackKind, TrackSource } from '@bytepulse/pulsewave-shared';
import { LocalTrack } from '../domain/LocalTrack';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('audio-track');

/**
 * AudioTrack - Helper class for audio track management
 */
export class AudioTrack extends LocalTrack {
  /**
   * Get audio track settings
   */
  getSettings(): MediaTrackSettings {
    return this.mediaTrack.getSettings();
  }

  /**
   * Get audio track capabilities
   */
  async getCapabilities(): Promise<MediaTrackCapabilities> {
    return this.mediaTrack.getCapabilities();
  }

  /**
   * Apply audio constraints
   */
  async applyConstraints(constraints: MediaTrackConstraints): Promise<void> {
    await this.mediaTrack.applyConstraints(constraints);
  }

  /**
   * Get current volume level (0-1)
   */
  getVolume(): number {
    // Note: Web Audio API would be needed for actual volume detection
    // This is a placeholder
    return 1;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(_volume: number): void {
    // Note: Web Audio API would be needed for actual volume control
    // This is a placeholder
    logger.warn('Volume control requires Web Audio API integration');
  }

  /**
   * Enable/disable echo cancellation
   */
  async setEchoCancellation(enabled: boolean): Promise<void> {
    await this.applyConstraints({ echoCancellation: enabled });
  }

  /**
   * Enable/disable noise suppression
   */
  async setNoiseSuppression(enabled: boolean): Promise<void> {
    await this.applyConstraints({ noiseSuppression: enabled });
  }

  /**
   * Enable/disable auto gain control
   */
  async setAutoGainControl(enabled: boolean): Promise<void> {
    await this.applyConstraints({ autoGainControl: enabled });
  }

  /**
   * Create an audio track from a media stream track
   */
  static fromMediaTrack(track: MediaStreamTrack, _name?: string): AudioTrack {
    const trackInfo: TrackInfo = {
      sid: `TR_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      kind: TrackKind.Audio,
      source: TrackSource.Microphone,
      muted: track.enabled === false,
      simulcast: false,
    };

    return new AudioTrack(trackInfo, track);
  }
}
