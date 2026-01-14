/**
 * AdaptiveBitrateController - Adjusts video quality based on network conditions
 */

import type { types } from 'mediasoup-client';
import type {
  NetworkQualityMetrics,
  AdaptiveBitrateConfig,
  SimulcastLayer,
} from '@bytepulse/pulsewave-shared';
import { ConnectionQuality } from '@bytepulse/pulsewave-shared';
import { NetworkQualityMonitor } from './NetworkQualityMonitor';
import { EventEmitter } from '../utils/EventEmitter';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('adaptive-bitrate');

/**
 * Simulcast layer configurations
 */
const SIMULCAST_LAYERS: SimulcastLayer[] = [
  { spatialLayer: 0, temporalLayer: 0, targetBitrate: 100, width: 320, height: 180, frameRate: 15 },
  { spatialLayer: 1, temporalLayer: 0, targetBitrate: 300, width: 640, height: 360, frameRate: 15 },
  { spatialLayer: 1, temporalLayer: 1, targetBitrate: 500, width: 640, height: 360, frameRate: 30 },
  {
    spatialLayer: 2,
    temporalLayer: 0,
    targetBitrate: 800,
    width: 1280,
    height: 720,
    frameRate: 15,
  },
  {
    spatialLayer: 2,
    temporalLayer: 1,
    targetBitrate: 1500,
    width: 1280,
    height: 720,
    frameRate: 30,
  },
  {
    spatialLayer: 2,
    temporalLayer: 2,
    targetBitrate: 2500,
    width: 1280,
    height: 720,
    frameRate: 60,
  },
  {
    spatialLayer: 3,
    temporalLayer: 0,
    targetBitrate: 2000,
    width: 1920,
    height: 1080,
    frameRate: 15,
  },
  {
    spatialLayer: 3,
    temporalLayer: 1,
    targetBitrate: 3000,
    width: 1920,
    height: 1080,
    frameRate: 30,
  },
  {
    spatialLayer: 3,
    temporalLayer: 2,
    targetBitrate: 4500,
    width: 1920,
    height: 1080,
    frameRate: 60,
  },
];

/**
 * Adaptive bitrate controller events
 */
export interface AdaptiveBitrateControllerEvents {
  'layer-changed': (layer: SimulcastLayer) => void;
  'quality-adjusted': (metrics: NetworkQualityMetrics) => void;
}

/**
 * Adaptive bitrate controller class
 * Automatically adjusts video quality based on network conditions
 */
export class AdaptiveBitrateController extends EventEmitter<AdaptiveBitrateControllerEvents> {
  private monitor: NetworkQualityMonitor;
  private consumer: types.Consumer | null = null;
  private currentLayer: SimulcastLayer | null = null;

  constructor(config: Partial<AdaptiveBitrateConfig> = {}) {
    super({ name: 'AdaptiveBitrateController' });
    this.monitor = new NetworkQualityMonitor(config);
    this.setupMonitorListeners();
    logger.info('AdaptiveBitrateController initialized', { config });
  }

  /**
   * Set up monitor event listeners
   */
  private setupMonitorListeners(): void {
    this.monitor.on('quality-update', (metrics: NetworkQualityMetrics) => {
      this.handleQualityUpdate(metrics);
    });

    this.monitor.on('quality-change', (quality: ConnectionQuality) => {
      logger.info('Network quality changed', { quality });
    });
  }

  /**
   * Start adaptive bitrate control
   */
  start(consumer: types.Consumer): void {
    this.consumer = consumer;
    this.monitor.start(consumer);
    logger.info('Adaptive bitrate control started');
  }

  /**
   * Stop adaptive bitrate control
   */
  stop(): void {
    this.monitor.stop();
    this.consumer = null;
    this.currentLayer = null;
    logger.info('Adaptive bitrate control stopped');
  }

  /**
   * Handle quality update from monitor
   */
  private handleQualityUpdate(metrics: NetworkQualityMetrics): void {
    const recommendedLayer = this.recommendLayer(metrics);

    if (recommendedLayer && (!this.currentLayer || this.shouldChangeLayer(recommendedLayer))) {
      this.applyLayer(recommendedLayer);
    }

    // Emit quality adjusted event
    this.emit('quality-adjusted', metrics);
  }

