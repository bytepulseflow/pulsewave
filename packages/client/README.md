# @bytepulse/pulsewave-client

> **⚠️ WARNING: This project is still under active development and testing. Do not use in production environments.**

React client SDK for PulseWave. Provides simple hooks and components for building video/audio conferencing applications.

## Installation

```bash
pnpm install @bytepulse/pulsewave-client
```

## Server Setup

The PulseWave client SDK requires a running PulseWave server. You can set up the server in two ways:

### Option 1: Using Docker (Recommended)

> **⚠️ NOTE: Before running the server set `ANNOUNCED_IP={host_ip_address}` in .env file to your machine ipv4 address.**

```bash
# Clone the repository
git clone https://github.com/bytepulseflow/pulsewave.git
cd pulsewave/server

# Copy environment file
cp .env.example .env

# Start the server with docker-compose
docker-compose up -d
```

The server will be available at `http://localhost:3000`

### Option 2: Manual Setup

```bash
# Clone the repository
git clone https://github.com/bytepulseflow/pulsewave.git
cd pulsewave

# Install dependencies
cd packages/server
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Required: API_KEY and API_SECRET for token generation

# Start the server
pnpm start:dev
```

For more details on server, visit the [PulseWave Server GitHub Repository](https://github.com/bytepulseflow/pulsewave/tree/main/packages/server).

## Quick Start

PulseWave Client SDK provides two approaches for building video/audio applications:

### Option 1: Built-in Component-Based Usage

Use the pre-built components for quick setup with minimal code:

```tsx
import { useState } from 'react';
import {
  RoomProvider,
  useRoom,
  useLocalParticipant,
  useParticipants,
  useConnectionState,
  PulseParticipantView,
} from '@bytepulse/pulsewave-client';
import { DataProviderType } from '@bytepulse/pulsewave-shared';

function VideoRoom() {
  const { disconnect, localTracks } = useRoom();
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();

  const toggleCamera = async () => {
    if (localParticipant) {
      const hasVideo = localParticipant.getTracks().some((t) => t.kind === 'video');
      if (hasVideo) {
        await localParticipant.disableCamera();
      } else {
        await localParticipant.enableCamera();
      }
    }
  };

  const toggleMicrophone = async () => {
    if (localParticipant) {
      const audioTrack = localParticipant.getTracks().find((t) => t.kind === 'audio');
      if (audioTrack) {
        if (audioTrack.track?.isMuted) {
          await localParticipant.unmuteAudio();
        } else {
          await localParticipant.muteAudio();
        }
      } else {
        await localParticipant.enableMicrophone();
      }
    }
  };

  return (
    <div className="video-room w-full bg-slate-950 h-screen pt-8">
      <div className="relative">
        {connectionState === 'connected' && (
          <div className="participants">
            {/* Local Participant */}
            {localParticipant && (
              <div className=" mx-auto w-[40%]">
                <PulseParticipantView
                  key={`local-${localTracks.length}`}
                  objectFit="fill"
                  className=""
                  participant={localParticipant}
                />
              </div>
            )}

            {/* Remote Participants */}
            {participants.map((participant) => {
              return (
                <div key={participant.sid} className="w-1/4">
                  <PulseParticipantView objectFit="fill" participant={participant} />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="controls absolute w-full flex justify-center items-center mx-auto bottom-14 z-10">
        <button
          className="bg-slate-800 text-white py-2 px-4 rounded-2xl"
          onClick={disconnect}
          disabled={connectionState === 'disconnected'}
        >
          Leave Room
        </button>
        <button className="bg-slate-800 text-white py-2 px-4 rounded-2xl" onClick={toggleCamera}>
          Toggle Camera
        </button>
        <button
          className="bg-slate-800 text-white py-2 px-4 rounded-2xl"
          onClick={toggleMicrophone}
        >
          Toggle Mic
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [token, setToken] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to generate token from API
  const generateToken = async (identity: string, room: string, name: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity,
          name,
          room,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate token');
      }

      const data = await response.json();
      return data.token;
    } catch (err) {
      throw new Error('Failed to generate access token. Please ensure the server is running.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !roomName) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const generatedToken = await generateToken(username, roomName, username);
      setToken(generatedToken);
      setIsJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = () => {
    setIsJoined(false);
    setToken('');
    setError('');
  };

  return (
    <div className="h-full">
      {!isJoined ? (
        <form
          onSubmit={handleJoin}
          className="flex items-center max-w-80 mx-auto justify-center flex-col space-y-4 h-screen"
        >
          <h2>Join a Room</h2>
          {error && <div>{error}</div>}
          <div className="w-full">
            <label className="block" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              required
              className="border rounded-sm p-1 w-full"
              disabled={isLoading}
            />
          </div>
          <div className="w-full">
            <label className="block" htmlFor="roomName">
              Room Name
            </label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              required
              className="border rounded-sm p-1 w-full"
              disabled={isLoading}
            />
          </div>
          <button
            className="bg-slate-900 px-4 py-2 text-white rounded-xl w-full"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Generating Token...' : 'Join'}
          </button>
        </form>
      ) : (
        <RoomProvider
          autoConnect
          options={{
            url: 'ws://localhost:3000',
            room: roomName,
            token: token,
            dataProvider: {
              type: DataProviderType.WebRTC,
            },
          }}
        >
          <VideoRoom />
          <button onClick={handleLeave}>Leave Room</button>
        </RoomProvider>
      )}
    </div>
  );
}
```

### Option 2: Hooks-Based API Usage

Build custom UI using hooks for full control:

```tsx
import { useEffect, useState } from 'react';
import {
  RoomProvider,
  useRoom,
  useLocalParticipant,
  useParticipants,
  useConnectionState,
} from '@bytepulse/pulsewave-client';
import { VideoTrack, AudioTrack } from '@bytepulse/pulsewave-client/ui';

function VideoRoom() {
  const { disconnect } = useRoom();
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const toggleCamera = async () => {
    if (localParticipant) {
      const hasVideo = localParticipant.getTracks().some((t) => t.kind === 'video');
      if (hasVideo) {
        await localParticipant.disableCamera();
      } else {
        await localParticipant.enableCamera();
      }
    }
  };

  const toggleMicrophone = async () => {
    if (localParticipant) {
      const hasAudio = localParticipant.getTracks().some((t) => t.kind === 'audio');
      if (hasAudio) {
        await localParticipant.disableMicrophone();
      } else {
        await localParticipant.enableMicrophone();
      }
    }
  };

  return (
    <div className="video-room">
      <div className="controls">
        <button onClick={disconnect} disabled={connectionState === 'disconnected'}>
          Leave Room
        </button>
        <button onClick={toggleCamera}>Toggle Camera</button>
        <button onClick={toggleMicrophone}>Toggle Mic</button>
      </div>

      {connectionState === 'connected' && (
        <div className="participants">
          {/* Local Participant */}
          {localParticipant && (
            <div className="participant local">
              <h3>You ({localParticipant.name})</h3>
              {localParticipant.getTracks().map((publication) => (
                <div key={publication.sid}>
                  {publication.track && publication.kind === 'video' && (
                    <VideoTrack track={publication.track} muted={true} />
                  )}
                  {publication.track && publication.kind === 'audio' && (
                    <AudioTrack track={publication.track} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Remote Participants */}
          {participants.map((participant) => (
            <div key={participant.identity} className="participant">
              <h3>{participant.name}</h3>
              {participant.getTracks().map((publication) => (
                <div key={publication.sid}>
                  {publication.track && publication.kind === 'video' && (
                    <VideoTrack track={publication.track} />
                  )}
                  {publication.track && publication.kind === 'audio' && (
                    <AudioTrack track={publication.track} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [token, setToken] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to generate token from API
  const generateToken = async (identity: string, room: string, name: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity,
          name,
          room,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate token');
      }

      const data = await response.json();
      return data.token;
    } catch (err) {
      throw new Error('Failed to generate access token. Please ensure the server is running.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !roomName) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const generatedToken = await generateToken(username, roomName, username);
      setToken(generatedToken);
      setIsJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = () => {
    setIsJoined(false);
    setToken('');
    setError('');
  };

  return (
    <div>
      {!isJoined ? (
        <form onSubmit={handleJoin} className="join-form">
          <h2>Join a Room</h2>
          {error && <div className="error">{error}</div>}
          <div>
            <label htmlFor="username">Username:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="roomName">Room Name:</label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              required
              disabled={isLoading}
            />
          </div>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Generating Token...' : 'Join'}
          </button>
        </form>
      ) : (
        <RoomProvider
          autoConnect
          options={{
            url: 'ws://localhost:3000',
            room: roomName,
            token: token,
          }}
        >
          <VideoRoom />
          <button onClick={handleLeave}>Leave Room</button>
        </RoomProvider>
      )}
    </div>
  );
}
```

### Option 3: Manual Track Attachment

For complete control, manually attach tracks to video elements:

```tsx
import { useState, useRef, useEffect } from 'react';
import {
  RoomProvider,
  useRoom,
  useLocalParticipant,
  useParticipants,
  useConnectionState,
} from '@bytepulse/pulsewave-client';
import { DataProviderType } from '@bytepulse/pulsewave-shared';

function ManualVideoRoom() {
  const { disconnect } = useRoom();
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();

  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // State for camera/mic status
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);

  // Toggle camera
  const toggleCamera = async () => {
    if (!localParticipant) return;

    if (isCameraEnabled) {
      await localParticipant.disableCamera();
      setIsCameraEnabled(false);
    } else {
      await localParticipant.enableCamera();
      setIsCameraEnabled(true);
    }
  };

  // Toggle microphone
  const toggleMicrophone = async () => {
    if (!localParticipant) return;

    if (isMicEnabled) {
      await localParticipant.disableMicrophone();
      setIsMicEnabled(false);
    } else {
      await localParticipant.enableMicrophone();
      setIsMicEnabled(true);
    }
  };

  // Attach local video track to video element
  useEffect(() => {
    if (!localParticipant || !localVideoRef.current) return;

    const tracks = localParticipant.getTracks();
    const videoTrack = tracks.find((t) => t.kind === 'video');

    if (videoTrack?.track?.mediaTrack) {
      const stream = new MediaStream([videoTrack.track.mediaTrack]);
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true; // Mute local video to prevent feedback
      localVideoRef.current.play().catch(console.error);
    } else {
      localVideoRef.current.srcObject = null;
    }
  }, [localParticipant, isCameraEnabled]);

  // Attach local audio track to audio element
  useEffect(() => {
    if (!localParticipant || !localAudioRef.current) return;

    const tracks = localParticipant.getTracks();
    const audioTrack = tracks.find((t) => t.kind === 'audio');

    if (audioTrack?.track?.mediaTrack) {
      const stream = new MediaStream([audioTrack.track.mediaTrack]);
      localAudioRef.current.srcObject = stream;
      localAudioRef.current.muted = true; // Mute local audio to prevent feedback
      localAudioRef.current.play().catch(console.error);
    } else {
      localAudioRef.current.srcObject = null;
    }
  }, [localParticipant, isMicEnabled]);

  // Attach remote video tracks
  useEffect(() => {
    participants.forEach((participant) => {
      const tracks = participant.getTracks();
      const videoTrack = tracks.find((t) => t.kind === 'video');

      const videoElement = remoteVideoRefs.current.get(participant.sid);
      if (videoElement && videoTrack?.track?.mediaTrack) {
        const stream = new MediaStream([videoTrack.track.mediaTrack]);
        videoElement.srcObject = stream;
        videoElement.play().catch(console.error);
      }
    });
  }, [participants]);

  // Attach remote audio tracks
  useEffect(() => {
    participants.forEach((participant) => {
      const tracks = participant.getTracks();
      const audioTrack = tracks.find((t) => t.kind === 'audio');

      const audioElement = remoteAudioRefs.current.get(participant.sid);
      if (audioElement && audioTrack?.track?.mediaTrack) {
        const stream = new MediaStream([audioTrack.track.mediaTrack]);
        audioElement.srcObject = stream;
        audioElement.play().catch(console.error);
      }
    });
  }, [participants]);

  return (
    <div className="video-room">
      <div className="controls">
        <button onClick={disconnect}>Leave Room</button>
        <button onClick={toggleCamera}>
          {isCameraEnabled ? 'Disable Camera' : 'Enable Camera'}
        </button>
        <button onClick={toggleMicrophone}>{isMicEnabled ? 'Disable Mic' : 'Enable Mic'}</button>
      </div>

      {connectionState === 'connected' && (
        <div className="participants">
          {/* Local Participant */}
          {localParticipant && (
            <div className="participant local">
              <h3>You (Local)</h3>
              <video
                ref={localVideoRef}
                className="w-full h-64 object-cover bg-black"
                autoPlay
                playsInline
                muted
              />
              {/* Hidden audio element for local audio */}
              <audio ref={localAudioRef} autoPlay muted />
            </div>
          )}

          {/* Remote Participants */}
          {participants.map((participant) => (
            <div key={participant.sid} className="participant">
              <h3>{participant.name || participant.identity}</h3>
              <video
                ref={(el) => {
                  if (el) {
                    remoteVideoRefs.current.set(participant.sid, el);
                  }
                }}
                className="w-full h-48 object-cover bg-black"
                autoPlay
                playsInline
              />
              {/* Hidden audio element for remote audio */}
              <audio
                ref={(el) => {
                  if (el) {
                    remoteAudioRefs.current.set(participant.sid, el);
                  }
                }}
                autoPlay
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Components

All UI components can be imported from `@bytepulse/pulsewave-client/ui`:

```tsx
import { PulseParticipantView, VideoTrack, AudioTrack } from '@bytepulse/pulsewave-client/ui';
```

### RoomProvider

The main provider component that wraps your application and provides room context.

```tsx
import { RoomProvider } from '@bytepulse/pulsewave-client';

<RoomProvider
  options={{
    url: 'ws://localhost:3000',
    room: 'my-room',
    token: 'your-access-token',
  }}
>
  <YourApp />
</RoomProvider>;
```

### VideoTrack

Component for rendering video tracks.

```tsx
import { VideoTrack } from '@bytepulse/pulsewave-client/ui';

<VideoTrack track={track} className="w-full" objectFit="cover" muted={true} />;
```

### AudioTrack

Component for rendering audio tracks (hidden).

```tsx
import { AudioTrack } from '@bytepulse/pulsewave-client/ui';

<AudioTrack track={track} />;
```

## Hooks

### useRoom

Access the room instance and manage connection.

```tsx
const { connect, disconnect } = useRoom();

connect();
disconnect();
```

### useLocalParticipant

Access and control the local participant.

```tsx
const localParticipant = useLocalParticipant();

// Media controls
await localParticipant.enableCamera(deviceId?);
await localParticipant.disableCamera();
await localParticipant.enableMicrophone(deviceId?);
await localParticipant.disableMicrophone();

// Device listing
const cameras = await localParticipant.listAvailableCameras();
const microphones = await localParticipant.listAvailableMicrophones();

// Properties
localParticipant.name;
localParticipant.identity;
localParticipant.tracks;
```

### useParticipants

Get all remote participants.

```tsx
const participants = useParticipants();

participants.map((p) => <ParticipantView key={p.identity} participant={p} />);
```

### useConnectionState

Monitor connection state.

```tsx
const state = useConnectionState();
// 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
```

### useMediaDevices

Access and manage media devices.

```tsx
const { audioInputs, videoInputs, audioOutputs, getDevices, getUserMedia, getDisplayMedia } =
  useMediaDevices();

// Get all devices
await getDevices();

// Get user media (camera/mic)
const stream = await getUserMedia({ video: true, audio: true });

// Get display media (screen share)
const stream = await getDisplayMedia({ video: true });
```

## Client Architecture

PulseWave Client follows a modular architecture with specialized controllers:

```
RoomClient (Facade)
├─ ConnectionController  (WebSocket lifecycle)
├─ SignalingClient       (Message dispatch)
├─ MediaController       (Device operations)
├─ WebRTCController      (WebRTC lifecycle)
├─ TrackController       (Track publishing/subscription)
├─ ParticipantStore      (Participant state)
└─ EventBus              (Event system)
```

### Controllers

#### EventBus

Type-safe event emitter for internal communication.

```typescript
eventBus.emit('participant_joined', participant);
eventBus.on('participant_joined', (participant) => { ... });
```

#### ParticipantStore

Manages participant state with intent-based methods.

```typescript
participantStore.addParticipant(participant);
participantStore.removeParticipant(identity);
participantStore.getLocalParticipant();
participantStore.getRemoteParticipants();
```

#### ConnectionController

Manages WebSocket connection lifecycle.

```typescript
connectionController.connect();
connectionController.disconnect();
connectionController.send(message);
```

#### SignalingClient

Dispatches signaling messages to handlers.

```typescript
signalingClient.dispatch(message);
```

#### MediaController

Handles media device operations.

```typescript
mediaController.getUserMedia(constraints);
mediaController.getDisplayMedia(constraints);
mediaController.getDevices();
```

#### WebRTCController

Manages WebRTC transport lifecycle.

```typescript
webRTCController.createTransports();
webRTCController.closeTransports();
```

#### TrackController

Handles track publishing and subscription with high-level APIs.

```typescript
// High-level methods
trackController.enableCamera(deviceId?);
trackController.disableCamera();
trackController.enableMicrophone(deviceId?);
trackController.disableMicrophone();

// Low-level methods
trackController.publishTrack(track, options);
trackController.unpublishTrack(producerId);
trackController.subscribeToTrack(consumerInfo);
```

## Client Classes

### RoomClient

Main client class that acts as a facade/coordinator for all subsystems.

```tsx
import { RoomClient } from '@bytepulse/pulsewave-client';

const client = new RoomClient({
  url: 'ws://localhost:3000',
  room: 'my-room',
  token: 'your-token',
});

await client.connect();
await client.disconnect();
```

### LocalParticipant

Represents the local user in the room.

```tsx
const localParticipant = client.localParticipant;

// Media controls
await localParticipant.enableCamera();
await localParticipant.disableCamera();
await localParticipant.enableMicrophone();
await localParticipant.disableMicrophone();

// Device listing
const cameras = await localParticipant.listAvailableCameras();
const microphones = await localParticipant.listAvailableMicrophones();

// Properties
localParticipant.name;
localParticipant.identity;
localParticipant.tracks;
```

### Participant

Base participant class.

```tsx
participant.name;
participant.identity;
participant.tracks;
```

### Track

Base track class.

```tsx
track.mute();
track.unmute();
track.stop();
```

### LocalTrack

Local track implementation.

```tsx
await localTrack.mute();
await localTrack.unmute();
```

### RemoteTrack

Remote track implementation.

```tsx
remoteTrack.on('subscribed', () => console.log('Subscribed'));
remoteTrack.on('unsubscribed', () => console.log('Unsubscribed'));
```

### DataChannel

WebRTC data channel wrapper.

```tsx
dataChannel.send('Hello');
dataChannel.on('message', (data) => console.log(data));
```

### DataChannelManager

Manages multiple data channels.

```tsx
const channel = await manager.createChannel({ label: 'chat' });
manager.closeChannel('chat');
```

## Types

### RoomClientOptions

```tsx
interface RoomClientOptions {
  url: string;
  room: string;
  token: string;
  autoSubscribe?: boolean;
  preferredVideoCodec?: 'vp8' | 'vp9' | 'h264' | 'av1';
  preferredAudioCodec?: 'opus' | 'isac' | 'aac';
  enableSimulcast?: boolean;
  enableDataChannels?: boolean;
  maxVideoBitrate?: number;
  maxAudioBitrate?: number;
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: 'all' | 'relay';
  debug?: boolean;
  dataProvider?: DataProviderConfig | DataProviderType;
}

type DataProviderType = 'WebSocket' | 'WebRTC';

interface DataProviderConfig {
  type: DataProviderType;
  maxMessageSize?: number;
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
}
```

#### Data Provider Options

PulseWave supports two data transmission methods for data channels:

**WebSocket (Default)** - Data flows through WebSocket signaling layer, routed through the server to all participants.

```tsx
// Default - no configuration needed
const client = new RoomClient({
  url: 'ws://localhost:3000',
  room: 'my-room',
  token: 'your-token',
  // dataProvider defaults to WebSocket
});

// Explicit WebSocket configuration
const client = new RoomClient({
  url: 'ws://localhost:3000',
  room: 'my-room',
  token: 'your-token',
  dataProvider: 'WebSocket',
});

// With custom options
const client = new RoomClient({
  url: 'ws://localhost:3000',
  room: 'my-room',
  token: 'your-token',
  dataProvider: {
    type: 'WebSocket',
    maxMessageSize: 16384, // 16KB default
  },
});
```

**WebRTC (Experimental)** - Uses mediasoup's DataProducer/DataConsumer for peer-to-peer data transmission through the SFU.

```tsx
// Default WebRTC configuration
const client = new RoomClient({
  url: 'ws://localhost:3000',
  room: 'my-room',
  token: 'your-token',
  dataProvider: 'WebRTC',
});

// With custom options
const client = new RoomClient({
  url: 'ws://localhost:3000',
  room: 'my-room',
  token: 'your-token',
  dataProvider: {
    type: 'WebRTC',
    maxMessageSize: 262144, // 256KB default
    ordered: true,
    maxPacketLifeTime: 1000,
    maxRetransmits: 3,
  },
});
```

**Choosing Between Data Providers:**

| Feature      | WebSocket                | WebRTC                      |
| ------------ | ------------------------ | --------------------------- |
| Latency      | Higher (server relay)    | Lower (P2P through SFU)     |
| Scalability  | Better (server managed)  | Limited (P2P connections)   |
| Reliability  | High (server guaranteed) | Medium (depends on network) |
| Message Size | 16KB default             | 256KB default               |
| Status       | Stable                   | Experimental                |

### TrackPublishOptions

```tsx
interface TrackPublishOptions {
  simulcast?: boolean;
  maxBitrate?: number;
  codec?: string;
}
```

### TrackSubscribeOptions

```tsx
interface TrackSubscribeOptions {
  codec?: string;
  maxBitrate?: number;
}
```

### DataChannelOptions

```tsx
interface DataChannelOptions {
  label: string;
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  protocol?: string;
}
```

## License

MIT
