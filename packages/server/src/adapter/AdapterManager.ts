/**
 * AdapterManager - Manages MediasoupAdapter instances per room
 *
 * This manager creates and manages MediasoupAdapter instances for each room.
 * It ensures proper lifecycle management of adapters.
 */

import type { MediasoupWorker } from './MediasoupWorker';
import type { MediasoupAdapterOptions } from './types';
import { MediasoupAdapter } from './MediasoupAdapter';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('adapter:manager');

/**
 * Adapter Manager
 */
export class AdapterManager {
  private workers: MediasoupWorker[];
  private adapters: Map<string, MediasoupAdapter>;
  private options: Omit<MediasoupAdapterOptions, 'router'>;
  private workerRouterCounts: Map<MediasoupWorker, number>;

  constructor(workers: MediasoupWorker[], options: Omit<MediasoupAdapterOptions, 'router'>) {
    this.workers = workers;
    this.adapters = new Map();
    this.options = options;
    this.workerRouterCounts = new Map(workers.map((w) => [w, 0]));
  }

  /**
   * Create an adapter for a room
   */
  public async createAdapter(roomSid: string): Promise<MediasoupAdapter> {
    // Check if adapter already exists
    const existingAdapter = this.adapters.get(roomSid);
    if (existingAdapter) {
      throw new Error(`Adapter already exists for room: ${roomSid}`);
    }

    // Select worker with least routers (simple load balancing)
    const worker = this.selectWorker();

    // Create router directly from the worker
    const router = await worker.getWorker().createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
          },
          rtcpFeedback: [
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'ccm', parameter: 'fir' },
            { type: 'goog-remb' },
          ],
        },
      ],
    });

    // Create adapter with the router
    const adapter = new MediasoupAdapter({
      ...this.options,
      router,
    });

    this.adapters.set(roomSid, adapter);

    // Update router count for this worker
    const currentCount = this.workerRouterCounts.get(worker) || 0;
    this.workerRouterCounts.set(worker, currentCount + 1);

    logger.info(`Created adapter for room: ${roomSid}`);

    return adapter;
  }

  /**
   * Get an adapter for a room
   */
  public getAdapter(roomSid: string): MediasoupAdapter | undefined {
    return this.adapters.get(roomSid);
  }

  /**
   * Remove an adapter for a room
   */
  public async removeAdapter(roomSid: string): Promise<void> {
    const adapter = this.adapters.get(roomSid);
    if (adapter) {
      await adapter.close();
      this.adapters.delete(roomSid);
      logger.info(`Removed adapter for room: ${roomSid}`);
    }
  }

  /**
   * Get all adapters
   */
  public getAdapters(): Map<string, MediasoupAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Get adapter count
   */
  public getAdapterCount(): number {
    return this.adapters.size;
  }

  /**
   * Close all adapters
   */
  public async closeAll(): Promise<void> {
    for (const [roomSid, adapter] of this.adapters.entries()) {
      await adapter.close();
      logger.info(`Closed adapter for room: ${roomSid}`);
    }
    this.adapters.clear();
  }

  /**
   * Select worker with least routers (simple load balancing)
   */
  private selectWorker(): MediasoupWorker {
    let selectedWorker = this.workers[0];
    let minRouters = this.workerRouterCounts.get(selectedWorker) || 0;

    for (const worker of this.workers) {
      const routerCount = this.workerRouterCounts.get(worker) || 0;
      if (routerCount < minRouters) {
        minRouters = routerCount;
        selectedWorker = worker;
      }
    }

    return selectedWorker;
  }
}
