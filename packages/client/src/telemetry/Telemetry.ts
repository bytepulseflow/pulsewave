/**
 * Telemetry module for production debugging
 *
 * This module provides structured logging and event tracking for production debugging.
 * It can be extended to integrate with external monitoring services like Sentry, DataDog, etc.
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Telemetry event types
 */
export enum TelemetryEventType {
  // Connection events
  CONNECTION_ATTEMPTED = 'connection_attempted',
  CONNECTION_SUCCESS = 'connection_success',
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_RETRY = 'connection_retry',
  CONNECTION_CLOSED = 'connection_closed',

  // Room events
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  ROOM_ERROR = 'room_error',

  // Call events
  CALL_STARTED = 'call_started',
  CALL_ACCEPTED = 'call_accepted',
  CALL_REJECTED = 'call_rejected',
  CALL_ENDED = 'call_ended',
  CALL_ERROR = 'call_error',

  // Media events
  TRACK_PUBLISHED = 'track_published',
  TRACK_SUBSCRIBED = 'track_subscribed',
  TRACK_MUTED = 'track_muted',
  TRACK_UNMUTED = 'track_unmuted',
  TRACK_ERROR = 'track_error',

  // Data channel events
  DATA_SENT = 'data_sent',
  DATA_RECEIVED = 'data_received',
  DATA_ERROR = 'data_error',

  // Performance events
  PERFORMANCE_METRIC = 'performance_metric',
}

/**
 * Telemetry event metadata
 */
export interface TelemetryMetadata {
  [key: string]: unknown;
}

/**
 * Telemetry event
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  level: LogLevel;
  timestamp: number;
  metadata?: TelemetryMetadata;
  error?: Error;
}

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  metadata?: TelemetryMetadata;
}

/**
 * Telemetry options
 */
export interface TelemetryOptions {
  /**
   * Enable/disable telemetry
   */
  enabled?: boolean;

  /**
   * Minimum log level
   */
  minLevel?: LogLevel;

  /**
   * Sample rate (0-1)
   */
  sampleRate?: number;

  /**
   * Max events to buffer
   */
  maxBufferSize?: number;

  /**
   * Custom event handler
   */
  onEvent?: (event: TelemetryEvent) => void;
}

/**
 * Default telemetry options
 */
const DEFAULT_OPTIONS: Required<TelemetryOptions> = {
  enabled: true,
  minLevel: LogLevel.INFO,
  sampleRate: 1.0,
  maxBufferSize: 100,
  onEvent: () => undefined,
};

/**
 * Telemetry class
 */
export class Telemetry {
  private options: Required<TelemetryOptions>;
  private eventBuffer: TelemetryEvent[] = [];
  private sessionId: string;

  constructor(options: TelemetryOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if event should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() < this.options.sampleRate;
  }

  /**
   * Check if event should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minLevelIndex = levels.indexOf(this.options.minLevel);
    const eventLevelIndex = levels.indexOf(level);
    return eventLevelIndex >= minLevelIndex;
  }

  /**
   * Add event to buffer
   */
  private addToBuffer(event: TelemetryEvent): void {
    this.eventBuffer.push(event);

    // Trim buffer if it exceeds max size
    if (this.eventBuffer.length > this.options.maxBufferSize) {
      this.eventBuffer.shift();
    }
  }

  /**
   * Log a telemetry event
   */
  private logEvent(
    type: TelemetryEventType,
    level: LogLevel,
    metadata?: TelemetryMetadata,
    error?: Error
  ): void {
    if (!this.options.enabled) {
      return;
    }

    if (!this.shouldLog(level)) {
      return;
    }

    if (!this.shouldSample()) {
      return;
    }

    const event: TelemetryEvent = {
      type,
      level,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        sessionId: this.sessionId,
      },
      error,
    };

    this.addToBuffer(event);
    this.options.onEvent(event);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod =
        level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
      console[consoleMethod](`[Telemetry] ${type}`, { ...event });
    }
  }

  /**
   * Log a debug event
   */
  debug(type: TelemetryEventType, metadata?: TelemetryMetadata): void {
    this.logEvent(type, LogLevel.DEBUG, metadata);
  }

  /**
   * Log an info event
   */
  info(type: TelemetryEventType, metadata?: TelemetryMetadata): void {
    this.logEvent(type, LogLevel.INFO, metadata);
  }

  /**
   * Log a warning event
   */
  warn(type: TelemetryEventType, metadata?: TelemetryMetadata): void {
    this.logEvent(type, LogLevel.WARN, metadata);
  }

  /**
   * Log an error event
   */
  error(type: TelemetryEventType, error: Error, metadata?: TelemetryMetadata): void {
    this.logEvent(type, LogLevel.ERROR, metadata, error);
  }

  /**
   * Log a performance metric
   */
  logMetric(metric: PerformanceMetric): void {
    this.logEvent(TelemetryEventType.PERFORMANCE_METRIC, LogLevel.INFO, {
      metricName: metric.name,
      metricValue: metric.value,
      metricUnit: metric.unit,
      ...metric.metadata,
    });
  }

  /**
   * Get all buffered events
   */
  getEvents(): TelemetryEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Clear the event buffer
   */
  clearEvents(): void {
    this.eventBuffer = [];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: TelemetryEventType): TelemetryEvent[] {
    return this.eventBuffer.filter((event) => event.type === type);
  }

  /**
   * Get events by level
   */
  getEventsByLevel(level: LogLevel): TelemetryEvent[] {
    return this.eventBuffer.filter((event) => event.level === level);
  }

  /**
   * Get error events
   */
  getErrorEvents(): TelemetryEvent[] {
    return this.eventBuffer.filter((event) => event.error !== undefined);
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.options.enabled = true;
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.options.enabled = false;
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }
}

/**
 * Create a default telemetry instance
 */
export function createTelemetry(options?: TelemetryOptions): Telemetry {
  return new Telemetry(options);
}

/**
 * Global telemetry instance (singleton)
 */
let globalTelemetry: Telemetry | null = null;

/**
 * Get or create global telemetry instance
 */
export function getGlobalTelemetry(options?: TelemetryOptions): Telemetry {
  if (!globalTelemetry) {
    globalTelemetry = createTelemetry(options);
  }
  return globalTelemetry;
}

/**
 * Reset global telemetry instance (useful for testing)
 */
export function resetGlobalTelemetry(): void {
  globalTelemetry = null;
}
