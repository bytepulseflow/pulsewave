/**
 * NetworkQualityMonitor - Monitors network quality metrics for WebRTC connections
 */

import type { types } from 'mediasoup-client';
import type { NetworkQualityMetrics, AdaptiveBitrateConfig } from '@bytepulse/pulsewave-shared';
import { ConnectionQuality } from '@bytepulse/pulsewave-shared';
import { EventEmitter } from '../utils/EventEmitter';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('network-quality');

/**
 * Default adaptive bitrate configuration
 */
const DEFAULT_CONFIG: AdaptiveBitrateConfig = {
  enabled: true,
  minBitrate: 100, // 100 kbps
  maxBitrate: 3000, // 3000 kbps (3 Mbps)
  targetPacketLoss: 2, // 2%
  targetJitter: 30, // 30ms
  adjustmentInterval: 2000, // 2 seconds
  sampleSize: 10, // Average over 10 samples
};

/**
 * Network quality monitor events
 */
export interface NetworkQualityMonitorEvents {
  'quality-update': (metrics: NetworkQualityMetrics) => void;
  'quality-change': (quality: ConnectionQuality) => void;
}

/**
 * Network quality monitor class
 * Monitors packet loss, jitter, RTT, and bandwidth to assess connection quality
 */
export class NetworkQualityMonitor extends EventEmitter<NetworkQualityMonitorEvents> {
  private config: AdaptiveBitrateConfig;
  private metricsHistory: NetworkQualityMetrics[] = [];
  private currentMetrics: NetworkQualityMetrics | null = null;
  private currentQuality: ConnectionQuality = ConnectionQuality.Excellent;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<AdaptiveBitrateConfig> = {}) {
    super({ name: 'NetworkQualityMonitor' });
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('NetworkQualityMonitor initialized', { config: this.config });
  }

  /**
   * Start monitoring network quality
   */
  start(consumer: types.Consumer): void {
    if (this.monitoringInterval) {
      logger.warn('Monitoring already started');
      return;
    }

    logger.info('Starting network quality monitoring');

    // Set up consumer stats monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics(consumer);
    }, this.config.adjustmentInterval);

    // Initial metrics collection
    this.collectMetrics(consumer);
  }

  /**
   * Stop monitoring network quality
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Network quality monitoring stopped');
    }

    this.metricsHistory = [];
    this.currentMetrics = null;
  }

  /**
   * Collect metrics from consumer stats
   */
  private async collectMetrics(consumer: types.Consumer): Promise<void> {
    try {
      const stats = await consumer.getStats();

      // Calculate packet loss
      const packetLoss = this.calculatePacketLoss(stats);

      // Calculate jitter
      const jitter = this.calculateJitter(stats);

      // Calculate RTT (from transport stats)
      const rtt = this.calculateRTT(stats);

      // Estimate bandwidth
      const bandwidth = this.estimateBandwidth(stats);

      const metrics: NetworkQualityMetrics = {
        quality: this.assessQuality(packetLoss, jitter, rtt, bandwidth),
        packetLoss,
        jitter,
        rtt,
        bandwidth,
        timestamp: Date.now(),
      };

      // Add to history
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.config.sampleSize) {
        this.metricsHistory.shift();
      }

      // Calculate average metrics
      this.currentMetrics = this.calculateAverageMetrics();

      // Check if quality changed
      const newQuality = this.currentMetrics.quality;
      if (newQuality !== this.currentQuality) {
        const oldQuality = this.currentQuality;
        this.currentQuality = newQuality;
        logger.info('Connection quality changed', {
          oldQuality,
          newQuality,
          metrics: this.currentMetrics,
        });
        this.emit('quality-change', newQuality);
      }

      // Emit quality update event
      this.emit('quality-update', this.currentMetrics);
    } catch (error) {
      logger.error('Error collecting metrics', { error });
    }
  }

  /**
   * Calculate packet loss percentage
   */
  private calculatePacketLoss(stats: RTCStatsReport): number {
    // Find inbound-rtp stats for video/audio
    const inboundStats = Array.from(stats.values()).find(
      (stat) => stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.kind === 'audio')
    );

    if (!inboundStats || !('packetsLost' in inboundStats) || !('packetsReceived' in inboundStats)) {
      return 0;
    }

    const packetsLost = (inboundStats as { packetsLost: number }).packetsLost;
    const packetsReceived = (inboundStats as { packetsReceived: number }).packetsReceived;
    const totalPackets = packetsReceived + packetsLost;

    if (totalPackets === 0) {
      return 0;
    }

    return (packetsLost / totalPackets) * 100;
  }

  /**
   * Calculate jitter in milliseconds
   */
  private calculateJitter(stats: RTCStatsReport): number {
    // Find inbound-rtp stats for video/audio
    const inboundStats = Array.from(stats.values()).find(
      (stat) => stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.kind === 'audio')
    );

    if (!inboundStats || !('jitter' in inboundStats)) {
      return 0;
    }

    return (inboundStats as { jitter: number }).jitter;
  }

  /**
   * Calculate round trip time
   */
  private calculateRTT(stats: RTCStatsReport): number {
    // Find remote-inbound-rtp stats for RTT
    const remoteStats = Array.from(stats.values()).find(
      (stat) =>
        stat.type === 'remote-inbound-rtp' && (stat.kind === 'video' || stat.kind === 'audio')
    );

    if (!remoteStats || !('roundTripTime' in remoteStats)) {
      return 0;
    }

    return (remoteStats as { roundTripTime: number }).roundTripTime * 1000; // Convert to ms
  }

  /**
   * Estimate bandwidth in kbps
   */
  private estimateBandwidth(stats: RTCStatsReport): number {
    // Find inbound-rtp stats for video/audio
    const inboundStats = Array.from(stats.values()).find(
      (stat) => stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.kind === 'audio')
    );

    if (!inboundStats || !('bytesReceived' in inboundStats)) {
      return 0;
    }

    // Calculate bitrate based on bytes received over time
    // This is a simplified calculation - in production, you'd track this over time
    const bytesReceived = (inboundStats as { bytesReceived: number }).bytesReceived;
    return Math.round((bytesReceived * 8) / 1000); // Convert to kbps (simplified)
  }

  /**
   * Assess connection quality based on metrics
   */
  private assessQuality(
    packetLoss: number,
    jitter: number,
    rtt: number,
    _bandwidth: number
  ): ConnectionQuality {
    // Quality scoring (lower is better)
    let score = 0;

    // Packet loss score (0-40)
    if (packetLoss > 10) score += 40;
    else if (packetLoss > 5) score += 30;
    else if (packetLoss > 2) score += 20;
    else if (packetLoss > 1) score += 10;

    // Jitter score (0-30)
    if (jitter > 100) score += 30;
    else if (jitter > 50) score += 20;
    else if (jitter > 30) score += 10;

    // RTT score (0-30)
    if (rtt > 500) score += 30;
    else if (rtt > 200) score += 20;
    else if (rtt > 100) score += 10;

    // Determine quality based on score
    if (score >= 70) {
      return ConnectionQuality.VeryPoor;
    } else if (score >= 50) {
      return ConnectionQuality.Poor;
    } else if (score >= 20) {
      return ConnectionQuality.Good;
    } else {
      return ConnectionQuality.Excellent;
    }
  }

  /**
   * Calculate average metrics from history
   */
  private calculateAverageMetrics(): NetworkQualityMetrics {
    if (this.metricsHistory.length === 0) {
      return {
        quality: ConnectionQuality.Excellent,
        packetLoss: 0,
        jitter: 0,
        rtt: 0,
        bandwidth: 0,
        timestamp: Date.now(),
      };
    }

    const sum = this.metricsHistory.reduce(
      (acc, metrics) => ({
        packetLoss: acc.packetLoss + metrics.packetLoss,
        jitter: acc.jitter + metrics.jitter,
        rtt: acc.rtt + metrics.rtt,
        bandwidth: acc.bandwidth + metrics.bandwidth,
      }),
      { packetLoss: 0, jitter: 0, rtt: 0, bandwidth: 0 }
    );

    const count = this.metricsHistory.length;
    const latest = this.metricsHistory[this.metricsHistory.length - 1];

    return {
      quality: latest.quality,
      packetLoss: sum.packetLoss / count,
      jitter: sum.jitter / count,
      rtt: sum.rtt / count,
      bandwidth: sum.bandwidth / count,
      timestamp: latest.timestamp,
    };
  }

  /**
   * Get current network quality metrics
   */
  getCurrentMetrics(): NetworkQualityMetrics | null {
    return this.currentMetrics;
  }

  /**
   * Get current connection quality
   */
  getCurrentQuality(): ConnectionQuality {
    return this.currentQuality;
  }

  /**
   * Check if adaptive bitrate is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AdaptiveBitrateConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('NetworkQualityMonitor config updated', { config: this.config });
  }
}
