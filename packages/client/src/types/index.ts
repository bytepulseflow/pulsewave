/**
 * Client-specific types
 */

import type {
  ConnectionState,
  TrackKind,
  DataPacket,
  DataProviderConfig,
  DataProviderType,
} from '@bytepulse/pulsewave-shared';

/**
 * Room client options
 */
export interface RoomClientOptions {
  /**
   * WebSocket server URL
   */
  url: string;

  /**
   * Room name to join
   */
  room: string;

  /**
   * Access token for authentication
   */
  token: string;

  /**
   * Whether to automatically subscribe to all remote tracks
   * @default true
   */
  autoSubscribe?: boolean;

  /**
   * Preferred video codec
   */
  preferredVideoCodec?: 'vp8' | 'vp9' | 'h264' | 'av1';

  /**
   * Preferred audio codec
   */
  preferredAudioCodec?: 'opus' | 'isac' | 'aac';

  /**
   * Enable simulcast for video
   * @default true
   */
  enableSimulcast?: boolean;

  /**
   * Enable data channels
   * @default true
   */
  enableDataChannels?: boolean;

  /**
   * Data provider configuration
   * If not specified, defaults to WebSocket provider
   */
  dataProvider?: DataProviderConfig | DataProviderType;

  /**
   * Maximum video bitrate (kbps)
   */
  maxVideoBitrate?: number;

  /**
   * Maximum audio bitrate (kbps)
   */
  maxAudioBitrate?: number;

  /**
   * Custom ICE servers
   */
  iceServers?: RTCIceServer[];

  /**
   * ICE transport policy
   */
  iceTransportPolicy?: 'all' | 'relay';

  /**
   * Debug mode
   * @default false
   */
  debug?: boolean;
}

/**
 * Media track options
 */
export interface MediaTrackOptions {
  /**
   * Track kind
   */
  kind: TrackKind;

  /**
   * Track name
   */
  name?: string;

  /**
   * Whether to enable simulcast
   */
  simulcast?: boolean;

  /**
   * Maximum bitrate (kbps)
   */
  maxBitrate?: number;

  /**
   * Video constraints
   */
  videoConstraints?: MediaTrackConstraints;

  /**
   * Audio constraints
   */
  audioConstraints?: MediaTrackConstraints;
}

/**
 * Track publication options
 */
export interface TrackPublishOptions {
  /**
   * Whether to publish the track
   * @default true
   */
  publish?: boolean;

  /**
   * Whether to enable simulcast
   */
  simulcast?: boolean;

  /**
   * Maximum bitrate (kbps)
   */
  maxBitrate?: number;

  /**
   * Codec preferences
   */
  codec?: string;
}

/**
 * Track subscription options
 */
export interface TrackSubscribeOptions {
  /**
   * Whether to subscribe
   * @default true
   */
  subscribe?: boolean;

  /**
   * Preferred codec
   */
  codec?: string;

  /**
   * Maximum bitrate (kbps)
   */
  maxBitrate?: number;
}

/**
 * Data channel options
 */
export interface DataChannelOptions {
  /**
   * Data channel label
   */
  label: string;

  /**
   * Whether to order messages
   * @default true
   */
  ordered?: boolean;

  /**
   * Maximum packet lifetime (ms)
   */
  maxPacketLifeTime?: number;

  /**
   * Maximum number of retransmits
   */
  maxRetransmits?: number;

  /**
   * Protocol
   */
  protocol?: string;
}

/**
 * Room events
 */
export interface RoomEvents {
  /**
   * Connection state changed
   */
  'connection-state-changed': (state: ConnectionState) => void;

  /**
   * Participant joined
   */
  'participant-joined': (participant: Participant) => void;

  /**
   * Participant left
   */
  'participant-left': (participant: Participant) => void;

  /**
   * Local participant joined
   */
  'local-participant-joined': (participant: LocalParticipant) => void;

  /**
   * Local participant left
   */
  'local-participant-left': () => void;

