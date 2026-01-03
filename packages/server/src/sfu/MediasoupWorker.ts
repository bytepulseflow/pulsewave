/**
 * MediasoupWorker - Wrapper around mediasoup worker
 */

import type { Worker } from 'mediasoup/types';
import type { RoomOptions } from './Room';
import { Room } from './Room';
import type { MediasoupConfig } from '../config';

/**
 * MediasoupWorker class
 */
export class MediasoupWorker {
  private worker: Worker;
  private rooms: Map<string, Room>;

  constructor(worker: Worker, _config: MediasoupConfig) {
    this.worker = worker;
    this.rooms = new Map();

    this.worker.on('died', () => {
      console.error('Mediasoup worker died');
    });
  }

  /**
   * Create a room
   */
  public async createRoom(options: RoomOptions): Promise<Room> {
    const router = await this.worker.createRouter({
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

    const room = new Room(router, this, options);
    this.rooms.set(room.sid, room);

    return room;
  }

  /**
   * Get a room by SID
   */
  public getRoom(sid: string): Room | undefined {
    return this.rooms.get(sid);
  }

  /**
   * Get a room by name
   */
  public getRoomByName(name: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.name === name) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * Get all rooms
   */
  public getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get room count
   */
  public getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Close a room
   */
  public async closeRoom(sid: string): Promise<void> {
    const room = this.rooms.get(sid);
    if (room) {
      await room.close();
      this.rooms.delete(sid);
    }
  }

  /**
   * Close all rooms
   */
  public async closeAllRooms(): Promise<void> {
    for (const room of this.rooms.values()) {
      await room.close();
    }
    this.rooms.clear();
  }

  /**
   * Close the worker
   */
  public async close(): Promise<void> {
    await this.closeAllRooms();
    await this.worker.close();
  }
}

/**
 * Create a mediasoup worker
 */
export async function createWorker(config: MediasoupConfig): Promise<MediasoupWorker> {
  const { createWorker: createMediasoupWorker } = await import('mediasoup');

  const worker = await createMediasoupWorker({
    logLevel: config.logLevel as any,
    logTags: config.logTags as any,
    rtcMinPort: config.rtcMinPort,
    rtcMaxPort: config.rtcMaxPort,
  });

  return new MediasoupWorker(worker, config);
}
