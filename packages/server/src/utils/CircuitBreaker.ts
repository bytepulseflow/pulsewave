/**
 * CircuitBreaker - Implements the circuit breaker pattern for external service resilience
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail immediately
 * - HALF_OPEN: Testing if the service has recovered
 */

import { createModuleLogger } from './logger';

const logger = createModuleLogger('circuit-breaker');

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Time in ms before attempting to close (half-open)
  monitoringPeriod: number; // Time in ms to consider for failure counting
  successThreshold: number; // Number of successes in half-open before closing
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

export class CircuitBreaker {
  private state: CircuitState;
  private failureCount: number;
  private successCount: number;
  private lastFailureTime: number | null;
  private lastSuccessTime: number | null;
  private nextAttemptTime: number | null;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod ?? 10000, // 10 seconds
      successThreshold: config.successThreshold ?? 2,
    };
  }

  /**
   * Execute a protected operation
   */
  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        const error = new Error(
          `Circuit breaker ${this.name} is OPEN. Retry after ${this.getRetryAfter()}ms`
        );
        error.name = 'CircuitBreakerOpenError';
        throw error;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
        logger.info(`Circuit breaker ${this.name} transitioned to CLOSED`);
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
      logger.warn(`Circuit breaker ${this.name} transitioned to OPEN (failed in HALF_OPEN)`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.transitionToOpen();
      logger.warn(
        `Circuit breaker ${this.name} transitioned to OPEN (failure count: ${this.failureCount})`
      );
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    this.successCount = 0;
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== null && Date.now() >= this.nextAttemptTime;
  }

  /**
   * Get the time until next retry attempt
   */
  private getRetryAfter(): number {
    if (this.nextAttemptTime === null) {
      return 0;
    }
    return Math.max(0, this.nextAttemptTime - Date.now());
  }

  /**
   * Get current circuit state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  public reset(): void {
    this.transitionToClosed();
    logger.info(`Circuit breaker ${this.name} manually reset to CLOSED`);
  }

  /**
   * Manually open the circuit breaker
   */
  public open(): void {
    this.transitionToOpen();
    logger.warn(`Circuit breaker ${this.name} manually opened`);
  }

  /**
   * Check if circuit is currently allowing requests
   */
  public isAllowingRequests(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }
    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }
    // OPEN state
    return this.shouldAttemptReset();
  }
}

/**
 * Create a default circuit breaker with standard configuration
 */
export function createDefaultCircuitBreaker(name: string): CircuitBreaker {
  return new CircuitBreaker(name, {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 10000, // 10 seconds
    successThreshold: 2,
  });
}
