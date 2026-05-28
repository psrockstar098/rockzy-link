import { AccessibilityManager } from "../a11y/accessibility-manager.js";
import { RouteCache } from "../cache/route-cache.js";
import type { RouteCacheOptions } from "../cache/route-cache.js";
import { NavigationSnapshotCache } from "../navigation/navigation-snapshot-cache.js";
import type { NavigationSnapshotOptions } from "../navigation/navigation-snapshot-cache.js";
import { ScrollRestorationManager } from "../navigation/scroll-restoration.js";
import type { ViewTransitionConfig } from "../navigation/view-transitions.js";
import { OfflineNavigationManager } from "../offline/offline-navigation.js";
import type { OfflineNavigationManagerOptions } from "../offline/offline-navigation.js";
import { SmartPrefetchScheduler } from "../prefetch/scheduler.js";
import type { PrefetchDiagnostics, PrefetchFetcher, PrefetchSchedulerOptions, PrefetchTaskOptions } from "../prefetch/scheduler.js";
import type { Href, LinkRouter, PrefetchPriority, ScrollBehavior } from "../types.js";
export interface RuntimePrefetchOptions extends Partial<Omit<PrefetchTaskOptions, "priority">> {
    priority?: PrefetchPriority | undefined;
    fetcher?: PrefetchFetcher | undefined;
}
export interface RoutePrefetchRule {
    match: string | RegExp | ((href: string) => boolean);
    options: Omit<RuntimePrefetchOptions, "fetcher">;
}
export interface NavigationGuardContext {
    href: string;
    from: string;
    options: NavigationOptions;
    runtime: LinkRuntime;
}
export type NavigationGuard = (context: NavigationGuardContext) => boolean | void | Promise<boolean | void>;
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
    guards?: NavigationGuard | readonly NavigationGuard[] | undefined;
}
export interface LinkRuntimeOptions {
    routeCache?: RouteCache | RouteCacheOptions | undefined;
    prefetch?: Omit<PrefetchSchedulerOptions, "routeCache"> | undefined;
    prefetchRoutes?: readonly RoutePrefetchRule[] | undefined;
    onPrefetchDiagnostics?: ((diagnostics: PrefetchDiagnostics) => void) | undefined;
    beforeNavigate?: NavigationGuard | readonly NavigationGuard[] | undefined;
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
    } & OfflineNavigationManagerOptions | undefined;
}
export declare class LinkRuntime {
    readonly routeCache: RouteCache;
    readonly scheduler: SmartPrefetchScheduler;
    readonly scroll: ScrollRestorationManager;
    readonly a11y: AccessibilityManager;
    readonly offline: OfflineNavigationManager;
    readonly snapshots: NavigationSnapshotCache;
    private readonly options;
    private readonly beforeNavigateGuards;
    private readonly cleanup;
    constructor(options?: LinkRuntimeOptions);
    prefetch(hrefLike: Href, options?: RuntimePrefetchOptions): AbortController;
    navigate(hrefLike: Href, options?: NavigationOptions): void | Promise<void>;
    private continueNavigate;
    destroy(): void;
    beforeNavigate(guards: NavigationGuard | readonly NavigationGuard[]): () => void;
    private addBeforeNavigateGuards;
    private runBeforeNavigate;
    private runBeforeNavigateAsync;
    private runBeforeNavigateLocalAsync;
    private resolveRoutePrefetchOptions;
    private performNavigation;
    private optimisticHistoryNavigation;
    private shouldQueueOfflineNavigation;
    private applyScroll;
    private applyAccessibility;
    private canUseFastNavigation;
    private shouldCaptureSnapshot;
    private shouldUseViewTransition;
    private resolveViewTransition;
    private installBrowserListeners;
}
export declare function createLinkRuntime(options?: LinkRuntimeOptions): LinkRuntime;
export declare function getDefaultLinkRuntime(): LinkRuntime;
//# sourceMappingURL=link-runtime.d.ts.map