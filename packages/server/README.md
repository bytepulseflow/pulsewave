# @bytepulse/pulsewave-server

Mediasoup SFU server for PulseWave. Provides WebRTC signaling and media routing for video/audio conferencing.

## Installation

The server is designed to be deployed via Docker or run directly with Node.js.

## Quick Start

### Docker (Recommended)

```bash
cd packages/server
docker-compose up -d
```

### Node.js

```bash
# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start server
npm start
```

## Environment Variables

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

## API Endpoints

### POST /api/token

Generate an access token for joining a room.

```bash
curl -X POST http://localhost:3000/api/token \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "user-123",
    "name": "John Doe",
    "room": "my-room",
    "metadata": {"role": "host"}
  }'
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## WebSocket Protocol

The server uses WebSocket for real-time signaling. Connect to `ws://localhost:3000` with the access token as a query parameter.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000?token=your-access-token');
```

### Client Messages

#### Join Room

```json
{
  "type": "join",
  "room": "my-room"
}
```

#### Leave Room

```json
{
  "type": "leave"
}
```

#### Create WebRTC Transport

```json
{
  "type": "create-transport",
  "direction": "send" | "recv"
}
```

#### Connect Transport

```json
{
  "type": "connect-transport",
  "transportId": "TP_123",
  "dtlsParameters": {...}
}
```

#### Publish Track

```json
{
  "type": "publish",
  "kind": "video" | "audio",
  "source": "camera" | "microphone" | "screen",
  "rtpParameters": {...}
}
```

#### Unpublish Track

```json
{
  "type": "unpublish",
  "producerId": "PR_123"
}
```

#### Subscribe Track

```json
{
  "type": "subscribe",
  "producerId": "PR_123",
  "rtpCapabilities": {...}
}
```

#### Unsubscribe Track

```json
{
  "type": "unsubscribe",
  "consumerId": "CN_123"
}
```

#### Resume Consumer

```json
{
  "type": "resume-consumer",
  "consumerId": "CN_123"
}
```

#### Mute Track

```json
{
  "type": "mute",
  "producerId": "PR_123"
}
```

#### Unmute Track

```json
{
  "type": "unmute",
  "producerId": "PR_123"
}
```

#### Publish Data

```json
{
  "type": "publish-data",
  "kind": "reliable" | "lossy",
  "data": { "type": "chat", "message": "Hello" }
}
```

### Server Messages

#### Joined

```json
{
  "type": "joined",
  "room": {...},
  "participant": {...}
}
```

#### Participant Joined

```json
{
  "type": "participant-joined",
  "participant": {...}
}
```

#### Participant Left

```json
{
  "type": "participant-left",
  "participant": {...}
}
```

#### Track Published

```json
{
  "type": "track-published",
  "track": {...}
}
```

#### Track Unpublished

```json
{
  "type": "track-unpublished",
  "producerId": "PR_123"
}
```

#### Track Subscribed

```json
{
  "type": "track-subscribed",
  "trackSid": "TR_123",
  "consumerId": "CN_123",
  "producerId": "PR_123",
  "rtpParameters": {...}
}
```

#### Track Unsubscribed

```json
{
  "type": "track-unsubscribed",
  "consumerId": "CN_123"
}
```

#### Track Muted

```json
{
  "type": "track-muted",
  "producerId": "PR_123"
}
```

#### Track Unmuted

```json
{
  "type": "track-unmuted",
  "producerId": "PR_123"
}
```

#### Data Received

```json
{
  "type": "data",
  "participantIdentity": "user-123",
  "kind": "reliable",
  "data": {...}
}
```

#### Error

```json
{
  "type": "error",
  "code": 100,
  "message": "Room not found"
}
```

## Token Generation

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

## Server Architecture

PulseWave Server follows a modular architecture using the Command Pattern for WebSocket message handling:

```
┌─────────────────────────────────────────────────────────┐
│                  WebSocketServer                         │
│  (WebSocket connection management & message routing)     │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────▼──────────────────────────────┐
         │           HandlerRegistry                 │
         │  (Maps message types to handlers)         │
         └───────────┬──────────────────────────────┘
                     │
    ┌────────────────┼──────────────────────────────┐
    │                │                              │
