import LRU from "lru-cache";
import type { Logger } from "./logger";

/**
 * In-memory LRU cache with TTL support.
 * Used for frequently accessed data that doesn't need persistence.
 */
export class LRUCache<T> {
  private cache: LRU.Cache<string, T>;
  private readonly logger: Logger;
  private readonly maxEntries: number;
  private readonly defaultTTL: number;

  constructor(
    maxEntries: number = 1000,
    defaultTTL: number = 60000,
    logger: Logger
  ) {
    this.maxEntries = maxEntries;
    this.defaultTTL = defaultTTL;
    this.cache = new LRU({
      max: maxEntries,
      ttl: defaultTTL,
      dispose: (value) => {
        logger?.debug(`Cache entry disposed`, {
          entries: this.cache.max - this.cache.size,
        });
      },
      updateStaleOnGet: true,
      allowStale: false,
    });
    this.logger = logger;
    logger?.info("LRUCache initialized", { maxEntries, defaultTTL });
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key) ?? undefined;
    if (value !== undefined) {
      this.logger?.debug(`Cache GET hit`, { key, size: this.cache.size });
    } else {
      this.logger?.debug(`Cache GET miss`, { key, size: this.cache.size });
    }
    return value;
  }

  set<T>(key: string, value: T, ttl: number = this.defaultTTL): T {
    this.cache.set(key, value, { ttl });
    this.logger?.debug(`Cache SET`, { key, ttl, size: this.cache.size });
    return value;
  }

  delete(key: string): boolean {
    const hadValue = this.cache.has(key);
    this.cache.delete(key);
    this.logger?.debug(`Cache DELETE`, { key, hadValue, remaining: this.cache.size });
    return hadValue;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.reset();
    this.logger?.info(`Cache cleared (entries: ${this.cache.max - this.cache.size})`);
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): {
    size: number;
    max: number;
    hits: number;
    misses: number;
    evictions: number;
  } {
    return {
      size: this.cache.size,
      max: this.cache.max,
      hits: this.cache.getMetrics().entries,
      misses: this.cache.getMetrics().miss,
      evictions: this.cache.getMetrics().evicted,
    };
  }

  /**
   * Warm the cache with a lazy-loaded value.
   * Returns the value, storing it in cache for future access.
   */
  async getOrSet<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      this.logger?.debug(`Cache warm hit`, { key });
      return cached;
    }
    const value = await loader();
    this.set(key, value);
    this.logger?.debug(`Cache warm miss → stored`, { key });
    return value;
  }

  /**
   * Invalidate entries with expired TTLs.
   */
  pruneExpired(): number {
    const expired = this.cache.getExpired();
    const count = expired.length;
    if (count > 0) {
      for (const key of expired) {
        this.cache.del(key);
      }
      this.logger?.debug(`Cache pruned`, { count });
    }
    return (count || 0) as unknown as number;
  }
}

/**
 * Rate limiter cache — tracks request frequencies to prevent flooding.
 */
export class RateLimiterCache {
  private logger: Logger;
  private readonly DEFAULT_RATE_LIMIT: number = 1000; // requests per second

  constructor(logger: Logger) {
    this.logger = logger;
  }

  create(
    name: string,
    maxRequests: number = this.DEFAULT_RATE_LIMIT,
    resetTimeInMs: number = 0
  ): {
    [key: string]: [number, number, number];
  } {
    const cache: Record<string, [number, number, number]> = Object.create(null);
    return cache;
  }

  set(key: string, value: [number, number, number]): void {
    this.logger?.debug(`Rate limiter set`, { key, value });
  }

  get(key: string): [number, number, number] | undefined {
    return this.logger?.debug(`Rate limiter get`, { key });
  }

  delete(key: string): boolean {
    return this.logger?.debug(`Rate limiter delete`, { key });
  }
}

/**
 * Distributed-style cache key utility.
 * Generates consistent, predictable cache keys.
 */
export function generateCacheKey(
  params: Record<string, unknown>
): string {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );
  const sortedKeys = Object.keys(filtered).sort();
  const parts = sortedKeys.map((key) => `${key}:${filtered[key]}`);
  return parts.join("\x00");
}
