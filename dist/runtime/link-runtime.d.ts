import { AccessibilityManager } from "../a11y/accessibility-manager.js";
import { RouteCache } from "../cache/route-cache.js";
import type { RouteCacheOptions } from "../cache/route-cache.js";
import { NavigationSnapshotCache } from "../navigation/navigation-snapshot-cache.js";
import type { NavigationSnapshotOptions } from "../navigation/navigation-snapshot-cache.js";
import { ScrollRestorationManager } from "../navigation/scroll-restoration.js";
import type { ViewTransitionConfig } from "../navigation/view-transitions.js";
import { OfflineNavigationManager } from "../offline/offline-navigation.js";
import { SmartPrefetchScheduler } from "../prefetch/scheduler.js";
import type { PrefetchFetcher, PrefetchSchedulerOptions, PrefetchTaskOptions } from "../prefetch/scheduler.js";
import type { Href, LinkRouter, PrefetchPriority, ScrollBehavior } from "../types.js";
export interface RuntimePrefetchOptions extends Partial<Omit<PrefetchTaskOptions, "priority">> {
    priority?: PrefetchPriority | undefined;
    fetcher?: PrefetchFetcher | undefined;
}
export interface NavigationOptions {
    router?: LinkRouter | undefined;
    replace?: boolean | undefined;
    state?: unknown;
    scroll?: boolean | string | undefined;
    scrollBehavior?: ScrollBehavior | undefined;
    hashOffset?: number | undefined;
    viewTransition?: boolean | ViewTransitionConfig | undefined;
    focus?: boolean | string | undefined;
    announce?: boolean | string | undefined;
    fallbackHref?: string | undefined;
    restoreDomSnapshot?: boolean | undefined;
}
export interface LinkRuntimeOptions {
    routeCache?: RouteCache | RouteCacheOptions | undefined;
    prefetch?: Omit<PrefetchSchedulerOptions, "routeCache" | "fetcher"> | undefined;
    scroll?: {
        restoreOnPopState?: boolean | undefined;
    } | undefined;
    snapshots?: NavigationSnapshotOptions | undefined;
    viewTransition?: ViewTransitionConfig | undefined;
    a11y?: {
        announce?: boolean | undefined;
        restoreFocus?: boolean | undefined;
        focusSelector?: string | undefined;
    } | undefined;
    offline?: {
        enabled?: boolean | undefined;
        optimistic?: boolean | undefined;
    } | undefined;
}
export declare class LinkRuntime {
    readonly routeCache: RouteCache;
    readonly scheduler: SmartPrefetchScheduler;
    readonly scroll: ScrollRestorationManager;
    readonly a11y: AccessibilityManager;
    readonly offline: OfflineNavigationManager;
    readonly snapshots: NavigationSnapshotCache;
    private readonly options;
    private readonly cleanup;
    constructor(options?: LinkRuntimeOptions);
    prefetch(hrefLike: Href, options?: RuntimePrefetchOptions): AbortController;
    navigate(hrefLike: Href, options?: NavigationOptions): Promise<void>;
    destroy(): void;
    private performNavigation;
    private optimisticHistoryNavigation;
    private shouldQueueOfflineNavigation;
    private applyScroll;
    private applyAccessibility;
    private resolveViewTransition;
    private installBrowserListeners;
}
export declare function createLinkRuntime(options?: LinkRuntimeOptions): LinkRuntime;
export declare function getDefaultLinkRuntime(): LinkRuntime;
//# sourceMappingURL=link-runtime.d.ts.map