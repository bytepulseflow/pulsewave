/**
 * Client module exports
 */

// New RoomClient (layered architecture)
export { RoomClient } from './RoomClient';
export type { RoomClientOptions, RoomEvents } from './RoomClient';

// Track and Participant classes (for advanced use cases)
export { Track } from './Track';
export { LocalTrack } from './LocalTrack';
export { RemoteTrack } from './RemoteTrack';
export {
  TrackPublicationImpl,
  LocalTrackPublicationImpl,
  RemoteTrackPublicationImpl,
} from './TrackPublication';
export { ParticipantImpl, RemoteParticipantImpl } from './Participant';
export { LocalParticipantImpl } from './LocalParticipant';
