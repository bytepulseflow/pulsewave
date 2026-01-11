/**
 * PulseMediaTrack - Unified component for rendering audio and video tracks
 *
 * Does NOT stop tracks - they are managed by mediasoup producer/consumer.
 */

import { useEffect, useRef, useState } from 'react';
import type { LocalTrackPublication, RemoteTrackPublication } from '../types';
import { AvatarPulse } from './AvatarPulse';

interface PulseMediaTrackProps {
  publication: LocalTrackPublication | RemoteTrackPublication | null;
  className?: string;
  videoClassName?: string;
  muted?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
  onVideoElement?: (element: HTMLVideoElement | null) => void;
  onAudioElement?: (element: HTMLAudioElement | null) => void;
  avatarUrl?: string;
  fallbackName?: string;
  hasVideo?: boolean;
}

/**
 * PulseMediaTrack component - Renders audio or video track based on publication kind
 */
export function PulseMediaTrack({
  publication,
  className = '',
  videoClassName = '',
  muted = false,
  objectFit = 'cover',
  onVideoElement,
  onAudioElement,
  fallbackName,
  avatarUrl,
}: PulseMediaTrackProps): JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);

  const track = publication?.track;
  const kind = publication?.kind;

  // Attach video track
  useEffect(() => {
    if (kind !== 'video') {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        setIsVideoLoaded(false);
        setHasVideoError(false);
      }
      videoStreamRef.current = null;
      return;
    }

    if (!track) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        setIsVideoLoaded(false);
        setHasVideoError(false);
      }
      videoStreamRef.current = null;
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    // Reuse existing stream if track hasn't changed
    const currentTrackId = videoStreamRef.current?.getTracks()[0]?.id;
    if (videoStreamRef.current && currentTrackId === track.mediaTrack.id) {
      videoElement.muted = muted;
      return;
    }

    videoStreamRef.current = null;

    const stream = new MediaStream([track.mediaTrack]);
    videoStreamRef.current = stream;

    setIsVideoLoaded(false);
    setHasVideoError(false);

    videoElement.srcObject = stream;
    videoElement.muted = muted;

    const onLoadedMetadata = (): void => {
      setIsVideoLoaded(true);
      videoElement.play().catch((error) => {
        console.error('Failed to play video:', error);
        setHasVideoError(true);
      });
    };

    const onError = (): void => {
      setHasVideoError(true);
    };

    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    videoElement.addEventListener('error', onError);

    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('error', onError);
      videoElement.srcObject = null;
      videoStreamRef.current = null;
      setIsVideoLoaded(false);
      setHasVideoError(false);
    };
  }, [track, kind, muted]);

  // Attach audio track
  useEffect(() => {
    if (kind !== 'audio' || !track) {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      audioStreamRef.current = null;
      return;
    }

    const audioElement = audioRef.current;
    if (!audioElement) return;

    const currentTrackId = audioStreamRef.current?.getTracks()[0]?.id;
    if (audioStreamRef.current && currentTrackId === track.mediaTrack.id) {
      audioElement.muted = muted || !track.mediaTrack.enabled;
      return;
    }

    audioStreamRef.current = null;

    const stream = new MediaStream([track.mediaTrack]);
    audioStreamRef.current = stream;

    audioElement.srcObject = stream;
    audioElement.muted = muted || !track.mediaTrack.enabled;

    // Poll for enabled state changes instead of relying on enabledchange event
    const enabledCheckInterval = setInterval(() => {
      if (audioElement && track) {
        const shouldBeMuted = muted || !track.mediaTrack.enabled;
        if (audioElement.muted !== shouldBeMuted) {
          audioElement.muted = shouldBeMuted;
          if (!shouldBeMuted) {
            audioElement.play().catch((error) => {
              console.error('Failed to play audio:', error);
            });
          }
        }
      }
    }, 100);

    return () => {
      clearInterval(enabledCheckInterval);
      audioElement.srcObject = null;
      audioStreamRef.current = null;
    };
  }, [track, kind, muted]);

  useEffect(() => {
    if (kind === 'video' && onVideoElement && videoRef.current) {
      onVideoElement(videoRef.current);
    }
  }, [kind, onVideoElement]);

  useEffect(() => {
    if (kind === 'audio' && onAudioElement && audioRef.current) {
      onAudioElement(audioRef.current);
    }
  }, [kind, onAudioElement]);

  if (!publication || !track) {
    return (
      <div className="no-video-container">
        <AvatarPulse audioTrack={null} fallbackName={fallbackName} avatarUrl={avatarUrl} />
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className={`pulsewave-media-track pulsewave-media-track--audio ${className}`}>
        <audio muted={muted} ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className={`pulsewave-media-track pulsewave-media-track--video ${className}`}>
        <video
          ref={videoRef}
          className={`pulsewave-video-track ${videoClassName} ${isVideoLoaded ? 'loaded' : 'loading'} ${hasVideoError ? 'error' : ''}`}
          style={{ objectFit }}
          autoPlay
          playsInline
          muted={muted}
        />
        {!isVideoLoaded && !hasVideoError && (
          <div className="pulsewave-video-skeleton">
            <div className="skeleton-shimmer" />
          </div>
        )}
        {hasVideoError && (
          <div className="pulsewave-video-error">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Video unavailable</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
