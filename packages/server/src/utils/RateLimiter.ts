/**
 * Rate Limiter
 *
 * Provides rate limiting functionality to prevent DoS attacks.
 * Supports per-socket and per-IP rate limiting with configurable limits.
 */

import { createModuleLogger } from './logger';

const logger = createModuleLogger('rate-limiter');

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining?: number;
}

export interface RateLimiterOptions {
  limit: number;
  window: number;
  banThreshold?: number;
  banDuration?: number;
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private banned: Map<string, number> = new Map();
  private readonly limit: number;
  private readonly window: number;
  private readonly banThreshold: number;
  private readonly banDuration: number;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.window = options.window;
    this.banThreshold = options.banThreshold ?? 5;
    this.banDuration = options.banDuration ?? 5 * 60 * 1000; // 5 minutes default

    // Clean up old entries periodically
    setInterval(() => this.cleanup(), this.window);
  }

  /**
   * Check if a request is allowed
   */
  check(identifier: string): RateLimitResult {
    const now = Date.now();

    // Check if identifier is banned
    const bannedUntil = this.banned.get(identifier);
    if (bannedUntil && now < bannedUntil) {
      return {
        allowed: false,
        retryAfter: bannedUntil - now,
      };
    }

    // Get existing timestamps
    const timestamps = this.requests.get(identifier) || [];

    // Filter out timestamps outside the window
    const validTimestamps = timestamps.filter((t) => now - t < this.window);

    // Check if limit exceeded
    if (validTimestamps.length >= this.limit) {
      const oldestTimestamp = validTimestamps[0];
      const retryAfter = this.window - (now - oldestTimestamp);

      // Check if ban threshold reached
      if (validTimestamps.length >= this.limit + this.banThreshold) {
        this.ban(identifier);
        logger.warn(`Identifier ${identifier} banned due to rate limit violations`);
        return {
          allowed: false,
          retryAfter: this.banDuration,
        };
      }

      return {
        allowed: false,
        retryAfter,
      };
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(identifier, validTimestamps);

    return {
      allowed: true,
      remaining: this.limit - validTimestamps.length,
    };
  }

  /**
   * Ban an identifier
   */
  private ban(identifier: string): void {
    this.banned.set(identifier, Date.now() + this.banDuration);
  }

  /**
   * Unban an identifier
   */
  unban(identifier: string): void {
    this.banned.delete(identifier);
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean up old request timestamps
    for (const [identifier, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter((t) => now - t < this.window);
      if (validTimestamps.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validTimestamps);
      }
    }

    // Clean up expired bans
    for (const [identifier, bannedUntil] of this.banned.entries()) {
      if (now >= bannedUntil) {
        this.banned.delete(identifier);
      }
    }
  }

  /**
   * Get statistics for an identifier
   */
  getStats(identifier: string): { count: number; remaining: number; banned: boolean } {
    const now = Date.now();
    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.window);
    const banned = this.banned.has(identifier) && this.banned.get(identifier)! > now;

    return {
      count: validTimestamps.length,
      remaining: Math.max(0, this.limit - validTimestamps.length),
      banned,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
    this.unban(identifier);
  }

  /**
   * Get all banned identifiers
   */
  getBanned(): string[] {
    const now = Date.now();
    return Array.from(this.banned.entries())
      .filter(([, until]) => until > now)
      .map(([identifier]) => identifier);
  }

  /**
   * Get total number of tracked identifiers
   */
  size(): number {
    return this.requests.size;
  }
}

/**
 * Default rate limiter for WebSocket connections (100 messages/minute)
 */
export const createDefaultRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    limit: 100,
    window: 60 * 1000, // 1 minute
    banThreshold: 5,
    banDuration: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Rate limiter for global IP-based limiting (1000 requests/minute)
 */
export const createGlobalRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    limit: 1000,
    window: 60 * 1000, // 1 minute
    banThreshold: 10,
    banDuration: 10 * 60 * 1000, // 10 minutes
  });
};
