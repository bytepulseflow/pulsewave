/**
 * Mediasoup Server - Main entry point
 */

import http from 'http';
import express, { Application, Request, Response, NextFunction } from 'express';
import { getConfig } from './config';
import { createWorker, MediasoupWorker } from './sfu';
import { RoomManager } from './sfu';
import { WebSocketServer } from './websocket';
import { RedisManager } from './redis';
import { routes } from './api';

interface ServerInfo {
  name: string;
  version: string;
  status: string;
}

/**
 * Main server class
 */
class MediasoupServer {
  private app: Application;
  private httpServer: http.Server;
  private workers: MediasoupWorker[];
  private roomManager!: RoomManager;
  private redisManager: RedisManager | null;
  private wsServer!: WebSocketServer;
  private config = getConfig();

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.workers = [];
    this.redisManager = null;

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req: Request, res: Response, next: NextFunction): void => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // Share config with routes
    this.app.set('jwtConfig', this.config.jwt);
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    this.app.use('/api', routes);

    // Root endpoint
    this.app.get('/', (_req: Request<unknown, ServerInfo>, res: Response<ServerInfo>) => {
      res.json({
        name: 'Mediasoup Server',
        version: '0.1.0',
        status: 'running',
      });
    });
  }

  /**
   * Initialize the server
   */
  public async initialize(): Promise<void> {
    console.log('Initializing Mediasoup Server...');

    // Initialize Redis if enabled
    if (this.config.redis.enabled) {
      console.log('Connecting to Redis...');
      this.redisManager = new RedisManager(this.config.redis);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for connection
      console.log('Redis connected');
    }

    // Create mediasoup workers
    console.log(`Creating ${this.config.mediasoup.numWorkers} mediasoup workers...`);
    for (let i = 0; i < this.config.mediasoup.numWorkers; i++) {
      const worker = await createWorker(this.config.mediasoup);
      this.workers.push(worker);
      console.log(`Worker ${i + 1} created`);
    }

    // Create room manager
    this.roomManager = new RoomManager(this.workers);

    // Create WebSocket server
    this.wsServer = new WebSocketServer(
      this.httpServer,
      this.roomManager,
      this.redisManager,
      this.config.jwt
    );
    console.log('WebSocket server initialized');
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    await this.initialize();

    const { port, host } = this.config.server;

    this.httpServer.listen(port, host, () => {
      console.log(`Server listening on http://${host}:${port}`);
      console.log(`WebSocket endpoint: ws://${host}:${port}`);
    });
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    console.log('Shutting down server...');

    // Close WebSocket server
    this.wsServer.close();

    // Close all rooms
    await this.roomManager.closeAllRooms();

    // Close all workers
    for (const worker of this.workers) {
      await worker.close();
    }
    this.workers = [];

    // Close Redis
    if (this.redisManager) {
      await this.redisManager.close();
    }

    // Close HTTP server
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('Server stopped');
        resolve();
      });
    });
  }
}

/**
 * Start the server
 */
async function main(): Promise<void> {
  const server = new MediasoupServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  await server.start();
}

// Start if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { MediasoupServer };
