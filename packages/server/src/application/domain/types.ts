/**
 * Types for Application Layer
 */

import type {
  ParticipantInfo,
  RoomInfo,
  TrackInfo,
  ConnectionState,
} from '@bytepulse/pulsewave-shared';

/**
 * Room manager options
 */
export interface RoomManagerOptions {
  maxParticipants?: number;
  maxRooms?: number;
}

/**
 * Call manager options
 */
export interface CallManagerOptions {
  maxCallDuration?: number; // in milliseconds
  allowMultipleCalls?: boolean;
}

/**
 * Application room (business logic layer)
 * This is separate from the SFU Room which handles mediasoup operations
 */
export interface ApplicationRoom {
  sid: string;
  name: string;
  metadata: Record<string, unknown>;
  maxParticipants?: number;
  creationTime: number;
  isActive: boolean;
  getParticipants(): ApplicationParticipant[];
  getParticipant(sid: string): ApplicationParticipant | undefined;
  getParticipantByIdentity(identity: string): ApplicationParticipant | undefined;
  getParticipantCount(): number;
  isFull(): boolean;
  addParticipant(participant: ApplicationParticipant): void;
  removeParticipant(sid: string): void;
  getInfo(): RoomInfo;
  close(): void;
}

/**
 * Application participant (business logic layer)
 * This is separate from the SFU Participant which handles mediasoup operations
 */
export interface ApplicationParticipant {
  sid: string;
  identity: string;
  name: string;
  metadata: Record<string, unknown>;
  state: ConnectionState;
  socketId: string;
  permission: {
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
  };
  tracks: TrackInfo[];
  producerIds: Map<string, string>; // trackSid -> producerId
  consumerIds: Map<string, string[]>; // targetParticipantSid -> consumerIds
  sendTransportId?: string; // Transport for producing tracks
  receiveTransportId?: string; // Transport for consuming tracks
  getInfo(): ParticipantInfo;
  setState(state: ConnectionState): void;
  setSocketId(socketId: string): void;
  addTrack(track: TrackInfo): void;
  removeTrack(trackSid: string): void;
  getTrack(trackSid: string): TrackInfo | undefined;
  getTracks(): TrackInfo[];
  getTrackBySource(source: string): TrackInfo | undefined;
  muteTrack(trackSid: string): void;
  unmuteTrack(trackSid: string): void;
  setProducerId(trackSid: string, producerId: string): void;
  getProducerId(trackSid: string): string | undefined;
  addConsumerId(targetParticipantSid: string, consumerId: string): void;
  getConsumerIds(targetParticipantSid: string): string[];
  removeConsumerIds(targetParticipantSid: string): void;
  setSendTransportId(transportId: string): void;
  getSendTransportId(): string | undefined;
  setReceiveTransportId(transportId: string): void;
  getReceiveTransportId(): string | undefined;
}

/**
 * Call state
 */
export type CallState = 'pending' | 'accepted' | 'rejected' | 'ended';

/**
 * Application call (business logic layer)
 */
export interface ApplicationCall {
  callId: string;
  callerSid: string;
  targetSid: string;
  state: CallState;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
  getInfo(): CallInfo;
  setState(state: CallState): void;
  end(reason?: string): void;
}

/**
 * Call info
 */
export interface CallInfo {
  callId: string;
  callerSid: string;
  targetSid: string;
  state: CallState;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Room creation result
 */
export interface RoomCreationResult {
  success: boolean;
  room?: ApplicationRoom;
  error?: string;
}

/**
 * Participant join result
 */
export interface ParticipantJoinResult {
  success: boolean;
  participant?: ApplicationParticipant;
  error?: string;
}

/**
 * Call result
 */
export interface CallResult {
  success: boolean;
  call?: ApplicationCall;
  error?: string;
}
