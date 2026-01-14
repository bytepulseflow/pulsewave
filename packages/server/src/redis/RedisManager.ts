/**
 * RedisManager - Redis client wrapper with circuit breaker for resilience
 */

import Redis from 'ioredis';
import type { RedisConfig } from '../config';
import { createModuleLogger } from '../utils/logger';
import { CircuitBreaker, createDefaultCircuitBreaker, CircuitState } from '../utils/CircuitBreaker';

const logger = createModuleLogger('redis');

/**
 * RedisManager class
 */
export class RedisManager {
  private client: Redis;
  private circuitBreaker: CircuitBreaker;

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

    // Initialize circuit breaker for Redis operations
    this.circuitBreaker = createDefaultCircuitBreaker('redis');

    this.client.on('error', (error: Error) => {
      logger.error({ error }, 'Redis error');
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
      // Reset circuit breaker when Redis reconnects
      this.circuitBreaker.reset();
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
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
    return this.circuitBreaker.execute(async () => {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    });
  }

  /**
   * Get a key
   */
  public async get(key: string): Promise<string | null> {
    return this.circuitBreaker.execute(async () => {
      return this.client.get(key);
    });
  }

  /**
   * Delete a key
   */
  public async del(key: string): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      await this.client.del(key);
    });
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      const result = await this.client.exists(key);
      return result === 1;
    });
  }

  /**
   * Set a hash field
   */
  public async hset(key: string, field: string, value: string): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      await this.client.hset(key, field, value);
    });
  }

  /**
   * Get a hash field
   */
  public async hget(key: string, field: string): Promise<string | null> {
    return this.circuitBreaker.execute(async () => {
      return this.client.hget(key, field);
    });
  }

  /**
   * Get all hash fields
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    return this.circuitBreaker.execute(async () => {
      return this.client.hgetall(key);
    });
  }

  /**
   * Delete a hash field
   */
  public async hdel(key: string, field: string): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      await this.client.hdel(key, field);
    });
  }

  /**
   * Publish to a channel
   */
  public async publish(channel: string, message: string): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      await this.client.publish(channel, message);
    });
  }

  /**
   * Subscribe to a channel
   * Note: Subscribe operations are not protected by circuit breaker as they maintain long-lived connections
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

  /**
   * Get circuit breaker state
   */
  public getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Get circuit breaker statistics
   */
  public getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Manually reset the circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Check if Redis operations are currently allowed
   */
  public isOperational(): boolean {
    return this.circuitBreaker.isAllowingRequests();
  }
}
