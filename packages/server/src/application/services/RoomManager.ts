/**
 * RoomManager - Application Layer for room management
 *
 * This is the business logic layer for room management.
 * It is independent of mediasoup and WebRTC details.
 */

import { v4 as uuidv4 } from 'uuid';
import type { RoomInfo } from '@bytepulse/pulsewave-shared';
import type {
  ApplicationRoom,
  ApplicationParticipant,
  RoomManagerOptions,
  RoomCreationResult,
} from './types';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('application:room-manager');

/**
 * Application Room implementation
 */
class ApplicationRoomImpl implements ApplicationRoom {
  public readonly sid: string;
  public readonly name: string;
  public readonly metadata: Record<string, unknown>;
  public readonly maxParticipants?: number;
  public readonly creationTime: number;
  private _isActive: boolean;
  private participants: Map<string, ApplicationParticipant>;
  private participantsByIdentity: Map<string, ApplicationParticipant>;

  constructor(name: string, metadata: Record<string, unknown> = {}, maxParticipants?: number) {
    this.sid = uuidv4();
    this.name = name;
    this.metadata = metadata;
    this.maxParticipants = maxParticipants;
    this.creationTime = Date.now();
    this._isActive = true;
    this.participants = new Map();
    this.participantsByIdentity = new Map();
  }

  get isActive(): boolean {
    return this._isActive;
  }

  public getParticipants(): ApplicationParticipant[] {
    return Array.from(this.participants.values());
  }

  public getParticipant(sid: string): ApplicationParticipant | undefined {
    return this.participants.get(sid);
  }

  public getParticipantByIdentity(identity: string): ApplicationParticipant | undefined {
    return this.participantsByIdentity.get(identity);
  }

  public getParticipantCount(): number {
    return this.participants.size;
  }

  public isFull(): boolean {
    return this.maxParticipants !== undefined && this.participants.size >= this.maxParticipants;
  }

  public addParticipant(participant: ApplicationParticipant): void {
    if (this.isFull()) {
      throw new Error('Room is full');
    }
    this.participants.set(participant.sid, participant);
    this.participantsByIdentity.set(participant.identity, participant);
  }

  public removeParticipant(sid: string): void {
    const participant = this.participants.get(sid);
    if (participant) {
      this.participantsByIdentity.delete(participant.identity);
    }
    this.participants.delete(sid);
  }

  public getInfo(): RoomInfo {
    return {
      sid: this.sid,
      name: this.name,
      numParticipants: this.participants.size,
      maxParticipants: this.maxParticipants,
      creationTime: this.creationTime,
      metadata: this.metadata,
    };
  }

  public close(): void {
    this._isActive = false;
    this.participants.clear();
    this.participantsByIdentity.clear();
  }
}

/**
 * Application Room Manager
 */
export class RoomManager {
  private rooms: Map<string, ApplicationRoom>;
  private roomsByName: Map<string, string>; // name -> sid
  private participantIndex: Map<string, { roomSid: string; participantSid: string }>; // identity -> roomSid, participantSid
  private options: RoomManagerOptions;

  constructor(options: RoomManagerOptions = {}) {
    this.rooms = new Map();
    this.roomsByName = new Map();
    this.participantIndex = new Map();
    this.options = options;
  }

  /**
   * Create a new room
   */
  public createRoom(
    name: string,
    metadata: Record<string, unknown> = {},
    maxParticipants?: number
  ): RoomCreationResult {
    // Check if room with same name exists
    const existingRoom = this.getRoomByName(name);
    if (existingRoom) {
      return {
        success: false,
        error: 'Room with this name already exists',
      };
    }

    // Check max rooms limit
    if (this.options.maxRooms && this.rooms.size >= this.options.maxRooms) {
      return {
        success: false,
        error: 'Maximum number of rooms reached',
      };
    }

    const room = new ApplicationRoomImpl(name, metadata, maxParticipants);
    this.rooms.set(room.sid, room);
    this.roomsByName.set(name, room.sid);

    logger.info(`Created room: ${room.name} (${room.sid})`);

    return {
      success: true,
      room,
    };
  }

  /**
   * Get a room by SID
   */
  public getRoom(sid: string): ApplicationRoom | undefined {
    return this.rooms.get(sid);
  }

  /**
   * Get a room by name
   */
  public getRoomByName(name: string): ApplicationRoom | undefined {
    const sid = this.roomsByName.get(name);
    return sid ? this.rooms.get(sid) : undefined;
  }

  /**
   * Get all rooms
   */
  public getRooms(): ApplicationRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get room count
   */
  public getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get total participant count across all rooms
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
  public closeRoom(sid: string): void {
    const room = this.rooms.get(sid);
    if (room) {
      room.close();
      this.rooms.delete(sid);
      this.roomsByName.delete(room.name);
      // Remove all participant entries for this room
      for (const participant of room.getParticipants()) {
        this.participantIndex.delete(participant.identity);
      }
      logger.info(`Closed room: ${room.name} (${room.sid})`);
    }
  }

  /**
   * Close all rooms
   */
  public closeAllRooms(): void {
    for (const room of this.rooms.values()) {
      room.close();
    }
    this.rooms.clear();
    this.roomsByName.clear();
    this.participantIndex.clear();
    logger.info('Closed all rooms');
  }

  /**
   * Get participant by SID across all rooms
   */
  public getParticipant(sid: string): ApplicationParticipant | undefined {
    for (const room of this.rooms.values()) {
      const participant = room.getParticipant(sid);
      if (participant) {
        return participant;
      }
    }
    return undefined;
  }

  /**
   * Get participant by identity across all rooms (O(1) lookup)
   */
  public getParticipantByIdentity(identity: string): ApplicationParticipant | undefined {
    const index = this.participantIndex.get(identity);
    if (!index) {
      return undefined;
    }
    const room = this.rooms.get(index.roomSid);
    return room?.getParticipant(index.participantSid);
  }

  /**
   * Get all participants across all rooms
   */
  public getAllParticipants(): ApplicationParticipant[] {
    const participants: ApplicationParticipant[] = [];
    for (const room of this.rooms.values()) {
      participants.push(...room.getParticipants());
    }
    return participants;
  }
}
