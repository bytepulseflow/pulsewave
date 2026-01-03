import pino from 'pino';

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// Logger configuration
interface LoggerConfig {
  level?: LogLevel;
  pretty?: boolean;
  name?: string;
}

// Create a child logger with context
export interface LoggerContext {
  [key: string]: string | number | boolean | null | undefined | LoggerContext | unknown[];
}

// Default logger instance
let defaultLogger: pino.Logger | null = null;

/**
 * Create a new pino logger instance
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const { level = LogLevel.INFO, pretty = true, name = 'pulsewave' } = config;

  const pinoConfig: pino.LoggerOptions = {
    level,
    name,
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  };

  // Use pretty print in development
  if (pretty && process.env.NODE_ENV !== 'production') {
    return pino(
      {
        ...pinoConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
      pino.multistream([
        {
          level: 'trace',
          stream: process.stdout,
        },
      ])
    );
  }

  return pino(pinoConfig);
}

/**
 * Get or create the default logger instance
 */
export function getLogger(): pino.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: LoggerContext, parent?: pino.Logger): pino.Logger {
  const logger = parent || getLogger();
  return logger.child(context);
}

/**
 * Set the default logger instance
 */
export function setLogger(logger: pino.Logger): void {
  defaultLogger = logger;
}

/**
 * Update the log level at runtime
 */
export function setLogLevel(level: LogLevel): void {
  const logger = getLogger();
  logger.level = level;
}

// Export convenience functions for the default logger
export const logger = getLogger();

export const log = {
  debug: (msg: string, ...args: unknown[]) => logger.debug(args, msg),
  info: (msg: string, ...args: unknown[]) => logger.info(args, msg),
  warn: (msg: string, ...args: unknown[]) => logger.warn(args, msg),
  error: (msg: string, ...args: unknown[]) => logger.error(args, msg),
  fatal: (msg: string, ...args: unknown[]) => logger.fatal(args, msg),
};

// Export named loggers for different modules
export const createModuleLogger = (moduleName: string) => {
  return createChildLogger({ module: moduleName });
};

export default logger;
