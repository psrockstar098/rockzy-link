import { isBrowser } from "../environment.js";
const DEFAULT_BROWSER_CACHE = "production-link-route-cache-v1";
export async function matchBrowserCache(href, options = {}) {
    if (!canUseCacheStorage())
        return undefined;
    const cache = await caches.open(options.cacheName ?? DEFAULT_BROWSER_CACHE);
    return cache.match(href);
}
export async function putBrowserCache(href, response, options = {}) {
    if (!canUseCacheStorage())
        return;
    if (!response.ok && response.type !== "opaque")
        return;
    const cache = await caches.open(options.cacheName ?? DEFAULT_BROWSER_CACHE);
    await cache.put(href, response.clone());
}
export async function prefetchToBrowserCache(href, options = {}) {
    if (!isBrowser() || typeof fetch !== "function")
        return undefined;
    const existing = await matchBrowserCache(href, options);
    if (existing)
        return existing;
    const response = await fetch(href, {
        credentials: "same-origin",
        priority: "low",
        ...options.requestInit
    });
    await putBrowserCache(href, response, options);
    return response;
}
function canUseCacheStorage() {
    return isBrowser() && "caches" in window;
}
//# sourceMappingURL=browser-cache.js.map