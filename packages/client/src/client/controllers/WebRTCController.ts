/**
 * WebRTCController - Manages WebRTC lifecycle
 *
 * Handles WebRTC transport creation, track publishing, and subscription.
 */

import type { RtpCapabilities, DataChannelKind } from '@bytepulse/pulsewave-shared';
import { WebRTCManager } from '../../webrtc/WebRTCManager';
import type { types } from 'mediasoup-client';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('webrtc-controller');

/**
 * WebRTCController - Manages WebRTC lifecycle
 */
export class WebRTCController {
  private webRTCManager: WebRTCManager | null = null;
  private isInitialized = false;
  private messageHandlers: Set<(data: unknown) => void> = new Set();

  constructor(private readonly sendFn: (message: Record<string, unknown>) => void) {}

  /**
   * Initialize WebRTC
   */
  async initialize(rtpCapabilities: RtpCapabilities): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.webRTCManager = new WebRTCManager(
      this.sendFn,
      (handler) => this.messageHandlers.add(handler),
      (handler) => this.messageHandlers.delete(handler)
    );
    await this.webRTCManager.initialize({
      rtpCapabilities,
    });

    // Create send and receive transports
    await this.webRTCManager.createSendTransport();
    await this.webRTCManager.createRecvTransport();

    this.isInitialized = true;
    logger.info('WebRTC initialized');
  }

  /**
   * Register a callback to be called when both transports are connected
   */
  onTransportsConnected(callback: () => void): void {
    if (!this.webRTCManager) {
      return;
    }
    this.webRTCManager.onTransportsConnected(callback);
  }

  /**
   * Unregister a transports connected callback
   */
  offTransportsConnected(callback: () => void): void {
    if (!this.webRTCManager) {
      return;
    }
    this.webRTCManager.offTransportsConnected(callback);
  }

  /**
   * Wait for both transports to be connected
   */
  async waitForTransportsConnected(): Promise<void> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }
    await this.webRTCManager.waitForTransportsConnected();
  }

  /**
   * Check if both transports are connected
   */
  areTransportsConnected(): boolean {
    if (!this.webRTCManager) {
      return false;
    }
    return this.webRTCManager.areTransportsConnected();
  }

  /**
   * Publish track
   */
  async publishTrack(
    track: MediaStreamTrack,
    options: { source: string }
  ): Promise<types.Producer> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    return this.webRTCManager.publishTrack(track, options);
  }

  /**
   * Unpublish track
   */
  async unpublishTrack(producerId: string): Promise<void> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    await this.webRTCManager.unpublishTrack(producerId);
  }

  /**
   * Subscribe to track
   */
  async subscribeToTrack(producerId: string): Promise<types.Consumer> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    return this.webRTCManager.subscribeToTrack(producerId);
  }

  /**
   * Unsubscribe from track
   */
  async unsubscribeFromTrack(consumerId: string): Promise<void> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    await this.webRTCManager.unsubscribeFromTrack(consumerId);
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Close WebRTC
   */
  close(): void {
    if (this.webRTCManager) {
      this.webRTCManager.close();
      this.webRTCManager = null;
    }
    this.messageHandlers.clear();
    this.isInitialized = false;
  }

  /**
   * Get message handlers for wiring
   */
  getMessageHandlers(): Set<(data: unknown) => void> {
    return this.messageHandlers;
  }

  /**
   * Create a data producer
   */
  async createDataProducer(
    kind: DataChannelKind,
    options: {
      label: string;
      ordered?: boolean;
      maxPacketLifeTime?: number;
      maxRetransmits?: number;
    }
  ): Promise<{ id: string; dataProducer: types.DataProducer }> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    return this.webRTCManager.createDataProducer(kind, options);
  }

  /**
   * Close a data producer
   */
  async closeDataProducer(producerId: string): Promise<void> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    await this.webRTCManager.closeDataProducer(producerId);
  }

  /**
   * Add a data consumer
   */
  async addDataConsumer(
    dataProducerId: string,
    options: {
      id: string;
      sctpStreamParameters: types.SctpStreamParameters;
      participantSid: string;
      label: string;
      ordered?: boolean;
    }
  ): Promise<{ id: string; dataConsumer: types.DataConsumer }> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    return this.webRTCManager.addDataConsumer(dataProducerId, options);
  }

  /**
   * Close a data consumer
   */
  async closeDataConsumer(consumerId: string): Promise<void> {
    if (!this.webRTCManager) {
      throw new Error('WebRTC not initialized');
    }

    await this.webRTCManager.closeDataConsumer(consumerId);
  }

  /**
   * Get the send transport
   */
  getSendTransport(): types.Transport | null {
    if (!this.webRTCManager) {
      return null;
    }
    return this.webRTCManager.getSendTransport();
  }
}
