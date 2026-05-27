import { RouteCache } from "./route-cache.js";
export async function createNodeRouteCache(options = {}) {
    const { NodeCache } = await import("@cacheable/node-cache");
    const nodeCache = new NodeCache();
    const memory = new RouteCache(options);
    return {
        get(key, kind) {
            const compositeKey = `${kind}:${key}`;
            const nodeValue = nodeCache.get(compositeKey);
            if (nodeValue !== undefined && nodeValue !== null)
                return nodeValue;
            return memory.get(key, kind)?.value;
        },
        set(key, kind, value, setOptions = {}) {
            const ttlSeconds = Math.max(1, Math.floor((setOptions.ttlMs ?? 0) / 1000));
            nodeCache.set(`${kind}:${key}`, value, ttlSeconds);
            memory.set(key, kind, value, setOptions);
        },
        invalidateTag(tag) {
            const keys = memory.getKeysForTag(tag);
            for (const compositeKey of keys) {
                nodeCache.del(compositeKey);
            }
            return memory.invalidateTag(tag);
        },
        invalidateMutation(routeKey, tags = []) {
            for (const kind of [
                "route-data",
                "rsc",
                "loader",
                "api",
                "html"
            ]) {
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
//# sourceMappingURL=node-cache.js.map