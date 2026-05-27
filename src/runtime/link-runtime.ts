import { AccessibilityManager } from "../a11y/accessibility-manager.js";
import { prefetchToBrowserCache } from "../cache/browser-cache.js";
import { RouteCache } from "../cache/route-cache.js";
import type { RouteCacheOptions } from "../cache/route-cache.js";
import { getCurrentHref, isBrowser, queueMicrotaskSafe } from "../environment.js";
import { NavigationSnapshotCache } from "../navigation/navigation-snapshot-cache.js";
import type { NavigationSnapshotOptions } from "../navigation/navigation-snapshot-cache.js";
import { ScrollRestorationManager } from "../navigation/scroll-restoration.js";
import { runWithViewTransition } from "../navigation/view-transitions.js";
import type { ViewTransitionConfig } from "../navigation/view-transitions.js";
import { OfflineNavigationManager } from "../offline/offline-navigation.js";
import { SmartPrefetchScheduler } from "../prefetch/scheduler.js";
import type {
  PrefetchFetcher,
  PrefetchSchedulerOptions,
  PrefetchTaskOptions
} from "../prefetch/scheduler.js";
import { classifyHref, getHrefString } from "../security/url.js";
import type { Href, LinkRouter, PrefetchPriority, ScrollBehavior } from "../types.js";

