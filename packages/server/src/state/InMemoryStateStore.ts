/**
 * InMemoryStateStore - In-memory implementation of StateStore
 *
 * This is a concrete implementation of the StateStore interface using in-memory storage.
 * Useful for testing and development without requiring Redis.
 */

import type { StateStore } from './StateStore';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('state:memory');

/**
 * In-memory State Store implementation
 */
export class InMemoryStateStore implements StateStore {
  private store: Map<string, { value: string; expiry?: number }>;

  constructor() {
    this.store = new Map();
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get a value from the store
   */
  public async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch (error) {
      logger.error({ error, key }, 'Error parsing value from in-memory store');
      return null;
    }
  }

  /**
   * Set a value in the store
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiry = ttl ? Date.now() + ttl * 1000 : undefined;
    this.store.set(key, {
      value: JSON.stringify(value),
      expiry,
    });
  }

  /**
   * Delete a value from the store
   */
  public async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys matching a pattern
   */
  public async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter((key) => regex.test(key));
  }

  /**
   * Clear all values
   */
  public async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Close the store connection
   */
  public async close(): Promise<void> {
    this.store.clear();
    logger.info('In-memory store closed');
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiry && now > entry.expiry) {
        this.store.delete(key);
      }
    }
  }
}
