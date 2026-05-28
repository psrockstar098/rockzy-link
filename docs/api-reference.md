# API Reference

This file lists the public API in plain language.

## React API

### `<Link />`

```tsx
import { Link } from "rockzy-link";

<Link href="/dashboard">Dashboard</Link>
```

Use `href` for normal/Next-style links and `to` for React Router-style links.

```tsx
<Link href="/docs">Docs</Link>
<Link to="/settings">Settings</Link>
```

### Link Props

| Prop | Type | Default | What It Does |
| --- | --- | --- | --- |
| `href` | `string \| URL` | required unless `to` exists | Destination URL |
| `to` | `string \| URL` | required unless `href` exists | Alias for React Router-style APIs |
| `replace` | `boolean` | `false` | Replace history instead of pushing |
| `state` | `unknown` | none | Pass state to router/history |
| `router` | `LinkRouter` | none | Framework adapter |
| `prefetch` | `"hover" \| "viewport" \| "idle" \| "none" \| boolean \| null` | `"hover"` | When to prefetch |
| `prefetchPriority` | `"high" \| "medium" \| "low"` | inferred | Override scheduler priority |
| `preloadAssets` | `readonly (string \| PrefetchAsset)[]` | none | Add asset preloads during prefetch |
| `speculationRules` | `boolean \| SpeculationRulesOptions` | runtime default | Add Chromium speculation rules |
| `cacheTags` | `readonly string[]` | none | Tags for prefetched cache entries |
| `cacheTtlMs` | `number` | runtime default | Cache TTL |
| `staleWhileRevalidateMs` | `number` | runtime default | Stale window |
| `estimateBytes` | `number` | `128000` | Scheduler budget estimate |
| `prefetchTimeoutMs` | `number` | runtime default | Prefetch timeout |
| `prefetchMaxRetries` | `number` | runtime default | Retry count |
| `prefetchRetryBaseDelayMs` | `number` | runtime default | Retry backoff base |
| `prefetchRetryMaxDelayMs` | `number` | runtime default | Retry backoff cap |
| `prefetchRetryBackoffFactor` | `number` | runtime default | Retry multiplier |
| `prefetchRetryJitterRatio` | `number` | runtime default | Retry jitter amount |
| `scroll` | `boolean \| string` | `true` | Scroll top, scroll to ID, or disable |
| `preventScrollReset` | `boolean` | `false` | Shortcut for `scroll={false}` |
| `scrollBehavior` | `"auto" \| "smooth" \| "instant"` | `"auto"` | Scroll behavior |
| `viewportScrollDebounceMs` | `number` | `120` | Debounce viewport prefetch while scrolling |
| `viewportScrollVelocityThreshold` | `number` | `1.4` | Fast-scroll threshold in px/ms |
| `hashOffset` | `number` | CSS/default | Pixel offset for hash targets |
| `viewTransition` | `boolean` | `false` | Use View Transition API when available |
| `focus` | `boolean \| string` | runtime default | Restore focus or choose selector |
| `announce` | `boolean \| string` | runtime default | Announce route change |
| `fallbackHref` | `string` | none | Fallback route if navigation fails |
| `beforeNavigate` | `NavigationGuard \| readonly NavigationGuard[]` | none | Per-link guard pipeline |
| `onBeforeNavigate` | `(href) => boolean \| void \| Promise<boolean \| void>` | none | Simple per-link guard |
| `onNavigate` | `(href) => void` | none | Called after navigation succeeds |
| `onNavigateError` | `(error, href) => void` | none | Called when navigation fails |
| `reloadDocument` | `boolean` | `false` | Let browser perform full document navigation |
| `disabled` | `boolean` | `false` | Render disabled `span` |
| `download` | `boolean \| string` | none | Native download attribute |

All normal anchor props like `className`, `target`, `rel`, and event handlers are also supported. External links automatically get `noopener noreferrer`.

### `<LinkRuntimeProvider />`

