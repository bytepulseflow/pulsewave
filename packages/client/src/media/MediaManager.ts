/**
 * MediaManager - Handles device enumeration and media stream acquisition
 */

import type { MediaTrackOptions } from '../types';
import { TrackKind, TrackSource } from '@bytepulse/pulsewave-shared';
import { LocalTrack } from '../domain/LocalTrack';
import type { TrackInfo } from '@bytepulse/pulsewave-shared';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('media-manager');

/**
 * MediaManager - Handles device enumeration and media stream acquisition
 */
export class MediaManager {
  private audioInputDevices: MediaDeviceInfo[] = [];
  private videoInputDevices: MediaDeviceInfo[] = [];
  private audioOutputDevices: MediaDeviceInfo[] = [];
  private currentAudioTrack: MediaStreamTrack | null = null;
  private currentVideoTrack: MediaStreamTrack | null = null;
  private currentScreenTrack: MediaStreamTrack | null = null;

  /**
   * Initialize the media manager and enumerate devices
   */
  async initialize(): Promise<void> {
    await this.enumerateDevices();
  }

  /**
   * Enumerate available media devices
   */
  async enumerateDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      this.audioInputDevices = devices.filter((d) => d.kind === 'audioinput');
      this.videoInputDevices = devices.filter((d) => d.kind === 'videoinput');
      this.audioOutputDevices = devices.filter((d) => d.kind === 'audiooutput');
    } catch (error) {
      logger.error('Failed to enumerate devices', { error });
      throw error;
    }
  }

  /**
   * Get audio input devices
   */
  getAudioInputDevices(): MediaDeviceInfo[] {
    return this.audioInputDevices;
  }

  /**
   * Get video input devices
   */
  getVideoInputDevices(): MediaDeviceInfo[] {
    return this.videoInputDevices;
  }

  /**
   * Get audio output devices
   */
  getAudioOutputDevices(): MediaDeviceInfo[] {
    return this.audioOutputDevices;
  }

  /**
   * Get user media (camera and/or microphone)
   */
  async getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      logger.error('Failed to get user media', { error });
      throw error;
    }
  }

  /**
   * Get display media (screen share)
   */
  async getDisplayMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (error) {
      logger.error('Failed to get display media', { error });
      throw error;
    }
  }

  /**
   * Create a local audio track
   */
  async createAudioTrack(options?: MediaTrackOptions): Promise<LocalTrack> {
    const constraints: MediaTrackConstraints = options?.audioConstraints || {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    const stream = await this.getUserMedia({ audio: constraints });
    const track = stream.getAudioTracks()[0];

    this.currentAudioTrack = track;

    const trackInfo: TrackInfo = {
      sid: this.generateTrackSid(),
      kind: TrackKind.Audio,
      source: TrackSource.Microphone,
      muted: false,
      simulcast: false,
    };

    return new LocalTrack(trackInfo, track);
  }

  /**
   * Create a local video track
   */
  async createVideoTrack(options?: MediaTrackOptions): Promise<LocalTrack> {
    const constraints: MediaTrackConstraints = options?.videoConstraints || {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
    };

    const stream = await this.getUserMedia({ video: constraints });
    const track = stream.getVideoTracks()[0];

    this.currentVideoTrack = track;

    const trackInfo: TrackInfo = {
      sid: this.generateTrackSid(),
      kind: TrackKind.Video,
      source: TrackSource.Camera,
      muted: false,
      simulcast: options?.simulcast || false,
      width: track.getSettings().width,
      height: track.getSettings().height,
    };

    return new LocalTrack(trackInfo, track);
  }

  /**
   * Create a screen share track
   */
  async createScreenShareTrack(_options?: MediaTrackOptions): Promise<LocalTrack> {
    const constraints: MediaStreamConstraints = {
      video: {
        cursor: 'always',
      } as MediaTrackConstraints,
      audio: false,
    };

    const stream = await this.getDisplayMedia(constraints);
    const videoTrack = stream.getVideoTracks()[0];

    this.currentScreenTrack = videoTrack;

    // Handle screen share stop
    videoTrack.onended = () => {
      this.currentScreenTrack = null;
    };

    const trackInfo: TrackInfo = {
      sid: this.generateTrackSid(),
      kind: TrackKind.Video,
      source: TrackSource.ScreenShare,
      muted: false,
      simulcast: false,
      width: videoTrack.getSettings().width,
      height: videoTrack.getSettings().height,
    };

    return new LocalTrack(trackInfo, videoTrack);
  }

  /**
   * Create a screen share track with audio
   */
  async createScreenShareWithAudioTrack(_options?: MediaTrackOptions): Promise<{
    video: LocalTrack;
    audio: LocalTrack;
  }> {
    const constraints: MediaStreamConstraints = {
      video: {
        cursor: 'always',
      } as MediaTrackConstraints,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as MediaTrackConstraints,
    };

    const stream = await this.getDisplayMedia(constraints);
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    this.currentScreenTrack = videoTrack;

    // Handle screen share stop
    videoTrack.onended = () => {
      this.currentScreenTrack = null;
    };

    const videoTrackInfo: TrackInfo = {
      sid: this.generateTrackSid(),
      kind: TrackKind.Video,
      source: TrackSource.ScreenShare,
      muted: false,
      simulcast: false,
      width: videoTrack.getSettings().width,
      height: videoTrack.getSettings().height,
    };

    const audioTrackInfo: TrackInfo = {
      sid: this.generateTrackSid(),
      kind: TrackKind.Audio,
      source: TrackSource.ScreenShareAudio,
      muted: false,
      simulcast: false,
    };

    return {
      video: new LocalTrack(videoTrackInfo, videoTrack),
      audio: new LocalTrack(audioTrackInfo, audioTrack),
    };
  }

  /**
   * Stop current audio track
   */
  stopAudioTrack(): void {
    if (this.currentAudioTrack) {
      this.currentAudioTrack.stop();
      this.currentAudioTrack = null;
    }
  }

  /**
   * Stop current video track
   */
  stopVideoTrack(): void {
    if (this.currentVideoTrack) {
      this.currentVideoTrack.stop();
      this.currentVideoTrack = null;
    }
  }

  /**
   * Stop current screen share track
   */
  stopScreenShareTrack(): void {
    if (this.currentScreenTrack) {
      this.currentScreenTrack.stop();
      this.currentScreenTrack = null;
    }
  }

  /**
   * Stop all tracks
   */
  stopAllTracks(): void {
    this.stopAudioTrack();
    this.stopVideoTrack();
    this.stopScreenShareTrack();
  }

  /**
   * Switch audio input device
   */
  async switchAudioDevice(deviceId: string): Promise<LocalTrack> {
    this.stopAudioTrack();

    const constraints: MediaTrackConstraints = {
      deviceId: { exact: deviceId },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    const stream = await this.getUserMedia({ audio: constraints });
    const track = stream.getAudioTracks()[0];

    this.currentAudioTrack = track;

    const trackInfo: TrackInfo = {
      sid: this.generateTrackSid(),
      kind: TrackKind.Audio,
      source: TrackSource.Microphone,
      muted: false,
      simulcast: false,
    };

    return new LocalTrack(trackInfo, track);
  }

  /**
   * Switch video input device
   */
  async switchVideoDevice(deviceId: string): Promise<LocalTrack> {
    this.stopVideoTrack();

    const constraints: MediaTrackConstraints = {
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };

    const stream = await this.getUserMedia({ video: constraints });
    const track = stream.getVideoTracks()[0];

    this.currentVideoTrack = track;

    const trackInfo: TrackInfo = {
      sid: this.generateTrackSid(),
      kind: TrackKind.Video,
      source: TrackSource.Camera,
      muted: false,
      simulcast: false,
      width: track.getSettings().width,
      height: track.getSettings().height,
    };

    return new LocalTrack(trackInfo, track);
  }

  /**
   * Check if camera permission is granted
   */
  async hasCameraPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted';
    } catch (error) {
      // Fallback: try to get a track and immediately stop it
      try {
        const stream = await this.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if microphone permission is granted
   */
  async hasMicrophonePermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state === 'granted';
    } catch (error) {
      // Fallback: try to get a track and immediately stop it
      try {
        const stream = await this.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Request camera permission
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      const stream = await this.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      logger.error('Camera permission denied', { error });
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await this.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      logger.error('Microphone permission denied', { error });
      return false;
    }
  }

  /**
   * Generate a unique track SID
   */
  private generateTrackSid(): string {
    return `TR_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
