/**
 * Domain Errors - Standardized error hierarchy for the PulseWave server
 *
 * Provides consistent error handling across all layers with:
 * - Error codes for programmatic handling
 * - Context information for debugging
 * - Proper error inheritance
 */

/**
 * Base Domain Error class
 *
 * All domain errors should extend this class for consistent error handling.
 */
export abstract class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to a plain object for serialization
   */
  toJSON(): {
    name: string;
    code: string;
    message: string;
    context?: Record<string, unknown>;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/**
 * Resource Not Found Error
 *
 * Thrown when a requested resource cannot be found.
 */
export class ResourceNotFoundError extends DomainError {
  constructor(resource: string, id: string, context?: Record<string, unknown>) {
    super('RESOURCE_NOT_FOUND', `${resource} not found: ${id}`, { resource, id, ...context });
  }
}

/**
 * Resource Exists Error
 *
 * Thrown when trying to create a resource that already exists.
 */
export class ResourceExistsError extends DomainError {
  constructor(resource: string, identifier: string, context?: Record<string, unknown>) {
    super('RESOURCE_EXISTS', `${resource} already exists: ${identifier}`, {
      resource,
      identifier,
      ...context,
    });
  }
}

/**
 * Invalid State Error
 *
 * Thrown when an operation is attempted in an invalid state.
 */
export class InvalidStateError extends DomainError {
  constructor(
    operation: string,
    currentState: string,
    expectedState: string,
    context?: Record<string, unknown>
  ) {
    super(
      'INVALID_STATE',
      `Cannot ${operation} in state "${currentState}" (expected: "${expectedState}")`,
      { operation, currentState, expectedState, ...context }
    );
  }
}

/**
 * Validation Error
 *
 * Thrown when input validation fails.
 */
export class ValidationError extends DomainError {
  constructor(field: string, reason: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', `Validation failed for field "${field}": ${reason}`, {
      field,
      reason,
      ...context,
    });
  }
}

/**
 * Rate Limit Error
 *
 * Thrown when rate limit is exceeded.
 */
export class RateLimitError extends DomainError {
  constructor(
    limit: number,
    window: number,
    retryAfter: number,
    context?: Record<string, unknown>
  ) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded: ${limit} requests per ${window}ms. Retry after ${retryAfter}ms`,
      { limit, window, retryAfter, ...context }
    );
  }
}

/**
 * Authentication Error
 *
 * Thrown when authentication fails.
 */
export class AuthenticationError extends DomainError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super('AUTHENTICATION_FAILED', `Authentication failed: ${reason}`, { reason, ...context });
  }
}

/**
 * Authorization Error
 *
 * Thrown when authorization fails (user is authenticated but not authorized).
 */
export class AuthorizationError extends DomainError {
  constructor(resource: string, action: string, context?: Record<string, unknown>) {
    super('AUTHORIZATION_FAILED', `Not authorized to ${action} on ${resource}`, {
      resource,
      action,
      ...context,
    });
  }
}

/**
 * Timeout Error
 *
 * Thrown when an operation times out.
 */
export class TimeoutError extends DomainError {
  constructor(operation: string, timeoutMs: number, context?: Record<string, unknown>) {
    super('TIMEOUT', `Operation "${operation}" timed out after ${timeoutMs}ms`, {
      operation,
      timeoutMs,
      ...context,
    });
  }
}

/**
 * Circuit Breaker Error
 *
 * Thrown when a circuit breaker is open.
 */
export class CircuitBreakerError extends DomainError {
  constructor(service: string, context?: Record<string, unknown>) {
    super('CIRCUIT_BREAKER_OPEN', `Circuit breaker is open for service: ${service}`, {
      service,
      ...context,
    });
  }
}

/**
 * Configuration Error
 *
 * Thrown when there's a configuration problem.
 */
export class ConfigurationError extends DomainError {
  constructor(setting: string, reason: string, context?: Record<string, unknown>) {
    super('CONFIGURATION_ERROR', `Configuration error for "${setting}": ${reason}`, {
      setting,
      reason,
      ...context,
    });
  }
}

/**
 * Media Error
 *
 * Thrown when there's a media-related error (WebRTC, mediasoup, etc.).
 */
export class MediaError extends DomainError {
  constructor(operation: string, reason: string, context?: Record<string, unknown>) {
    super('MEDIA_ERROR', `Media error during ${operation}: ${reason}`, {
      operation,
      reason,
      ...context,
    });
  }
}

/**
 * Network Error
 *
 * Thrown when there's a network-related error.
 */
export class NetworkError extends DomainError {
  constructor(operation: string, reason: string, context?: Record<string, unknown>) {
    super('NETWORK_ERROR', `Network error during ${operation}: ${reason}`, {
      operation,
      reason,
      ...context,
    });
  }
}

/**
 * Internal Error
 *
 * Thrown when there's an unexpected internal error.
 */
export class InternalError extends DomainError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super('INTERNAL_ERROR', `Internal error: ${reason}`, { reason, ...context });
  }
}

/**
 * Error Code Constants
 */
export const ERROR_CODES = {
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  INVALID_STATE: 'INVALID_STATE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  TIMEOUT: 'TIMEOUT',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  MEDIA_ERROR: 'MEDIA_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Type guard to check if an error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Convert any error to a DomainError
 *
 * If the error is already a DomainError, return it.
 * Otherwise, wrap it in an InternalError.
 */
export function toDomainError(error: unknown, context?: Record<string, unknown>): DomainError {
  if (isDomainError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, { originalError: error.name, ...context });
  }

  return new InternalError(String(error), context);
}
