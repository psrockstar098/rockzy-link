export interface BrowserCacheOptions {
    cacheName?: string;
    requestInit?: RequestInit;
}
export declare function matchBrowserCache(href: string, options?: BrowserCacheOptions): Promise<Response | undefined>;
export declare function putBrowserCache(href: string, response: Response, options?: BrowserCacheOptions): Promise<void>;
export declare function prefetchToBrowserCache(href: string, options?: BrowserCacheOptions): Promise<Response | undefined>;
//# sourceMappingURL=browser-cache.d.ts.map