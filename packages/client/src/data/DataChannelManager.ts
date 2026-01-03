/**
 * DataChannelManager - Manages data channels for a room
 */

import type { DataChannelOptions } from '../types';
import { DataChannel } from './DataChannel';

/**
 * DataChannelManager class
 */
export class DataChannelManager {
  /** Data channels by label */
  private channels: Map<string, DataChannel> = new Map();

  /** Transport for creating data channels */
  private transport: any;

  /** Default data channel options */
  private defaultOptions: Partial<DataChannelOptions>;

  constructor(transport: any, defaultOptions: Partial<DataChannelOptions> = {}) {
    this.transport = transport;
    this.defaultOptions = defaultOptions;
  }

  /**
   * Create a new data channel
   */
  async createChannel(options: DataChannelOptions): Promise<DataChannel> {
    const existing = this.channels.get(options.label);
    if (existing) {
      throw new Error(`Data channel with label "${options.label}" already exists`);
    }

    const init: RTCDataChannelInit = {
      ordered: options.ordered ?? this.defaultOptions.ordered ?? true,
      maxPacketLifeTime: options.maxPacketLifeTime ?? this.defaultOptions.maxPacketLifeTime,
      maxRetransmits: options.maxRetransmits ?? this.defaultOptions.maxRetransmits,
      protocol: options.protocol ?? this.defaultOptions.protocol,
    };

    const dataChannel = this.transport.createDataChannel(options.label, init);
    const channel = new DataChannel(dataChannel);

    this.channels.set(options.label, channel);

    return channel;
  }

  /**
   * Get a data channel by label
   */
  getChannel(label: string): DataChannel | undefined {
    return this.channels.get(label);
  }

  /**
   * Get all data channels
   */
  getAllChannels(): DataChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Close a data channel
   */
  closeChannel(label: string): void {
    const channel = this.channels.get(label);
    if (channel) {
      channel.close();
      this.channels.delete(label);
    }
  }

  /**
   * Close all data channels
   */
  closeAll(): void {
    this.channels.forEach((channel) => channel.close());
    this.channels.clear();
  }

  /**
   * Handle incoming data channel from remote
   */
  handleIncomingChannel(channel: RTCDataChannel): DataChannel {
    const existing = this.channels.get(channel.label);
    if (existing) {
      // Close existing channel and replace with new one
      existing.close();
    }

    const dataChannel = new DataChannel(channel);
    this.channels.set(channel.label, dataChannel);

    return dataChannel;
  }

  /**
   * Check if a channel exists
   */
  hasChannel(label: string): boolean {
    return this.channels.has(label);
  }

  /**
   * Get channel count
   */
  get channelCount(): number {
    return this.channels.size;
  }
}
