/**
 * Main entry point for pulsewave-client client
 */

// Export client classes
export { RoomClient } from './client';
export { Track } from './client/Track';
export { LocalTrack } from './client/LocalTrack';
export { RemoteTrack } from './client/RemoteTrack';
export {
  TrackPublicationImpl,
  LocalTrackPublicationImpl,
  RemoteTrackPublicationImpl,
} from './client/TrackPublication';
export { ParticipantImpl, RemoteParticipantImpl } from './client/Participant';
export { LocalParticipantImpl } from './client/LocalParticipant';

// Export media classes
export { MediaManager } from './media';
export { AudioTrack } from './media/AudioTrack';
export { VideoTrack } from './media/VideoTrack';

// Export WebRTC classes
export { WebRTCManager } from './webrtc/WebRTCManager';
export type { WebRTCConfig } from './webrtc/WebRTCManager';

// Export context
export { RoomProvider, useRoomContext, useRoom, withRoom } from './context';
export type { RoomContextValue, RoomProviderProps } from './context';

// Export types (excluding conflicting ones)
export type {
  RoomClientOptions,
  MediaTrackOptions,
  TrackPublishOptions,
  TrackSubscribeOptions,
  DataChannelOptions,
  RoomEvents,
  ParticipantEvents,
  LocalParticipantEvents,
  TrackEvents,
  LocalTrackEvents,
  RemoteTrackEvents,
  DataChannelEvents,
  TrackPublication,
  LocalTrackPublication,
  RemoteTrackPublication,
  Participant,
  LocalParticipant,
  RemoteParticipant,
} from './types';

// Export hooks (placeholder for Phase 12)
export * from './hooks';

// Export components (placeholder for Phase 13)
export * from './components';

// Export data (placeholder for Phase 14)
export * from './data';
