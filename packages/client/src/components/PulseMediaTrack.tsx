/**
 * PulseMediaTrack - Unified component for rendering audio and video tracks
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
  hasVideo,
}: PulseMediaTrackProps): JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);

  const track = publication?.track;
  const kind = publication?.kind;

  // Attach video track
  useEffect(() => {
    if (kind !== 'video' || !track) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    const stream = new MediaStream();
    stream.addTrack(track.mediaTrack);

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
      setIsVideoLoaded(false);
      setHasVideoError(false);
    };
  }, [track, kind, muted]);

  // Attach audio track
  useEffect(() => {
    if (kind !== 'audio' || !track) return;

    const audioElement = audioRef.current;
    if (!audioElement) return;

    const stream = new MediaStream();
    stream.addTrack(track.mediaTrack);

    audioElement.srcObject = stream;

    return () => {
      audioElement.srcObject = null;
    };
  }, [track, kind]);

  // Callbacks
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

  if (!publication) {
    return (
      <div className="no-video-container">
        <AvatarPulse stream={null} fallbackName={fallbackName} avatarUrl={avatarUrl} />
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className={`pulsewave-media-track pulsewave-media-track--audio ${className}`}>
        <audio muted={muted} ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
        {!hasVideo && (
          <div className="no-video-container">
            <AvatarPulse
              stream={track ? new MediaStream([track.mediaTrack]) : null}
              fallbackName={fallbackName}
              avatarUrl={avatarUrl}
            />
          </div>
        )}
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
