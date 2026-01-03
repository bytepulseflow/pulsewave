/**
 * Logger utility for client-side logging
 *
 * Provides a simple logging interface that works in browser environments.
 * Supports different log levels and structured logging.
 */

// Type declaration for process.env in browser
declare const process:
  | {
      env?: {
        NODE_ENV?: string;
      };
    }
  | undefined;

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

// Logger configuration
interface LoggerConfig {
  level?: LogLevel;
  name?: string;
  enabled?: boolean;
}

// Log entry interface
interface LogEntry {
  level: string;
  name?: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

// Default logger instance
let defaultLogger: Logger | null = null;

/**
 * Get log level from string
 */
function getLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'silent':
      return LogLevel.SILENT;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Get log level name
 */
function getLogLevelName(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARN:
      return 'WARN';
    case LogLevel.ERROR:
      return 'ERROR';
    case LogLevel.SILENT:
      return 'SILENT';
    default:
      return 'INFO';
  }
}

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts: string[] = [];

  if (entry.timestamp) {
    parts.push(`[${entry.timestamp}]`);
  }

  if (entry.name) {
    parts.push(`[${entry.name}]`);
  }

  parts.push(`[${entry.level}]`);
  parts.push(entry.message);

  return parts.join(' ');
}

/**
 * Logger class
 */
export class Logger {
  private level: LogLevel;
  private name: string;
  private enabled: boolean;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level !== undefined ? config.level : LogLevel.INFO;
    this.name = config.name || 'pulsewave';
    this.enabled = config.enabled !== undefined ? config.enabled : true;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.enabled && level >= this.level;
  }

  /**
   * Log a message
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level: getLogLevelName(level),
      name: this.name,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    const formattedMessage = formatLogEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        console.debug(formattedMessage, data ?? '');
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(formattedMessage, data ?? '');
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(formattedMessage, data ?? '');
        break;
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        console.error(formattedMessage, data ?? '');
        break;
    }
  }

  /**
   * Log debug message
   */
  public debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  public info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  public warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  public error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel | string): void {
    this.level = typeof level === 'string' ? getLogLevel(level) : level;
  }

  /**
   * Enable or disable logging
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Create a child logger
   */
  public child(name: string): Logger {
    const childName = this.name ? `${this.name}:${name}` : name;
    return new Logger({
      level: this.level,
      name: childName,
      enabled: this.enabled,
    });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  return new Logger(config);
}
/**
 * Get or create the default logger instance
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    // Check for environment variable - works in both browser and Node.js
    const isProduction =
      (typeof window !== 'undefined' &&
        (window as { __PULSEWAVE_ENV__?: string }).__PULSEWAVE_ENV__ === 'production') ||
      (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
    const envLevel = isProduction ? LogLevel.WARN : LogLevel.DEBUG;
    defaultLogger = createLogger({ level: envLevel });
  }
  return defaultLogger;
}
/**
 * Set the default logger instance
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Create a module logger
 */
export function createModuleLogger(moduleName: string): Logger {
  return getLogger().child(moduleName);
}

// Export default logger
export const logger = getLogger();

// Export convenience functions
export const log = {
  debug: (msg: string, data?: unknown) => logger.debug(msg, data),
  info: (msg: string, data?: unknown) => logger.info(msg, data),
  warn: (msg: string, data?: unknown) => logger.warn(msg, data),
  error: (msg: string, data?: unknown) => logger.error(msg, data),
};

export default logger;
