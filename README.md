# PulseWave

A modern WebRTC conferencing solution built on top of mediasoup, providing a complete video/audio communication platform with simple React hooks and a self-hosted server.

## Overview

- **Client SDK**: React library with intuitive hooks like `useRoom`, `useParticipants`, `useLocalParticipant`
- **Server**: Self-hosted or Docker-deployable mediasoup SFU server
- **Features**: Video/audio streaming, screen sharing, data channels, text chat

## Packages

| Package                       | Description                                | Status      |
| ----------------------------- | ------------------------------------------ | ----------- |
| `@bytepulse/pulsewave-client` | React client SDK with hooks and components | ✅ Complete |
| `@bytepulse/pulsewave-server` | Mediasoup SFU server (Docker)              | ✅ Complete |
| `@bytepulse/pulsewave-shared` | Shared types and constants                 | ✅ Complete |

## Quick Start

### Server (Docker)

```bash
# Clone the repository
git clone https://github.com/your-org/pulsewave.git
cd pulsewave

# Start with docker-compose
cd packages/server
docker-compose up -d
```

The server will be available at `http://localhost:3000`

### Client (React)

```bash
# Install the client SDK
npm install @bytepulse/pulsewave-client
```

```tsx
import {
  RoomProvider,
  useRoom,
  useLocalParticipant,
  useParticipants,
  RoomView,
} from '@bytepulse/pulsewave-client';

function VideoRoom() {
  const room = useRoom();
  const localParticipant = useLocalParticipant();
  const participants = useParticipants();

  return (
    <div>
      <button onClick={() => localParticipant.enableCamera()}>Enable Camera</button>
      <button onClick={() => localParticipant.enableMicrophone()}>Enable Microphone</button>

      <RoomView />
    </div>
  );
}

function App() {
  return (
    <RoomProvider
      options={{
        url: 'wss://pulsewave.example.com',
        room: 'my-room',
        token: accessToken,
      }}
    >
      <VideoRoom />
    </RoomProvider>
  );
}
```

## Client SDK API

### RoomProvider

The main entry point for using the client SDK.

```tsx
<RoomProvider
  options={{
    url: 'wss://pulsewave.example.com',
    room: 'my-room',
    token: accessToken,
  }}
>
  <YourRoomComponent />
</RoomProvider>
```

### React Hooks

#### `useRoom()`

Access the room instance and manage connection.

```tsx
const { connect, disconnect } = useRoom();

connect();
disconnect();
```

#### `useLocalParticipant()`

Access and control the local participant.

```tsx
const localParticipant = useLocalParticipant();

// Media controls
localParticipant.enableCamera(deviceId?);
localParticipant.disableCamera();
localParticipant.enableMicrophone(deviceId?);
localParticipant.disableMicrophone();

// Device listing
const cameras = await localParticipant.listAvailableCameras();
const microphones = await localParticipant.listAvailableMicrophones();

// Properties
localParticipant.name;
localParticipant.identity;
localParticipant.tracks;
```

#### `useParticipants()`

Get all remote participants in the room.

```tsx
const participants = useParticipants();

participants.map((p) => <ParticipantView key={p.identity} participant={p} />);
```

#### `useConnectionState()`

Monitor connection state.

```tsx
const state = useConnectionState();
// 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
```

### Components

#### `RoomView`

A pre-built component that displays all participants and their tracks.

```tsx
<RoomView />
```

#### `ParticipantView`

Display a single participant with their tracks.

```tsx
<ParticipantView participant={participant} />
```

## Server Configuration

### Environment Variables

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Mediasoup
MEDIASOUP_NUM_WORKERS=4
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=50000
MEDIASOUP_LOG_LEVEL=error

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_ENABLED=true

# JWT
API_KEY=your-api-key
API_SECRET=your-api-secret
JWT_EXPIRES_IN=24h

