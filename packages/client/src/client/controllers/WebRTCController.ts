/**
 * WebRTCController - Manages WebRTC lifecycle
 *
 * Handles WebRTC transport creation, track publishing, and subscription.
 */

import type { RtpCapabilities } from '@bytepulse/pulsewave-shared';
import { WebRTCManager } from '../../webrtc/WebRTCManager';
import type { types } from 'mediasoup-client';

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
    await this.webRTCManager.initialize(rtpCapabilities);

    // Create send and receive transports
    await this.webRTCManager.createSendTransport();
    await this.webRTCManager.createRecvTransport();

    this.isInitialized = true;
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
}
