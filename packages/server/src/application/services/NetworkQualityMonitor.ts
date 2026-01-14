/**
 * NetworkQualityMonitor - Server-side network quality monitoring
 *
 * This service monitors network quality for all participants by collecting
 * stats from mediasoup consumers and updating participant metadata.
 */

import type { ConsumerStat } from '@bytepulse/pulsewave-shared';
import type { ApplicationParticipant } from '../domain/types';
import type { MediaAdapter } from '../../adapter/types';
import type {
  NetworkQualityMetrics,
  ConnectionQuality,
  AdaptiveBitrateConfig,
} from '@bytepulse/pulsewave-shared';
import { ConnectionQuality as ConnectionQualityEnum } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('application:network-quality-monitor');

/**
 * Network quality monitor options
 */
export interface NetworkQualityMonitorOptions {
  /** Interval for collecting stats in milliseconds (default: 5000ms) */
  interval?: number;
  /** Enable adaptive bitrate control (default: true) */
  enableAdaptiveBitrate?: boolean;
  /** Adaptive bitrate configuration */
  adaptiveBitrateConfig?: Partial<AdaptiveBitrateConfig>;
}

/**
 * Network quality monitor events
 */
export interface NetworkQualityMonitorEvents {
  /**
   * Network quality updated for a participant
   */
  'quality-updated': (data: { participantSid: string; metrics: NetworkQualityMetrics }) => void;
}

/**
 * Network quality monitor service
 */
export class NetworkQualityMonitor {
  private mediaAdapter: MediaAdapter;
  private participants: Map<string, ApplicationParticipant>;
  private options: Required<NetworkQualityMonitorOptions>;
  private intervalId: NodeJS.Timeout | null = null;
  private participantMetrics: Map<string, NetworkQualityMetrics> = new Map();

  constructor(mediaAdapter: MediaAdapter, options: NetworkQualityMonitorOptions = {}) {
    this.mediaAdapter = mediaAdapter;
    this.participants = new Map();
    this.options = {
      interval: options.interval ?? 5000,
      enableAdaptiveBitrate: options.enableAdaptiveBitrate ?? true,
      adaptiveBitrateConfig: options.adaptiveBitrateConfig ?? {},
    };
  }

