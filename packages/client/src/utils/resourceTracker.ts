/**
 * ResourceTracker - Development mode resource tracking utility
 *
 * This utility helps track and detect resource leaks during development.
 * It should only be used in development mode.
 */

/**
 * Tracked resource type
 */
export enum ResourceType {
  MEDIA_STREAM = 'media_stream',
  MEDIA_TRACK = 'media_track',
  TRANSPORT = 'transport',
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
  DATA_PRODUCER = 'data_producer',
  DATA_CONSUMER = 'data_consumer',
}

/**
 * Tracked resource info
 */
export interface TrackedResource {
  id: string;
  type: ResourceType;
  createdAt: number;
  stackTrace?: string;
  releasedAt?: number;
}

/**
 * ResourceTracker class
 */
export class ResourceTracker {
  private resources: Map<string, TrackedResource> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean = process.env.NODE_ENV === 'development') {
    this.enabled = enabled;
  }

  /**
   * Track a resource
   */
  track(id: string, type: ResourceType, stackTrace?: string): void {
    if (!this.enabled) {
      return;
    }

    if (this.resources.has(id)) {
      console.warn(`Resource ${id} is already tracked`);
      return;
    }

    this.resources.set(id, {
      id,
      type,
      createdAt: Date.now(),
      stackTrace,
    });

    console.debug(`[ResourceTracker] Tracked ${type}: ${id}`);
  }

  /**
   * Release a resource
   */
  release(id: string): void {
    if (!this.enabled) {
      return;
    }

    const resource = this.resources.get(id);
    if (!resource) {
      console.warn(`Resource ${id} not found in tracker`);
      return;
    }

    if (resource.releasedAt) {
      console.warn(`Resource ${id} already released`);
      return;
    }

    resource.releasedAt = Date.now();
    this.resources.delete(id);

    console.debug(`[ResourceTracker] Released ${resource.type}: ${id}`);
  }

  /**
   * Get all active resources
   */
  getActiveResources(): TrackedResource[] {
    return Array.from(this.resources.values()).filter((r) => !r.releasedAt);
  }

  /**
   * Get all resources by type
   */
  getResourcesByType(type: ResourceType): TrackedResource[] {
    return Array.from(this.resources.values()).filter((r) => r.type === type && !r.releasedAt);
  }

  /**
   * Check for resource leaks
   */
  checkLeaks(): void {
    if (!this.enabled) {
      return;
    }

    const activeResources = this.getActiveResources();

    if (activeResources.length > 0) {
      console.warn(`[ResourceTracker] Found ${activeResources.length} leaked resources:`);

      activeResources.forEach((resource) => {
        const age = Date.now() - resource.createdAt;
        console.warn(`  - ${resource.type}: ${resource.id} (${age}ms old)`);
        if (resource.stackTrace) {
          console.warn(`    Created at:\n${resource.stackTrace}`);
        }
      });
    } else {
      console.debug('[ResourceTracker] No resource leaks detected');
    }
  }

  /**
   * Clear all tracked resources
   */
  clear(): void {
    this.resources.clear();
    console.debug('[ResourceTracker] Cleared all tracked resources');
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; active: number; byType: Record<string, number> } {
    const allResources = Array.from(this.resources.values());
    const activeResources = allResources.filter((r) => !r.releasedAt);

    const byType: Record<string, number> = {};
    activeResources.forEach((resource) => {
      byType[resource.type] = (byType[resource.type] || 0) + 1;
    });

    return {
      total: allResources.length,
      active: activeResources.length,
      byType,
    };
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Global resource tracker instance
 */
let globalResourceTracker: ResourceTracker | null = null;

/**
 * Get or create global resource tracker
 */
export function getGlobalResourceTracker(): ResourceTracker {
  if (!globalResourceTracker) {
    globalResourceTracker = new ResourceTracker();
  }
  return globalResourceTracker;
}

/**
 * Reset global resource tracker (useful for testing)
 */
export function resetGlobalResourceTracker(): void {
  globalResourceTracker = null;
}

/**
 * Create a unique resource ID
 */
export function createResourceId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Capture stack trace (development only)
 */
export function captureStackTrace(): string | undefined {
  if (process.env.NODE_ENV !== 'development') {
    return undefined;
  }

  const stack = new Error().stack;
  if (!stack) {
    return undefined;
  }

  // Remove the first few lines (this function and the caller)
  const lines = stack.split('\n').slice(3);
  return lines.join('\n');
}
