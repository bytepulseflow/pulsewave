/**
 * RedisStateStore - Redis implementation of StateStore
 *
 * This is a concrete implementation of the StateStore interface using Redis.
 * It allows the application layer to work with Redis without being tightly coupled to it.
 */

import Redis from 'ioredis';
import type { StateStore } from './StateStore';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('state:redis');

export interface RedisStateStoreOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

/**
 * Redis State Store implementation
 */
export class RedisStateStore implements StateStore {
  private client: Redis;
  private connected: boolean = false;

  constructor(options: RedisStateStoreOptions) {
    this.client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      db: options.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.connected = true;
      logger.info('Redis connected');
    });

    this.client.on('error', (error) => {
      logger.error({ error }, 'Redis error');
    });

    this.client.on('close', () => {
      this.connected = false;
      logger.info('Redis connection closed');
    });
  }

  /**
   * Get a value from the store
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.connected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error({ error, key }, 'Error getting value from Redis');
      return null;
    }
  }

  /**
   * Set a value in the store
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error({ error, key }, 'Error setting value in Redis');
      throw error;
    }
  }

  /**
   * Delete a value from the store
   */
  public async delete(key: string): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Error deleting value from Redis');
    }
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ error, key }, 'Error checking if key exists in Redis');
      return false;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  public async keys(pattern: string): Promise<string[]> {
    if (!this.connected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error({ error, pattern }, 'Error getting keys from Redis');
      return [];
    }
  }

  /**
   * Clear all values
   */
  public async clear(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client.flushdb();
    } catch (error) {
      logger.error({ error }, 'Error clearing Redis');
      throw error;
    }
  }

  /**
   * Close the store connection
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error({ error }, 'Error closing Redis connection');
    }
  }
}
