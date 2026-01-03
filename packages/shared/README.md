# @bytepulse/pulsewave-shared

Shared types, constants, and utilities for PulseWave client and server packages.

## Installation

```bash
npm install @bytepulse/pulsewave-shared
```

## Overview

This package contains:

- **Types**: TypeScript interfaces and types used across client and server
- **Constants**: Shared constants for events, errors, and configuration
- **Utilities**: Common utility functions

## Types

### Room Types

```typescript
// Room information
interface Room {
  sid: string;
  name: string;
  numParticipants: number;
  maxParticipants: number;
  creationTime: number;
  metadata: Record<string, unknown>;
}

// Participant information
interface Participant {
  identity: string;
  name: string;
  sid: string;
  state: 'joined' | 'connected' | 'disconnected';
  tracks: TrackPublication[];
  metadata: Record<string, unknown>;
}

// Local participant extends Participant
interface LocalParticipant extends Participant {
  isLocal: true;
}

// Remote participant extends Participant
interface RemoteParticipant extends Participant {
  isLocal: false;
}
```

### Track Types

```typescript
// Track kind
type TrackKind = 'video' | 'audio' | 'data';

// Track source
type TrackSource = 'camera' | 'microphone' | 'screen' | 'screen_audio' | 'unknown';

// Track publication
interface TrackPublication {
  sid: string;
  kind: TrackKind;
  source: TrackSource;
  mimeType: string;
  simulcast: boolean;
  muted: boolean;
  width?: number;
  height?: number;
}

// Track
interface Track {
  sid: string;
  kind: TrackKind;
  source: TrackSource;
  muted: boolean;
}

// Local track
interface LocalTrack extends Track {
  mediaStreamTrack: MediaStreamTrack;
}

// Remote track
interface RemoteTrack extends Track {
  stream: MediaStream;
}
```

### Signal Types

```typescript
// Signaling message types
type SignalingMessageType =
  | 'join'
  | 'leave'
  | 'joined'
  | 'participant-joined'
  | 'participant-left'
  | 'track-published'
  | 'track-unpublished'
  | 'track-subscribed'
  | 'track-unsubscribed'
  | 'track-muted'
  | 'track-unmuted'
  | 'create-transport'
  | 'connect-transport'
  | 'publish'
  | 'unpublish'
  | 'subscribe'
  | 'unsubscribe'
  | 'resume-consumer'
  | 'publish-data'
  | 'data'
  | 'error';

// Base signaling message
interface SignalingMessage {
  type: SignalingMessageType;
}

// Join message
interface JoinMessage extends SignalingMessage {
  type: 'join';
  room: string;
}

// Leave message
interface LeaveMessage extends SignalingMessage {
  type: 'leave';
}

// Joined message
interface JoinedMessage extends SignalingMessage {
  type: 'joined';
  room: Room;
  participant: Participant;
  otherParticipants: Participant[];
}

// Participant joined message
interface ParticipantJoinedMessage extends SignalingMessage {
  type: 'participant-joined';
  participant: Participant;
}

// Participant left message
interface ParticipantLeftMessage extends SignalingMessage {
  type: 'participant-left';
  participant: Participant;
}

// Track published message
interface TrackPublishedMessage extends SignalingMessage {
  type: 'track-published';
  track: TrackPublication;
}

// Track unpublished message
interface TrackUnpublishedMessage extends SignalingMessage {
  type: 'track-unpublished';
  producerId: string;
}

// Track subscribed message
interface TrackSubscribedMessage extends SignalingMessage {
  type: 'track-subscribed';
  trackSid: string;
  consumerId: string;
  producerId: string;
  rtpParameters: RtpParameters;
}

// Track unsubscribed message
interface TrackUnsubscribedMessage extends SignalingMessage {
  type: 'track-unsubscribed';
  consumerId: string;
}

// Track muted message
interface TrackMutedMessage extends SignalingMessage {
  type: 'track-muted';
  producerId: string;
}

// Track unmuted message
interface TrackUnmutedMessage extends SignalingMessage {
  type: 'track-unmuted';
  producerId: string;
}

// Create transport message
interface CreateTransportMessage extends SignalingMessage {
  type: 'create-transport';
  direction: 'send' | 'recv';
}

// Connect transport message
interface ConnectTransportMessage extends SignalingMessage {
  type: 'connect-transport';
  transportId: string;
  dtlsParameters: DtlsParameters;
}

// Publish message
interface PublishMessage extends SignalingMessage {
  type: 'publish';
  kind: TrackKind;
  source: TrackSource;
  rtpParameters: RtpParameters;
}

// Unpublish message
interface UnpublishMessage extends SignalingMessage {
  type: 'unpublish';
  producerId: string;
}

// Subscribe message
interface SubscribeMessage extends SignalingMessage {
  type: 'subscribe';
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}

// Unsubscribe message
interface UnsubscribeMessage extends SignalingMessage {
  type: 'unsubscribe';
  consumerId: string;
}

// Resume consumer message
interface ResumeConsumerMessage extends SignalingMessage {
  type: 'resume-consumer';
  consumerId: string;
}

// Publish data message
interface PublishDataMessage extends SignalingMessage {
  type: 'publish-data';
  kind: 'reliable' | 'lossy';
  data: unknown;
}

// Data message
interface DataMessage extends SignalingMessage {
  type: 'data';
  participantIdentity: string;
  kind: 'reliable' | 'lossy';
  data: unknown;
}

// Error message
interface ErrorMessage extends SignalingMessage {
  type: 'error';
  code: number;
  message: string;
}
```

