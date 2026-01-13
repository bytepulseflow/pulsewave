/**
 * Transport Layer
 *
 * Contains all transport adapters (WebSocket, HTTP API) for communication with clients.
 * These are optional adapters that can be swapped or extended.
 */

export { WebSocketServer } from './websocket';
export { routes } from './api';