┌───▼────────┐  ┌───▼──────────┐  ┌─────────────▼────┐
│ JoinHandler│  │PublishHandler│  │SubscribeHandler  │
└────────────┘  └──────────────┘  └──────────────────┘
    │                │                      │
┌───▼────────┐  ┌───▼──────────┐  ┌─────────────▼────┐
│LeaveHandler│  │UnpublishHandler│ │UnsubscribeHandler│
└────────────┘  └──────────────┘  └──────────────────┘
    │                │                      │
    └────────────────┼──────────────────────┘
                     │
         ┌───────────▼──────────────────────────────┐
         │            RoomManager                    │
         │  (Room lifecycle & participant management)│
         └───────────┬──────────────────────────────┘
                     │
         ┌───────────▼──────────────────────────────┐
         │               Room                        │
         │  (Mediasoup Router & state)               │
         └───────────┬──────────────────────────────┘
                     │
    ┌────────────────┼──────────────────────────────┐
    │                │                              │
┌───▼────────┐  ┌───▼──────────┐  ┌─────────────▼────┐
│Mediasoup   │  │   Redis      │  │   JWT Service    │
│Workers     │  │   Manager    │  │                  │
└────────────┘  └──────────────┘  └──────────────────┘
```

### Handlers

The server uses the Command Pattern for handling WebSocket messages. Each handler implements the `BaseHandler` interface:

```typescript
abstract class BaseHandler {
  abstract canHandle(message: SignalingMessage): boolean;
  abstract handle(message: SignalingMessage, context: HandlerContext): Promise<void>;
}
```

Available handlers:

- `JoinHandler` - Handles room join requests
- `LeaveHandler` - Handles room leave requests
- `CreateWebRtcTransportHandler` - Creates WebRTC transports
- `ConnectTransportHandler` - Connects WebRTC transports
- `PublishHandler` - Handles track publishing
- `UnpublishHandler` - Handles track unpublishing
- `SubscribeHandler` - Handles track subscription
- `UnsubscribeHandler` - Handles track unsubscription
- `ResumeConsumerHandler` - Resumes paused consumers
- `MuteHandler` - Handles track muting
- `DataHandler` - Handles data channel messages

### Modules

#### WebSocket Server

Manages WebSocket connections and message routing.

```typescript
import { WebSocketServer } from '@bytepulse/pulsewave-server';

const server = new WebSocketServer({
  port: 3000,
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
});

server.start();
```

#### Room Manager

Manages room lifecycle and participant management.

```typescript
import { RoomManager } from '@bytepulse/pulsewave-server';

const roomManager = new RoomManager();

// Create or get room
const room = await roomManager.getOrCreateRoom('my-room');

// Close room
await roomManager.closeRoom('my-room');
```

#### Mediasoup Worker

Wraps mediasoup worker processes.

```typescript
import { MediasoupWorker } from '@bytepulse/pulsewave-server';

const worker = new MediasoupWorker({
  logLevel: 'error',
  rtcMinPort: 40000,
  rtcMaxPort: 50000,
});
```

#### Redis Manager

Manages Redis connections for state synchronization.

```typescript
import { RedisManager } from '@bytepulse/pulsewave-server';

const redis = new RedisManager({
  host: 'localhost',
  port: 6379,
});

await redis.connect();
```

## Scaling

### Horizontal Scaling

Multiple server instances can be run behind a load balancer. Redis is used for state synchronization.

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  server-1:
    build: .
    environment:
      - REDIS_HOST=redis
      - REDIS_ENABLED=true
    ports:
      - '3001:3000'

  server-2:
    build: .
    environment:
      - REDIS_HOST=redis
      - REDIS_ENABLED=true
    ports:
      - '3002:3000'
```

## License

MIT
