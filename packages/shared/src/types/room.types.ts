/**
 * Room types shared between server and client
 */

/**
 * Connection state of a participant
 */
export enum ConnectionState {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Reconnecting = 'reconnecting',
}

/**
 * Room metadata
 */
export interface RoomInfo {
  sid: string;
  name: string;
  numParticipants: number;
  maxParticipants?: number;
  creationTime: number;
  metadata?: Record<string, unknown>;
}

/**
 * Room state
 */
export interface RoomState {
  sid: string;
  name: string;
  participants: Map<string, ParticipantInfo>;
  active: boolean;
}

/**
 * Participant info (shared)
 */
export interface ParticipantInfo {
  sid: string;
  identity: string;
  name?: string;
  state: ConnectionState;
  metadata?: Record<string, unknown>;
  tracks: TrackInfo[];
  permission?: ParticipantPermission;
}

/**
 * Participant permissions
 */
export interface ParticipantPermission {
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  hidden?: boolean;
  recorder?: boolean;
}

/**
 * Track info (shared)
 */
export interface TrackInfo {
  sid: string;
  kind: TrackKind;
  source: TrackSource;
  muted: boolean;
  width?: number;
  height?: number;
  simulcast?: boolean;
}

/**
 * Track kind
 */
export enum TrackKind {
  Audio = 'audio',
  Video = 'video',
}

/**
 * Track source
 */
export enum TrackSource {
  Camera = 'camera',
  Microphone = 'microphone',
  ScreenShare = 'screen_share',
  ScreenShareAudio = 'screen_share_audio',
  Unknown = 'unknown',
}

/**
 * Data packet kind
 */
export enum DataPacketKind {
  Reliable = 'reliable',
  Lossy = 'lossy',
}

/**
 * Data packet
 */
export interface DataPacket {
  kind: DataPacketKind;
  value: unknown;
  participantSid?: string;
  timestamp: number;
}

/**
 * Error codes
 */
export enum ErrorCode {
  // General errors
  Unknown = 0,
  InvalidRequest = 1,
  Unauthorized = 2,
  NotFound = 3,
  // Room errors
  RoomNotFound = 100,
  RoomFull = 101,
  RoomClosed = 102,
  // Participant errors
  ParticipantNotFound = 200,
  ParticipantAlreadyJoined = 201,
  // Track errors
  TrackNotFound = 300,
  TrackPublishError = 301,
  TrackSubscribeError = 302,
  // Transport errors
  TransportError = 400,
  // Media errors
  MediaError = 500,
  DeviceNotFound = 501,
  PermissionDenied = 502,
}

/**
 * Error info
 */
export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}