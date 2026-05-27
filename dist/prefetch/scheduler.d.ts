import { RouteCache } from "../cache/route-cache.js";
import type { CacheKind } from "../cache/route-cache.js";
import type { PrefetchPriority } from "../types.js";
export interface PrefetchContext {
    signal: AbortSignal;
    priority: PrefetchPriority;
    cache: RouteCache;
}
export type PrefetchFetcher = (href: string, context: PrefetchContext) => void | Response | Promise<void | Response>;
export interface PrefetchTaskOptions {
    priority: PrefetchPriority;
    kind?: CacheKind | undefined;
    tags?: readonly string[] | undefined;
    ttlMs?: number | undefined;
    staleWhileRevalidateMs?: number | undefined;
    estimateBytes?: number | undefined;
    staleAfterMs?: number | undefined;
    timeoutMs?: number | undefined;
    viewportScore?: number | undefined;
}
export interface PrefetchSchedulerOptions {
    concurrency?: number | undefined;
    maxRetries?: number | undefined;
    retryBaseDelayMs?: number | undefined;
    staleTaskMs?: number | undefined;
    requestTimeoutMs?: number | undefined;
    bandwidthBudgetBytesPerMinute?: number | undefined;
    memoryBudgetBytes?: number | undefined;
    crossTabDedupe?: boolean | undefined;
    routeCache?: RouteCache | undefined;
    fetcher?: PrefetchFetcher | undefined;
    now?: (() => number) | undefined;
}
export declare class SmartPrefetchScheduler {
    private readonly queue;
    private readonly inFlight;
    private readonly completed;
    private readonly concurrency;
    private readonly maxRetries;
    private readonly retryBaseDelayMs;
    private readonly staleTaskMs;
    private readonly requestTimeoutMs;
    private readonly routeCache;
    private readonly budget;
    private readonly dedupe;
    private readonly defaultFetcher;
    private readonly now;
    private pumpQueued;
    constructor(options?: PrefetchSchedulerOptions);
    prefetch(href: string, fetcher: PrefetchFetcher | undefined, options: PrefetchTaskOptions): AbortController;
    cancel(href: string): void;
    cancelStale(maxAgeMs?: number): number;
    clear(): void;
    destroy(): void;
    private schedulePump;
    private pump;
    private nextTask;
    private run;
    private escalate;
}
//# sourceMappingURL=scheduler.d.ts.map