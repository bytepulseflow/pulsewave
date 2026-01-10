/**
 * RoomClient - Main client class for connecting to a mediasoup room
 *
 *
 * Acts as a facade/coordinator, delegating to specialized controllers.
 */

import type { RoomInfo, RtpCapabilities, DataProvider } from '@bytepulse/pulsewave-shared';
import {
  ConnectionState,
  DataProviderType as SharedDataProviderType,
  DataChannelKind,
} from '@bytepulse/pulsewave-shared';
import type {
  RoomClientOptions,
  RoomEvents,
  LocalParticipant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  TrackSubscribeOptions,
} from '../types';
import { LocalParticipantImpl } from './LocalParticipant';
import { RemoteParticipantImpl } from './Participant';
import { LocalTrack as LocalTrackImpl } from './LocalTrack';
import {
  EventBus,
  ParticipantStore,
  ConnectionController,
  SignalingClient,
  MediaController,
  WebRTCController,
  TrackController,
} from './controllers';
import { WebSocketDataProvider, WebRTCDataProvider } from '../data/providers';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('room-client');

export class RoomClient {
  public readonly options: RoomClientOptions;

  // Controllers
  private eventBus: EventBus;
  private participantStore: ParticipantStore;
  private connectionController: ConnectionController;
  private signalingClient: SignalingClient;
  private mediaController: MediaController;
  private webRTCController: WebRTCController;
  private trackController: TrackController;

  // Data provider (strategy pattern for data transmission)
  private dataProvider: DataProvider | null = null;

  // Room state
  public roomInfo: RoomInfo | null = null;
  public rtpCapabilities: RtpCapabilities | null = null;

  constructor(options: RoomClientOptions) {
    this.options = options;

    // Initialize controllers
    this.eventBus = new EventBus();
    this.participantStore = new ParticipantStore();
    this.connectionController = new ConnectionController(options);
    this.signalingClient = new SignalingClient(options, (message) =>
      this.connectionController.send(message)
    );
    this.mediaController = new MediaController();
    this.webRTCController = new WebRTCController((message) =>
      this.connectionController.send(message)
    );
    this.trackController = new TrackController(
      this.webRTCController,
      this.participantStore,
      (event, data) => this.eventBus.emit(event as keyof RoomEvents, data)
    );

    // Initialize data provider based on configuration
    this.initializeDataProvider();

    // Setup controller wiring
    this.setupControllers();
  }

  /**
   * Initialize data provider based on configuration
   */
  private initializeDataProvider(): void {
    const dataProviderConfig = this.options.dataProvider;

    if (!dataProviderConfig) {
      // Default to WebSocket provider
      this.dataProvider = new WebSocketDataProvider(async (data, kind) =>
        this.signalingClient.sendData(data, kind)
      );
      logger.info('Using WebSocket data provider (default)');
      return;
    }

    // Check if it's a DataProviderType enum value
    if (typeof dataProviderConfig === 'string') {
      if (dataProviderConfig === SharedDataProviderType.WebSocket) {
        this.dataProvider = new WebSocketDataProvider(async (data, kind) =>
          this.signalingClient.sendData(data, kind)
        );
        logger.info('Using WebSocket data provider');
      } else if (dataProviderConfig === SharedDataProviderType.WebRTC) {
        // WebRTC provider requires WebRTC controller integration
        this.dataProvider = new WebRTCDataProvider({
          createDataProducer: async (config) => {
            // Integrate with WebRTC controller to create data producer
            await this.ensureWebRTCInitialized();
            return this.webRTCController.createDataProducer(
              config.label.includes('lossy') ? DataChannelKind.Lossy : DataChannelKind.Reliable,
              config
            );
          },
          closeDataProducer: async (producerId) => {
            // Integrate with WebRTC controller to close data producer
            return this.webRTCController.closeDataProducer(producerId);
          },
          onDataConsumer: (consumer) => {
            // Handle new data consumer
            logger.debug('Data consumer created via WebRTC', consumer);
          },
          onDataConsumerClosed: (consumerId) => {
            // Handle data consumer closed
            logger.debug('Data consumer closed via WebRTC', consumerId);
          },
        });
        logger.info('Using WebRTC data provider (experimental)');
      }
    } else {
      // Full configuration object
      if (dataProviderConfig.type === SharedDataProviderType.WebSocket) {
        this.dataProvider = new WebSocketDataProvider(
          async (data, kind) => this.signalingClient.sendData(data, kind),
          dataProviderConfig
        );
        logger.info('Using WebSocket data provider with custom config');
      } else if (dataProviderConfig.type === SharedDataProviderType.WebRTC) {
        this.dataProvider = new WebRTCDataProvider(
          {
            createDataProducer: async (config) => {
              // Integrate with WebRTC controller to create data producer
              await this.ensureWebRTCInitialized();
              return this.webRTCController.createDataProducer(
                config.label.includes('lossy') ? DataChannelKind.Lossy : DataChannelKind.Reliable,
                config
              );
            },
            closeDataProducer: async (producerId) => {
              // Integrate with WebRTC controller to close data producer
              return this.webRTCController.closeDataProducer(producerId);
            },
            onDataConsumer: (consumer) => {
              // Handle new data consumer
              logger.debug('Data consumer created via WebRTC', consumer);
            },
            onDataConsumerClosed: (consumerId) => {
              // Handle data consumer closed
              logger.debug('Data consumer closed via WebRTC', consumerId);
            },
          },
          dataProviderConfig
        );
        logger.info('Using WebRTC data provider with custom config (experimental)');
      }
    }
  }

