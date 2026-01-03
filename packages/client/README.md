# @bytepulse/pulsewave-client

React client SDK for PulseWave. Provides simple hooks and components for building video/audio conferencing applications.

## Installation

```bash
npm install @bytepulse/pulsewave-client
```

## Quick Start

```tsx
import { RoomProvider, useRoom, useLocalParticipant } from '@bytepulse/pulsewave-client';

function VideoRoom() {
  const { connect, disconnect } = useRoom();
  const localParticipant = useLocalParticipant();

  return (
    <div>
      <button onClick={connect}>Join Room</button>
      <button onClick={disconnect}>Leave Room</button>
      <button onClick={() => localParticipant?.enableCamera()}>Enable Camera</button>
    </div>
  );
}

function App() {
  return (
    <RoomProvider options={{ url: 'ws://localhost:3000', room: 'my-room', token: 'your-token' }}>
      <VideoRoom />
    </RoomProvider>
  );
}
```

## Components

### RoomProvider

The main provider component that wraps your application and provides room context.

```tsx
<RoomProvider
  options={{
    url: 'ws://localhost:3000',
    room: 'my-room',
    token: 'your-access-token',
  }}
>
  <YourApp />
</RoomProvider>
```

### VideoTrack

Component for rendering video tracks.

```tsx
<VideoTrack track={track} className="w-full" objectFit="cover" muted={true} />
```

### AudioTrack

Component for rendering audio tracks (hidden).

```tsx
<AudioTrack track={track} />
```

### ParticipantView

Component for rendering a participant with their tracks.

```tsx
<ParticipantView participant={participant} />
```

### LocalParticipantView

Component for rendering local participant with controls.

```tsx
<LocalParticipantView participant={localParticipant} />
```

### RoomView

Component for rendering all participants in a room.

```tsx
<RoomView />
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