# ICE Servers
ICE_SERVERS=[{"urls":["stun:stun.l.google.com:19302"]}]
```

### Token Generation

Generate access tokens on your backend:

```typescript
import { AccessToken } from '@bytepulse/pulsewave-server';

const token = new AccessToken(API_KEY, API_SECRET, {
  identity: 'user-123',
  name: 'John Doe',
  metadata: { role: 'host' },
});

token.addGrant({
  room: 'room-name',
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
});

const jwt = token.toJwt();
```

## Architecture

PulseWave follows a modular, production-grade architecture with clear separation of concerns.

### Monorepo Structure

```
pulsewave/
├── packages/
│   ├── client/          # React client SDK
│   │   ├── src/
│   │   │   ├── client/          # Core client logic
│   │   │   │   ├── RoomClient.ts         # Facade/coordinator
│   │   │   │   ├── controllers/          # Specialized controllers
│   │   │   │   │   ├── EventBus.ts       # Type-safe event emitter
│   │   │   │   │   ├── ParticipantStore.ts  # Participant state management
│   │   │   │   │   ├── ConnectionController.ts  # WebSocket connection
│   │   │   │   │   ├── SignalingClient.ts  # Signaling message dispatch
│   │   │   │   │   ├── MediaController.ts  # Media device operations
│   │   │   │   │   ├── WebRTCController.ts  # WebRTC lifecycle
│   │   │   │   │   └── TrackController.ts  # Track publishing/subscription
│   │   │   │   ├── handlers/       # Message handlers (Command pattern)
│   │   │   │   └── ...
│   │   │   ├── components/      # React components
│   │   │   ├── context/         # React context
│   │   │   ├── hooks/           # React hooks
│   │   │   ├── media/           # Media handling
│   │   │   └── webrtc/          # WebRTC management
│   ├── server/          # Mediasoup SFU server
│   │   ├── src/
│   │   │   ├── api/            # REST API
│   │   │   ├── auth/           # JWT authentication
│   │   │   ├── config/         # Configuration
│   │   │   ├── redis/          # Redis integration
│   │   │   ├── sfu/            # Mediasoup SFU
│   │   │   └── websocket/      # WebSocket server & handlers
│   └── shared/          # Shared types and constants
├── plans/               # Architecture and roadmap
└── README.md
```

### Client Architecture

The client SDK follows the **Facade Pattern** with specialized controllers:

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

**Key Design Principles:**

- **Single Responsibility**: Each controller handles one specific concern
- **Intent-based APIs**: High-level methods like `enableCamera()` instead of low-level producer management
- **Event-driven**: Proper event system for state changes
- **Type-safe**: Full TypeScript support with no `any` types

### Server Architecture

The server uses the **Command Pattern** for WebSocket message handling:

```
WebSocketServer
├─ HandlerRegistry  (Maps message types to handlers)
├─ Handlers         (Command implementations)
│   ├─ JoinHandler
│   ├─ LeaveHandler
│   ├─ PublishHandler
│   ├─ SubscribeHandler
│   └─ ...
└─ RoomManager      (Room lifecycle)
```

See [`plans/architecture.md`](plans/architecture.md) for detailed architecture documentation.

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev
```

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @bytepulse/pulsewave-client build
pnpm --filter @bytepulse/pulsewave-server build
```

### Test

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @bytepulse/pulsewave-client test
```

## Deployment

### Server (Docker)

```bash
# Build the Docker image
docker build -t pulsewave/server:latest packages/server

# Run with docker-compose
cd packages/server
docker-compose up -d
```

### Client (NPM)

```bash
# Build and publish
pnpm build
pnpm release
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT

## Support

- GitHub Issues: [github.com/your-org/pulsewave/issues](https://github.com/your-org/pulsewave/issues)
- Documentation: [docs.pulsewave.dev](https://docs.pulsewave.dev)

## Acknowledgments

Built with:

- [mediasoup](https://mediasoup.org/) - WebRTC SFU library
- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
