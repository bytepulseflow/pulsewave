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
  DataChannelKind,
} from '@bytepulse/pulsewave-shared';
import type { Producer, Consumer, Transport, DataProducer, DataConsumer } from 'mediasoup/types';
import type { Room } from './Room';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('participant');

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
  private transportDirections: Map<string, string>;
  private dataProducers: Map<string, DataProducer>;
  private dataConsumers: Map<string, DataConsumer>;

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
    this.transportDirections = new Map();
    this.dataProducers = new Map();
    this.dataConsumers = new Map();
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
  public addTransport(id: string, transport: Transport, direction?: string): void {
    this.transports.set(id, transport);
    if (direction) {
      this.transportDirections.set(id, direction);
    }
  }

  /**
   * Get a transport by ID
   */
  public getTransport(id: string): Transport | undefined {
    return this.transports.get(id);
  }

  /**
   * Get transport direction by ID
   */
  public getTransportDirection(id: string): string | undefined {
    return this.transportDirections.get(id);
  }

  /**
   * Get a receive transport
   */
  public getReceiveTransport(): Transport | undefined {
    for (const [id, direction] of this.transportDirections.entries()) {
      if (direction === 'recv') {
        return this.transports.get(id);
      }
    }
    return undefined;
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
    this.transportDirections.delete(id);
  }

  /**
   * Add a producer
   */
  public addProducer(id: string, producer: Producer, kind: TrackKind, source: TrackSource): Track {
    const track = new Track(id, kind, source);
    this.tracks.set(id, track);
    this.producers.set(id, producer);
    logger.debug(`Participant ${this.identity} added producer ${id}, track SID: ${track.sid}`);
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

    // Close all data producers
    for (const dataProducer of this.dataProducers.values()) {
      dataProducer.close();
    }
    this.dataProducers.clear();

    // Close all data consumers
    for (const dataConsumer of this.dataConsumers.values()) {
      dataConsumer.close();
    }
    this.dataConsumers.clear();

    this.state = ConnectionState.Disconnected;
  }

  /**
   * Add a data producer
   */
  public addDataProducer(id: string, dataProducer: DataProducer, kind: DataChannelKind): void {
    this.dataProducers.set(id, dataProducer);
    logger.debug(`Participant ${this.identity} added data producer ${id}, kind: ${kind}`);
  }

  /**
   * Get a data producer by ID
   */
  public getDataProducer(id: string): DataProducer | undefined {
    return this.dataProducers.get(id);
  }

  /**
   * Remove a data producer
   */
  public removeDataProducer(id: string): void {
    const dataProducer = this.dataProducers.get(id);
    if (dataProducer) {
      dataProducer.close();
      this.dataProducers.delete(id);
    }
  }

  /**
   * Add a data consumer
   */
  public addDataConsumer(id: string, dataConsumer: DataConsumer): void {
    this.dataConsumers.set(id, dataConsumer);
    logger.debug(`Participant ${this.identity} added data consumer ${id}`);
  }

  /**
   * Get a data consumer by ID
   */
  public getDataConsumer(id: string): DataConsumer | undefined {
    return this.dataConsumers.get(id);
  }

  /**
   * Remove a data consumer
   */
  public removeDataConsumer(id: string): void {
    const dataConsumer = this.dataConsumers.get(id);
    if (dataConsumer) {
      dataConsumer.close();
      this.dataConsumers.delete(id);
    }
  }

  /**
   * Get all data producers
   */
  public getDataProducers(): Map<string, DataProducer> {
    return this.dataProducers;
  }

  /**
   * Get all data consumers
   */
  public getDataConsumers(): Map<string, DataConsumer> {
    return this.dataConsumers;
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
