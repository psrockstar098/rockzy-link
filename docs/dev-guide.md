# Developer Guide

This package gives you a production-grade navigation primitive, not just a prettier `<a>`.

It has two layers:

- `rockzy-link`: React component and public utilities.
- `rockzy-link/runtime`: framework-neutral runtime for Vue, Nuxt, SvelteKit, Angular, Solid, Qwik, Astro, and vanilla JavaScript.

Use it when you want route navigation to coordinate:

- safe URL parsing
- smart prefetch
- route cache
- scroll restoration
- view transitions
- accessibility announcements
- offline fallback
- back/forward snapshots

## Basic Setup

```tsx
import {
  Link,
  LinkRuntimeProvider,
  createLinkRuntime
} from "rockzy-link";

const runtime = createLinkRuntime({
  prefetch: {
    concurrency: 4,
    bandwidthBudgetBytesPerMinute: 3_000_000,
    memoryBudgetBytes: 30_000_000
  },
  offline: {
    enabled: true,
    optimistic: true
  },
  a11y: {
    announce: true,
    restoreFocus: true
  },
  viewTransition: {
    enabled: true,
    respectReducedMotion: true
  }
});

export function App() {
  return (
    <LinkRuntimeProvider runtime={runtime}>
      <Link href="/dashboard" prefetch="viewport">
        Dashboard
      </Link>
    </LinkRuntimeProvider>
  );
}
```

For non-React frameworks:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export const runtime = createLinkRuntime();
```

Then connect your framework router:

```ts
await runtime.navigate("/dashboard", {
  router: {
    push: (href) => frameworkRouter.push(href),
    prefetch: (href) => frameworkRouter.prefetch?.(href)
  }
});
```

## How The Runtime Works

Navigation has two paths: prefetch and click.

Prefetch path:

1. A link receives hover, focus, viewport, or idle intent.
2. The URL is classified and unsafe URLs are rejected.
3. The task enters the scheduler with `high`, `medium`, or `low` priority.
4. The scheduler checks concurrency, bandwidth, device, save-data, visibility, and memory budgets.
5. The scheduler deduplicates same-route work in the current tab and across tabs.
6. The fetcher warms browser cache, framework preload APIs, route cache, or any custom cache you provide.

Click path:

1. The runtime saves scroll and navigation snapshots for the current route.
2. It runs `onBeforeNavigate` or your own guard if you use one.
3. It delegates to your router adapter, or falls back to `history.pushState()`.
4. It runs view transitions when supported.
5. It restores scroll or hash position.
6. It announces the route change and restores focus.
7. If offline mode is enabled, failed/offline navigations can queue for later replay.

## Choosing The Right Import

React:

```tsx
import { Link } from "rockzy-link";
```

Any other framework:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";
```

Cache-only usage:

```ts
import { RouteCache } from "rockzy-link/cache";
```

Security-only usage:

```ts
import { sanitizeHref } from "rockzy-link/security";
```

## Prefetch Modes

```tsx
<Link href="/pricing" prefetch="hover">Pricing</Link>
<Link href="/dashboard" prefetch="viewport">Dashboard</Link>
<Link href="/legal" prefetch="idle">Legal</Link>
<Link href="/billing" prefetch="none">Billing</Link>
```

Use this mapping:

- `hover`: highest priority, best for likely user intent.
- `viewport`: medium priority, best for menus and primary content links.
- `idle`: low priority, best for cheap pages that improve later navigation.
- `none`: disable prefetch for expensive, private, or mutation-sensitive routes.

Priority can be overridden:

```tsx
<Link href="/admin" prefetch="viewport" prefetchPriority="low">
  Admin
</Link>
```

Manual prefetch:

```ts
runtime.prefetch("/reports", {
  priority: "medium",
  estimateBytes: 180_000,
  tags: ["reports"],
  ttlMs: 120_000
});
```

## Route Cache

```ts
runtime.routeCache.set("/api/user/42", "api", user, {
  ttlMs: 60_000,
  staleWhileRevalidateMs: 15_000,
  tags: ["user:42"]
});

const cached = runtime.routeCache.get("/api/user/42", "api");
```

