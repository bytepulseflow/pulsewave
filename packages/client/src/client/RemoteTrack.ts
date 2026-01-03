/**
 * RemoteTrack class for remote media tracks
 */

import type { TrackInfo } from '@bytepulse/pulsewave-shared';
import type { RemoteTrackEvents } from '../types';
import { Track } from './Track';

/**
 * RemoteTrack class representing a remote media track
 */
export class RemoteTrack extends Track {
  /**
   * Event listeners
   */
  private remoteListeners: Map<keyof RemoteTrackEvents, Set<(data: unknown) => void>> = new Map();

  constructor(info: TrackInfo, mediaTrack: MediaStreamTrack) {
    super(info, mediaTrack);
  }

  /**
   * Add event listener
   */
  on<K extends keyof RemoteTrackEvents>(event: K, listener: RemoteTrackEvents[K]): void {
    if (!this.remoteListeners.has(event)) {
      this.remoteListeners.set(event, new Set());
    }
    this.remoteListeners.get(event)!.add(listener as (data: unknown) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof RemoteTrackEvents>(event: K, listener: RemoteTrackEvents[K]): void {
    const listeners = this.remoteListeners.get(event);
    if (listeners) {
      listeners.delete(listener as (data: unknown) => void);
    }
  }

  /**
   * Emit event
   */
  protected emit<K extends keyof RemoteTrackEvents>(event: K, data?: unknown): void {
    // Only call base class emit for events that exist in TrackEvents
    const trackEvents: (keyof RemoteTrackEvents)[] = ['muted', 'unmuted', 'enabled', 'disabled'];
    if (trackEvents.includes(event)) {
      super.emit(event as keyof import('../types').TrackEvents, data);
    }

    // Emit to remote listeners
    const listeners = this.remoteListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in ${String(event)} listener:`, error);
        }
      });
    }
  }

  /**
   * Emit subscribed event
   */
  emitSubscribed(): void {
    this.emit('subscribed');
  }

  /**
   * Emit unsubscribed event
   */
  emitUnsubscribed(): void {
    this.emit('unsubscribed');
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    super.removeAllListeners();
    this.remoteListeners.clear();
  }
}
