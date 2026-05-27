import { RouteCache } from "./route-cache.js";
import type { CacheKind, CacheSetOptions, RouteCacheOptions } from "./route-cache.js";
export interface NodeRouteCache {
    get<T = unknown>(key: string, kind: CacheKind): T | undefined;
    set<T = unknown>(key: string, kind: CacheKind, value: T, options?: CacheSetOptions): void;
    invalidateTag(tag: string): number;
    invalidateMutation(routeKey: string, tags?: readonly string[]): number;
    memory: RouteCache;
}
export declare function createNodeRouteCache(options?: RouteCacheOptions): Promise<NodeRouteCache>;
//# sourceMappingURL=node-cache.d.ts.map