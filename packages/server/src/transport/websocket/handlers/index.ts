/**
 * WebSocket message handlers
 *
 * Exports all message handlers organized by domain capability.
 * This structure scales horizontally as the SDK grows.
 */

// Types
export * from './types';

// Base handler
export { BaseHandler } from './BaseHandler';

// Domain handlers
export * from './room';
export * from './call';
export * from './media';
export * from './data';

// Handler registry
export { HandlerRegistry, handlerRegistry } from './HandlerRegistry';
