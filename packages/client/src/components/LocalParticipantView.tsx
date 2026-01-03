/**
 * LocalParticipantView - Component for rendering local participant with controls
 */

import { useState } from 'react';
import type { LocalParticipant, LocalTrack } from '../types';
import { VideoTrack } from './VideoTrack';
import { AudioTrack } from './AudioTrack';

interface LocalParticipantViewProps {
  participant: LocalParticipant;
  className?: string;
  videoClassName?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  showIdentity?: boolean;
  onVideoElement?: (element: HTMLVideoElement | null) => void;
}

/**
 * LocalParticipantView component - Renders local participant with controls
 */
export function LocalParticipantView({
  participant,
  className = '',
  videoClassName = '',
  objectFit = 'contain',
  showIdentity = true,
  onVideoElement,
}: LocalParticipantViewProps): JSX.Element | null {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraMuted, setIsCameraMuted] = useState(false);

  const videoTracks = participant.getTracks().filter((t) => t.track && t.track.kind === 'video');
  const audioTracks = participant.getTracks().filter((t) => t.track && t.track.kind === 'audio');

  const mainVideoTrack: LocalTrack | undefined = videoTracks[0]?.track as LocalTrack;
  const mainAudioTrack: LocalTrack | undefined = audioTracks[0]?.track as LocalTrack;

  const toggleMic = async (): Promise<void> => {
    if (mainAudioTrack) {
      const newState = !isMicMuted;
      if (newState) {
        await mainAudioTrack.mute();
      } else {
        await mainAudioTrack.unmute();
      }
      setIsMicMuted(newState);
    }
  };

  const toggleCamera = async (): Promise<void> => {
    if (mainVideoTrack) {
      const newState = !isCameraMuted;
      if (newState) {
        await mainVideoTrack.mute();
      } else {
        await mainVideoTrack.unmute();
      }
      setIsCameraMuted(newState);
    }
  };

  if (!participant) {
    return null;
  }

  const displayName = participant.name || participant.identity;

  return (
    <div className={`local-participant-view ${className}`}>
      {/* Video track */}
      {mainVideoTrack ? (
        <div className="local-participant-video">
          <VideoTrack
            track={mainVideoTrack}
            className={videoClassName}
            objectFit={objectFit}
            muted={true}
            onVideoElement={onVideoElement}
          />
        </div>
      ) : (
        <div className="local-participant-placeholder">
          <div className="placeholder-avatar">{displayName.charAt(0).toUpperCase()}</div>
        </div>
      )}

      {/* Audio track (hidden) */}
      {mainAudioTrack && <AudioTrack track={mainAudioTrack} />}

      {/* Controls */}
      <div className="local-participant-controls">
        <button
          type="button"
          className={`control-button mic-button ${isMicMuted ? 'muted' : ''}`}
          onClick={toggleMic}
          disabled={!mainAudioTrack}
          aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMicMuted ? '🔇' : '🎤'}
        </button>
        <button
          type="button"
          className={`control-button camera-button ${isCameraMuted ? 'muted' : ''}`}
          onClick={toggleCamera}
          disabled={!mainVideoTrack}
          aria-label={isCameraMuted ? 'Enable camera' : 'Disable camera'}
        >
          {isCameraMuted ? '📷' : '📹'}
        </button>
      </div>

      {/* Identity display */}
      {showIdentity && (
        <div className="local-participant-identity">
          <span className="participant-name">{displayName}</span>
          <span className="participant-badge">You</span>
        </div>
      )}
    </div>
  );
}
