/**
 * LocalParticipantView - Component for rendering local participant with controls
 */

import { useState, useEffect } from 'react';
import type { LocalParticipant, LocalTrack } from '../types';
import type { RoomClient } from '../client/RoomClient';
import { VideoTrack } from './VideoTrack';
import { AudioTrack } from './AudioTrack';

interface LocalParticipantViewProps {
  participant: LocalParticipant;
  room: RoomClient | null;
  className?: string;
  videoClassName?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  showIdentity?: boolean;
  showControls?: boolean;
  onVideoElement?: (element: HTMLVideoElement | null) => void;
}

interface ControlButtonProps {
  icon: JSX.Element;
  activeIcon?: JSX.Element;
  isActive: boolean;
  isDisabled: boolean;
  onClick: () => void;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * ControlButton - Individual control button component
 */
function ControlButton({
  icon,
  activeIcon,
  isActive,
  isDisabled,
  onClick,
  label,
  variant = 'primary',
}: ControlButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`pulsewave-control-button pulsewave-control-button--${variant} ${
        isActive ? 'pulsewave-control-button--active' : ''
      } ${isDisabled ? 'pulsewave-control-button--disabled' : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={label}
      title={label}
    >
      {isActive && activeIcon ? activeIcon : icon}
      <span className="pulsewave-control-button__tooltip">{label}</span>
    </button>
  );
}

/**
 * LocalParticipantView component - Renders local participant with controls
 */
export function LocalParticipantView({
  participant,
  room,
  className = '',
  videoClassName = '',
  objectFit = 'contain',
  showIdentity = true,
  showControls = true,
  onVideoElement,
}: LocalParticipantViewProps): JSX.Element | null {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [tracksVersion, setTracksVersion] = useState(0);

  const videoTracks = participant.getTracks().filter((t) => t.track && t.track.kind === 'video');
  const audioTracks = participant.getTracks().filter((t) => t.track && t.track.kind === 'audio');

  const mainVideoTrack: LocalTrack | undefined = videoTracks[0]?.track as LocalTrack;
  const mainAudioTrack: LocalTrack | undefined = audioTracks[0]?.track as LocalTrack;

  // Listen for track changes to force re-render
  useEffect(() => {
    const handleTrackChange = () => {
      setTracksVersion((v) => v + 1);
      // Reset toggling state when tracks change
      setIsToggling(false);
    };

    participant.on('track-published', handleTrackChange as () => void);
    participant.on('track-unpublished', handleTrackChange as () => void);
    participant.on('track-muted', handleTrackChange as () => void);
    participant.on('track-unmuted', handleTrackChange as () => void);

    return () => {
      participant.off('track-published', handleTrackChange as () => void);
      participant.off('track-unpublished', handleTrackChange as () => void);
      participant.off('track-muted', handleTrackChange as () => void);
      participant.off('track-unmuted', handleTrackChange as () => void);
    };
  }, [participant]);

  // Sync mute state with actual track state
  useEffect(() => {
    if (mainAudioTrack) {
      setIsMicMuted(mainAudioTrack.isMuted);
      setHasAudio(true);
    } else {
      setHasAudio(false);
      setIsMicMuted(false);
    }
  }, [mainAudioTrack, tracksVersion]);

  useEffect(() => {
    if (mainVideoTrack) {
      setIsCameraMuted(mainVideoTrack.isMuted);
      setHasVideo(true);
    } else {
      setHasVideo(false);
      setIsCameraMuted(false);
    }
  }, [mainVideoTrack, tracksVersion]);

  const toggleMic = async (): Promise<void> => {
    if (isToggling || !room) return;

    setIsToggling(true);
    try {
      if (hasAudio && mainAudioTrack) {
        // Mute/unmute existing track
        const newState = !isMicMuted;
        if (newState) {
          await mainAudioTrack.mute();
        } else {
          await mainAudioTrack.unmute();
        }
        setIsMicMuted(newState);
      } else {
        // Enable microphone
        await room.enableMicrophone();
        setIsMicMuted(false);
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const toggleCamera = async (): Promise<void> => {
    if (isToggling || !room) return;

    setIsToggling(true);
    try {
      if (hasVideo && mainVideoTrack) {
        // Disable camera properly (not just mute)
        await room.disableCamera();
      } else {
        // Enable camera
        await room.enableCamera();
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
    } finally {
      setIsToggling(false);
    }
  };

  if (!participant) {
    return null;
  }

  const displayName = participant.name || participant.identity;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Determine button states
  const isMicOff = !hasAudio || isMicMuted;
  const isCameraOff = !hasVideo || isCameraMuted;

  return (
    <div className={`pulsewave-local-participant ${className}`}>
      {/* Video/placeholder container */}
      <div className="pulsewave-local-participant__media">
        {mainVideoTrack ? (
          <div className="pulsewave-local-participant__video">
            <VideoTrack
              track={mainVideoTrack}
              className={videoClassName}
              objectFit={objectFit}
              muted={true}
              onVideoElement={onVideoElement}
            />
          </div>
        ) : (
          <div className="pulsewave-local-participant__placeholder">
            <div className="pulsewave-avatar pulsewave-avatar--large">
              <span className="pulsewave-avatar__initials">{initials}</span>
            </div>
            <div className="pulsewave-local-participant__placeholder-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </div>
        )}

        {/* Audio track (hidden) */}
        {mainAudioTrack && <AudioTrack track={mainAudioTrack} />}

        {/* Status badges */}
        <div className="pulsewave-local-participant__badges">
          {isCameraOff && (
            <div className="pulsewave-badge pulsewave-badge--camera-off">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 21l-3-3m-8.5-8.5L5 5m4 4l3 3m-5 5l-3-3" />
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          )}
          {isMicOff && (
            <div className="pulsewave-badge pulsewave-badge--mic-off">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      {showControls && (
        <div className="pulsewave-local-participant__controls">
          <ControlButton
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            }
            activeIcon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            }
            isActive={isMicOff}
            isDisabled={isToggling || !room}
            onClick={toggleMic}
            label={isMicOff ? 'Enable microphone' : 'Mute microphone'}
            variant={isMicOff ? 'danger' : 'primary'}
          />
          <ControlButton
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            }
            activeIcon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 21l-3-3m-8.5-8.5L5 5m4 4l3 3m-5 5l-3-3" />
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              </svg>
            }
            isActive={isCameraOff}
            isDisabled={isToggling || !room}
            onClick={toggleCamera}
            label={isCameraOff ? 'Enable camera' : 'Disable camera'}
            variant={isCameraOff ? 'danger' : 'primary'}
          />
        </div>
      )}

      {/* Identity display */}
      {showIdentity && (
        <div className="pulsewave-local-participant__identity">
          <span className="pulsewave-local-participant__name">{displayName}</span>
          <span className="pulsewave-badge pulsewave-badge--you">You</span>
        </div>
      )}
    </div>
  );
}
