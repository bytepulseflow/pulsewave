/**
 * RedisManager - Redis client wrapper
 */

import Redis from 'ioredis';
import type { RedisConfig } from '../config';

/**
 * RedisManager class
 */
export class RedisManager {
  private client: Redis;

  constructor(config: RedisConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (error: Error) => {
      console.error('Redis error:', error);
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
    });

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });
  }

  /**
   * Get Redis client
   */
  public getClient(): Redis {
    return this.client;
  }

  /**
   * Set a key
   */
  public async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Get a key
   */
  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set a hash field
   */
  public async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  /**
   * Get a hash field
   */
  public async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Get all hash fields
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /**
   * Delete a hash field
   */
  public async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  /**
   * Publish to a channel
   */
  public async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  /**
   * Subscribe to a channel
   */
  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();

    await subscriber.subscribe(channel);
    subscriber.on('message', (receivedChannel: string, message: string) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  /**
   * Close the connection
   */
  public async close(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.client.status === 'ready';
  }
}
