/**
 * WebSocket signaling message types
 */

import type { RoomInfo, ParticipantInfo, TrackInfo, ErrorInfo, TrackKind } from './room.types';

// ============================================================================
// Client -> Server Messages
// ============================================================================

/**
 * Join room message
 */
export interface JoinMessage {
  type: 'join';
  room: string;
  token: string;
  metadata?: Record<string, unknown>;
}

/**
 * Leave room message
 */
export interface LeaveMessage {
  type: 'leave';
}

/**
 * Create WebRTC transport message
 */
export interface CreateTransportMessage {
  type: 'create_transport';
  direction: 'send' | 'recv';
  rtpCapabilities: RtpCapabilities;
}

/**
 * Connect WebRTC transport message
 */
export interface ConnectTransportMessage {
  type: 'connect_transport';
  transportId: string;
  dtlsParameters: DtlsParameters;
}

/**
 * Publish track message
 */
export interface PublishMessage {
  type: 'publish';
  transportId: string;
  kind: TrackKind;
  rtpParameters: RtpParameters;
  appData?: Record<string, unknown>;
}

/**
 * Unpublish track message
 */
export interface UnpublishMessage {
  type: 'unpublish';
  producerId: string;
  trackSid: string;
}

/**
 * Subscribe to track message
 */
export interface SubscribeMessage {
  type: 'subscribe';
  transportId: string;
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}

/**
 * Unsubscribe from track message
 */
export interface UnsubscribeMessage {
  type: 'unsubscribe';
  consumerId: string;
}

/**
 * Resume consumer message
 */
export interface ResumeConsumerMessage {
  type: 'resume_consumer';
  consumerId: string;
}

/**
 * Mute/unmute track message
 */
export interface MuteMessage {
  type: 'mute';
  trackSid: string;
  muted: boolean;
}

/**
 * Send data message
 */
export interface DataMessage {
  type: 'data';
  payload: unknown;
  kind?: 'reliable' | 'lossy';
}

/**
 * Create WebRTC transport message (new naming)
 */
export interface CreateWebRtcTransportMessage {
  type: 'create_webrtc_transport';
  direction: 'send' | 'recv';
}

/**
 * Connect WebRTC transport message (new naming)
 */
export interface ConnectWebRtcTransportMessage {
  type: 'connect_webrtc_transport';
  transportId: string;
  dtlsParameters: DtlsParameters;
}

/**
 * Track published message (notification to others)
 */
export interface TrackPublishedMessage {
  type: 'track_published';
  participantSid: string;
  track: TrackInfo;
}

/**
 * Track unpublished message
 */
export interface TrackUnpublishedMessage {
  type: 'track_unpublished';
  participantSid: string;
  trackSid: string;
}

/**
 * Track subscribed message
 */
export interface TrackSubscribedMessage {
  type: 'track_subscribed';
  id: string;
  producerId: string;
  kind: string; // Allow 'audio' | 'video' from mediasoup
  rtpParameters: RtpParameters;
  trackSid: string;
}

/**
 * Track unsubscribed message
 */
export interface TrackUnsubscribedMessage {
  type: 'track_unsubscribed';
  trackSid: string;
}

/**
 * Track muted message
 */
export interface TrackMutedMessage {
  type: 'track_muted';
  participantSid: string;
  trackSid: string;
  muted: boolean;
}

/**
 * Track unmuted message
 */
export interface TrackUnmutedMessage {
  type: 'track_unmuted';
  participantSid: string;
  trackSid: string;
  muted: boolean;
}

/**
 * Client message union
 */
export type ClientMessage =
  | JoinMessage
  | LeaveMessage
  | CreateTransportMessage
  | ConnectTransportMessage
  | PublishMessage
  | UnpublishMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | ResumeConsumerMessage
  | MuteMessage
  | DataMessage;

// ============================================================================
// Server -> Client Messages
// ============================================================================

/**
 * Room joined message
 */
export interface JoinedMessage {
  type: 'joined';
  room: RoomInfo;
  participant: ParticipantInfo;
  otherParticipants: ParticipantInfo[];
  rtpCapabilities?: RtpCapabilities;
}

/**
 * Participant joined message
 */
export interface ParticipantJoinedMessage {
  type: 'participant_joined';
  participant: ParticipantInfo;
}

/**
 * Participant left message
 */
export interface ParticipantLeftMessage {
  type: 'participant_left';
  participantSid: string;
}

/**
 * Transport created message
 */
export interface TransportCreatedMessage {
  type: 'transport_created';
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  direction: 'send' | 'recv';
}

/**
 * Transport connected message
 */
export interface TransportConnectedMessage {
  type: 'transport_connected';
  transportId: string;
}

/**
 * Track published message (notification to others)
 */
