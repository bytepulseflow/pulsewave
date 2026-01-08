# @bytepulse/pulsewave-client

> **⚠️ WARNING: This project is still under active development and testing. Do not use in production environments.**

React client SDK for PulseWave. Provides simple hooks and components for building video/audio conferencing applications.

## Installation

```bash
npm install @bytepulse/pulsewave-client
```

## Server Setup

The PulseWave client SDK requires a running PulseWave server. You can set up the server in two ways:

### Option 1: Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/bytepulseflow/pulsewave.git
cd pulsewave

# Start the server with docker-compose
cd packages/server
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
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Required: API_KEY and API_SECRET for token generation

# Start the server
npm start
```

### Environment Variables

The server requires the following environment variables:

```bash
# Server
PORT=3000
HOST=0.0.0.0

# JWT (Required)
API_KEY=your-api-key
API_SECRET=your-api-secret

# Mediasoup
MEDIASOUP_NUM_WORKERS=4
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=50000

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_ENABLED=false

# ICE Servers
ICE_SERVERS=[{"urls":["stun:stun.l.google.com:19302"]}]
```

### Token Generation

The client SDK requires an access token to join rooms. You can generate tokens using the server's API:

```bash
curl -X POST http://localhost:3000/api/token \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "user-123",
    "name": "John Doe",
    "room": "my-room",
    "canPublish": true,
    "canSubscribe": true,
    "canPublishData": true
  }'
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

For more server documentation, visit the [PulseWave Server GitHub Repository](https://github.com/bytepulseflow/pulsewave/tree/main/packages/server).

## Quick Start

PulseWave Client SDK provides two approaches for building video/audio applications:

### Option 1: Hooks-Based API Usage

Build custom UI using hooks for full control:

```tsx
import { useState } from 'react';
import {
  RoomProvider,
  useRoom,
  useLocalParticipant,
  useParticipants,
  useConnectionState,
} from '@bytepulse/pulsewave-client';
import { VideoTrack, AudioTrack } from '@bytepulse/pulsewave-client/ui';

function VideoRoom() {
  const { connect, disconnect } = useRoom();
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
        <button onClick={connect} disabled={connectionState === 'connected'}>
          Join Room
        </button>
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

### Option 2: Built-in Component-Based Usage

Use the pre-built components for quick setup with minimal code:

```tsx
import { useRoom } from '@bytepulse/pulsewave-client';
import { RoomProvider, RoomView, LocalParticipantView } from '@bytepulse/pulsewave-client/ui';

function VideoRoom() {
  const { connect, disconnect, connectionState } = useRoom();

  return (
    <div>
      <div className="controls">
        <button onClick={connect} disabled={connectionState === 'connected'}>
          Join Room
        </button>
        <button onClick={disconnect} disabled={connectionState === 'disconnected'}>
          Leave Room
        </button>
      </div>

      {connectionState === 'connected' && (
        <div className="room">
          <LocalParticipantView />
          <RoomView />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <RoomProvider
      options={{
        url: 'ws://localhost:3000',
        room: 'my-room',
        token: 'your-token',
      }}
    >
      <VideoRoom />
    </RoomProvider>
  );
}
```

## Components

All UI components can be imported from `@bytepulse/pulsewave-client/ui`:

```tsx
import {
  RoomProvider,
  RoomView,
  ParticipantView,
  LocalParticipantView,
  VideoTrack,
  AudioTrack,
} from '@bytepulse/pulsewave-client/ui';
```

### RoomProvider

The main provider component that wraps your application and provides room context.

```tsx
import { RoomProvider } from '@bytepulse/pulsewave-client/ui';

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

### ParticipantView

Component for rendering a participant with their tracks.

```tsx
import { ParticipantView } from '@bytepulse/pulsewave-client/ui';

<ParticipantView participant={participant} />;
```

### LocalParticipantView

Component for rendering local participant with controls.

```tsx
import { LocalParticipantView } from '@bytepulse/pulsewave-client/ui';

<LocalParticipantView participant={localParticipant} />;
```

### RoomView

Component for rendering all participants in a room.

```tsx
import { RoomView } from '@bytepulse/pulsewave-client/ui';

<RoomView />;
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
}
```

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
