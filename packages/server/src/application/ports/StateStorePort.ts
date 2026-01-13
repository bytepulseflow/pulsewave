/**
 * State Store Port
 *
 * Port interface for state storage operations.
 * This allows the application layer to be independent of the specific state store implementation.
 */

/**
 * State Store Port interface
 * Defines the contract for state storage implementations
 */
export interface StateStorePort {
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