export interface TrackPublishedMessage {
  type: 'track_published';
  participantSid: string;
  track: TrackInfo;
}

/**
 * Track published response (to publisher)
 */
export interface TrackPublishResponse {
  type: 'track_published';
  id: string;
  trackSid: string;
}

/**
 * Track unpublished message
 */
export interface TrackUnpublishedMessage {
  type: 'track_unpublished';
  participantSid: string;
  trackSid: string;
}

/**
 * Track subscribed message
 */
export interface TrackSubscribedMessage {
  type: 'track_subscribed';
  id: string;
  producerId: string;
  kind: string; // Allow 'audio' | 'video' from mediasoup
  rtpParameters: RtpParameters;
  trackSid: string;
}

/**
 * Track unsubscribed message
 */
export interface TrackUnsubscribedMessage {
  type: 'track_unsubscribed';
  trackSid: string;
}

/**
 * Track muted message
 */
export interface TrackMutedMessage {
  type: 'track_muted';
  participantSid: string;
  trackSid: string;
  muted: boolean;
}

/**
 * Data received message
 */
export interface DataReceivedMessage {
  type: 'data';
  participantSid: string;
  payload: unknown;
}

/**
 * Error message
 */
export interface ErrorMessage {
  type: 'error';
  error: ErrorInfo;
}

/**
 * Server message union
 */
export type ServerMessage =
  | JoinedMessage
  | TransportCreatedMessage
  | TransportConnectedMessage
  | ParticipantJoinedMessage
  | ParticipantLeftMessage
  | TrackPublishedMessage
  | TrackPublishResponse
  | TrackUnpublishedMessage
  | TrackSubscribedMessage
  | TrackUnsubscribedMessage
  | TrackMutedMessage
  | DataReceivedMessage
  | ErrorMessage;

// ============================================================================
// WebRTC Types
// ============================================================================

/**
 * RTP parameters (simplified) - compatible with mediasoup types
 */
export interface RtpParameters {
  codecs?: RtpCodecParameters[];
  headerExtensions?: RtpHeaderExtensionParameters[];
  encodings?: RtpEncodingParameters[];
  rtcp?: RtcpParameters;
}

/**
 * RTP codec parameters
 */
export interface RtpCodecParameters {
  mimeType: string;
  clockRate: number;
  channels?: number;
  parameters?: Record<string, unknown>;
}

/**
 * RTP header extension parameters
 */
export interface RtpHeaderExtensionParameters {
  uri: string;
  id: number;
  encrypt?: boolean;
  parameters?: Record<string, unknown>;
}

/**
 * RTP encoding parameters
 */
export interface RtpEncodingParameters {
  ssrc?: number;
  rid?: string;
  codecPayloadType?: number;
  rtx?: {
    ssrc: number;
  };
  dtx?: boolean;
  scalabilityMode?: string;
  scaleResolutionDownBy?: number;
  maxBitrate?: number;
  maxFramerate?: number;
  adaptivePtime?: boolean;
  priority?: 'very-low' | 'low' | 'medium' | 'high';
  networkPriority?: 'very-low' | 'low' | 'medium' | 'high';
}

/**
 * RTCP parameters
 */
export interface RtcpParameters {
  cname?: string;
  reducedSize?: boolean;
  mux?: boolean;
}

/**
 * RTP capabilities
 */
export interface RtpCapabilities {
  codecs: RtpCodecCapability[];
  headerExtensions: RtpHeaderExtension[];
}

/**
 * RTP codec capability
 */
export interface RtpCodecCapability {
  mimeType: string;
  kind?: string;
  preferredPayloadType?: number;
  clockRate: number;
  channels?: number;
  parameters?: Record<string, unknown>;
  rtcpFeedback?: RtcpFeedback[];
}

/**
 * RTP header extension
 */
export interface RtpHeaderExtension {
  uri: string;
  preferredId: number;
  preferredEncrypt?: boolean;
  direction?: 'sendrecv' | 'send' | 'recv' | 'sendonly' | 'recvonly' | 'inactive';
}

/**
 * RTCP feedback
 */
export interface RtcpFeedback {
  type: string;
  parameter?: string;
}

/**
 * ICE parameters
 */
export interface IceParameters {
  usernameFragment: string;
  password: string;
  iceLite?: boolean;
}

/**
 * ICE candidate
 */
export interface IceCandidate {
  foundation: string;
  priority: number;
  ip: string;
  protocol: 'udp' | 'tcp';
  port: number;
  type: 'host';
  tcpType?: 'passive';
}

/**
 * DTLS parameters
 */
export interface DtlsParameters {
  role?: 'auto' | 'client' | 'server';
  fingerprints: DtlsFingerprint[];
}

/**
 * DTLS fingerprint
 */
export interface DtlsFingerprint {
  algorithm: string;
  value: string;
}
