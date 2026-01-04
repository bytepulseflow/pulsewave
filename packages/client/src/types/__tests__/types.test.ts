/**
 * Tests for types module
 */

import type { TrackSubscribeOptions, RoomClientOptions } from '../index';

describe('Types', () => {
  describe('TrackSubscribeOptions', () => {
    it('should accept valid subscribe options', () => {
      const options: TrackSubscribeOptions = {
        subscribe: true,
        codec: 'vp8',
        maxBitrate: 1000,
      };

      expect(options.subscribe).toBe(true);
      expect(options.codec).toBe('vp8');
      expect(options.maxBitrate).toBe(1000);
    });

    it('should accept empty options', () => {
      const options: TrackSubscribeOptions = {};

      expect(options).toEqual({});
    });
  });

  describe('RoomClientOptions', () => {
    it('should accept valid room client options', () => {
      const options: RoomClientOptions = {
        url: 'ws://localhost:3000',
        room: 'test-room',
        token: 'test-token',
        autoSubscribe: true,
        enableSimulcast: true,
        enableDataChannels: true,
      };

      expect(options.url).toBe('ws://localhost:3000');
      expect(options.room).toBe('test-room');
      expect(options.token).toBe('test-token');
      expect(options.autoSubscribe).toBe(true);
    });

    it('should accept minimal room client options', () => {
      const options: RoomClientOptions = {
        url: 'ws://localhost:3000',
        room: 'test-room',
        token: 'test-token',
      };

      expect(options.url).toBe('ws://localhost:3000');
      expect(options.room).toBe('test-room');
      expect(options.token).toBe('test-token');
    });
  });
});
