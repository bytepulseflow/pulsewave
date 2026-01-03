/**
 * EventBus - Type-safe event emitter for room events
 *
 * Handles all event emission and listening in a type-safe manner.
 */

import type { RoomEvents } from '../../types';

/**
 * Event listener type
 */
type EventListener<T = unknown> = (data: T) => void;

/**
 * EventBus - Type-safe event emitter
 */
export class EventBus {
  private listeners: Map<keyof RoomEvents, Set<EventListener>> = new Map();

  /**
   * Add event listener
   */
  on<K extends keyof RoomEvents>(event: K, listener: RoomEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof RoomEvents>(event: K, listener: RoomEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as EventListener);
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Emit event
   */
  emit<K extends keyof RoomEvents>(event: K, data?: unknown): void {
    const listeners = this.listeners.get(event);
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
   * Remove all listeners for a specific event
   */
  removeAllListenersForEvent<K extends keyof RoomEvents>(event: K): void {
    this.listeners.delete(event);
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof RoomEvents>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners<K extends keyof RoomEvents>(event: K): boolean {
    return this.listenerCount(event) > 0;
  }
}
