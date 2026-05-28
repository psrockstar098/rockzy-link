import { AccessibilityManager } from "../a11y/accessibility-manager.js";
import { prefetchToBrowserCache } from "../cache/browser-cache.js";
import { RouteCache } from "../cache/route-cache.js";
import { getCurrentHref, isBrowser, prefersReducedMotion, queueMicrotaskSafe } from "../environment.js";
import { NavigationSnapshotCache } from "../navigation/navigation-snapshot-cache.js";
import { ScrollRestorationManager } from "../navigation/scroll-restoration.js";
import { runWithViewTransition } from "../navigation/view-transitions.js";
import { OfflineNavigationManager } from "../offline/offline-navigation.js";
import { SmartPrefetchScheduler } from "../prefetch/scheduler.js";
import { classifyHref } from "../security/url.js";
export class LinkRuntime {
    routeCache;
    scheduler;
    scroll;
    a11y;
    offline;
    snapshots;
    options;
    beforeNavigateGuards = [];
    cleanup = [];
    constructor(options = {}) {
        this.options = options;
        this.routeCache =
            options.routeCache instanceof RouteCache
                ? options.routeCache
                : new RouteCache(options.routeCache);
        this.scroll = new ScrollRestorationManager();
        this.a11y = new AccessibilityManager();
        this.offline = new OfflineNavigationManager(options.offline);
        this.snapshots = new NavigationSnapshotCache(this.scroll, options.snapshots);
        this.scheduler = new SmartPrefetchScheduler({
            ...options.prefetch,
            onDiagnostics: options.onPrefetchDiagnostics ?? options.prefetch?.onDiagnostics,
            routeCache: this.routeCache,
            fetcher: options.prefetch?.fetcher ?? defaultRuntimePrefetcher
        });
        this.addBeforeNavigateGuards(options.beforeNavigate);
        this.installBrowserListeners();
    }
    prefetch(hrefLike, options = {}) {
        const classified = classifyHref(hrefLike);
        if (classified.isUnsafe || classified.isExternal || classified.isHash) {
            return new AbortController();
        }
        const routeOptions = this.resolveRoutePrefetchOptions(classified.href);
        const mergedOptions = { ...routeOptions, ...options };
        return this.scheduler.prefetch(classified.href, options.fetcher, {
            priority: mergedOptions.priority ?? "low",
            kind: mergedOptions.kind,
            tags: mergedOptions.tags,
            ttlMs: mergedOptions.ttlMs,
            staleWhileRevalidateMs: mergedOptions.staleWhileRevalidateMs,
            estimateBytes: mergedOptions.estimateBytes,
            staleAfterMs: mergedOptions.staleAfterMs,
            timeoutMs: mergedOptions.timeoutMs,
            maxRetries: mergedOptions.maxRetries,
            retryBaseDelayMs: mergedOptions.retryBaseDelayMs,
            retryMaxDelayMs: mergedOptions.retryMaxDelayMs,
            retryBackoffFactor: mergedOptions.retryBackoffFactor,
            retryJitterRatio: mergedOptions.retryJitterRatio,
            viewportScore: mergedOptions.viewportScore,
            assets: mergedOptions.assets,
            speculationRules: mergedOptions.speculationRules
        });
    }
    navigate(hrefLike, options = {}) {
        if (!isBrowser())
            return;
        const classified = classifyHref(hrefLike);
        if (classified.isUnsafe)
            return;
        const href = classified.href;
        if (this.canUseFastNavigation(options)) {
            this.scheduler.recordNavigation(href);
            return this.performNavigation(href, options);
        }
        const from = getCurrentHref();
        const beforeResult = this.runBeforeNavigate(href, from, options);
        if (beforeResult instanceof Promise) {
            return beforeResult.then((allowed) => {
                if (!allowed)
                    return;
                return this.continueNavigate(href, from, options);
            });
        }
        if (!beforeResult)
            return;
        return this.continueNavigate(href, from, options);
    }
    continueNavigate(href, from, options) {
        this.scheduler.recordNavigation(href);
        if (this.shouldCaptureSnapshot(options)) {
            this.snapshots.capture(from);
        }
        const navigationResult = this.performNavigation(href, options);
        const handlePostNavigation = () => {
            this.applyScroll(href, options);
            this.applyAccessibility(href, options);
        };
        const handleTransitionError = (error) => {
            if (options.fallbackHref && options.fallbackHref !== href) {
                const fallbackResult = this.performNavigation(options.fallbackHref, options);
                if (fallbackResult instanceof Promise) {
                    return fallbackResult.then(handlePostNavigation);
                }
                handlePostNavigation();
            }
            else {
                throw error;
            }
        };
        const useTransition = this.shouldUseViewTransition(options);
        if (useTransition) {
            const viewTransitionConfig = this.resolveViewTransition(options);
            const transitionResult = runWithViewTransition(() => {
                return navigationResult;
            }, viewTransitionConfig);
            if (transitionResult instanceof Promise) {
                return transitionResult.then(handlePostNavigation, handleTransitionError);
            }
        }
        if (navigationResult instanceof Promise) {
            return navigationResult.then(handlePostNavigation, handleTransitionError);
        }
        handlePostNavigation();
    }
    destroy() {
        for (const cleanup of this.cleanup.splice(0))
            cleanup();
        this.scheduler.destroy();
    }
    beforeNavigate(guards) {
        const list = normalizeGuards(guards);
        this.beforeNavigateGuards.push(...list);
        return () => {
            for (const guard of list) {
                const index = this.beforeNavigateGuards.indexOf(guard);
                if (index >= 0)
                    this.beforeNavigateGuards.splice(index, 1);
            }
        };
    }
    addBeforeNavigateGuards(guards) {
        if (!guards)
            return;
        this.beforeNavigateGuards.push(...normalizeGuards(guards));
    }
    runBeforeNavigate(href, from, options) {
        const globalGuards = this.beforeNavigateGuards;
        const localGuards = options.guards;
        if (globalGuards.length === 0 && !localGuards) {
            return true;
        }
        const context = { href, from, options, runtime: this };
        for (let index = 0; index < globalGuards.length; index += 1) {
            const guard = globalGuards[index];
            if (!guard)
                continue;
            const result = guard(context);
            if (result instanceof Promise) {
                return this.runBeforeNavigateAsync(context, index, result, localGuards);
            }
            if (result === false) {
                return false;
            }
        }
        if (localGuards) {
            if (typeof localGuards === "function") {
                const result = localGuards(context);
                if (result instanceof Promise) {
                    return this.runBeforeNavigateLocalAsync(context, result, undefined, 0);
                }
                if (result === false) {
                    return false;
                }
            }
            else {
                for (let index = 0; index < localGuards.length; index += 1) {
                    const guard = localGuards[index];
                    if (!guard)
                        continue;
                    const result = guard(context);
                    if (result instanceof Promise) {
                        return this.runBeforeNavigateLocalAsync(context, result, localGuards, index);
                    }
                    if (result === false) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    async runBeforeNavigateAsync(context, globalStartIndex, pendingPromise, localGuards) {
        if ((await pendingPromise) === false)
            return false;
        const globalGuards = this.beforeNavigateGuards;
        for (let index = globalStartIndex + 1; index < globalGuards.length; index += 1) {
            const guard = globalGuards[index];
            if (!guard)
                continue;
            const result = guard(context);
            if (result instanceof Promise) {
                if ((await result) === false)
                    return false;
            }
            else if (result === false) {
                return false;
            }
        }
        if (localGuards) {
            if (typeof localGuards === "function") {
                const result = localGuards(context);
                if (result instanceof Promise) {
                    if ((await result) === false)
                        return false;
                }
                else if (result === false) {
                    return false;
                }
            }
            else {
                for (let index = 0; index < localGuards.length; index += 1) {
                    const guard = localGuards[index];
                    if (!guard)
                        continue;
                    const result = guard(context);
                    if (result instanceof Promise) {
                        if ((await result) === false)
                            return false;
                    }
                    else if (result === false) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    async runBeforeNavigateLocalAsync(context, pendingPromise, localGuards, localStartIndex) {
        if ((await pendingPromise) === false)
            return false;
        if (localGuards) {
            for (let index = localStartIndex + 1; index < localGuards.length; index += 1) {
                const guard = localGuards[index];
                if (!guard)
                    continue;
                const result = guard(context);
                if (result instanceof Promise) {
                    if ((await result) === false)
                        return false;
                }
                else if (result === false) {
                    return false;
                }
            }
        }
        return true;
    }
    resolveRoutePrefetchOptions(href) {
        const merged = {};
        for (const rule of this.options.prefetchRoutes ?? []) {
            if (routeMatches(rule.match, href)) {
                Object.assign(merged, rule.options);
            }
        }
        return merged;
    }
    performNavigation(href, options) {
        if (this.shouldQueueOfflineNavigation()) {
            this.optimisticHistoryNavigation(href, options);
            this.offline.queueNavigation(href, options.replace ?? false, options.state);
            return;
        }
        if (options.router) {
            if (options.replace === undefined && options.state === undefined) {
                const result = options.router.push(href);
                if (result instanceof Promise) {
                    return result;
                }
                return;
            }
            const routerOptions = {};
            if (options.replace !== undefined)
                routerOptions.replace = options.replace;
            if (options.state !== undefined)
                routerOptions.state = options.state;
            const result = options.router.push(href, routerOptions);
            if (result instanceof Promise) {
                return result;
            }
            return;
        }
        this.optimisticHistoryNavigation(href, options);
    }
    optimisticHistoryNavigation(href, options) {
        const state = options.state ?? {};
        if (options.replace) {
            window.history.replaceState(state, "", href);
        }
        else {
            window.history.pushState(state, "", href);
        }
        window.dispatchEvent(new PopStateEvent("popstate", { state }));
        window.dispatchEvent(new CustomEvent("production-link:navigate", {
            detail: { href, replace: options.replace ?? false, state }
        }));
        window.dispatchEvent(new Event("fullra-navigate"));
    }
    shouldQueueOfflineNavigation() {
        return Boolean(this.options.offline?.enabled &&
            this.options.offline.optimistic !== false &&
            isBrowser() &&
            "onLine" in navigator &&
            !navigator.onLine);
    }
    applyScroll(href, options) {
        if (options.scroll === false)
            return;
        const scroll = resolveScroll(options.scroll);
        if (!scroll.enabled)
            return;
        if (scroll.id) {
            this.scroll.scrollToElement(scroll.id, {
                behavior: options.scrollBehavior,
                hashOffset: options.hashOffset
            });
            return;
        }
        const hash = hashFromHref(href);
        if (hash) {
            this.scroll.scrollToElement(hash, {
                behavior: options.scrollBehavior,
                hashOffset: options.hashOffset
            });
            return;
        }
        this.scroll.scrollToTop(options.scrollBehavior);
    }
    applyAccessibility(href, options) {
        const announce = options.announce ?? this.options.a11y?.announce ?? true;
        const focus = options.focus ?? this.options.a11y?.restoreFocus ?? true;
        if (!announce && !focus)
            return;
        queueMicrotaskSafe(() => {
            if (announce) {
                this.a11y.announceRouteChange(href, {
                    label: typeof announce === "string" ? announce : undefined
                });
            }
            if (focus) {
                this.a11y.restoreFocus({
                    selector: typeof focus === "string" ? focus : this.options.a11y?.focusSelector
                });
            }
        });
    }
    canUseFastNavigation(options) {
        return Boolean(options.router &&
            this.beforeNavigateGuards.length === 0 &&
            !options.guards &&
            !options.fallbackHref &&
            !this.shouldQueueOfflineNavigation() &&
            !this.shouldUseViewTransition(options) &&
            !this.shouldCaptureSnapshot(options) &&
            options.scroll === false &&
            (options.announce ?? this.options.a11y?.announce ?? true) === false &&
            (options.focus ?? this.options.a11y?.restoreFocus ?? true) === false);
    }
    shouldCaptureSnapshot(options) {
        if (options.restoreDomSnapshot || this.options.snapshots?.restoreDom)
            return true;
        return options.scroll !== false;
    }
    shouldUseViewTransition(options) {
        const enabled = typeof options.viewTransition === "boolean"
            ? options.viewTransition
            : options.viewTransition?.enabled ?? this.options.viewTransition?.enabled ?? false;
        if (!enabled || !isBrowser() || !document.startViewTransition)
            return false;
        const respectReducedMotion = typeof options.viewTransition === "object"
            ? options.viewTransition.respectReducedMotion
            : this.options.viewTransition?.respectReducedMotion;
        return !(respectReducedMotion !== false &&
            prefersReducedMotion());
    }
    resolveViewTransition(options) {
        if (typeof options.viewTransition === "boolean") {
            return {
                ...this.options.viewTransition,
                enabled: options.viewTransition
            };
        }
        return {
            ...this.options.viewTransition,
            ...options.viewTransition,
            enabled: options.viewTransition?.enabled ??
                this.options.viewTransition?.enabled ??
                false
        };
    }
    installBrowserListeners() {
        if (!isBrowser())
            return;
        const onPopState = () => {
            if (this.options.scroll?.restoreOnPopState === false)
                return;
            const key = getCurrentHref();
            window.setTimeout(() => {
                this.snapshots.restore(key, {
                    restoreDom: this.options.snapshots?.restoreDom
                });
                this.applyAccessibility(key, { announce: true, focus: true });
            }, 0);
        };
        const onOnline = () => {
            this.offline.flushQueue(async (navigation) => {
                await this.performNavigation(navigation.href, navigation);
            });
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                this.scroll.save(getCurrentHref());
                this.snapshots.capture(getCurrentHref());
                this.routeCache.pruneExpired();
                this.scheduler.cancelStale(0);
            }
        };
        const onMemoryPressure = () => {
            this.routeCache.pruneExpired();
            this.scheduler.cancelStale(0);
            this.routeCache.setMemoryBudget(Math.floor(this.routeCache.totalBytes * 0.6));
        };
        window.addEventListener("popstate", onPopState);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("memorypressure", onMemoryPressure);
        this.cleanup.push(() => window.removeEventListener("popstate", onPopState));
        this.cleanup.push(() => window.removeEventListener("online", onOnline));
        this.cleanup.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));
        this.cleanup.push(() => window.removeEventListener("memorypressure", onMemoryPressure));
    }
}
let defaultRuntime;
export function createLinkRuntime(options = {}) {
    return new LinkRuntime(options);
}
export function getDefaultLinkRuntime() {
    defaultRuntime ??= createLinkRuntime({
        prefetch: {
            concurrency: 4,
            bandwidthBudgetBytesPerMinute: 2_500_000,
            memoryBudgetBytes: 50_000_000,
            crossTabDedupe: true
        },
        a11y: {
            announce: true,
            restoreFocus: true
        },
        offline: {
            enabled: true,
            optimistic: true
        }
    });
    return defaultRuntime;
}
function resolveScroll(scroll) {
    if (scroll === false)
        return { enabled: false };
    if (typeof scroll === "string")
        return { enabled: true, id: scroll };
    return { enabled: true };
}
function hashFromHref(href) {
    try {
        const hash = new URL(href, window.location.origin).hash;
        return hash || undefined;
    }
    catch {
        return undefined;
    }
}
async function defaultRuntimePrefetcher(href, context) {
    return prefetchToBrowserCache(href, {
        requestInit: {
            signal: context.signal
        }
    });
}
function normalizeGuards(guards) {
    if (!guards)
        return [];
    return typeof guards === "function" ? [guards] : [...guards];
}
function routeMatches(match, href) {
    if (typeof match === "function")
        return match(href);
    if (match instanceof RegExp)
        return match.test(href);
    if (match.endsWith("*")) {
        return href.startsWith(match.slice(0, -1));
    }
    if (href === match)
        return true;
    try {
        const url = new URL(href, window.location.origin);
        return url.pathname === match;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=link-runtime.js.map