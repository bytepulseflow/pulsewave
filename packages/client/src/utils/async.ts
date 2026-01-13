/**
 * Async utilities for timeout and retry logic
 */

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeout: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Error classification for retry logic
 */
export enum ErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  FATAL = 'fatal',
  RECOVERABLE = 'recoverable',
}

/**
 * Retry options
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds (default: 1000ms)
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds (default: 30000ms)
   */
  maxDelay?: number;

  /**
   * Exponential backoff multiplier (default: 2)
   */
  backoffMultiplier?: number;

  /**
   * Jitter factor to add randomness to delay (default: 0.1)
   */
  jitterFactor?: number;

  /**
   * Function to determine if an error is retryable
   */
  isRetryable?: (error: unknown) => boolean;

  /**
   * Callback called before each retry
   */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Timeout options
 */
export interface TimeoutOptions {
  /**
   * Timeout duration in milliseconds
   */
  timeout: number;

  /**
   * Custom error message
   */
  message?: string;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  isRetryable: (error: unknown) => {
    // Retry network errors, timeouts, and recoverable errors
    if (error instanceof TimeoutError) {
      return true;
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('etimedout') ||
        message.includes('enotfound') ||
        message.includes('fetch failed') ||
        message.includes('connection reset')
      );
    }
    return false;
  },
  onRetry: () => {},
};

/**
 * Add timeout to a promise
 */
export function withTimeout<T>(promise: Promise<T>, options: TimeoutOptions): Promise<T> {
  const { timeout, message = `Operation timed out after ${timeout}ms` } = options;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(message, timeout));
      }, timeout);
      // Cleanup timeout if promise resolves
      promise.finally(() => clearTimeout(timeoutId));
    }),
  ]);
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * options.jitterFactor * (Math.random() - 0.5);

  return Math.max(0, cappedDelay + jitter);
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const mergedOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  let lastError: unknown;

  for (let attempt = 0; attempt < mergedOptions.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!mergedOptions.isRetryable(error)) {
        throw error;
      }

      // Don't retry after last attempt
      if (attempt === mergedOptions.maxAttempts - 1) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, mergedOptions);
      mergedOptions.onRetry(attempt + 1, error);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Classify an error by type
 */
export function classifyError(error: unknown): ErrorType {
  if (error instanceof TimeoutError) {
    return ErrorType.TIMEOUT;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('connection reset') ||
      message.includes('fetch failed')
    ) {
      return ErrorType.NETWORK;
    }

    // Fatal errors (authentication, authorization, etc.)
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid token') ||
      message.includes('authentication failed') ||
      message.includes('not found')
    ) {
      return ErrorType.FATAL;
    }

    // Other errors are considered recoverable
    return ErrorType.RECOVERABLE;
  }

  return ErrorType.FATAL;
}

/**
 * Create a timeout error with context
 */
export function createTimeoutError(operation: string, timeout: number): TimeoutError {
  return new TimeoutError(`${operation} timed out after ${timeout}ms`, timeout);
}