### Token Types

```typescript
// JWT grant
interface VideoGrant {
  room: string;
  roomJoin: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
}

// JWT payload
interface TokenPayload {
  identity: string;
  name: string;
  metadata: Record<string, unknown>;
  video: VideoGrant;
  nbf: number;
  exp: number;
  iss: string;
  sub: string;
  jti: string;
  iat: number;
}
```

## Constants

### Events

```typescript
// Connection events
const CONNECTION_EVENTS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
} as const;

// Participant events
const PARTICIPANT_EVENTS = {
  JOINED: 'participant_joined',
  LEFT: 'participant_left',
  TRACK_PUBLISHED: 'track_published',
  TRACK_UNPUBLISHED: 'track_unpublished',
  TRACK_SUBSCRIBED: 'track_subscribed',
  TRACK_UNSUBSCRIBED: 'track_unsubscribed',
} as const;

// Track events
const TRACK_EVENTS = {
  MUTED: 'track_muted',
  UNMUTED: 'track_unmuted',
  STOPPED: 'track_stopped',
} as const;

// Data events
const DATA_EVENTS = {
  MESSAGE: 'data_message',
} as const;
```

### Errors

```typescript
// Error codes
const ERROR_CODES = {
  // General errors (100-199)
  UNKNOWN_ERROR: 100,
  INVALID_REQUEST: 101,
  UNAUTHORIZED: 102,
  FORBIDDEN: 103,
  NOT_FOUND: 104,

  // Room errors (200-299)
  ROOM_NOT_FOUND: 200,
  ROOM_FULL: 201,
  ROOM_CLOSED: 202,

  // Participant errors (300-399)
  PARTICIPANT_NOT_FOUND: 300,
  PARTICIPANT_ALREADY_JOINED: 301,

  // Track errors (400-499)
  TRACK_NOT_FOUND: 400,
  TRACK_ALREADY_PUBLISHED: 401,
  TRACK_NOT_PUBLISHED: 402,
  TRACK_ALREADY_SUBSCRIBED: 403,
  TRACK_NOT_SUBSCRIBED: 404,

  // Transport errors (500-599)
  TRANSPORT_NOT_FOUND: 500,
  TRANSPORT_ALREADY_CONNECTED: 501,
  TRANSPORT_NOT_CONNECTED: 502,
} as const;

// Error messages
const ERROR_MESSAGES: Record<number, string> = {
  [ERROR_CODES.UNKNOWN_ERROR]: 'Unknown error',
  [ERROR_CODES.INVALID_REQUEST]: 'Invalid request',
  [ERROR_CODES.UNAUTHORIZED]: 'Unauthorized',
  [ERROR_CODES.FORBIDDEN]: 'Forbidden',
  [ERROR_CODES.NOT_FOUND]: 'Not found',
  [ERROR_CODES.ROOM_NOT_FOUND]: 'Room not found',
  [ERROR_CODES.ROOM_FULL]: 'Room is full',
  [ERROR_CODES.ROOM_CLOSED]: 'Room is closed',
  [ERROR_CODES.PARTICIPANT_NOT_FOUND]: 'Participant not found',
  [ERROR_CODES.PARTICIPANT_ALREADY_JOINED]: 'Participant already joined',
  [ERROR_CODES.TRACK_NOT_FOUND]: 'Track not found',
  [ERROR_CODES.TRACK_ALREADY_PUBLISHED]: 'Track already published',
  [ERROR_CODES.TRACK_NOT_PUBLISHED]: 'Track not published',
  [ERROR_CODES.TRACK_ALREADY_SUBSCRIBED]: 'Track already subscribed',
  [ERROR_CODES.TRACK_NOT_SUBSCRIBED]: 'Track not subscribed',
  [ERROR_CODES.TRANSPORT_NOT_FOUND]: 'Transport not found',
  [ERROR_CODES.TRANSPORT_ALREADY_CONNECTED]: 'Transport already connected',
  [ERROR_CODES.TRANSPORT_NOT_CONNECTED]: 'Transport not connected',
};
```

## Usage

```typescript
import {
  Room,
  Participant,
  TrackPublication,
  SignalingMessage,
  ERROR_CODES,
  ERROR_MESSAGES,
} from '@bytepulse/pulsewave-shared';

// Use types
const room: Room = {
  sid: 'RM_123',
  name: 'my-room',
  numParticipants: 3,
  maxParticipants: 10,
  creationTime: Date.now(),
  metadata: {},
};

// Use constants
const errorMessage = ERROR_MESSAGES[ERROR_CODES.ROOM_NOT_FOUND];
// "Room not found"
```

## License

MIT
