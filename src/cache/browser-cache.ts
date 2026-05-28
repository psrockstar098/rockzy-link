import { isBrowser } from "../environment.js";

export interface BrowserCacheOptions {
  cacheName?: string;
  requestInit?: RequestInit;
}

const DEFAULT_BROWSER_CACHE = "production-link-route-cache-v1";

export async function matchBrowserCache(
  href: string,
  options: BrowserCacheOptions = {}
): Promise<Response | undefined> {
  if (!canUseCacheStorage()) return undefined;
  try {
    const cache = await caches.open(options.cacheName ?? DEFAULT_BROWSER_CACHE);
    return await cache.match(href);
  } catch {
    return undefined;
  }
}

export async function putBrowserCache(
  href: string,
  response: Response,
  options: BrowserCacheOptions = {}
): Promise<void> {
  if (!canUseCacheStorage()) return;
  if (!response.ok && response.type !== "opaque") return;
  try {
    const cache = await caches.open(options.cacheName ?? DEFAULT_BROWSER_CACHE);
    await cache.put(href, response.clone());
  } catch {
    // Ignore cache storage errors (e.g. QuotaExceededError or security restrictions in private mode)
  }
}

export async function prefetchToBrowserCache(
  href: string,
  options: BrowserCacheOptions = {}
): Promise<Response | undefined> {
  if (!isBrowser() || typeof fetch !== "function") return undefined;

  const existing = await matchBrowserCache(href, options);
  if (existing) return existing;

  const response = await fetch(href, {
    credentials: "same-origin",
    priority: "low",
    ...options.requestInit
  } as RequestInit);

  await putBrowserCache(href, response, options);
  return response;
}

function canUseCacheStorage(): boolean {
  return isBrowser() && "caches" in window;
}
