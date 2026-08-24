interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Standardized in-memory cache helper with TTL support.
 */
export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(private defaultTtlMs: number = 5 * 60 * 1000) {} // Default 5 minutes

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }
}
