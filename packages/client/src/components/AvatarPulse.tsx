import { useState } from 'react';
import { useAudioPulse } from '../hooks/useAudioPulse';
import './avatar.css';

type Props = {
  stream: MediaStream | null;
  avatarUrl?: string;
  fallbackName?: string;
};

export function AvatarPulse({ stream, avatarUrl, fallbackName }: Props) {
  const [rings, setRings] = useState({
    ring1: 0,
    ring2: 0,
    ring3: 0,
  });

  useAudioPulse({
    stream,
    onUpdate: setRings,
  });

  if (!stream) {
    return (
      <div>
        {avatarUrl ? (
          <>
            <img src={avatarUrl} className="avatar" />
          </>
        ) : (
          <>
            <div className="avatar">
              {fallbackName ? fallbackName.charAt(0).toUpperCase() : '?'}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pulse-root">
      <div className="ring ring-1" style={{ '--energy': rings.ring1 } as React.CSSProperties} />
      <div className="ring ring-2" style={{ '--energy': rings.ring2 } as React.CSSProperties} />
      <div className="ring ring-3" style={{ '--energy': rings.ring3 } as React.CSSProperties} />
      {avatarUrl ? (
        <>
          <img src={avatarUrl} className="avatar" />
        </>
      ) : (
        <>
          <div className="avatar">{fallbackName ? fallbackName.charAt(0).toUpperCase() : '?'}</div>
        </>
      )}
    </div>
  );
}
