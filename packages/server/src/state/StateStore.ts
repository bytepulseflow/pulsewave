/**
 * StateStore - Abstract interface for state storage
 *
 * This is the abstraction for state storage operations.
 * Implementations can use Redis, in-memory, DynamoDB, etc.
 */

/**
 * State Store interface
 * Defines the contract for state storage implementations
 */
export interface StateStore {
  /**
   * Get a value from the store
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the store
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from the store
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get all keys matching a pattern
   */
  keys(pattern: string): Promise<string[]>;

  /**
   * Clear all values
   */
  clear(): Promise<void>;

  /**
   * Close the store connection
   */
  close(): Promise<void>;
}
