/**
 * Timeout utility for async operations
 *
 * Provides timeout protection for all async operations to prevent
 * indefinite hanging and resource exhaustion.
 */

import { createModuleLogger } from './logger';

const logger = createModuleLogger('timeout');

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Execute a promise with a timeout
 *
 * @param promise - The promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Operation name for logging
 * @returns Promise that resolves with the result or rejects with TimeoutError
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new TimeoutError(operation, timeoutMs);
        logger.warn({ operation, timeoutMs }, 'Operation timed out');
        reject(error);
      }, timeoutMs);

      // Clear timeout if promise resolves/rejects
      promise.finally(() => {
        clearTimeout(timeoutId);
      });
    }),
  ]);
}

/**
 * Default timeout values for different operations
 */
export const DEFAULT_TIMEOUTS = {
  TRANSPORT_CREATE: 30000, // 30s
  TRANSPORT_CONNECT: 30000, // 30s
  PRODUCER_CREATE: 30000, // 30s
  PRODUCER_PAUSE: 10000, // 10s
  PRODUCER_RESUME: 10000, // 10s
  PRODUCER_CLOSE: 10000, // 10s
  CONSUMER_CREATE: 30000, // 30s
  CONSUMER_PAUSE: 10000, // 10s
  CONSUMER_RESUME: 10000, // 10s
  CONSUMER_CLOSE: 10000, // 10s
  DATA_PRODUCER_CREATE: 30000, // 30s
  DATA_PRODUCER_CLOSE: 10000, // 10s
  DATA_CONSUMER_CREATE: 30000, // 30s
  DATA_CONSUMER_CLOSE: 10000, // 10s
  STATS_GET: 5000, // 5s
} as const;

/**
 * Get timeout from environment variable or default
 */
export function getTimeout(envVar: string | undefined, defaultValue: number): number {
  if (envVar === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(envVar, 10);
  if (isNaN(parsed) || parsed <= 0) {
    logger.warn({ envVar, defaultValue }, 'Invalid timeout value in environment, using default');
    return defaultValue;
  }
  return parsed;
}