  /**
   * Track published
   */
  'track-published': (publication: TrackPublication, participant: Participant) => void;

  /**
   * Track unpublished
   */
  'track-unpublished': (publication: TrackPublication, participant: Participant) => void;

  /**
   * Track subscribed
   */
  'track-subscribed': (
    track: RemoteTrack,
    publication: TrackPublication,
    participant: Participant
  ) => void;

  /**
   * Track unsubscribed
   */
  'track-unsubscribed': (
    track: RemoteTrack,
    publication: TrackPublication,
    participant: Participant
  ) => void;

  /**
   * Track muted
   */
  'track-muted': (track: Track, participant: Participant) => void;

  /**
   * Track unmuted
   */
  'track-unmuted': (track: Track, participant: Participant) => void;

  /**
   * Data received
   */
  'data-received': (data: DataPacket, participant: Participant) => void;

  /**
   * Error occurred
   */
  error: (error: Error) => void;

  /**
   * Room disconnected
   */
  disconnected: () => void;

  /**
   * Room metadata updated
   */
  'metadata-updated': (metadata: Record<string, unknown>) => void;

  /**
   * Server message received (for WebRTC signaling)
   */
  message: (data: unknown) => void;
}

/**
 * Participant events
 */
export interface ParticipantEvents {
  /**
   * Metadata updated
   */
  'metadata-updated': (metadata: Record<string, unknown>) => void;

  /**
   * Track published
   */
  'track-published': (publication: TrackPublication) => void;

  /**
   * Track unpublished
   */
  'track-unpublished': (publication: TrackPublication) => void;

  /**
   * Track subscribed (track object is now available)
   */
  'track-subscribed': (publication: TrackPublication) => void;

  /**
   * Track unsubscribed
   */
  'track-unsubscribed': (publication: TrackPublication) => void;

  /**
   * Track muted
   */
  'track-muted': (track: Track) => void;

  /**
   * Track unmuted
   */
  'track-unmuted': (track: Track) => void;
}

/**
 * Local participant events
 */
export interface LocalParticipantEvents extends Omit<
  ParticipantEvents,
  'track-published' | 'track-unpublished' | 'track-muted' | 'track-unmuted'
> {
  /**
   * Track published
   */
  'track-published': (publication: LocalTrackPublication) => void;

  /**
   * Track unpublished
   */
  'track-unpublished': (publication: LocalTrackPublication) => void;

  /**
   * Track muted
   */
  'track-muted': (track: LocalTrack) => void;

  /**
   * Track unmuted
   */
  'track-unmuted': (track: LocalTrack) => void;
}

/**
 * Local track events
 */
export interface LocalTrackEvents {
  /**
   * Muted
   */
  muted: () => void;

  /**
   * Unmuted
   */
  unmuted: () => void;

  /**
   * Enabled
   */
  enabled: () => void;

  /**
   * Disabled
   */
  disabled: () => void;
}

/**
 * Remote track events
 */
export interface RemoteTrackEvents {
  /**
   * Muted
   */
  muted: () => void;

  /**
   * Unmuted
   */
  unmuted: () => void;

  /**
   * Enabled
   */
  enabled: () => void;

  /**
   * Disabled
   */
  disabled: () => void;

  /**
   * Subscribed
   */
  subscribed: () => void;

  /**
   * Unsubscribed
   */
  unsubscribed: () => void;
}

/**
 * Track events
 */
export interface TrackEvents {
  /**
   * Muted
   */
  muted: () => void;

  /**
   * Unmuted
   */
  unmuted: () => void;

  /**
   * Enabled
   */
  enabled: () => void;

  /**
   * Disabled
   */
  disabled: () => void;
}

/**
 * Track publication (base)
 */
export interface TrackPublication {
  /**
   * Track SID
   */
  sid: string;

  /**
   * Track kind
   */
  kind: TrackKind;

  /**
   * Track name
   */
  name: string;

  /**
   * Track source
   */
  source: string;