Invalidate after mutations:

```ts
runtime.routeCache.invalidateMutation("/settings", ["settings", "user:42"]);
```

Cache kinds:

- `route-data`
- `rsc`
- `loader`
- `api`
- `html`
- `script`
- `image`
- `font`

Use route cache for client-side reuse and invalidation. Do not pretend it replaces your framework's server cache. In Next, Nuxt, Remix, SvelteKit, or Angular SSR apps, keep server cache invalidation in the framework and use this cache for client-side warm data and navigation metadata.

## Scroll Restoration

Window scroll is automatic. For nested containers:

```tsx
<aside data-scroll-restoration-id="sidebar" />
```

Or register manually:

```tsx
useEffect(() => {
  if (!ref.current) return;
  return runtime.scroll.registerContainer("sidebar", ref.current);
}, [runtime]);
```

Hash anchor offsets use CSS:

```css
:root {
  --route-scroll-offset: 72px;
}
```

## View Transitions

```tsx
<Link href="/reports" viewTransition>
  Reports
</Link>
```

The runtime uses `document.startViewTransition()` when available and falls back to normal navigation when unsupported. Reduced-motion users are respected by default.

## Accessibility

Route changes announce through a hidden live region and focus moves to:

1. `[data-route-focus]`
2. `main h1`
3. `h1`
4. `main`
5. `[role="main"]`

Example:

```tsx
<main id="main-content">
  <h1 data-route-focus>Dashboard</h1>
</main>
```

Skip navigation:

```tsx
import { SkipNavigation } from "rockzy-link";

<SkipNavigation className="skip-link" targetId="main-content" />
```

## Offline Navigation

Register a service worker:

```ts
runtime.offline.register("/sw.js");
```

Expose the packaged worker script from your app:

```ts
import { OFFLINE_NAVIGATION_SERVICE_WORKER } from "rockzy-link/service-worker";
```

When offline, navigations can be queued and replayed after the browser comes back online.

Offline works best when your route shell is cacheable. Treat queued navigation as a UX recovery feature, not a replacement for real conflict handling around offline mutations.

## Non-React Click Handler

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const link = target.closest<HTMLAnchorElement>("a[data-smart-link]");
  if (!link) return;

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();

  await runtime.navigate(link.href, {
    viewTransition: true
  });
});
```

## Common Mistakes

- Importing the React component in Vue, Svelte, Angular, or Qwik. Use `rockzy-link/runtime` instead.
- Letting multiple systems prefetch the same route independently. Pick one budget owner.
- Using viewport prefetch for every sidebar item. Use hover intent for dense navigation.
- Caching mutation-sensitive pages without tags. Always tag cache entries that a mutation can invalidate.
- Forcing view transitions for reduced-motion users. Keep `respectReducedMotion: true`.
- Ignoring nested scroll containers. Add `data-scroll-restoration-id` for panels, sidebars, inboxes, and tables.

## Performance & Offline Safety Details

### O(N) Snapshot Eviction
To maintain maximum performance under memory limits, the snapshot eviction algorithms in `ScrollRestorationManager` and `NavigationSnapshotCache` use a highly efficient, single-pass linear O(N) scan. This avoids the garbage collection overhead and O(N log N) sorting associated with array clones, ensuring a zero-lag experience even with a large number of saved scroll views and DOM trees.

### Sequential Queue Flushing
When connection transitions from offline to online, the `OfflineNavigationManager` sequentially flushes the offline queue using `await` on each transition. This guarantees that queued events are retried strictly in order and prevents concurrent write race conditions on LocalStorage.

## Production Defaults

Good starting point:

```ts
createLinkRuntime({
  prefetch: {
    concurrency: 4,
    bandwidthBudgetBytesPerMinute: 2_500_000,
    memoryBudgetBytes: 50_000_000,
    crossTabDedupe: true
  },
  offline: {
    enabled: true,
    optimistic: true
  },
  a11y: {
    announce: true,
    restoreFocus: true
  },
  scroll: {
    restoreOnPopState: true
  },
  viewTransition: {
    enabled: true,
    respectReducedMotion: true
  }
});
```
