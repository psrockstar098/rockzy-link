const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STALE_MS = 30 * 1000;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTES = 50_000_000;
export class RouteCache {
    entries = new Map();
    tagIndex = new Map();
    maxEntries;
    maxBytes;
    defaultTtlMs;
    defaultStaleWhileRevalidateMs;
    now;
    bytes = 0;
    constructor(options = {}) {
        this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
        this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
        this.defaultStaleWhileRevalidateMs =
            options.defaultStaleWhileRevalidateMs ?? DEFAULT_STALE_MS;
        this.now = options.now ?? Date.now;
    }
    get totalBytes() {
        return this.bytes;
    }
    get size() {
        return this.entries.size;
    }
    setMemoryBudget(maxBytes) {
        this.maxBytes = Math.max(0, maxBytes);
        this.evictIfNeeded();
    }
    get(key, kind) {
        const cacheKey = createCacheKey(kind, key);
        const entry = this.entries.get(cacheKey);
        if (!entry)
            return undefined;
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
    set(key, kind, value, options = {}) {
        const now = this.now();
        const ttlMs = options.ttlMs ?? this.defaultTtlMs;
        const staleMs = options.staleWhileRevalidateMs ?? this.defaultStaleWhileRevalidateMs;
        const cacheKey = createCacheKey(kind, key);
        const previous = this.entries.get(cacheKey);
        if (previous) {
            this.unindex(previous);
            this.bytes -= previous.bytes;
        }
        const entry = {
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
    delete(key, kind) {
        const cacheKey = createCacheKey(kind, key);
        const entry = this.entries.get(cacheKey);
        if (!entry)
            return false;
        this.unindex(entry);
        this.bytes -= entry.bytes;
        return this.entries.delete(cacheKey);
    }
    invalidateTag(tag) {
        const keys = this.tagIndex.get(tag);
        if (!keys)
            return 0;
        let count = 0;
        for (const cacheKey of Array.from(keys)) {
            const entry = this.entries.get(cacheKey);
            if (!entry)
                continue;
            this.unindex(entry);
            this.bytes -= entry.bytes;
            this.entries.delete(cacheKey);
            count += 1;
        }
        this.tagIndex.delete(tag);
        return count;
    }
    invalidateTags(tags) {
        return tags.reduce((count, tag) => count + this.invalidateTag(tag), 0);
    }
    getKeysForTag(tag) {
        const keys = this.tagIndex.get(tag);
        return keys ? Array.from(keys) : [];
    }
    invalidateMutation(routeKey, tags = []) {
        let count = 0;
        for (const kind of [
            "route-data",
            "rsc",
            "loader",
            "api",
            "html"
        ]) {
            if (this.delete(routeKey, kind))
                count += 1;
        }
        return count + this.invalidateTags(tags);
    }
    clear() {
        this.entries.clear();
        this.tagIndex.clear();
        this.bytes = 0;
    }
    pruneExpired() {
        const now = this.now();
        let count = 0;
        for (const [cacheKey, entry] of this.entries) {
            if (entry.expiresAt > now)
                continue;
            this.unindex(entry);
            this.bytes -= entry.bytes;
            this.entries.delete(cacheKey);
            count += 1;
        }
        return count;
    }
    keys() {
        return Array.from(this.entries.keys());
    }
    evictIfNeeded() {
        this.pruneExpired();
        while (this.entries.size > this.maxEntries ||
            (this.maxBytes > 0 && this.bytes > this.maxBytes)) {
            const lru = this.findLruKey();
            if (!lru)
                return;
            const entry = this.entries.get(lru);
            if (!entry)
                return;
            this.unindex(entry);
            this.bytes -= entry.bytes;
            this.entries.delete(lru);
        }
    }
    findLruKey() {
        let lruKey;
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
    index(cacheKey, entry) {
        for (const tag of entry.tags) {
            let keys = this.tagIndex.get(tag);
            if (!keys) {
                keys = new Set();
                this.tagIndex.set(tag, keys);
            }
            keys.add(cacheKey);
        }
    }
    unindex(entry) {
        const cacheKey = createCacheKey(entry.kind, entry.key);
        for (const tag of entry.tags) {
            const keys = this.tagIndex.get(tag);
            if (!keys)
                continue;
            keys.delete(cacheKey);
            if (keys.size === 0)
                this.tagIndex.delete(tag);
        }
    }
}
export function createCacheKey(kind, key) {
    return `${kind}:${key}`;
}
export function estimateBytes(value) {
    if (value == null)
        return 0;
    if (typeof value === "string")
        return value.length * 2;
    if (value instanceof Blob)
        return value.size;
    if (value instanceof ArrayBuffer)
        return value.byteLength;
    if (ArrayBuffer.isView(value))
        return value.byteLength;
    if (value instanceof Response) {
        const contentLength = value.headers.get("content-length");
        return contentLength ? Number(contentLength) || 0 : 16_384;
    }
    try {
        return JSON.stringify(value).length * 2;
    }
    catch {
        return 16_384;
    }
}
//# sourceMappingURL=route-cache.js.map