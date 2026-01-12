/**
 * Room - Represents a mediasoup room
 */

import { v4 as uuidv4 } from 'uuid';
import type { RoomInfo, RoomState } from '@bytepulse/pulsewave-shared';
import type { Router, WebRtcTransport, RtpCapabilities } from 'mediasoup/types';
import type { Participant } from './Participant';
import type { MediasoupWorker } from './MediasoupWorker';

/**
 * Room options
 */
export interface RoomOptions {
  name: string;
  metadata?: Record<string, unknown>;
  maxParticipants?: number;
}

/**
 * Room class
 */
export class Room {
  public readonly sid: string;
  public readonly name: string;
  public readonly metadata: Record<string, unknown>;
  public readonly maxParticipants?: number;
  public readonly creationTime: number;

  private router: Router;
  private participants: Map<string, Participant>;
  private active: boolean;
  private calls: Map<string, RoomCallInfo>;

  constructor(router: Router, _worker: MediasoupWorker, options: RoomOptions) {
    this.sid = uuidv4();
    this.name = options.name;
    this.metadata = options.metadata || {};
    this.maxParticipants = options.maxParticipants;
    this.creationTime = Date.now();
    this.router = router;
    this.participants = new Map();
    this.calls = new Map();
    this.active = true;
  }

  /**
   * Get room info
   */
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

  /**
   * Get room state
   */
  public getState(): RoomState {
    return {
      sid: this.sid,
      name: this.name,
      participants: new Map(
        Array.from(this.participants.entries()).map(([id, p]) => [id, p.getInfo()])
      ),
      active: this.active,
    };
  }

  /**
   * Get router
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Get RTP capabilities
   */
  public getRtpCapabilities(): RtpCapabilities {
    return this.router.rtpCapabilities;
  }

  /**
   * Check if room is active
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Check if room is full
   */
  public isFull(): boolean {
    return this.maxParticipants !== undefined && this.participants.size >= this.maxParticipants;
  }

  /**
   * Add a participant
   */
  public addParticipant(participant: Participant): void {
    if (this.isFull()) {
      throw new Error('Room is full');
    }
    this.participants.set(participant.sid, participant);
  }

  /**
   * Get a participant by SID
   */
  public getParticipant(sid: string): Participant | undefined {
    return this.participants.get(sid);
  }

  /**
   * Get a participant by identity
   */
  public getParticipantByIdentity(identity: string): Participant | undefined {
    for (const participant of this.participants.values()) {
      if (participant.identity === identity) {
        return participant;
      }
    }
    return undefined;
  }

  /**
   * Get all participants
   */
  public getParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get participant count
   */
  public getParticipantCount(): number {
    return this.participants.size;
  }

  /**
   * Remove a participant
   */
  public removeParticipant(sid: string): void {
    const participant = this.participants.get(sid);
    if (participant) {
      participant.close();
      this.participants.delete(sid);
    }
  }

  /**
   * Create a WebRTC transport for a participant
   */
  public async createWebRtcTransport(options: {
    enableUdp: boolean;
    enableTcp: boolean;
    preferUdp: boolean;
    enableSctp?: boolean;
    listenIps: { ip: string; announcedIp?: string }[];
    initialAvailableOutgoingBitrate?: number;
    minimumAvailableOutgoingBitrate?: number;
  }): Promise<WebRtcTransport> {
    const transport = await this.router.createWebRtcTransport(options);

    return transport;
  }

  /**
   * Close the room
   */
  public async close(): Promise<void> {
    this.active = false;

    // Close all participants
    for (const participant of this.participants.values()) {
      participant.close();
    }
    this.participants.clear();

    // Close router
    await this.router.close();
  }

  /**
   * Get all calls in the room
   */
  public getCalls(): RoomCallInfo[] {
    return Array.from(this.calls.values());
  }

  /**
   * Get a call by ID
   */
  public getCall(callId: string): RoomCallInfo | undefined {
    return this.calls.get(callId);
  }

  /**
   * Add a call to the room
   */
  public addCall(callInfo: RoomCallInfo): void {
    this.calls.set(callInfo.callId, callInfo);
  }

  /**
   * Update a call in the room
   */
  public updateCall(callId: string, updates: Partial<RoomCallInfo>): void {
    const call = this.calls.get(callId);
    if (call) {
      this.calls.set(callId, { ...call, ...updates });
    }
  }

  /**
   * Remove a call from the room
   */
  public removeCall(callId: string): void {
    this.calls.delete(callId);
  }

  /**
   * Get call between two participants
   */
  public getCallBetweenParticipants(sid1: string, sid2: string): RoomCallInfo | undefined {
    return Array.from(this.calls.values()).find(
      (call) =>
        (call.callerSid === sid1 && call.targetSid === sid2) ||
        (call.callerSid === sid2 && call.targetSid === sid1)
    );
  }
}

/**
 * Call info stored in room
 */
export interface RoomCallInfo {
  callId: string;
  callerSid: string;
  targetSid: string;
  state: 'pending' | 'accepted' | 'rejected' | 'ended';
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}
