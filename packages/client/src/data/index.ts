/**
 * Data module exports
 */

export { DataChannel } from './DataChannel';
export { DataChannelManager } from './DataChannelManager';

// Data providers (strategy pattern for data transmission)
export { WebSocketDataProvider, WebRTCDataProvider } from './providers';
export type { WebRTCDataProviderOptions } from './providers';
