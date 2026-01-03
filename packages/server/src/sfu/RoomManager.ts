/**
 * RoomManager - Manages all rooms across workers
 */

import type { Room, RoomOptions } from './Room';
import type { Participant } from './Participant';
import type { MediasoupWorker } from './MediasoupWorker';

/**
 * RoomManager class
 */
export class RoomManager {
  private workers: MediasoupWorker[];
  private rooms: Map<string, Room>;

  constructor(workers: MediasoupWorker[]) {
    this.workers = workers;
    this.rooms = new Map();
  }

  /**
   * Create a room
   */
  public async createRoom(options: RoomOptions): Promise<Room> {
    // Select worker with least rooms (simple load balancing)
    const worker = this.selectWorker();
    const room = await worker.createRoom(options);
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
   * Get participant count across all rooms
   */
  public getTotalParticipantCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.getParticipantCount();
    }
    return count;
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
   * Select worker with least rooms (simple load balancing)
   */
  private selectWorker(): MediasoupWorker {
    let selectedWorker = this.workers[0];
    let minRooms = selectedWorker.getRoomCount();

    for (const worker of this.workers) {
      const roomCount = worker.getRoomCount();
      if (roomCount < minRooms) {
        minRooms = roomCount;
        selectedWorker = worker;
      }
    }

    return selectedWorker;
  }

  /**
   * Get all participants across all rooms
   */
  public getAllParticipants(): Participant[] {
    const participants: Participant[] = [];
    for (const room of this.rooms.values()) {
      participants.push(...room.getParticipants());
    }
    return participants;
  }

  /**
   * Get participant by SID
   */
  public getParticipant(sid: string): Participant | undefined {
    for (const room of this.rooms.values()) {
      const participant = room.getParticipant(sid);
      if (participant) {
        return participant;
      }
    }
    return undefined;
  }

  /**
   * Get participant info by SID
   */
  public getParticipantInfo(sid: string) {
    const participant = this.getParticipant(sid);
    return participant?.getInfo();
  }
}