  /**
   * Whether the track is muted
   */
  muted: boolean;

  /**
   * Whether the track is subscribed
   */
  subscribed: boolean;

  /**
   * Whether the track is simulcast
   */
  simulcast: boolean;
}

/**
 * Local track publication
 */
export interface LocalTrackPublication extends TrackPublication {
  /**
   * The local track (may be null if not yet initialized)
   */
  track: LocalTrack | null;

  /**
   * Unpublish the track
   */
  unpublish(): Promise<void>;
}

/**
 * Remote track publication
 */
export interface RemoteTrackPublication extends TrackPublication {
  /**
   * The remote track (if subscribed)
   */
  track: RemoteTrack | null;

  /**
   * Whether the track is enabled
   */
  enabled: boolean;

  /**
   * Set subscription status
   */
  setSubscribed(subscribed: boolean): Promise<void>;
}

/**
 * Participant (base)
 */
export interface Participant {
  /**
   * Participant SID
   */
  sid: string;

  /**
   * Participant identity
   */
  identity: string;

  /**
   * Participant name
   */
  name: string;

  /**
   * Connection state
   */
  state: ConnectionState;

  /**
   * Participant metadata
   */
  metadata: Record<string, unknown>;

  /**
   * Whether this is the local participant
   */
  isLocal: boolean;

  /**
   * Track publications map
   */
  tracks: Map<string, RemoteTrackPublication>;

  /**
   * Get all track publications
   */
  getTracks(): RemoteTrackPublication[];

  /**
   * Get track publication by SID
   */
  getTrack(sid: string): RemoteTrackPublication | undefined;

  /**
   * Get track publication by name
   */
  getTrackByName(name: string): RemoteTrackPublication | undefined;

  /**
   * Set metadata
   */
  setMetadata(metadata: Record<string, unknown>): Promise<void>;

  /**
   * Add event listener
   */
  on<K extends keyof ParticipantEvents>(event: K, listener: ParticipantEvents[K]): void;

  /**
   * Remove event listener
   */
  off<K extends keyof ParticipantEvents>(event: K, listener: ParticipantEvents[K]): void;

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void;
}

/**
 * Local participant
 */
export interface LocalParticipant extends Omit<
  Participant,
  'isLocal' | 'tracks' | 'getTracks' | 'getTrack' | 'getTrackByName' | 'on' | 'off'
> {
  /**
   * Override isLocal to true
   */
  isLocal: true;

  /**
   * Track publications map
   */
  tracks: Map<string, LocalTrackPublication>;

  /**
   * Get all track publications
   */
  getTracks(): LocalTrackPublication[];

  /**
   * Get track publication by SID
   */
  getTrack(sid: string): LocalTrackPublication | undefined;

  /**
   * Get track publication by name
   */
  getTrackByName(name: string): LocalTrackPublication | undefined;

  /**
   * Publish a track
   */
  publishTrack(track: LocalTrack, options?: TrackPublishOptions): Promise<LocalTrackPublication>;

  /**
   * Unpublish a track
   */
  unpublishTrack(sid: string): Promise<void>;

  /**
   * Publish data
   */
  publishData(data: unknown, kind?: 'reliable' | 'lossy'): Promise<void>;

  /**
   * Enable camera (video)
   * @param deviceId - Optional specific device ID to use. If not provided, uses default camera.
   */
  enableCamera(deviceId?: string): Promise<void>;

  /**
   * Disable camera (video)
   */
  disableCamera(): Promise<void>;

  /**
   * Enable microphone (audio)
   * @param deviceId - Optional specific device ID to use. If not provided, uses default microphone.
   */
  enableMicrophone(deviceId?: string): Promise<void>;

  /**
   * Disable microphone (audio)
   */
  disableMicrophone(): Promise<void>;

  /**
   * Mute audio track (pauses producer, keeps track enabled)
   */
  muteAudio(): Promise<void>;

  /**
   * Unmute audio track (resumes producer)
   */
  unmuteAudio(): Promise<void>;

  /**
   * Mute video track (pauses producer, keeps track enabled)
   */
  muteVideo(): Promise<void>;

  /**
   * Unmute video track (resumes producer)
   */
  unmuteVideo(): Promise<void>;

  /**
   * List available microphones
   */
  listAvailableMicrophones(): Promise<MediaDeviceInfo[]>;

  /**
   * List available cameras
   */
  listAvailableCameras(): Promise<MediaDeviceInfo[]>;

  /**
   * Add event listener
   */
  on<K extends keyof LocalParticipantEvents>(event: K, listener: LocalParticipantEvents[K]): void;

  /**
   * Remove event listener
   */
  off<K extends keyof LocalParticipantEvents>(event: K, listener: LocalParticipantEvents[K]): void;
}

