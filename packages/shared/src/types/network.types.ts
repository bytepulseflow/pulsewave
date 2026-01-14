/**
 * Network quality types shared between server and client
 */

/**
 * Connection quality levels
 */
export enum ConnectionQuality {
  Excellent = 'excellent',
  Good = 'good',
  Poor = 'poor',
  VeryPoor = 'very_poor',
}

/**
 * Network quality metrics
 */
export interface NetworkQualityMetrics {
  /** Overall connection quality */
  quality: ConnectionQuality;
  /** Packet loss percentage (0-100) */
  packetLoss: number;
  /** Network jitter in milliseconds */
  jitter: number;
  /** Round trip time in milliseconds */
  rtt: number;
  /** Available bandwidth in kbps */
  bandwidth: number;
  /** Timestamp when metrics were collected */
  timestamp: number;
}

/**
 * Simulcast layer info
 */
export interface SimulcastLayer {
  /** Layer spatial quality */
  spatialLayer: number;
  /** Layer temporal quality */
  temporalLayer: number;
  /** Target bitrate in kbps */
  targetBitrate: number;
  /** Resolution width */
  width: number;
  /** Resolution height */
  height: number;
  /** Frame rate */
  frameRate: number;
}

/**
 * Adaptive bitrate configuration
 */
export interface AdaptiveBitrateConfig {
  /** Enable adaptive bitrate */
  enabled: boolean;
  /** Minimum bitrate in kbps */
  minBitrate: number;
  /** Maximum bitrate in kbps */
  maxBitrate: number;
  /** Target packet loss percentage */
  targetPacketLoss: number;
  /** Target jitter in milliseconds */
  targetJitter: number;
  /** Quality adjustment interval in milliseconds */
  adjustmentInterval: number;
  /** Number of samples to average */
  sampleSize: number;
}

/**
 * Network quality update event
 */
export interface NetworkQualityUpdateEvent {
  metrics: NetworkQualityMetrics;
  recommendedLayer?: SimulcastLayer;
}
