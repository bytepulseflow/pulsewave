/**
 * WebSocket signaling message types
 *
 * This file defines both intent-based signaling messages (for the new architecture)
 * and WebRTC-shaped messages (for backward compatibility with the adapter layer).
 *
 * Intent-based messages are high-level business intents (e.g., "join_room", "call")
 * WebRTC-shaped messages are low-level operations (e.g., "create_transport", "publish")
 */

import type { RoomInfo, ParticipantInfo, TrackInfo, ErrorInfo, TrackKind } from './room.types';
import type {
  RtpCapabilities,
  RtpParameters,
  DtlsParameters,
  SctpStreamParameters,
  SctpParameters,
  IceParameters,
  IceCandidate,
} from './adapter.types';

// ============================================================================
// Intent-Based Messages (New Architecture)
// ============================================================================

/**
 * Intent: Join a room (presence-only, no media)
 */
export interface JoinRoomIntent {
  type: 'join_room';
  room: string;
  token: string;
  metadata?: Record<string, unknown>;
}

/**
 * Intent: Leave a room
 */
export interface LeaveRoomIntent {
  type: 'leave_room';
}

/**
 * Intent: Start a call (initiate media session)
 */
export interface StartCallIntent {
  type: 'start_call';
  targetUserId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Intent: Accept a call
 */
export interface AcceptCallIntent {
  type: 'accept_call';
  callId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Intent: Reject a call
 */
export interface RejectCallIntent {
  type: 'reject_call';
  callId: string;
  reason?: string;
}

/**
 * Intent: End a call
 */
export interface EndCallIntent {
  type: 'end_call';
  callId: string;
  reason?: string;
}

/**
 * Intent: Enable camera
 */
export interface EnableCameraIntent {
  type: 'enable_camera';
  deviceId?: string;
}

/**
 * Intent: Disable camera
 */
export interface DisableCameraIntent {
  type: 'disable_camera';
}

/**
 * Intent: Enable microphone
 */
export interface EnableMicrophoneIntent {
  type: 'enable_microphone';
  deviceId?: string;
}

/**
 * Intent: Disable microphone
 */
export interface DisableMicrophoneIntent {
  type: 'disable_microphone';
}

/**
 * Intent: Send data message
 */
export interface SendDataIntent {
  type: 'send_data';
  payload: unknown;
  kind?: 'reliable' | 'lossy';
}

/**
 * Intent: Subscribe to participant's tracks
 */
export interface SubscribeToParticipantIntent {
  type: 'subscribe_to_participant';
  participantSid: string;
}

/**
 * Intent: Unsubscribe from participant's tracks
 */
export interface UnsubscribeFromParticipantIntent {
  type: 'unsubscribe_from_participant';
  participantSid: string;
}

/**
 * Intent: Mute track
 */
export interface MuteTrackIntent {
  type: 'mute_track';
  trackSid: string;
}

/**
 * Intent: Unmute track
 */
export interface UnmuteTrackIntent {
  type: 'unmute_track';
  trackSid: string;
}

/**
 * Client intent union (new architecture)
 */
export type ClientIntent =
  | JoinRoomIntent
  | LeaveRoomIntent
  | StartCallIntent
  | AcceptCallIntent
  | RejectCallIntent
  | EndCallIntent
  | EnableCameraIntent
  | DisableCameraIntent
  | EnableMicrophoneIntent
  | DisableMicrophoneIntent
  | SendDataIntent
  | SubscribeToParticipantIntent
  | UnsubscribeFromParticipantIntent
  | MuteTrackIntent
  | UnmuteTrackIntent;

// ============================================================================
// Server Intent Responses (New Architecture)
// ============================================================================

/**
 * Response: Room joined (presence-only)
 */
export interface RoomJoinedResponse {
  type: 'room_joined';
  room: RoomInfo;
  participant: ParticipantInfo;
  otherParticipants: ParticipantInfo[];
}

/**
 * Response: Call started
 */
export interface CallStartedResponse {
  type: 'call_started';
  callId: string;
  target: ParticipantInfo;
}

/**
 * Response: Call received (incoming call)
 */
export interface CallReceivedResponse {
  type: 'call_received';
  callId: string;
  caller: ParticipantInfo;
  metadata?: Record<string, unknown>;
}

/**
 * Response: Call accepted
 */
export interface CallAcceptedResponse {
  type: 'call_accepted';
  callId: string;
  participant: ParticipantInfo;
  metadata?: Record<string, unknown>;
}

/**
 * Response: Call rejected
 */
export interface CallRejectedResponse {
  type: 'call_rejected';
  callId: string;
  participant: ParticipantInfo;
  reason?: string;
}

/**
 * Response: Call ended
 */
export interface CallEndedResponse {
  type: 'call_ended';
  callId: string;
  reason?: string;
}

/**
 * Response: Camera enabled
 */
export interface CameraEnabledResponse {
  type: 'camera_enabled';
  trackSid: string;
}

/**
 * Response: Camera disabled
 */
export interface CameraDisabledResponse {
  type: 'camera_disabled';
  trackSid: string;
}

/**
 * Response: Microphone enabled
 */
export interface MicrophoneEnabledResponse {
  type: 'microphone_enabled';
  trackSid: string;
}

/**
 * Response: Microphone disabled
 */
export interface MicrophoneDisabledResponse {
  type: 'microphone_disabled';
  trackSid: string;
}

/**
 * Response: Data received
 */
export interface DataReceivedResponse {
  type: 'data_received';
  participantSid: string;
  payload: unknown;
  kind?: 'reliable' | 'lossy';
}

/**
 * Response: Participant joined
 */
export interface ParticipantJoinedResponse {
  type: 'participant_joined';
  participant: ParticipantInfo;
}

/**
 * Response: Participant left
 */
export interface ParticipantLeftResponse {
  type: 'participant_left';
  participantSid: string;
}

/**
 * Response: Track published
 */
export interface TrackPublishedResponse {
  type: 'track_published';
  participantSid: string;
  track: TrackInfo;
}

/**
 * Response: Track unpublished
 */
export interface TrackUnpublishedResponse {
  type: 'track_unpublished';
  participantSid: string;
  trackSid: string;
}

/**
 * Response: Track subscribed
 */
export interface TrackSubscribedResponse {
  type: 'track_subscribed';
  participantSid: string;
  track: TrackInfo;
  consumerId?: string;
  rtpParameters?: RtpParameters;
}

/**
 * Response: Track unsubscribed
 */
export interface TrackUnsubscribedResponse {
  type: 'track_unsubscribed';
  participantSid: string;
  trackSid: string;
}

/**
 * Response: Track muted
 */
export interface TrackMutedResponse {
  type: 'track_muted';
  participantSid: string;
  trackSid: string;
}

/**
 * Response: Track unmuted
 */
export interface TrackUnmutedResponse {
  type: 'track_unmuted';
  participantSid: string;
  trackSid: string;
}

/**
 * Server response union (new architecture)
 */
export type ServerResponse =
  | RoomJoinedResponse
  | CallStartedResponse
  | CallReceivedResponse
  | CallAcceptedResponse
  | CallRejectedResponse
  | CallEndedResponse
  | CameraEnabledResponse
  | CameraDisabledResponse
  | MicrophoneEnabledResponse
  | MicrophoneDisabledResponse
  | DataReceivedResponse
  | ParticipantJoinedResponse
  | ParticipantLeftResponse
  | TrackPublishedResponse
  | TrackUnpublishedResponse
  | TrackSubscribedResponse
  | TrackUnsubscribedResponse
  | TrackMutedResponse
  | TrackUnmutedResponse
  | ErrorMessage;

// ============================================================================
// WebRTC-Shaped Messages (Adapter Layer Only)
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
 * Create data producer message
 */
export interface CreateDataProducerMessage {
  type: 'create_data_producer';
  transportId: string;
  label: string;
  protocol?: string;
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  sctpStreamParameters?: SctpStreamParameters;
}

/**
 * Close data producer message
 */
export interface CloseDataProducerMessage {
  type: 'close_data_producer';
  dataProducerId: string;
}

/**
 * Data producer created message
 */
export interface DataProducerCreatedMessage {
  type: 'data_producer_created';
  id: string;
}

/**
 * Data producer closed message
 */
export interface DataProducerClosedMessage {
  type: 'data_producer_closed';
  dataProducerId: string;
}

/**
 * Data consumer created message
 */
export interface DataConsumerCreatedMessage {
  type: 'data_consumer_created';
  id: string;
  dataProducerId: string;
  participantSid: string;
  label: string;
  protocol?: string;
  ordered?: boolean;
  sctpStreamParameters: SctpStreamParameters;
}

/**
 * SCTP capabilities
 */
export interface SctpCapabilities {
  numStreams: {
    OS: number;
    MIS: number;
  };
}

/**
 * Data consumer closed message
 */
export interface DataConsumerClosedMessage {
  type: 'data_consumer_closed';
  dataConsumerId: string;
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
 * Call message
 */
export interface CallMessage {
  type: 'call';
  targetUserId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Accept call message
 */
export interface AcceptCallMessage {
  type: 'accept_call';
  callId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Reject call message
 */
export interface RejectCallMessage {
  type: 'reject_call';
  callId: string;
  reason?: string;
}

/**
 * Call received message (incoming call notification)
 */
export interface CallReceivedMessage {
  type: 'call_received';
  callId: string;
  caller: ParticipantInfo;
  metadata?: Record<string, unknown>;
}

/**
 * Call accepted message
 */
export interface CallAcceptedMessage {
  type: 'call_accepted';
  callId: string;
  participant: ParticipantInfo;
  metadata?: Record<string, unknown>;
}

/**
 * Call rejected message
 */
export interface CallRejectedMessage {
  type: 'call_rejected';
  callId: string;
  participant: ParticipantInfo;
  reason?: string;
}

/**
 * Call ended message
 */
export interface CallEndedMessage {
  type: 'call_ended';
  callId: string;
  reason?: string;
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
  | DataMessage
  | CreateDataProducerMessage
  | CloseDataProducerMessage
  | CallMessage
  | AcceptCallMessage
  | RejectCallMessage;

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
  sctpParameters?: SctpParameters;
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
 * Data received message
 */
export interface DataReceivedMessage {
  type: 'data';
  participantSid: string;
  payload: unknown;
  kind?: 'reliable' | 'lossy';
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
  | TrackUnpublishedMessage
  | TrackSubscribedMessage
  | TrackUnsubscribedMessage
  | TrackMutedMessage
  | TrackUnmutedMessage
  | DataReceivedMessage
  | DataProducerCreatedMessage
  | DataProducerClosedMessage
  | DataConsumerCreatedMessage
  | DataConsumerClosedMessage
  | CallReceivedMessage
  | CallAcceptedMessage
  | CallRejectedMessage
  | CallEndedMessage
  | ErrorMessage;