/**
 * Remote participant
 */
export interface RemoteParticipant extends Participant {
  /**
   * Override isLocal to false
   */
  isLocal: false;

  /**
   * Subscribe to a track
   */
  subscribeToTrack(sid: string, options?: TrackSubscribeOptions): Promise<void>;

  /**
   * Unsubscribe from a track
   */
  unsubscribeFromTrack(sid: string): Promise<void>;

  /**
   * Subscribe to all tracks
   */
  subscribeToAllTracks(options?: TrackSubscribeOptions): Promise<void>;

  /**
   * Unsubscribe from all tracks
   */
  unsubscribeFromAllTracks(): Promise<void>;
}

/**
 * Track (base)
 */
export interface Track {
  /**
   * Track SID
   */
  sid: string;

  /**
   * Track kind
   */
  kind: TrackKind;

  /**
   * Track source
   */
  source: string;

  /**
   * Media stream track
   */
  mediaTrack: MediaStreamTrack;

  /**
   * Whether the track is muted
   */
  isMuted: boolean;

  /**
   * Whether the track is enabled
   */
  isEnabled: boolean;

  /**
   * Set enabled state
   */
  set enabled(value: boolean);

  /**
   * Attach track to an HTML element
   */
  attach(element: HTMLVideoElement | HTMLAudioElement): void;

  /**
   * Detach track from element
   */
  detach(element?: HTMLVideoElement | HTMLAudioElement): void;

  /**
   * Mute the track
   */
  mute(): Promise<void>;

  /**
   * Unmute the track
   */
  unmute(): Promise<void>;

  /**
   * Stop the track
   */
  stop(): void;

  /**
   * Add event listener
   */
  on<K extends keyof TrackEvents>(event: K, listener: TrackEvents[K]): void;

  /**
   * Remove event listener
   */
  off<K extends keyof TrackEvents>(event: K, listener: TrackEvents[K]): void;

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void;
}

/**
 * Local track
 */
export interface LocalTrack extends Track {
  /**
   * Mute the track locally
   */
  mute(): Promise<void>;

  /**
   * Unmute the track locally
   */
  unmute(): Promise<void>;

  /**
   * Add event listener
   */
  on<K extends keyof LocalTrackEvents>(event: K, listener: LocalTrackEvents[K]): void;

  /**
   * Remove event listener
   */
  off<K extends keyof LocalTrackEvents>(event: K, listener: LocalTrackEvents[K]): void;
}

/**
 * Remote track
 */
export interface RemoteTrack extends Track {
  /**
   * Add event listener
   */
  on<K extends keyof RemoteTrackEvents>(event: K, listener: RemoteTrackEvents[K]): void;

  /**
   * Remove event listener
   */
  off<K extends keyof RemoteTrackEvents>(event: K, listener: RemoteTrackEvents[K]): void;
}

/**
 * Data channel events
 */
export interface DataChannelEvents {
  /**
   * Message received
   */
  message: (data: unknown) => void;

  /**
   * Opened
   */
  open: () => void;

  /**
   * Closed
   */
  close: () => void;

  /**
   * Error occurred
   */
  error: (error: Error) => void;
}
