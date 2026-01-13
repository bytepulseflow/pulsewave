/**
 * ApplicationParticipant - Application Layer participant implementation
 *
 * This is the business logic layer for participant management.
 * It is independent of mediasoup and WebRTC details.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ParticipantInfo,
  ParticipantPermission,
  TrackInfo,
} from '@bytepulse/pulsewave-shared';
import { ConnectionState } from '@bytepulse/pulsewave-shared';
import type { ApplicationParticipant as IApplicationParticipant } from './types';

/**
 * Application Participant implementation
 */
export class ApplicationParticipant implements IApplicationParticipant {
  public readonly sid: string;
  public readonly identity: string;
  public name: string;
  public metadata: Record<string, unknown>;
  public state: ConnectionState;
  public socketId: string;
  public permission: ParticipantPermission;
  public tracks: TrackInfo[];
  public producerIds: Map<string, string>;
  public consumerIds: Map<string, string[]>;
  public sendTransportId?: string;
  public receiveTransportId?: string;

  constructor(
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
    this.socketId = '';
    this.permission = permission;
    this.tracks = [];
    this.producerIds = new Map();
    this.consumerIds = new Map();
  }

  public getInfo(): ParticipantInfo {
    return {
      sid: this.sid,
      identity: this.identity,
      name: this.name,
      state: this.state,
      metadata: this.metadata,
      tracks: this.tracks,
      permission: this.permission,
    };
  }

  public setState(state: ConnectionState): void {
    this.state = state;
  }

  public setSocketId(socketId: string): void {
    this.socketId = socketId;
  }

  public addTrack(track: TrackInfo): void {
    this.tracks.push(track);
  }

  public removeTrack(trackSid: string): void {
    this.tracks = this.tracks.filter((t) => t.sid !== trackSid);
    this.producerIds.delete(trackSid);
  }

  public getTrack(trackSid: string): TrackInfo | undefined {
    return this.tracks.find((t) => t.sid === trackSid);
  }

  public getTracks(): TrackInfo[] {
    return this.tracks;
  }

  public getTrackBySource(source: string): TrackInfo | undefined {
    return this.tracks.find((t) => t.source === source);
  }

  public muteTrack(trackSid: string): void {
    const track = this.getTrack(trackSid);
    if (track) {
      track.muted = true;
    }
  }

  public unmuteTrack(trackSid: string): void {
    const track = this.getTrack(trackSid);
    if (track) {
      track.muted = false;
    }
  }

  public setProducerId(trackSid: string, producerId: string): void {
    this.producerIds.set(trackSid, producerId);
  }

  public getProducerId(trackSid: string): string | undefined {
    return this.producerIds.get(trackSid);
  }

  public addConsumerId(targetParticipantSid: string, consumerId: string): void {
    const existing = this.consumerIds.get(targetParticipantSid) || [];
    existing.push(consumerId);
    this.consumerIds.set(targetParticipantSid, existing);
  }

  public getConsumerIds(targetParticipantSid: string): string[] {
    return this.consumerIds.get(targetParticipantSid) || [];
  }

  public removeConsumerIds(targetParticipantSid: string): void {
    this.consumerIds.delete(targetParticipantSid);
  }

  public setSendTransportId(transportId: string): void {
    this.sendTransportId = transportId;
  }

  public getSendTransportId(): string | undefined {
    return this.sendTransportId;
  }

  public setReceiveTransportId(transportId: string): void {
    this.receiveTransportId = transportId;
  }

  public getReceiveTransportId(): string | undefined {
    return this.receiveTransportId;
  }
}
