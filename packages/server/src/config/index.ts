/**
 * Server configuration
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Mediasoup configuration schema
 */
const mediasoupConfigSchema = z.object({
  numWorkers: z.number().min(1).default(1),
  rtcMinPort: z.number().min(1024).max(65535).default(40000),
  rtcMaxPort: z.number().min(1024).max(65535).default(50000),
  logLevel: z.enum(['debug', 'warn', 'error']).default('error'),
  logTags: z.array(z.string()).default(['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']),
  // Transport configuration
  enableUdp: z.boolean().default(true),
  enableTcp: z.boolean().default(true),
  preferUdp: z.boolean().default(true),
  enableSctp: z.boolean().default(false),
  listenIps: z
    .array(
      z.object({
        ip: z.string(),
        announcedIp: z.string().optional(),
      })
    )
    .default([{ ip: '0.0.0.0' }]),
  initialAvailableOutgoingBitrate: z.number().default(600000),
});

/**
 * Redis configuration schema
 */
const redisConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.number().min(0).default(0),
  enabled: z.boolean().default(true),
});

/**
 * Server configuration schema
 */
const serverConfigSchema = z.object({
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  tls: z
    .object({
      cert: z.string(),
      key: z.string(),
    })
    .optional(),
});

/**
 * JWT configuration schema
 */
const jwtConfigSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  expiresIn: z.string().default('24h'),
});

/**
 * ICE servers configuration schema
 */
const iceServersSchema = z.array(
  z.object({
    urls: z.array(z.string()),
    username: z.string().optional(),
    credential: z.string().optional(),
  })
);

/**
 * Full configuration schema
 */
const configSchema = z.object({
  server: serverConfigSchema,
  mediasoup: mediasoupConfigSchema,
  redis: redisConfigSchema,
  jwt: jwtConfigSchema,
  iceServers: iceServersSchema.optional().default([]),
});

/**
 * Configuration types
 */
export type MediasoupConfig = z.infer<typeof mediasoupConfigSchema>;
export type RedisConfig = z.infer<typeof redisConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type JwtConfig = z.infer<typeof jwtConfigSchema>;
export type IceServer = z.infer<typeof iceServersSchema>[number];
export type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const config = configSchema.parse({
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
      host: process.env.HOST,
      tls:
        process.env.TLS_CERT && process.env.TLS_KEY
          ? {
              cert: process.env.TLS_CERT,
              key: process.env.TLS_KEY,
            }
          : undefined,
    },
    mediasoup: {
      numWorkers: process.env.MEDIASOUP_NUM_WORKERS
        ? parseInt(process.env.MEDIASOUP_NUM_WORKERS, 10)
        : undefined,
      rtcMinPort: process.env.MEDIASOUP_MIN_PORT
        ? parseInt(process.env.MEDIASOUP_MIN_PORT, 10)
        : undefined,
      rtcMaxPort: process.env.MEDIASOUP_MAX_PORT
        ? parseInt(process.env.MEDIASOUP_MAX_PORT, 10)
        : undefined,
      logLevel: process.env.MEDIASOUP_LOG_LEVEL as 'debug' | 'warn' | 'error',
      enableUdp: process.env.MEDIASOUP_ENABLE_UDP !== 'false',
      enableTcp: process.env.MEDIASOUP_ENABLE_TCP !== 'false',
      preferUdp: process.env.MEDIASOUP_PREFER_UDP !== 'false',
      enableSctp: process.env.MEDIASOUP_ENABLE_SCTP === 'true',
      listenIps: process.env.MEDIASOUP_LISTEN_IPS
        ? JSON.parse(process.env.MEDIASOUP_LISTEN_IPS)
        : [{ ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0' }],
      initialAvailableOutgoingBitrate: process.env.MEDIASOUP_INITIAL_BITRATE
        ? parseInt(process.env.MEDIASOUP_INITIAL_BITRATE, 10)
        : undefined,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
      enabled: process.env.REDIS_ENABLED !== 'false',
    },
    jwt: {
      apiKey: process.env.API_KEY,
      apiSecret: process.env.API_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
    iceServers: process.env.ICE_SERVERS ? JSON.parse(process.env.ICE_SERVERS) : undefined,
  });

  return config;
}

/**
 * Get configuration (singleton)
 */
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