  /**
   * Start monitoring network quality
   */
  public start(): void {
    if (this.intervalId) {
      logger.warn('Network quality monitor already running');
      return;
    }

    logger.info(`Starting network quality monitor with interval: ${this.options.interval}ms`);

    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.options.interval);
  }

  /**
   * Stop monitoring network quality
   */
  public stop(): void {
    if (!this.intervalId) {
      logger.warn('Network quality monitor not running');
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    logger.info('Stopped network quality monitor');
  }

  /**
   * Add a participant to monitor
   */
  public addParticipant(participant: ApplicationParticipant): void {
    this.participants.set(participant.sid, participant);
    logger.debug(`Added participant to monitor: ${participant.sid}`);
  }

  /**
   * Remove a participant from monitoring
   */
  public removeParticipant(participantSid: string): void {
    this.participants.delete(participantSid);
    this.participantMetrics.delete(participantSid);
    logger.debug(`Removed participant from monitor: ${participantSid}`);
  }

  /**
   * Collect metrics from all participants
   */
  private async collectMetrics(): Promise<void> {
    for (const participant of this.participants.values()) {
      try {
        const metrics = await this.collectParticipantMetrics(participant);
        if (metrics) {
          this.updateParticipantMetrics(participant, metrics);
        }
      } catch (error) {
        logger.error(`Failed to collect metrics for participant ${participant.sid}: ${error}`);
      }
    }
  }

  /**
   * Collect metrics for a single participant
   */
  private async collectParticipantMetrics(
    participant: ApplicationParticipant
  ): Promise<NetworkQualityMetrics | null> {
    const consumerIds = participant.getConsumerIds('*'); // Get all consumers

    if (consumerIds.length === 0) {
      logger.debug(`No consumers for participant ${participant.sid}`);
      return null;
    }

    let totalPacketLoss = 0;
    let totalJitter = 0;
    let totalRtt = 0;
    let totalBitrate = 0;
    let validStats = 0;

    for (const consumerId of consumerIds) {
      try {
        const stats = await this.mediaAdapter.getConsumerStats(consumerId);
        const consumerStats = this.extractConsumerStats(stats);

        if (consumerStats) {
          totalPacketLoss += consumerStats.packetLoss;
          totalJitter += consumerStats.jitter;
          totalRtt += consumerStats.rtt;
          totalBitrate += consumerStats.bitrate;
          validStats++;
        }
      } catch (error) {
        logger.debug(`Failed to get stats for consumer ${consumerId}: ${error}`);
      }
    }

    if (validStats === 0) {
      return null;
    }

    // Calculate averages
    const avgPacketLoss = totalPacketLoss / validStats;
    const avgJitter = totalJitter / validStats;
    const avgRtt = totalRtt / validStats;
    const avgBitrate = totalBitrate / validStats;

    // Determine connection quality
    const quality = this.assessConnectionQuality(avgPacketLoss, avgJitter, avgRtt);

    const metrics: NetworkQualityMetrics = {
      quality,
      packetLoss: avgPacketLoss,
      jitter: avgJitter,
      rtt: avgRtt,
      bandwidth: avgBitrate,
      timestamp: Date.now(),
    };

    return metrics;
  }

  /**
   * Extract relevant stats from consumer stats array
   */
  private extractConsumerStats(stats: ConsumerStat[]): {
    packetLoss: number;
    jitter: number;
    rtt: number;
    bitrate: number;
  } | null {
    for (const stat of stats) {
      if (stat.type === 'outbound-rtp' || stat.type === 'inbound-rtp') {
        return {
          packetLoss: this.calculatePacketLoss(stat),
          jitter: stat.jitter ?? 0,
          rtt: stat.rtt ?? 0,
          bitrate: stat.bitrate ?? 0,
        };
      }
    }
    return null;
  }

  /**
   * Calculate packet loss percentage
   */
  private calculatePacketLoss(stat: ConsumerStat): number {
    if (stat.packetLost !== undefined && stat.packetCount !== undefined) {
      const total = stat.packetLost + stat.packetCount;
      return total > 0 ? (stat.packetLost / total) * 100 : 0;
    }
    return 0;
  }

  /**
   * Assess connection quality based on metrics
   */
  private assessConnectionQuality(
    packetLoss: number,
    jitter: number,
    rtt: number
  ): ConnectionQuality {
    // Quality thresholds
    const EXCELLENT_PACKET_LOSS = 1;
    const GOOD_PACKET_LOSS = 3;
    const POOR_PACKET_LOSS = 5;

    const EXCELLENT_JITTER = 30;
    const GOOD_JITTER = 50;
    const POOR_JITTER = 100;

    const EXCELLENT_RTT = 100;
    const GOOD_RTT = 200;
    const POOR_RTT = 500;

    // Calculate quality score
    let score = 0;
    score += this.getQualityScore(
      packetLoss,
      EXCELLENT_PACKET_LOSS,
      GOOD_PACKET_LOSS,
      POOR_PACKET_LOSS
    );
    score += this.getQualityScore(jitter, EXCELLENT_JITTER, GOOD_JITTER, POOR_JITTER);
    score += this.getQualityScore(rtt, EXCELLENT_RTT, GOOD_RTT, POOR_RTT);

    // Determine quality based on average score
    const avgScore = score / 3;

    if (avgScore >= 0.8) {
      return ConnectionQualityEnum.Excellent;
    } else if (avgScore >= 0.6) {
      return ConnectionQualityEnum.Good;
    } else if (avgScore >= 0.4) {
      return ConnectionQualityEnum.Poor;
    } else {
      return ConnectionQualityEnum.VeryPoor;
    }
  }

  /**
   * Get quality score for a metric (0-1, where 1 is excellent)
   */
  private getQualityScore(value: number, excellent: number, good: number, poor: number): number {
    if (value <= excellent) {
      return 1;
    } else if (value <= good) {
      return 1 - ((value - excellent) / (good - excellent)) * 0.3;
    } else if (value <= poor) {
      return 0.7 - ((value - good) / (poor - good)) * 0.5;
    } else {
      return Math.max(0, 0.2 - ((value - poor) / poor) * 0.2);
    }
  }

  /**
   * Update participant metadata with network quality metrics
   */
  private updateParticipantMetrics(
    participant: ApplicationParticipant,
    metrics: NetworkQualityMetrics
  ): void {
    // Store metrics
    this.participantMetrics.set(participant.sid, metrics);

    // Update participant metadata
    participant.metadata = {
      ...participant.metadata,
      networkQuality: metrics,
    };

    logger.debug(
      `Updated network quality for participant ${participant.sid}: quality=${metrics.quality}, packetLoss=${metrics.packetLoss.toFixed(2)}%, rtt=${metrics.rtt}ms`
    );
  }

  /**
   * Get network quality metrics for a participant
   */
  public getParticipantMetrics(participantSid: string): NetworkQualityMetrics | null {
    return this.participantMetrics.get(participantSid) ?? null;
  }

  /**
   * Get all participant metrics
   */
  public getAllMetrics(): Map<string, NetworkQualityMetrics> {
    return new Map(this.participantMetrics);
  }

  /**
   * Update configuration
   */
  public updateConfig(options: Partial<NetworkQualityMonitorOptions>): void {
    if (options.interval !== undefined) {
      this.options.interval = options.interval;
      // Restart with new interval
      if (this.intervalId) {
        this.stop();
        this.start();
      }
    }
    if (options.enableAdaptiveBitrate !== undefined) {
      this.options.enableAdaptiveBitrate = options.enableAdaptiveBitrate;
    }
    if (options.adaptiveBitrateConfig !== undefined) {
      this.options.adaptiveBitrateConfig = {
        ...this.options.adaptiveBitrateConfig,
        ...options.adaptiveBitrateConfig,
      };
    }
    logger.info('Updated network quality monitor configuration');
  }

  /**
   * Check if monitor is running
   */
  public isRunning(): boolean {
    return this.intervalId !== null;
  }
}