  /**
   * Setup controller wiring
   */
  private setupControllers(): void {
    // Wire connection state changes to event bus
    this.connectionController.onStateChange((state) => {
      this.eventBus.emit('connection-state-changed', state);
    });

    // Wire connection errors to event bus
    this.connectionController.onError((error) => {
      this.eventBus.emit('error', error);
    });

    // Wire incoming messages to signaling client and WebRTC handlers
    this.connectionController.setMessageListener((message) => {
      this.eventBus.emit('message', message);
      this.signalingClient.handleMessage(message as Record<string, unknown>);
      // Also notify WebRTC message handlers
      this.webRTCController.getMessageHandlers().forEach((handler) => handler(message));
    });

    // Set client reference in signaling client for handlers
    this.signalingClient.setClient(this);
  }

  /**
   * Connect to the room
   */
  async connect(): Promise<void> {
    try {
      await this.connectionController.connect();
      this.signalingClient.sendJoin();

      // Initialize data provider (only WebSocket provider can be initialized now)
      // WebRTC provider will be initialized after WebRTC is ready
      if (this.dataProvider && this.dataProvider.type === SharedDataProviderType.WebSocket) {
        await this.dataProvider.initialize();
        // Wire data provider events to event bus
        this.dataProvider.on('data-received', (packet, participantSid) => {
          const participant = this.participantStore.getParticipant(participantSid);
          if (participant) {
            this.eventBus.emit('data-received', { data: packet, participant });
          }
        });
        this.dataProvider.on('error', (error) => {
          this.eventBus.emit('error', error);
        });
      }

      this.eventBus.emit('connection-state-changed', ConnectionState.Connected);
    } catch (error) {
      this.eventBus.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Initialize WebRTC data provider (called after WebRTC is ready)
   */
  public async initializeWebRTCDataProvider(): Promise<void> {
    if (this.dataProvider && this.dataProvider.type === SharedDataProviderType.WebRTC) {
      await this.dataProvider.initialize();
      // Wire data provider events to event bus
      this.dataProvider.on('data-received', (packet, participantSid) => {
        const participant = this.participantStore.getParticipant(participantSid);
        if (participant) {
          this.eventBus.emit('data-received', { data: packet, participant });
        }
      });
      this.dataProvider.on('error', (error) => {
        this.eventBus.emit('error', error);
      });
      logger.info('WebRTC data provider initialized');
    }
  }

  /**
   * Disconnect from the room
   */
  async disconnect(): Promise<void> {
    // Close data provider
    if (this.dataProvider) {
      await this.dataProvider.close();
      this.dataProvider = null;
    }

    // Stop all tracks
    this.trackController.stopAllLocalTracks();

    // Close WebRTC
    this.webRTCController.close();

    // Stop media
    this.mediaController.destroy();

    // Disconnect connection
    this.connectionController.disconnect();

    // Clear participants
    this.participantStore.clear();

    // Emit disconnected event
    this.eventBus.emit('disconnected');
    this.eventBus.emit('connection-state-changed', ConnectionState.Disconnected);
  }

  /**
   * Enable camera (video)
   * @param deviceId - Optional specific device ID to use. If not provided, uses default camera.
   */
  async enableCamera(deviceId?: string): Promise<void> {
    await this.ensureWebRTCInitialized();

    const localParticipant = this.participantStore.getLocalParticipant();
    if (!localParticipant) {
      throw new Error('Local participant not found');
    }

    // Create video track with optional device selection
    const videoTrack = deviceId
      ? await this.mediaController.switchVideoDevice(deviceId)
      : await this.mediaController.createVideoTrack();

    const mediaTrack = (videoTrack as LocalTrackImpl).mediaTrack;
    if (!mediaTrack) {
      throw new Error('Failed to create video track');
    }

    // Delegate to TrackController - handles all domain construction logic
    await this.trackController.enableCamera(mediaTrack);

    logger.info('Camera enabled', deviceId ? `device: ${deviceId}` : '');
  }

  /**
   * Disable camera (video)
   */
  async disableCamera(): Promise<void> {
    // Delegate to TrackController - handles cleanup
    await this.trackController.disableCamera();
  }

  /**
   * Enable microphone (audio)
   * @param deviceId - Optional specific device ID to use. If not provided, uses default microphone.
   */
  async enableMicrophone(deviceId?: string): Promise<void> {
    await this.ensureWebRTCInitialized();

    const localParticipant = this.participantStore.getLocalParticipant();
    if (!localParticipant) {
      throw new Error('Local participant not found');
    }

    // Create audio track with optional device selection
    const audioTrack = deviceId
      ? await this.mediaController.switchAudioDevice(deviceId)
      : await this.mediaController.createAudioTrack();

    const mediaTrack = (audioTrack as LocalTrackImpl).mediaTrack;
    if (!mediaTrack) {
      throw new Error('Failed to create audio track');
    }

    // Delegate to TrackController - handles all domain construction logic
    await this.trackController.enableMicrophone(mediaTrack);

    logger.info('Microphone enabled', deviceId ? `device: ${deviceId}` : '');
  }

  /**
   * Disable microphone (audio)
   */
  async disableMicrophone(): Promise<void> {
    // Delegate to TrackController - handles cleanup
    await this.trackController.disableMicrophone();
  }

  /**
   * List available microphones
   */
  async listAvailableMicrophones(): Promise<MediaDeviceInfo[]> {
    return this.mediaController.listAvailableMicrophones();
  }

  /**
   * List available cameras
   */
  async listAvailableCameras(): Promise<MediaDeviceInfo[]> {
    return this.mediaController.listAvailableCameras();
  }

  /**
   * Ensure WebRTC is initialized (public for handlers)
   */
  public async ensureWebRTCInitialized(): Promise<void> {
    if (this.webRTCController.isReady()) {
      return;
    }

    if (!this.rtpCapabilities) {
      throw new Error('RTP capabilities not available. Wait for connection.');
    }

    // Initialize media controller
    await this.mediaController.initialize();

    // Initialize WebRTC controller
    await this.webRTCController.initialize(this.rtpCapabilities);

    logger.info('WebRTC initialized');
  }

  /**
   * Get room info
   */
  getRoomInfo(): RoomInfo | null {
    return this.roomInfo;
  }

  /**
   * Get local participant
   */
  getLocalParticipant(): LocalParticipant | null {
    return this.participantStore.getLocalParticipant();
  }

  /**
   * Get all participants
   */
  getParticipants(): RemoteParticipant[] {
    return this.participantStore.getParticipants();
  }

  /**
   * Get participant by SID
   */
  getParticipant(sid: string): RemoteParticipant | null {
    return this.participantStore.getParticipant(sid);
  }

  /**
   * Get participant by identity
   */
  getParticipantByIdentity(identity: string): RemoteParticipant | null {
    return this.participantStore.getParticipantByIdentity(identity);
  }

  /**
   * Subscribe to a track
   */
  async subscribeToTrack(
    sid: string,
    options?: TrackSubscribeOptions
  ): Promise<RemoteTrack | null> {
    logger.debug('subscribeToTrack called with sid:', sid);
    return this.trackController.subscribeToTrack(sid, options);
  }

  /**
   * Unsubscribe from a track
   */
  async unsubscribeFromTrack(sid: string): Promise<void> {
    await this.trackController.unsubscribeFromTrack(sid);
  }

  /**
   * Subscribe to all tracks
   */
  async subscribeToAllTracks(options?: TrackSubscribeOptions): Promise<void> {
    const promises: Promise<void>[] = [];

    this.participantStore.getParticipants().forEach((participant) => {
      participant.getTracks().forEach((track: RemoteTrackPublication) => {
        promises.push(
          this.subscribeToTrack(track.sid, options).then(() => {
            // Ignore result
          })
        );
      });
    });

    await Promise.all(promises);
  }

  /**
   * Unsubscribe from all tracks
   */
  async unsubscribeFromAllTracks(): Promise<void> {
    const promises: Promise<void>[] = [];

    this.participantStore.getParticipants().forEach((participant) => {
      participant.getTracks().forEach((track: RemoteTrackPublication) => {
        promises.push(this.unsubscribeFromTrack(track.sid));
      });
    });

    await Promise.all(promises);
  }

  /**
   * Send data to all participants
   */
  async sendData(data: unknown, kind: 'reliable' | 'lossy' = 'reliable'): Promise<void> {
    if (!this.dataProvider) {
      throw new Error('Data provider not initialized');
    }

    await this.dataProvider.send(data, kind as DataChannelKind);
  }

  /**
   * Add event listener
   */
  on<K extends keyof RoomEvents>(event: K, listener: RoomEvents[K]): void {
    this.eventBus.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof RoomEvents>(event: K, listener: RoomEvents[K]): void {
    this.eventBus.off(event, listener);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventBus.removeAllListeners();
  }

  /**
   * Get RTP capabilities
   */
  public getRtpCapabilities(): RtpCapabilities | null {
    return this.rtpCapabilities;
  }

  /**
   * Emit event (public for handlers)
   */
  public emit<K extends keyof RoomEvents>(event: K, data?: unknown): void {
    this.eventBus.emit(event, data);
  }

  /**
   * Set room info (called by handlers)
   */
  public setRoomInfo(info: RoomInfo): void {
    this.roomInfo = info;
  }

  /**
   * Set RTP capabilities (called by handlers)
   */
  public setRtpCapabilities(capabilities: RtpCapabilities | null): void {
    this.rtpCapabilities = capabilities;
  }

  /**
   * Set local participant (called by handlers)
   */
  public setLocalParticipant(participant: LocalParticipantImpl): void {
    this.participantStore.setLocalParticipant(participant);
  }

  /**
   * Add participant (called by handlers)
   */
  public addParticipant(participant: RemoteParticipantImpl): void {
    this.participantStore.addParticipant(participant);
  }

  /**
   * Remove participant (called by handlers)
   */
  public removeParticipant(sid: string): RemoteParticipantImpl | null {
    return this.participantStore.removeParticipant(sid);
  }

  /**
   * Send message via WebSocket (public for handlers and WebRTC)
   */
  public send(message: Record<string, unknown>): void {
    this.connectionController.send(message);
  }

  /**
   * Get the WebRTC controller (public for handlers)
   */
  public getWebRTCController(): WebRTCController | null {
    return this.webRTCController;
  }
}
