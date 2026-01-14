/**
 * Types for Application Layer Services
 *
 * Common types used by RoomManager and CallManager services.
 */

import type { ApplicationParticipant } from '../domain';
import type { RoomInfo } from '@bytepulse/pulsewave-shared';

// Re-export ApplicationParticipant for use in services
export type { ApplicationParticipant } from '../domain';

/**
 * Application Room interface
 */
export interface ApplicationRoom {
  readonly sid: string;
  readonly name: string;
  readonly metadata: Record<string, unknown>;
  readonly maxParticipants?: number;
  readonly creationTime: number;
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
 * Application Call interface
 */
export interface ApplicationCall {
  readonly callId: string;
  readonly callerSid: string;
  readonly targetSid: string;
  readonly startTime: number;
  state: 'pending' | 'accepted' | 'rejected' | 'ended';
  endTime?: number | undefined;
  metadata?: Record<string, unknown>;

  getInfo(): CallInfo;
  setState(state: 'pending' | 'accepted' | 'rejected' | 'ended'): void;
  end(reason?: string): void;
}

/**
 * Call Info
 */
export interface CallInfo {
  callId: string;
  callerSid: string;
  targetSid: string;
  state: 'pending' | 'accepted' | 'rejected' | 'ended';
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Room Manager Options
 */
export interface RoomManagerOptions {
  maxRooms?: number;
}

/**
 * Room Creation Result
 */
export interface RoomCreationResult {
  success: boolean;
  room?: ApplicationRoom;
  error?: string;
}

/**
 * Call Manager Options
 */
export interface CallManagerOptions {
  allowMultipleCalls?: boolean;
  enableAutoCleanup?: boolean;
  cleanupIntervalMs?: number;
  cleanupMaxAge?: number;
}

/**
 * Call Result
 */
export interface CallResult {
  success: boolean;
  call?: ApplicationCall;
  error?: string;
}
