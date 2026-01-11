/**
 * LocalTrack class for local media tracks
 */

import type { TrackInfo } from '@bytepulse/pulsewave-shared';
import type { LocalTrackEvents } from '../types';
import { Track } from './Track';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('local-track');

/**
 * LocalTrack class representing a local media track
 */
export class LocalTrack extends Track {
  /**
   * Event listeners
   */
  private localListeners: Map<keyof LocalTrackEvents, Set<(data: unknown) => void>> = new Map();

  /**
   * Mute callback
   */
  private muteCallback?: () => Promise<void>;

  /**
   * Unmute callback
   */
  private unmuteCallback?: () => Promise<void>;

  constructor(info: TrackInfo, mediaTrack: MediaStreamTrack) {
    super(info, mediaTrack);
  }

  /**
   * Mute the track locally
   */
  async mute(): Promise<void> {
    if (!this.isMuted) {
      this.info.muted = true;
      this.mediaTrack.enabled = false;

      // Call mute callback (producer.pause())
      if (this.muteCallback) {
        await this.muteCallback();
      }

      this.emitLocal('muted');
    }
  }

  /**
   * Unmute the track locally
   */
  async unmute(): Promise<void> {
    if (this.isMuted) {
      this.info.muted = false;
      this.mediaTrack.enabled = true;

      // Call unmute callback (producer.resume())
      if (this.unmuteCallback) {
        await this.unmuteCallback();
      }

      this.emitLocal('unmuted');
    }
  }

  /**
   * Set mute callback
   */
  setMuteCallback(callback: () => Promise<void>): void {
    this.muteCallback = callback;
  }

  /**
   * Set unmute callback
   */
  setUnmuteCallback(callback: () => Promise<void>): void {
    this.unmuteCallback = callback;
  }

  /**
   * Add event listener
   */
  on<K extends keyof LocalTrackEvents>(event: K, listener: LocalTrackEvents[K]): void {
    if (!this.localListeners.has(event)) {
      this.localListeners.set(event, new Set());
    }
    const listeners = this.localListeners.get(event);
    if (listeners) {
      listeners.add(listener as (data: unknown) => void);
    }
  }

  /**
   * Remove event listener
   */
  off<K extends keyof LocalTrackEvents>(event: K, listener: LocalTrackEvents[K]): void {
    const listeners = this.localListeners.get(event);
    if (listeners) {
      listeners.delete(listener as (data: unknown) => void);
    }
  }

  /**
   * Emit event
   */
  protected emitLocal<K extends keyof LocalTrackEvents>(event: K, data?: unknown): void {
    const listeners = this.localListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          logger.error(`Error in ${event} listener`, { error });
        }
      });
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    super.removeAllListeners();
    this.localListeners.clear();
  }
}
