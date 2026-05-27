export type CacheKind =
  | "route-data"
  | "rsc"
  | "loader"
  | "api"
  | "html"
  | "script"
  | "image"
  | "font";

export interface CacheSetOptions {
  ttlMs?: number | undefined;
  staleWhileRevalidateMs?: number | undefined;
  tags?: readonly string[] | undefined;
  bytes?: number | undefined;
  revalidate?: (() => void | Promise<void>) | undefined;
}

export interface CacheEntry<T = unknown> {
  key: string;
  kind: CacheKind;
  value: T;
  tags: Set<string>;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  staleAt: number;
  bytes: number;
  hits: number;
  lastAccessedAt: number;
  revalidate?: (() => void | Promise<void>) | undefined;
}

export interface CacheReadResult<T = unknown> {
  value: T;
  entry: CacheEntry<T>;
  stale: boolean;
}

export interface RouteCacheOptions {
  maxEntries?: number | undefined;
  maxBytes?: number | undefined;
  defaultTtlMs?: number | undefined;
  defaultStaleWhileRevalidateMs?: number | undefined;
  now?: (() => number) | undefined;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STALE_MS = 30 * 1000;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTES = 50_000_000;

export class RouteCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly maxEntries: number;
  private maxBytes: number;
  private readonly defaultTtlMs: number;
  private readonly defaultStaleWhileRevalidateMs: number;
  private readonly now: () => number;
  private bytes = 0;

  constructor(options: RouteCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
    this.defaultStaleWhileRevalidateMs =
      options.defaultStaleWhileRevalidateMs ?? DEFAULT_STALE_MS;
    this.now = options.now ?? Date.now;
  }

  get totalBytes(): number {
    return this.bytes;
  }

  get size(): number {
    return this.entries.size;
  }

  setMemoryBudget(maxBytes: number): void {
    this.maxBytes = Math.max(0, maxBytes);
    this.evictIfNeeded();
  }

  get<T = unknown>(key: string, kind: CacheKind): CacheReadResult<T> | undefined {
    const cacheKey = createCacheKey(kind, key);
    const entry = this.entries.get(cacheKey) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    const now = this.now();
    if (entry.expiresAt <= now) {
      this.delete(key, kind);
      return undefined;
    }

    entry.hits += 1;
    entry.lastAccessedAt = now;

    const stale = entry.staleAt <= now;
    if (stale && entry.revalidate) {
      void Promise.resolve(entry.revalidate()).catch(() => undefined);
    }

    return { value: entry.value, entry, stale };
  }

  set<T = unknown>(
    key: string,
    kind: CacheKind,
    value: T,
    options: CacheSetOptions = {}
  ): CacheEntry<T> {
    const now = this.now();
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const staleMs =
      options.staleWhileRevalidateMs ?? this.defaultStaleWhileRevalidateMs;
    const cacheKey = createCacheKey(kind, key);
    const previous = this.entries.get(cacheKey);

    if (previous) {
      this.unindex(previous);
      this.bytes -= previous.bytes;
    }

    const entry: CacheEntry<T> = {
      key,
      kind,
      value,
      tags: new Set(options.tags ?? []),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttlMs,
      staleAt: now + Math.max(0, ttlMs - staleMs),
      bytes: options.bytes ?? estimateBytes(value),
      hits: 0,
      lastAccessedAt: now,
      revalidate: options.revalidate
    };

    this.entries.set(cacheKey, entry);
    this.index(cacheKey, entry);
    this.bytes += entry.bytes;
    this.evictIfNeeded();
    return entry;
  }

  delete(key: string, kind: CacheKind): boolean {
    const cacheKey = createCacheKey(kind, key);
    const entry = this.entries.get(cacheKey);
    if (!entry) return false;
    this.unindex(entry);
    this.bytes -= entry.bytes;
    return this.entries.delete(cacheKey);
  }

  invalidateTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const cacheKey of Array.from(keys)) {
      const entry = this.entries.get(cacheKey);
      if (!entry) continue;
      this.unindex(entry);
      this.bytes -= entry.bytes;
      this.entries.delete(cacheKey);
      count += 1;
    }
    this.tagIndex.delete(tag);
    return count;
  }

  invalidateTags(tags: readonly string[]): number {
    return tags.reduce((count, tag) => count + this.invalidateTag(tag), 0);
  }

  getKeysForTag(tag: string): string[] {
    const keys = this.tagIndex.get(tag);
    return keys ? Array.from(keys) : [];
  }

  invalidateMutation(routeKey: string, tags: readonly string[] = []): number {
    let count = 0;
    for (const kind of [
      "route-data",
      "rsc",
      "loader",
      "api",
      "html"
    ] satisfies CacheKind[]) {
      if (this.delete(routeKey, kind)) count += 1;
    }
    return count + this.invalidateTags(tags);
  }

  clear(): void {
    this.entries.clear();
    this.tagIndex.clear();
    this.bytes = 0;
  }

  pruneExpired(): number {
    const now = this.now();
    let count = 0;
    for (const [cacheKey, entry] of this.entries) {
      if (entry.expiresAt > now) continue;
      this.unindex(entry);
      this.bytes -= entry.bytes;
      this.entries.delete(cacheKey);
      count += 1;
    }
    return count;
  }

  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  private evictIfNeeded(): void {
    this.pruneExpired();
    while (
      this.entries.size > this.maxEntries ||
      (this.maxBytes > 0 && this.bytes > this.maxBytes)
    ) {
      const lru = this.findLruKey();
      if (!lru) return;
      const entry = this.entries.get(lru);
      if (!entry) return;
      this.unindex(entry);
      this.bytes -= entry.bytes;
      this.entries.delete(lru);
    }
  }

  private findLruKey(): string | undefined {
    let lruKey: string | undefined;
    let lruScore = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries) {
      const score = entry.lastAccessedAt + entry.hits * 100;
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }
    return lruKey;
  }

  private index(cacheKey: string, entry: CacheEntry): void {
    for (const tag of entry.tags) {
      let keys = this.tagIndex.get(tag);
      if (!keys) {
        keys = new Set();
        this.tagIndex.set(tag, keys);
      }
      keys.add(cacheKey);
    }
  }

  private unindex(entry: CacheEntry): void {
    const cacheKey = createCacheKey(entry.kind, entry.key);
    for (const tag of entry.tags) {
      const keys = this.tagIndex.get(tag);
      if (!keys) continue;
      keys.delete(cacheKey);
      if (keys.size === 0) this.tagIndex.delete(tag);
    }
  }
}

export function createCacheKey(kind: CacheKind, key: string): string {
  return `${kind}:${key}`;
}

export function estimateBytes(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "string") return value.length * 2;
  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (value instanceof Response) {
    const contentLength = value.headers.get("content-length");
    return contentLength ? Number(contentLength) || 0 : 16_384;
  }
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 16_384;
  }
}
