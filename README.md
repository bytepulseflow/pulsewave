# PulseWave

![Under Active Testing](https://img.shields.io/badge/status-under%20active%20testing-orange?style=for-the-badge)
![Powered by mediasoup](https://img.shields.io/badge/powered%20by-mediasoup-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge)

A modern WebRTC conferencing solution built on top of [mediasoup](https://mediasoup.org/), providing a complete video/audio communication platform with simple React hooks and a self-hosted server.

> **⚠️ Status**: This project is currently under active testing and development. APIs and features may change as we stabilize the platform.

## Overview

- **Client SDK**: React library with intuitive hooks like `useRoom`, `useParticipants`, `useLocalParticipant`
- **Server**: Self-hosted or Docker-deployable mediasoup SFU server
- **Features**: Video/audio streaming, screen sharing, data channels, text chat

## Packages

| Package                       | Description                                | Status      | NPM                                                                                                                               |
| ----------------------------- | ------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@bytepulse/pulsewave-client` | React client SDK with hooks and components | ✅ Complete | [![npm](https://img.shields.io/npm/v/@bytepulse/pulsewave-client.svg)](https://www.npmjs.com/package/@bytepulse/pulsewave-client) |

|

## Installation

### Client SDK

```bash
npm install @bytepulse/pulsewave-client
```

Visit [npmjs.com/package/@bytepulse/pulsewave-client](https://www.npmjs.com/package/@bytepulse/pulsewave-client) for detailed client SDK documentation.

Visit [@bytepulse/pulsewave-server](https://github.com/bytepulseflow/pulsewave/tree/main/packages/server) for detailed server documentation.

## Quick Start

### Server (Docker)

> **⚠️ NOTE: Before running the server set `ANNOUNCED_IP={host_ip_address}` in .env file to your machine ipv4 address.**

```bash
# Clone the repository
git clone https://github.com/bytepulseflow/pulsewave
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

For detailed usage examples and API documentation, visit the [Client SDK Documentation](https://www.npmjs.com/package/@bytepulse/pulsewave-client).

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

## Contributing

Contributions are welcome!

## License

MIT

## Acknowledgments

Built with:

- [mediasoup](https://mediasoup.org/) - WebRTC SFU library
- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
