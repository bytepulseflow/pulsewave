/**
 * Event names for WebSocket signaling
 */

// Client -> Server events
export const CLIENT_EVENTS = {
  JOIN: 'join',
  LEAVE: 'leave',
  CREATE_WEBRTC_TRANSPORT: 'create_webrtc_transport',
  CONNECT_TRANSPORT: 'connect_transport',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  RESUME_CONSUMER: 'resume_consumer',
  MUTE: 'mute',
  DATA: 'data',
  CALL: 'call',
  ACCEPT_CALL: 'accept_call',
  REJECT_CALL: 'reject_call',
} as const;

// Server -> Client events
export const SERVER_EVENTS = {
  JOINED: 'joined',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  TRACK_PUBLISHED: 'track_published',
  TRACK_UNPUBLISHED: 'track_unpublished',
  TRACK_SUBSCRIBED: 'track_subscribed',
  TRACK_UNSUBSCRIBED: 'track_unsubscribed',
  TRACK_MUTED: 'track_muted',
  DATA: 'data',
  ERROR: 'error',
  CALL_RECEIVED: 'call_received',
  CALL_ACCEPTED: 'call_accepted',
  CALL_REJECTED: 'call_rejected',
  CALL_ENDED: 'call_ended',
} as const;

// Room events (for internal use)
export const ROOM_EVENTS = {
  PARTICIPANT_CONNECTED: 'participant:connected',
  PARTICIPANT_DISCONNECTED: 'participant:disconnected',
  TRACK_ADDED: 'track:added',
  TRACK_REMOVED: 'track:removed',
  TRACK_MUTED: 'track:muted',
  TRACK_UNMUTED: 'track:unmuted',
  ROOM_CLOSED: 'room:closed',
} as const;
