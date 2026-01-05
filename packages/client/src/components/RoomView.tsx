/**
 * RoomView - Component for rendering a room with all participants
 */

import { useMemo } from 'react';
import { useParticipants, useLocalParticipant, useConnectionState } from '../hooks';

import { ParticipantView } from './ParticipantView';
import { LocalParticipantView } from './LocalParticipantView';

interface RoomViewProps {
  className?: string;
  videoClassName?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  showAudioIndicator?: boolean;
  showIdentity?: boolean;
  showLocalParticipant?: boolean;
  showSpeakingIndicator?: boolean;
  layout?: 'grid' | 'list' | 'spotlight';
  maxColumns?: number;
}

/**
 * ConnectionStatus - Display connection state
 */
function ConnectionStatus({ state }: { state: string }): JSX.Element {
  const statusConfig: Record<string, { label: string; icon: JSX.Element; className: string }> = {
    disconnected: {
      label: 'Disconnected',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      ),
      className: 'pulsewave-connection-status--disconnected',
    },
    connecting: {
      label: 'Connecting...',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      ),
      className: 'pulsewave-connection-status--connecting',
    },
    connected: {
      label: 'Connected',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      ),
      className: 'pulsewave-connection-status--connected',
    },
    reconnecting: {
      label: 'Reconnecting...',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      ),
      className: 'pulsewave-connection-status--reconnecting',
    },
  };

  const config = statusConfig[state] || statusConfig.disconnected;

  return (
    <div className={`pulsewave-connection-status ${config.className}`}>
      <span className="pulsewave-connection-status__icon">{config.icon}</span>
      <span className="pulsewave-connection-status__label">{config.label}</span>
    </div>
  );
}

/**
 * ParticipantCount - Display participant count
 */
function ParticipantCount({ local, remote }: { local: number; remote: number }): JSX.Element {
  const total = local + remote;

  return (
    <div className="pulsewave-participant-count">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span className="pulsewave-participant-count__number">{total}</span>
      <span className="pulsewave-participant-count__label">
        {total === 1 ? 'participant' : 'participants'}
      </span>
    </div>
  );
}

/**
 * RoomView component - Renders a room with all participants
 */
export function RoomView({
  className = '',
  videoClassName = '',
  objectFit = 'contain',
  showAudioIndicator = true,
  showIdentity = true,
  showLocalParticipant = true,
  showSpeakingIndicator = true,
  layout = 'grid',
  maxColumns,
}: RoomViewProps): JSX.Element | null {
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();

  // Calculate grid columns based on participant count
  const gridStyle = useMemo(() => {
    const totalParticipants = (showLocalParticipant ? 1 : 0) + participants.length;

    if (layout === 'grid') {
      const columns = maxColumns || Math.min(Math.ceil(Math.sqrt(totalParticipants)), 4);
      return {
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      };
    }

    return undefined;
  }, [layout, maxColumns, showLocalParticipant, participants.length]);

  const layoutClassName = `pulsewave-room-view--${layout}`;

  return (
    <div className={`pulsewave-room-view ${layoutClassName} ${className}`}>
      {/* Header with status and participant count */}
      <div className="pulsewave-room-view__header">
        <ConnectionStatus state={connectionState} />
        <ParticipantCount
          local={showLocalParticipant && localParticipant ? 1 : 0}
          remote={participants.length}
        />
      </div>

      {/* Participants container */}
      <div className="pulsewave-room-view__participants" style={gridStyle}>
        {/* Local participant */}
        {showLocalParticipant && localParticipant && (
          <div className="pulsewave-room-view__participant pulsewave-room-view__participant--local">
            <LocalParticipantView
              participant={localParticipant}
              videoClassName={videoClassName}
              objectFit={objectFit}
              showIdentity={showIdentity}
              showControls={true}
            />
          </div>
        )}

        {/* Remote participants */}
        {participants.map((participant) => (
          <div
            key={participant.sid}
            className="pulsewave-room-view__participant pulsewave-room-view__participant--remote"
          >
            <ParticipantView
              participant={participant}
              videoClassName={videoClassName}
              objectFit={objectFit}
              showAudioIndicator={showAudioIndicator}
              showIdentity={showIdentity}
              showSpeakingIndicator={showSpeakingIndicator}
            />
          </div>
        ))}

        {/* Empty state */}
        {!showLocalParticipant && participants.length === 0 && (
          <div className="pulsewave-room-view__empty">
            <div className="pulsewave-room-view__empty-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="pulsewave-room-view__empty-title">No participants yet</h3>
            <p className="pulsewave-room-view__empty-description">
              Waiting for others to join the room
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
