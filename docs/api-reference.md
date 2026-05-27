# API Reference

## `<Link />`

```tsx
<Link href="/dashboard">Dashboard</Link>
```

Core props:

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `href` | `string | URL` | required | Destination URL |
| `replace` | `boolean` | `false` | Replace current history entry |
| `scroll` | `boolean | string` | `true` | Scroll top, scroll to element id, or disable |
| `scrollBehavior` | `"auto" | "smooth" | "instant"` | `"auto"` | Scroll behavior |
| `prefetch` | `"hover" | "viewport" | "idle" | "none" | false` | `"hover"` | Prefetch trigger |
| `prefetchPriority` | `"high" | "medium" | "low"` | inferred | Override scheduler priority |
| `router` | `LinkRouter` | none | Adapter for framework navigation |
| `state` | `unknown` | none | State attached to history/router navigation |
| `viewTransition` | `boolean` | `false` | Use native View Transition API when available |
| `disabled` | `boolean` | `false` | Render a disabled `span` |
| `download` | `boolean | string` | none | Native download attribute |
| `cacheTags` | `readonly string[]` | none | Tags for prefetched cache entries |
| `cacheTtlMs` | `number` | runtime default | Cache TTL |
| `staleWhileRevalidateMs` | `number` | runtime default | Stale window |
| `estimateBytes` | `number` | `128000` | Budget estimate for scheduler |
| `hashOffset` | `number` | CSS/default | Pixel offset for hash scrolling |
| `focus` | `boolean | string` | runtime default | Focus restore toggle or selector |
| `announce` | `boolean | string` | runtime default | Announce toggle or label |
| `fallbackHref` | `string` | none | Route fallback after navigation failure |

Event props:

```tsx
<Link
  href="/account"
  onBeforeNavigate={async (href) => {
    return await canLeaveCurrentPage(href);
  }}
  onNavigate={(href) => analytics.track("navigate", { href })}
  onNavigateError={(error, href) => reportNavigationError(error, href)}
>
  Account
</Link>
```

## `createLinkRuntime(options)`

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime({
  prefetch: {
    concurrency: 4,
    bandwidthBudgetBytesPerMinute: 2_500_000,
    memoryBudgetBytes: 50_000_000,
    crossTabDedupe: true
  },
  a11y: {
    announce: true,
    restoreFocus: true,
    focusSelector: "[data-route-focus]"
  },
  offline: {
    enabled: true,
    optimistic: true
  },
  viewTransition: {
    enabled: true,
    respectReducedMotion: true
  },
  scroll: {
    restoreOnPopState: true
  }
});
```

Runtime methods:

| Method | Purpose |
| --- | --- |
| `runtime.prefetch(href, options)` | Schedule a route prefetch |
| `runtime.navigate(href, options)` | Navigate through adapter or History API |
| `runtime.destroy()` | Remove listeners and cancel scheduler work |
| `runtime.routeCache.get()` | Read cached route/API data |
| `runtime.routeCache.set()` | Write cached route/API data |
| `runtime.routeCache.invalidateTag()` | Invalidate by tag |
| `runtime.routeCache.invalidateMutation()` | Invalidate route layers and tags after mutation |
| `runtime.scroll.registerContainer()` | Register nested scroll containers |
| `runtime.offline.register()` | Register a service worker |
| `runtime.offline.queueNavigation()` | Queue navigation while offline |

## Router Adapter

```ts
type LinkRouter = {
  push: (
    href: string,
    opts?: { replace?: boolean; state?: unknown }
  ) => void | Promise<void>;
  prefetch?: (href: string) => void | Promise<void>;
};
```

Use adapters to plug into Next.js, Vue Router, SvelteKit, Angular Router, TanStack Router, React Router, or any custom router.

## `runtime.prefetch()`

```ts
runtime.prefetch("/reports", {
  priority: "medium",
  kind: "html",
  tags: ["reports"],
  ttlMs: 120_000,
  staleWhileRevalidateMs: 30_000,
  estimateBytes: 180_000,
  viewportScore: 75
});
```

Priority guide:

- `high`: user is very likely to click.
- `medium`: visible and likely.
- `low`: idle or speculative.

## `runtime.navigate()`

```ts
await runtime.navigate("/docs#install", {
  router,
  replace: false,
  scroll: true,
  scrollBehavior: "smooth",
  hashOffset: 72,
  viewTransition: true,
  announce: "Documentation",
  focus: "[data-route-focus]"
});
```

If no router is provided, navigation uses `window.history.pushState()` or `replaceState()` and dispatches:

- `popstate`
- `production-link:navigate`
- `fullra-navigate`

## `RouteCache`

```ts
import { RouteCache } from "rockzy-link/cache";

const cache = new RouteCache({
  maxEntries: 500,
  maxBytes: 50_000_000,
  defaultTtlMs: 300_000,
  defaultStaleWhileRevalidateMs: 30_000
});
```

Set:

```ts
cache.set("/api/projects", "api", projects, {
  ttlMs: 60_000,
  staleWhileRevalidateMs: 10_000,
  tags: ["projects"]
});
```

Get:

```ts
const result = cache.get<Project[]>("/api/projects", "api");

if (result && result.stale) {
  refreshProjectsInBackground();
}
```

Invalidate:

```ts
cache.invalidateTag("projects");
cache.invalidateMutation("/projects/42", ["project:42", "projects"]);
```

### Node Cache Adapter Invalidation

When utilizing the `createNodeRouteCache` wrapper (from `rockzy-link/cache/node`), any invalidation commands like `invalidateTag` and `invalidateMutation` automatically propagate down to evict entries in both the in-memory cache and the underlying server-side `@cacheable/node-cache` database. This ensures unified cache consistency.

## URL Security

```ts
import { classifyHref, sanitizeHref } from "rockzy-link/security";

const info = classifyHref(userHref);

if (info.isUnsafe) {
  console.warn(info.reason);
}

const href = sanitizeHref(userHref);
```

Unsafe protocols such as `javascript:`, `vbscript:`, and `data:` are blocked.

