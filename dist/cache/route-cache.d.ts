export type CacheKind = "route-data" | "rsc" | "loader" | "api" | "html" | "script" | "image" | "font";
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
export declare class RouteCache {
    private readonly entries;
    private readonly tagIndex;
    private readonly maxEntries;
    private maxBytes;
    private readonly defaultTtlMs;
    private readonly defaultStaleWhileRevalidateMs;
    private readonly now;
    private bytes;
    constructor(options?: RouteCacheOptions);
    get totalBytes(): number;
    get size(): number;
    setMemoryBudget(maxBytes: number): void;
    get<T = unknown>(key: string, kind: CacheKind): CacheReadResult<T> | undefined;
    set<T = unknown>(key: string, kind: CacheKind, value: T, options?: CacheSetOptions): CacheEntry<T>;
    delete(key: string, kind: CacheKind): boolean;
    invalidateTag(tag: string): number;
    invalidateTags(tags: readonly string[]): number;
    getKeysForTag(tag: string): string[];
    invalidateMutation(routeKey: string, tags?: readonly string[]): number;
    clear(): void;
    pruneExpired(): number;
    keys(): string[];
    private evictIfNeeded;
    private findLruKey;
    private index;
    private unindex;
}
export declare function createCacheKey(kind: CacheKind, key: string): string;
export declare function estimateBytes(value: unknown): number;
//# sourceMappingURL=route-cache.d.ts.map