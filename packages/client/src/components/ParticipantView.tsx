/**
 * ParticipantView - Component for rendering a participant with their tracks
 */

import { useEffect, useState } from 'react';
import type { Participant } from '../types';
import { VideoTrack } from './VideoTrack';
import { AudioTrack } from './AudioTrack';

interface ParticipantViewProps {
  participant: Participant;
  className?: string;
  videoClassName?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  showAudioIndicator?: boolean;
  showIdentity?: boolean;
  onVideoElement?: (element: HTMLVideoElement | null) => void;
}

/**
 * ParticipantView component - Renders a participant with their tracks
 */
export function ParticipantView({
  participant,
  className = '',
  videoClassName = '',
  objectFit = 'contain',
  showAudioIndicator = true,
  showIdentity = true,
  onVideoElement,
}: ParticipantViewProps): JSX.Element | null {
  const [tracks, setTracks] = useState(() => participant.getTracks());

  // Update tracks when participant changes or when tracks are updated
  useEffect(() => {
    const updateTracks = () => {
      const currentTracks = participant.getTracks();
      console.log(
        'ParticipantView - Updating tracks for participant:',
        participant.identity,
        currentTracks.map((t) => ({
          sid: t.sid,
          kind: t.kind,
          hasTrack: !!t.track,
          subscribed: t.subscribed,
        }))
      );
      setTracks(currentTracks);
    };

    // Initial update
    updateTracks();

    // Listen for track changes
    const handleTrackPublished = (publication: any) => {
      console.log('ParticipantView - Track published event:', publication);
      updateTracks();
    };

    const handleTrackSubscribed = (publication: any) => {
      console.log(
        'ParticipantView - Track subscribed event:',
        publication.sid,
        'hasTrack:',
        !!publication.track
      );
      updateTracks();
    };

    const handleTrackUnpublished = () => {
      console.log('ParticipantView - Track unpublished event');
      updateTracks();
    };

    participant.on('track-published', handleTrackPublished);
    participant.on('track-subscribed', handleTrackSubscribed);
    participant.on('track-unpublished', handleTrackUnpublished);

    return () => {
      participant.off('track-published', handleTrackPublished);
      participant.off('track-subscribed', handleTrackSubscribed);
      participant.off('track-unpublished', handleTrackUnpublished);
    };
  }, [participant]);

  // Derive video and audio tracks from current tracks state
  const videoTracks = tracks
    .filter((t) => t.track && t.track.kind === 'video')
    .map((t) => ({ track: t.track, sid: t.sid }));
  const audioTracks = tracks
    .filter((t) => t.track && t.track.kind === 'audio')
    .map((t) => ({ track: t.track, sid: t.sid }));

  console.log(
    'ParticipantView render - videoTracks:',
    videoTracks.length,
    'audioTracks:',
    audioTracks.length
  );

  const hasAudio = audioTracks.length > 0;
  const isAudioMuted = hasAudio && audioTracks.some((t) => t.track?.isMuted);

  if (!participant) {
    return null;
  }

  const displayName = participant.name || participant.identity;

  return (
    <div className={`participant-view ${className}`}>
      {/* Video tracks */}
      {videoTracks.length > 0 ? (
        <div className="participant-video">
          {videoTracks.map(({ track, sid }) => {
            if (!track) return null;
            return (
              <VideoTrack
                key={sid}
                track={track}
                className={videoClassName}
                objectFit={objectFit}
                onVideoElement={onVideoElement}
              />
            );
          })}
        </div>
      ) : (
        <div className="participant-placeholder">
          <div className="placeholder-avatar">{displayName.charAt(0).toUpperCase()}</div>
        </div>
      )}

      {/* Audio tracks (hidden) */}
      {audioTracks.map(({ track, sid }) => {
        if (!track) return null;
        return <AudioTrack key={sid} track={track} />;
      })}

      {/* Audio indicator */}
      {showAudioIndicator && hasAudio && (
        <div className="participant-audio-indicator">
          {isAudioMuted ? (
            <span className="audio-muted">🔇</span>
          ) : (
            <span className="audio-active">🔊</span>
          )}
        </div>
      )}

      {/* Identity display */}
      {showIdentity && (
        <div className="participant-identity">
          <span className="participant-name">{displayName}</span>
        </div>
      )}
    </div>
  );
}