export interface RuntimePrefetchOptions
  extends Partial<Omit<PrefetchTaskOptions, "priority">> {
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

export class LinkRuntime {
  readonly routeCache: RouteCache;
  readonly scheduler: SmartPrefetchScheduler;
  readonly scroll: ScrollRestorationManager;
  readonly a11y: AccessibilityManager;
  readonly offline: OfflineNavigationManager;
  readonly snapshots: NavigationSnapshotCache;
  private readonly options: LinkRuntimeOptions;
  private readonly cleanup: Array<() => void> = [];

  constructor(options: LinkRuntimeOptions = {}) {
    this.options = options;
    this.routeCache =
      options.routeCache instanceof RouteCache
        ? options.routeCache
        : new RouteCache(options.routeCache);
    this.scroll = new ScrollRestorationManager();
    this.a11y = new AccessibilityManager();
    this.offline = new OfflineNavigationManager();
    this.snapshots = new NavigationSnapshotCache(this.scroll, options.snapshots);
    this.scheduler = new SmartPrefetchScheduler({
      ...options.prefetch,
      routeCache: this.routeCache,
      fetcher: defaultRuntimePrefetcher
    });

    this.installBrowserListeners();
  }

  prefetch(hrefLike: Href, options: RuntimePrefetchOptions = {}): AbortController {
    const classified = classifyHref(hrefLike);
    if (classified.isUnsafe || classified.isExternal || classified.isHash) {
      return new AbortController();
    }

    return this.scheduler.prefetch(classified.href, options.fetcher, {
      priority: options.priority ?? "low",
      kind: options.kind,
      tags: options.tags,
      ttlMs: options.ttlMs,
      staleWhileRevalidateMs: options.staleWhileRevalidateMs,
      estimateBytes: options.estimateBytes,
      staleAfterMs: options.staleAfterMs,
      timeoutMs: options.timeoutMs,
      viewportScore: options.viewportScore
    });
  }

  async navigate(hrefLike: Href, options: NavigationOptions = {}): Promise<void> {
    if (!isBrowser()) return;

    const classified = classifyHref(hrefLike);
    if (classified.isUnsafe) return;

    const href = classified.href;
    const from = getCurrentHref();
    this.scroll.save(from);
    this.snapshots.capture(from);

    const navigation = async () => {
      await this.performNavigation(href, options);
    };

    try {
      await runWithViewTransition(navigation, this.resolveViewTransition(options));
    } catch (error) {
      if (options.fallbackHref && options.fallbackHref !== href) {
        await this.performNavigation(options.fallbackHref, options);
      } else {
        throw error;
      }
    }

    this.applyScroll(href, options);
    this.applyAccessibility(href, options);
  }

  destroy(): void {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.scheduler.destroy();
  }

  private async performNavigation(
    href: string,
    options: NavigationOptions
  ): Promise<void> {
    if (this.shouldQueueOfflineNavigation()) {
      this.optimisticHistoryNavigation(href, options);
      this.offline.queueNavigation(href, options.replace ?? false, options.state);
      return;
    }

    if (options.router) {
      const routerOptions: { replace?: boolean; state?: unknown } = {};
      if (options.replace !== undefined) routerOptions.replace = options.replace;
      if (options.state !== undefined) routerOptions.state = options.state;
      await options.router.push(href, routerOptions);
      return;
    }

    this.optimisticHistoryNavigation(href, options);
  }

  private optimisticHistoryNavigation(
    href: string,
    options: NavigationOptions
  ): void {
    const state = options.state ?? {};
    if (options.replace) {
      window.history.replaceState(state, "", href);
    } else {
      window.history.pushState(state, "", href);
    }

    window.dispatchEvent(new PopStateEvent("popstate", { state }));
    window.dispatchEvent(
      new CustomEvent("production-link:navigate", {
        detail: { href, replace: options.replace ?? false, state }
      })
    );
    window.dispatchEvent(new Event("fullra-navigate"));
  }

  private shouldQueueOfflineNavigation(): boolean {
    return Boolean(
      this.options.offline?.enabled &&
        this.options.offline.optimistic !== false &&
        isBrowser() &&
        "onLine" in navigator &&
        !navigator.onLine
    );
  }

  private applyScroll(href: string, options: NavigationOptions): void {
    const scroll = resolveScroll(options.scroll);
    if (!scroll.enabled) return;

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

  private applyAccessibility(href: string, options: NavigationOptions): void {
    const announce = options.announce ?? this.options.a11y?.announce ?? true;
    const focus = options.focus ?? this.options.a11y?.restoreFocus ?? true;

    queueMicrotaskSafe(() => {
      if (announce) {
        this.a11y.announceRouteChange(href, {
          label: typeof announce === "string" ? announce : undefined
        });
      }

      if (focus) {
        this.a11y.restoreFocus({
          selector:
            typeof focus === "string" ? focus : this.options.a11y?.focusSelector
        });
      }
    });
  }

  private resolveViewTransition(options: NavigationOptions): ViewTransitionConfig {
    if (typeof options.viewTransition === "boolean") {
      return {
        ...this.options.viewTransition,
        enabled: options.viewTransition
      };
    }
    return {
      ...this.options.viewTransition,
      ...options.viewTransition,
      enabled:
        options.viewTransition?.enabled ??
        this.options.viewTransition?.enabled ??
        false
    };
  }

  private installBrowserListeners(): void {
    if (!isBrowser()) return;

    const onPopState = () => {
      if (this.options.scroll?.restoreOnPopState === false) return;
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
    this.cleanup.push(() =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
    );
    this.cleanup.push(() =>
      window.removeEventListener("memorypressure", onMemoryPressure)
    );
  }
}

let defaultRuntime: LinkRuntime | undefined;

export function createLinkRuntime(options: LinkRuntimeOptions = {}): LinkRuntime {
  return new LinkRuntime(options);
}

export function getDefaultLinkRuntime(): LinkRuntime {
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

function resolveScroll(scroll: boolean | string | undefined): {
  enabled: boolean;
  id?: string;
} {
  if (scroll === false) return { enabled: false };
  if (typeof scroll === "string") return { enabled: true, id: scroll };
  return { enabled: true };
}

function hashFromHref(href: string): string | undefined {
  try {
    const hash = new URL(href, window.location.origin).hash;
    return hash || undefined;
  } catch {
    return undefined;
  }
}

async function defaultRuntimePrefetcher(
  href: string,
  context: Parameters<PrefetchFetcher>[1]
): Promise<Response | undefined> {
  return prefetchToBrowserCache(href, {
    requestInit: {
      signal: context.signal
    }
  });
}
