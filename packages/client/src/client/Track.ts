/**
 * Base Track class
 */

import type { TrackKind, TrackInfo } from '@bytepulse/pulsewave-shared';
import type { TrackEvents } from '../types';

/**
 * Base Track class representing a media track
 */
export class Track {
  /**
   * Track info from server
   */
  public readonly info: TrackInfo;

  /**
   * Media stream track
   */
  public readonly mediaTrack: MediaStreamTrack;

  /**
   * Event listeners
   */
  private listeners: Map<keyof TrackEvents, Set<(data: unknown) => void>> = new Map();

  constructor(info: TrackInfo, mediaTrack: MediaStreamTrack) {
    this.info = info;
    this.mediaTrack = mediaTrack;
  }

  /**
   * Get track SID
   */
  get sid(): string {
    return this.info.sid;
  }

  /**
   * Get track kind
   */
  get kind(): TrackKind {
    return this.info.kind;
  }

  /**
   * Check if track is muted
   */
  get isMuted(): boolean {
    return this.info.muted;
  }

  /**
   * Get track source
   */
  get source(): string {
    return this.info.source;
  }

  /**
   * Check if track is enabled
   */
  get isEnabled(): boolean {
    return this.mediaTrack.enabled;
  }

  /**
   * Set track enabled state
   */
  set enabled(value: boolean) {
    this.mediaTrack.enabled = value;
  }

  /**
   * Attach track to an HTML element
   */
  attach(element: HTMLVideoElement | HTMLAudioElement): void {
    const stream = new MediaStream([this.mediaTrack]);
    element.srcObject = stream;
    element.play().catch((error) => {
      console.error('Failed to play media:', error);
    });
  }

  /**
   * Detach track from element
   */
  detach(element?: HTMLVideoElement | HTMLAudioElement): void {
    if (element) {
      element.srcObject = null;
    }
  }

  /**
   * Mute the track
   */
  async mute(): Promise<void> {
    if (!this.isMuted) {
      this.info.muted = true;
      this.emit('muted');
    }
  }

  /**
   * Unmute the track
   */
  async unmute(): Promise<void> {
    if (this.isMuted) {
      this.info.muted = false;
      this.emit('unmuted');
    }
  }

  /**
   * Stop the track
   */
  stop(): void {
    this.mediaTrack.stop();
  }

  /**
   * Add event listener
   */
  on<K extends keyof TrackEvents>(event: K, listener: TrackEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as (data: unknown) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof TrackEvents>(event: K, listener: TrackEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as (data: unknown) => void);
    }
  }

  /**
   * Emit event
   */
  protected emit<K extends keyof TrackEvents>(event: K, data?: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}