```tsx
const runtime = createLinkRuntime();

<LinkRuntimeProvider runtime={runtime}>
  <App />
</LinkRuntimeProvider>
```

Provides a runtime to all nested `Link` components.

### `useLinkRuntime()`

```tsx
const runtime = useLinkRuntime();
```

Returns the nearest provider runtime, or the default runtime.

### `<SkipNavigation />`

```tsx
<SkipNavigation targetId="main-content" />
```

Renders an accessible skip link.

## Runtime API

### `createLinkRuntime(options)`

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime({
  prefetch: {
    concurrency: 4,
    bandwidthBudgetBytesPerMinute: 2_500_000,
    memoryBudgetBytes: 50_000_000,
    crossTabDedupe: true,
    adaptive: {
      lowBatteryThreshold: 0.2,
      minDeviceMemoryGb: 1
    }
  },
  a11y: {
    announce: true,
    restoreFocus: true
  }
});
```

### Runtime Options

| Option | What It Does |
| --- | --- |
| `routeCache` | Provide a `RouteCache` or route cache options |
| `prefetch` | Scheduler options |
| `prefetchRoutes` | Route-specific prefetch defaults |
| `onPrefetchDiagnostics` | Receive scheduler metrics |
| `beforeNavigate` | Global navigation guards |
| `scroll.restoreOnPopState` | Restore snapshots on back/forward |
| `snapshots.maxEntries` | Max saved navigation snapshots |
| `snapshots.rootSelector` | DOM root for optional snapshot capture |
| `snapshots.restoreDom` | Store and restore root HTML snapshots |
| `viewTransition.enabled` | Enable View Transitions by default |
| `viewTransition.respectReducedMotion` | Avoid transitions for reduced-motion users |
| `a11y.announce` | Announce route changes |
| `a11y.restoreFocus` | Restore focus after navigation |
| `a11y.focusSelector` | Custom focus selector |
| `offline.enabled` | Enable offline navigation queue |
| `offline.optimistic` | Update history while offline |
| `offline.onOfflineQueueAdded` | Queue callback |
| `offline.onOfflineSyncing` | Flush start callback |
| `offline.onOfflineSynced` | Flush complete callback |

### Runtime Methods

| Method | What It Does |
| --- | --- |
| `runtime.prefetch(href, options)` | Schedule a prefetch |
| `runtime.navigate(href, options)` | Navigate using a router or History API |
| `runtime.beforeNavigate(guards)` | Add global guards; returns unregister function |
| `runtime.destroy()` | Cleanup listeners and scheduler work |

### `runtime.navigate()`

```ts
await runtime.navigate("/docs#install", {
  router,
  replace: false,
  state: { from: "home" },
  scroll: true,
  scrollBehavior: "smooth",
  hashOffset: 72,
  viewTransition: true,
  announce: "Docs",
  focus: "[data-route-focus]",
  fallbackHref: "/offline",
  guards: [({ href }) => href !== "/blocked"]
});
```

If no router is passed, the runtime uses `history.pushState()` or `history.replaceState()` and dispatches:

- `popstate`
- `production-link:navigate`
- `fullra-navigate`

Fast path tip:

```ts
runtime.navigate("/dashboard", {
  router,
  scroll: false,
  announce: false,
  focus: false
});
```

### `runtime.prefetch()`

```ts
runtime.prefetch("/reports", {
  priority: "medium",
  kind: "html",
  tags: ["reports"],
  ttlMs: 120_000,
  staleWhileRevalidateMs: 30_000,
  estimateBytes: 180_000,
  staleAfterMs: 10_000,
  timeoutMs: 4_000,
  maxRetries: 1,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 2_000,
  retryBackoffFactor: 2,
  retryJitterRatio: 0.5,
  viewportScore: 75,
  assets: ["/assets/reports.css", { href: "/assets/reports.js", module: true }],
  speculationRules: { action: "prefetch" }
});
```

### Router Adapter

```ts
type LinkRouter = {
  push: (
    href: string,
    opts?: { replace?: boolean; state?: unknown }
  ) => void | Promise<void>;
  prefetch?: (href: string) => void | Promise<void>;
};
```

## Route Cache API

```ts
import { RouteCache } from "rockzy-link/cache";

