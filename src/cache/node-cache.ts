import { RouteCache } from "./route-cache.js";
import type { CacheKind, CacheSetOptions, RouteCacheOptions } from "./route-cache.js";

export interface NodeRouteCache {
  get<T = unknown>(key: string, kind: CacheKind): T | undefined;
  set<T = unknown>(
    key: string,
    kind: CacheKind,
    value: T,
    options?: CacheSetOptions
  ): void;
  invalidateTag(tag: string): number;
  invalidateMutation(routeKey: string, tags?: readonly string[]): number;
  memory: RouteCache;
}

export async function createNodeRouteCache(
  options: RouteCacheOptions = {}
): Promise<NodeRouteCache> {
  const { NodeCache } = await import("@cacheable/node-cache");
  const nodeCache = new NodeCache<unknown>();
  const memory = new RouteCache(options);

  return {
    get<T = unknown>(key: string, kind: CacheKind): T | undefined {
      const compositeKey = `${kind}:${key}`;
      const nodeValue = nodeCache.get(compositeKey) as T | null | undefined;
      if (nodeValue !== undefined && nodeValue !== null) return nodeValue;
      return memory.get<T>(key, kind)?.value;
    },
    set<T = unknown>(
      key: string,
      kind: CacheKind,
      value: T,
      setOptions: CacheSetOptions = {}
    ): void {
      const ttlSeconds = Math.max(1, Math.floor((setOptions.ttlMs ?? 0) / 1000));
      nodeCache.set(`${kind}:${key}`, value, ttlSeconds);
      memory.set(key, kind, value, setOptions);
    },
    invalidateTag(tag: string): number {
      const keys = memory.getKeysForTag(tag);
      for (const compositeKey of keys) {
        nodeCache.del(compositeKey);
      }
      return memory.invalidateTag(tag);
    },
    invalidateMutation(routeKey: string, tags: readonly string[] = []): number {
      for (const kind of [
        "route-data",
        "rsc",
        "loader",
        "api",
        "html"
      ] satisfies CacheKind[]) {
        nodeCache.del(`${kind}:${routeKey}`);
      }
      for (const tag of tags) {
        const keys = memory.getKeysForTag(tag);
        for (const compositeKey of keys) {
          nodeCache.del(compositeKey);
        }
      }
      return memory.invalidateMutation(routeKey, tags);
    },
    memory
  };
}
