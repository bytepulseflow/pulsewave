/**
 * Client module exports
 */

// RoomClient (layered architecture)
export { RoomClient } from './RoomClient';
export type { RoomClientOptions, RoomClientEvents as RoomEvents } from './RoomClient';

// Track and Participant classes (domain layer - moved to domain/ folder)
export { Track } from '../domain/Track';
export { LocalTrack } from '../domain/LocalTrack';
export { RemoteTrack } from '../domain/RemoteTrack';
export {
  TrackPublicationImpl,
  LocalTrackPublicationImpl,
  RemoteTrackPublicationImpl,
} from '../domain/TrackPublication';
export { ParticipantImpl, RemoteParticipantImpl } from '../domain/Participant';
export { LocalParticipantImpl } from '../domain/LocalParticipant';