  /**
   * Recommend a simulcast layer based on network quality
   */
  private recommendLayer(metrics: NetworkQualityMetrics): SimulcastLayer | null {
    const { quality, bandwidth } = metrics;

    // Select layer based on quality and available bandwidth
    switch (quality) {
      case ConnectionQuality.Excellent:
        // Use highest quality layer if bandwidth allows
        return this.findBestLayer(bandwidth, 3);

      case ConnectionQuality.Good:
        // Use medium-high quality
        return this.findBestLayer(bandwidth, 2);

      case ConnectionQuality.Poor:
        // Use low-medium quality
        return this.findBestLayer(bandwidth, 1);

      case ConnectionQuality.VeryPoor:
        // Use lowest quality
        return SIMULCAST_LAYERS[0];

      default:
        return SIMULCAST_LAYERS[2]; // Default to 720p
    }
  }

  /**
   * Find the best layer for a given max spatial layer and bandwidth
   */
  private findBestLayer(bandwidth: number, maxSpatialLayer: number): SimulcastLayer {
    // Filter layers by max spatial layer
    const availableLayers = SIMULCAST_LAYERS.filter(
      (layer) => layer.spatialLayer <= maxSpatialLayer
    );

    // Find the highest quality layer that fits within bandwidth
    for (let i = availableLayers.length - 1; i >= 0; i--) {
      if (availableLayers[i].targetBitrate <= bandwidth) {
        return availableLayers[i];
      }
    }

    // Return lowest layer if none fit
    return availableLayers[0];
  }

  /**
   * Check if we should change to the recommended layer
   */
  private shouldChangeLayer(recommendedLayer: SimulcastLayer): boolean {
    if (!this.currentLayer) {
      return true;
    }

    // Only change if there's a significant difference
    const qualityDiff = Math.abs(recommendedLayer.spatialLayer - this.currentLayer.spatialLayer);
    return qualityDiff >= 1;
  }

  /**
   * Apply the recommended layer to the consumer
   */
  private async applyLayer(layer: SimulcastLayer): Promise<void> {
    if (!this.consumer) {
      logger.warn('No consumer to apply layer to');
      return;
    }

    try {
      // Set preferred spatial layer using mediasoup API
      // Note: setPreferredLayers may not be available in all versions
      // We'll use setMaxSpatialLayer and setMaxTemporalLayer instead
      if ('setMaxSpatialLayer' in this.consumer) {
        await (this.consumer as any).setMaxSpatialLayer(layer.spatialLayer);
      }
      if ('setMaxTemporalLayer' in this.consumer) {
        await (this.consumer as any).setMaxTemporalLayer(layer.temporalLayer);
      }

      this.currentLayer = layer;
      logger.info('Applied simulcast layer', {
        spatialLayer: layer.spatialLayer,
        temporalLayer: layer.temporalLayer,
        targetBitrate: layer.targetBitrate,
        resolution: `${layer.width}x${layer.height}`,
        frameRate: layer.frameRate,
      });

      // Emit layer changed event
      this.emit('layer-changed', layer);
    } catch (error) {
      logger.error('Failed to apply layer', { error, layer });
    }
  }

  /**
   * Get current network quality metrics
   */
  getCurrentMetrics(): NetworkQualityMetrics | null {
    return this.monitor.getCurrentMetrics();
  }

  /**
   * Get current connection quality
   */
  getCurrentQuality(): ConnectionQuality {
    return this.monitor.getCurrentQuality();
  }

  /**
   * Get current simulcast layer
   */
  getCurrentLayer(): SimulcastLayer | null {
    return this.currentLayer;
  }

  /**
   * Check if adaptive bitrate is enabled
   */
  isEnabled(): boolean {
    return this.monitor.isEnabled();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AdaptiveBitrateConfig>): void {
    this.monitor.updateConfig(config);
    logger.info('AdaptiveBitrateController config updated', { config });
  }

  /**
   * Manually set a specific layer (overrides automatic selection)
   */
  async setManualLayer(layer: SimulcastLayer): Promise<void> {
    await this.applyLayer(layer);
  }

  /**
   * Reset to automatic layer selection
   */
  resetToAutomatic(): void {
    this.currentLayer = null;
    logger.info('Reset to automatic layer selection');
  }
}
