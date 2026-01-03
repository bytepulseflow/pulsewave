/**
 * RoomView - Component for rendering a room with all participants
 */

import { useParticipants, useLocalParticipant } from '../hooks';
import { ParticipantView } from './ParticipantView';
import { LocalParticipantView } from './LocalParticipantView';

interface RoomViewProps {
  className?: string;
  videoClassName?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  showAudioIndicator?: boolean;
  showIdentity?: boolean;
  showLocalParticipant?: boolean;
  layout?: 'grid' | 'list';
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
  layout = 'grid',
}: RoomViewProps): JSX.Element | null {
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();

  const gridClassName = layout === 'grid' ? 'room-grid' : 'room-list';

  return (
    <div className={`room-view ${gridClassName} ${className}`}>
      {/* Local participant */}
      {showLocalParticipant && localParticipant && (
        <div className="room-participant local">
          <LocalParticipantView
            participant={localParticipant}
            videoClassName={videoClassName}
            objectFit={objectFit}
            showIdentity={showIdentity}
          />
        </div>
      )}

      {/* Remote participants */}
      {participants.map((participant) => (
        <div key={participant.sid} className="room-participant remote">
          <ParticipantView
            participant={participant}
            videoClassName={videoClassName}
            objectFit={objectFit}
            showAudioIndicator={showAudioIndicator}
            showIdentity={showIdentity}
          />
        </div>
      ))}
    </div>
  );
}