const cache = new RouteCache({
  maxEntries: 500,
  maxBytes: 50_000_000,
  defaultTtlMs: 300_000,
  defaultStaleWhileRevalidateMs: 30_000
});
```

| Method | What It Does |
| --- | --- |
| `cache.get(key, kind)` | Read a cache entry and count a hit |
| `cache.has(key, kind)` | Check presence without counting a read hit |
| `cache.set(key, kind, value, options)` | Write a cache entry |
| `cache.delete(key, kind)` | Delete one cache entry |
| `cache.invalidateTag(tag)` | Delete entries with one tag |
| `cache.invalidateTags(tags)` | Delete entries with many tags |
| `cache.getKeysForTag(tag)` | Return composite keys for a tag |
| `cache.invalidateMutation(routeKey, tags)` | Delete route layers and tags after mutation |
| `cache.pruneExpired()` | Remove expired entries |
| `cache.setMemoryBudget(bytes)` | Change memory budget and evict if needed |
| `cache.keys()` | Return composite cache keys |
| `cache.clear()` | Clear all entries |

Helpers:

| Helper | What It Does |
| --- | --- |
| `createCacheKey(kind, key)` | Build a composite key |
| `estimateBytes(value)` | Estimate cache weight |

Cache kinds:

`route-data`, `rsc`, `loader`, `api`, `html`, `script`, `image`, `font`

## Browser Cache Helpers

```ts
import {
  matchBrowserCache,
  putBrowserCache,
  prefetchToBrowserCache
} from "rockzy-link/cache/browser";

await prefetchToBrowserCache("/docs/getting-started");
```

## Node Cache Adapter

```ts
import { createNodeRouteCache } from "rockzy-link/cache/node";

const cache = await createNodeRouteCache({
  maxEntries: 2_000
});
```

The adapter writes to `@cacheable/node-cache` and mirrors invalidation through an in-memory `RouteCache`.

## Prefetch Scheduler API

```ts
import { SmartPrefetchScheduler } from "rockzy-link/prefetch";

const scheduler = new SmartPrefetchScheduler({
  concurrency: 4,
  bandwidthBudgetBytesPerMinute: 2_500_000,
  memoryBudgetBytes: 50_000_000,
  crossTabDedupe: true
});
```

Common methods:

| Method | What It Does |
| --- | --- |
| `scheduler.prefetch(href, fetcher, options)` | Queue a prefetch |
| `scheduler.cancel(href)` | Cancel queued/running work |
| `scheduler.cancelStale(maxAgeMs)` | Cancel stale low/medium priority tasks |
| `scheduler.clear()` | Cancel and clear all work |
| `scheduler.recordNavigation(href)` | Count a navigation for diagnostics |
| `scheduler.getDiagnostics()` | Read metrics |
| `scheduler.destroy()` | Cleanup |

Diagnostics include queue size, in-flight count, cache hits, bytes fetched, retries, cancellations, navigation count, prefetch-to-click ratio, and prefetched navigation ratio.

## Offline API

```ts
runtime.offline.register("/sw.js");
runtime.offline.queueNavigation("/dashboard");
const queue = runtime.offline.readQueue();
```

Window events:

- `offline-queue:added`
- `syncing`
- `synced`

## Security API

```ts
import {
  classifyHref,
  getHrefString,
  isUnsafeHref,
  sanitizeHref
} from "rockzy-link/security";
```

Unsafe protocols like `javascript:`, `vbscript:`, and `data:` are blocked.

## Navigation Utilities

```ts
import { ScrollRestorationManager } from "rockzy-link/navigation/scroll";
import { runWithViewTransition } from "rockzy-link/navigation/view-transitions";
```

The root package also exports `AccessibilityManager`, `OfflineNavigationManager`, and `NavigationSnapshotCache` for advanced integrations.
