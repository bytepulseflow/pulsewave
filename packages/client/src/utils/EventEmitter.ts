/**
 * EventEmitter - Base class for type-safe event emission with automatic cleanup
 *
 * This class provides:
 * - Type-safe event listener management
 * - Automatic cleanup validation in development mode
 * - Max listeners warning to prevent memory leaks
 * - One-time listeners with once()
 * - Cleanup function return from on() for easy cleanup
 * - Development mode warnings for potential issues
 */

import { createModuleLogger } from './logger';

const logger = createModuleLogger('event-emitter');

/**
 * Event listener type
 */
export type EventListener<T = unknown> = (data: T) => void;

/**
 * EventEmitter options
 */
export interface EventEmitterOptions {
  /**
   * Maximum number of listeners per event before warning
   * @default 10
   */
  maxListeners?: number;

  /**
   * Enable cleanup validation in development mode
   * @default true in development, false in production
   */
  enableCleanupValidation?: boolean;

  /**
   * Name for debugging (helps identify which emitter has issues)
   */
  name?: string;
}

/**
 * EventEmitter - Type-safe event emitter with automatic cleanup
 */
export class EventEmitter<Events> {
  private eventListeners: Map<keyof Events, Set<EventListener<unknown>>> = new Map();
  private maxListeners: number;
  private enableCleanupValidation: boolean;
  private name: string;
  private listenerStack: Map<keyof Events, Set<EventListener<unknown>>> = new Map();
  private isDevelopment: boolean;

  constructor(options: EventEmitterOptions = {}) {
    this.maxListeners = options.maxListeners ?? 10;
    this.enableCleanupValidation = options.enableCleanupValidation ?? this.isDev();
    this.name = options.name ?? 'EventEmitter';
    this.isDevelopment = this.isDev();

    if (this.isDevelopment && this.enableCleanupValidation) {
      // Track listeners for cleanup validation
      this.trackListeners();
    }
  }

  /**
   * Check if running in development mode
   */
  private isDev(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  }

  /**
   * Add event listener
   * @returns Cleanup function to remove the listener
   */
  on<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    const listeners = this.eventListeners.get(event)!;
    listeners.add(listener as EventListener<unknown>);

    // Check max listeners
    if (listeners.size > this.maxListeners) {
      logger.warn(
        `[${this.name}] Possible memory leak detected. ${listeners.size} listeners added for event "${String(event)}". Use off() or the returned cleanup function to remove listeners.`
      );
    }

    // Track listener for cleanup validation in development
    if (this.isDevelopment && this.enableCleanupValidation) {
      const stack = this.listenerStack.get(event);
      if (stack) {
        stack.add(listener as EventListener<unknown>);
      }
    }

    // Return cleanup function
    return () => this.off(event, listener);
  }

  /**
   * Add one-time event listener
   * @returns Cleanup function to remove the listener
   */
  once<K extends keyof Events>(event: K, listener: Events[K]): () => void {
    const wrappedListener = ((data: unknown) => {
      this.off(event, wrappedListener as Events[K]);
      (listener as EventListener<unknown>)(data);
    }) as Events[K];

    return this.on(event, wrappedListener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof Events>(event: K, listener: Events[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as EventListener<unknown>);

      // Remove from tracking in development
      if (this.isDevelopment && this.enableCleanupValidation) {
        const stack = this.listenerStack.get(event);
        if (stack) {
          stack.delete(listener as EventListener<unknown>);
        }
      }

      // Clean up empty sets
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Remove all event listeners for a specific event or all events
   */
  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      // Remove listeners for specific event
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.clear();
        this.eventListeners.delete(event);
      }

      // Clear tracking for this event
      if (this.isDevelopment && this.enableCleanupValidation) {
        this.listenerStack.delete(event);
      }
    } else {
      // Remove all listeners
      this.eventListeners.clear();
      this.listenerStack.clear();
    }
  }

  /**
   * Emit event to all listeners
   */
  emit<K extends keyof Events>(event: K, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }

    // Create a copy to avoid issues if listeners modify the set during iteration
    const listenersCopy = Array.from(listeners);

    for (const listener of listenersCopy) {
      try {
        (listener as EventListener<unknown>)(data);
      } catch (error) {
        logger.error(`[${this.name}] Error in event listener for "${String(event)}":`, { error });
      }
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    return this.eventListeners.get(event)?.size ?? 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): Array<keyof Events> {
    return Array.from(this.eventListeners.keys());
  }

  /**
   * Track listeners for cleanup validation in development mode
   */
  private trackListeners(): void {
    // Initialize tracking for all events
    this.eventListeners.forEach((_, event) => {
      if (!this.listenerStack.has(event)) {
        this.listenerStack.set(event, new Set());
      }
    });

    // Warn about uncleaned listeners on process exit in development
    if (typeof process !== 'undefined' && process.on) {
      process.on('beforeExit', () => {
        this.validateCleanup();
      });
    }
  }

  /**
   * Validate cleanup in development mode
   */
  private validateCleanup(): void {
    if (!this.isDevelopment || !this.enableCleanupValidation) {
      return;
    }

    let hasUncleanedListeners = false;

    this.listenerStack.forEach((listeners, event) => {
      if (listeners.size > 0) {
        hasUncleanedListeners = true;
        logger.warn(
          `[${this.name}] ${listeners.size} listener(s) not cleaned up for event "${String(event)}". This may cause memory leaks.`
        );
      }
    });

    if (hasUncleanedListeners) {
      logger.warn(
        `[${this.name}] Some event listeners were not cleaned up. Ensure you call off() or use the cleanup function returned by on() when components unmount.`
      );
    }
  }

  /**
   * Set max listeners threshold
   */
  setMaxListeners(n: number): void {
    this.maxListeners = Math.max(0, n);
    logger.debug(`[${this.name}] Max listeners set to ${n}`);
  }

  /**
   * Get max listeners threshold
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }
}
