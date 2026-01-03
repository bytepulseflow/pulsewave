/**
 * Participant - Represents a participant in a room
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ParticipantInfo,
  ConnectionState,
  ParticipantPermission,
  TrackInfo,
  TrackKind,
  TrackSource,
} from '@bytepulse/pulsewave-shared';
import type { Producer, Consumer, Transport } from 'mediasoup/types';
import type { Room } from './Room';

/**
 * Participant class
 */
export class Participant {
  public readonly sid: string;
  public readonly identity: string;
  public name: string;
  public metadata: Record<string, unknown>;
  public state: ConnectionState;
  public permission: ParticipantPermission;
  public socketId: string;

  private tracks: Map<string, Track>;
  private producers: Map<string, Producer>;
  private consumers: Map<string, Consumer>;
  private transports: Map<string, Transport>;

  constructor(
    _room: Room,
    identity: string,
    name?: string,
    metadata: Record<string, unknown> = {},
    permission: ParticipantPermission = {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    }
  ) {
    this.sid = uuidv4();
    this.identity = identity;
    this.name = name || identity;
    this.metadata = metadata;
    this.state = ConnectionState.Disconnected;
    this.permission = permission;
    this.socketId = '';

    this.tracks = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.transports = new Map();
  }

  /**
   * Get participant info
   */
  public getInfo(): ParticipantInfo {
    return {
      sid: this.sid,
      identity: this.identity,
      name: this.name,
      state: this.state,
      metadata: this.metadata,
      tracks: Array.from(this.tracks.values()).map((t) => t.getInfo()),
      permission: this.permission,
    };
  }

  /**
   * Set connection state
   */
  public setState(state: ConnectionState): void {
    this.state = state;
  }

  /**
   * Set socket ID
   */
  public setSocketId(socketId: string): void {
    this.socketId = socketId;
  }

  /**
   * Add a transport
   */
  public addTransport(id: string, transport: Transport): void {
    this.transports.set(id, transport);
  }

  /**
   * Get a transport by ID
   */
  public getTransport(id: string): Transport | undefined {
    return this.transports.get(id);
  }

  /**
   * Remove a transport
   */
  public removeTransport(id: string): void {
    const transport = this.transports.get(id);
    if (transport) {
      transport.close();
      this.transports.delete(id);
    }
  }

  /**
   * Add a producer
   */
  public addProducer(id: string, producer: Producer, kind: TrackKind, source: TrackSource): Track {
    const track = new Track(id, kind, source);
    this.tracks.set(id, track);
    this.producers.set(id, producer);
    console.log(`Participant ${this.identity} added producer ${id}, track SID: ${track.sid}`);
    return track;
  }

  /**
   * Get a producer by ID
   */
  public getProducer(id: string): Producer | undefined {
    return this.producers.get(id);
  }

  /**
   * Remove a producer
   */
  public removeProducer(id: string): void {
    const producer = this.producers.get(id);
    if (producer) {
      producer.close();
      this.producers.delete(id);
    }
    this.tracks.delete(id);
  }

  /**
   * Add a consumer
   */
  public addConsumer(id: string, consumer: Consumer): void {
    this.consumers.set(id, consumer);
  }

  /**
   * Get a consumer by ID
   */
  public getConsumer(id: string): Consumer | undefined {
    return this.consumers.get(id);
  }

  /**
   * Remove a consumer
   */
  public removeConsumer(id: string): void {
    const consumer = this.consumers.get(id);
    if (consumer) {
      consumer.close();
      this.consumers.delete(id);
    }
  }

  /**
   * Get all tracks
   */
  public getTracks(): Track[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Get a track by ID
   */
  public getTrack(id: string): Track | undefined {
    return this.tracks.get(id);
  }

  /**
   * Mute a track
   */
  public muteTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.mute();
    }
  }

  /**
   * Unmute a track
   */
  public unmuteTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.unmute();
    }
  }

  /**
   * Close all resources
   */
  public close(): void {
    // Close all transports
    for (const transport of this.transports.values()) {
      transport.close();
    }
    this.transports.clear();

    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    this.tracks.clear();
    this.state = ConnectionState.Disconnected;
  }
}

/**
 * Track - Represents a media track
 */
export class Track {
  public readonly sid: string;
  public readonly kind: TrackKind;
  public readonly source: TrackSource;
  public muted: boolean;
  public width?: number;
  public height?: number;
  public simulcast: boolean;

  constructor(sid: string, kind: TrackKind, source: TrackSource) {
    // Use the producer ID as the track SID for consistency
    this.sid = sid;
    this.kind = kind;
    this.source = source;
    this.muted = false;
    this.simulcast = false;
  }

  /**
   * Get track info
   */
  public getInfo(): TrackInfo {
    return {
      sid: this.sid,
      kind: this.kind,
      source: this.source,
      muted: this.muted,
      width: this.width,
      height: this.height,
      simulcast: this.simulcast,
    };
  }

  /**
   * Mute the track
   */
  public mute(): void {
    this.muted = true;
  }

  /**
   * Unmute the track
   */
  public unmute(): void {
    this.muted = false;
  }
}
