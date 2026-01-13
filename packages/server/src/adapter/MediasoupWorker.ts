/**
 * MediasoupWorker - Wrapper around mediasoup worker
 *
 * This is a low-level wrapper around mediasoup's Worker.
 * It's used by the AdapterManager to create workers for mediasoup adapters.
 */

import type { Worker, WorkerLogTag } from 'mediasoup/types';
import type { MediasoupConfig } from '../config';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('mediasoup-worker');

/**
 * MediasoupWorker class
 */
export class MediasoupWorker {
  private worker: Worker;

  constructor(worker: Worker, _config: MediasoupConfig) {
    this.worker = worker;

    this.worker.on('died', () => {
      logger.error('Mediasoup worker died');
    });
  }

  /**
   * Get the underlying mediasoup worker
   */
  public getWorker(): Worker {
    return this.worker;
  }

  /**
   * Close the worker
   */
  public async close(): Promise<void> {
    await this.worker.close();
  }
}

/**
 * Create a mediasoup worker
 */
export async function createWorker(config: MediasoupConfig): Promise<MediasoupWorker> {
  const { createWorker: createMediasoupWorker } = await import('mediasoup');

  const worker = await createMediasoupWorker({
    logLevel: config.logLevel as 'debug' | 'warn' | 'error' | 'none',
    logTags: config.logTags as WorkerLogTag[],
    rtcMinPort: config.rtcMinPort,
    rtcMaxPort: config.rtcMaxPort,
  });

  return new MediasoupWorker(worker, config);
}
