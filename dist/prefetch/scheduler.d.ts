import { RouteCache } from "../cache/route-cache.js";
import type { CacheKind } from "../cache/route-cache.js";
import type { PrefetchPriority } from "../types.js";
export interface PrefetchContext {
    signal: AbortSignal;
    priority: PrefetchPriority;
    cache: RouteCache;
}
export type PrefetchFetcher = (href: string, context: PrefetchContext) => void | Response | Promise<void | Response>;
export interface PrefetchAsset {
    href: string;
    rel?: "preload" | "modulepreload" | undefined;
    as?: string | undefined;
    type?: string | undefined;
    crossOrigin?: "" | "anonymous" | "use-credentials" | undefined;
    integrity?: string | undefined;
    media?: string | undefined;
    referrerPolicy?: ReferrerPolicy | undefined;
    fetchPriority?: "high" | "low" | "auto" | undefined;
    module?: boolean | undefined;
}
export type PrefetchAssetInput = string | PrefetchAsset;
export interface SpeculationRulesOptions {
    action?: "prefetch" | "prerender" | "both" | undefined;
    eagerness?: "immediate" | "eager" | "moderate" | "conservative" | undefined;
    referrerPolicy?: ReferrerPolicy | undefined;
}
export interface AdaptivePrefetchOptions {
    enabled?: boolean | undefined;
    lowBatteryThreshold?: number | undefined;
    minDeviceMemoryGb?: number | undefined;
}
export type PrefetchDiagnosticReason = "scheduled" | "cache-hit" | "completed" | "failed" | "cancelled" | "retried" | "navigation";
export interface PrefetchDiagnostics {
    reason: PrefetchDiagnosticReason;
    href?: string | undefined;
    queued: number;
    inFlight: number;
    scheduledPrefetches: number;
    completedPrefetches: number;
    failedPrefetches: number;
    cancelledPrefetches: number;
    retriedPrefetches: number;
    cacheHits: number;
    cacheHitRate: number;
    totalBytesFetched: number;
    navigationCount: number;
    prefetchedNavigationCount: number;
    prefetchToClickRatio: number;
    prefetchedNavigationRatio: number;
}
export interface PrefetchTaskOptions {
    priority: PrefetchPriority;
    kind?: CacheKind | undefined;
    tags?: readonly string[] | undefined;
    ttlMs?: number | undefined;
    staleWhileRevalidateMs?: number | undefined;
    estimateBytes?: number | undefined;
    staleAfterMs?: number | undefined;
    timeoutMs?: number | undefined;
    maxRetries?: number | undefined;
    retryBaseDelayMs?: number | undefined;
    retryMaxDelayMs?: number | undefined;
    retryBackoffFactor?: number | undefined;
    retryJitterRatio?: number | undefined;
    viewportScore?: number | undefined;
    assets?: readonly PrefetchAssetInput[] | undefined;
    speculationRules?: boolean | SpeculationRulesOptions | undefined;
}
export interface PrefetchSchedulerOptions {
    concurrency?: number | undefined;
    maxRetries?: number | undefined;
    retryBaseDelayMs?: number | undefined;
    retryMaxDelayMs?: number | undefined;
    retryBackoffFactor?: number | undefined;
    retryJitterRatio?: number | undefined;
    staleTaskMs?: number | undefined;
    requestTimeoutMs?: number | undefined;
    bandwidthBudgetBytesPerMinute?: number | undefined;
    memoryBudgetBytes?: number | undefined;
    crossTabDedupe?: boolean | undefined;
    routeCache?: RouteCache | undefined;
    fetcher?: PrefetchFetcher | undefined;
    adaptive?: boolean | AdaptivePrefetchOptions | undefined;
    speculationRules?: boolean | SpeculationRulesOptions | undefined;
    onDiagnostics?: ((diagnostics: PrefetchDiagnostics) => void) | undefined;
    now?: (() => number) | undefined;
}
export declare class SmartPrefetchScheduler {
    private readonly queue;
    private readonly inFlight;
    private readonly completed;
    private readonly concurrency;
    private readonly maxRetries;
    private readonly retryBaseDelayMs;
    private readonly retryMaxDelayMs;
    private readonly retryBackoffFactor;
    private readonly retryJitterRatio;
    private readonly staleTaskMs;
    private readonly requestTimeoutMs;
    private readonly routeCache;
    private readonly budget;
    private readonly dedupe;
    private readonly defaultFetcher;
    private readonly adaptive;
    private readonly defaultSpeculationRules;
    private readonly onDiagnostics;
    private readonly now;
    private readonly metrics;
    private batteryState;
    private batteryCleanup;
    private pumpQueued;
    private destroyed;
    constructor(options?: PrefetchSchedulerOptions);
    prefetch(href: string, fetcher: PrefetchFetcher | undefined, options: PrefetchTaskOptions): AbortController;
    cancel(href: string): void;
    cancelStale(maxAgeMs?: number): number;
    clear(): void;
    destroy(): void;
    recordNavigation(href: string): void;
    getDiagnostics(reason?: PrefetchDiagnosticReason): PrefetchDiagnostics;
    private schedulePump;
    private pump;
    private nextTask;
    private run;
    private escalate;
    private markCancelled;
    private hasCachedDocument;
    private getDevicePolicy;
    private installBatteryMonitor;
    private emitDiagnostics;
    private createDiagnostics;
}
//# sourceMappingURL=scheduler.d.ts.map