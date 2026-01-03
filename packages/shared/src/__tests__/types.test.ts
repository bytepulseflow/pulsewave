/**
 * Tests for shared types
 */

import type { RoomInfo, ParticipantInfo, TrackInfo } from '@bytepulse/pulsewave-shared';
import { ConnectionState, TrackKind, TrackSource } from '@bytepulse/pulsewave-shared';

describe('Shared Types', () => {
  describe('RoomInfo', () => {
    it('should create a valid RoomInfo object', () => {
      const roomInfo: RoomInfo = {
        sid: 'RM_123',
        name: 'test-room',
        numParticipants: 0,
        creationTime: Date.now(),
      };

      expect(roomInfo.sid).toBe('RM_123');
      expect(roomInfo.name).toBe('test-room');
    });
  });

  describe('ParticipantInfo', () => {
    it('should create a valid ParticipantInfo object', () => {
      const participantInfo: ParticipantInfo = {
        sid: 'PA_123',
        identity: 'user-1',
        name: 'Test User',
        state: ConnectionState.Connected,
        tracks: [],
      };

      expect(participantInfo.sid).toBe('PA_123');
      expect(participantInfo.identity).toBe('user-1');
    });
  });

  describe('TrackInfo', () => {
    it('should create a valid TrackInfo object', () => {
      const trackInfo: TrackInfo = {
        sid: 'TR_123',
        kind: TrackKind.Video,
        source: TrackSource.Camera,
        muted: false,
      };

      expect(trackInfo.sid).toBe('TR_123');
      expect(trackInfo.kind).toBe(TrackKind.Video);
    });
  });

  describe('ConnectionState', () => {
    it('should have valid connection states', () => {
      const states = [
        ConnectionState.Connected,
        ConnectionState.Disconnected,
        ConnectionState.Reconnecting,
      ];
      expect(states).toContain(ConnectionState.Connected);
    });
  });

  describe('TrackKind', () => {
    it('should have valid track kinds', () => {
      const kinds = [TrackKind.Audio, TrackKind.Video];
      expect(kinds).toContain(TrackKind.Audio);
      expect(kinds).toContain(TrackKind.Video);
    });
  });

  describe('TrackSource', () => {
    it('should have valid track sources', () => {
      const sources = [TrackSource.Camera, TrackSource.Microphone, TrackSource.ScreenShare];
      expect(sources).toContain(TrackSource.Camera);
      expect(sources).toContain(TrackSource.Microphone);
    });
  });
});
