# rockzy-link

A small React `<Link>` and navigation runtime for apps that want safer links, smarter prefetching, route caching, scroll restoration, accessibility, offline recovery, and browser-tested performance.

[![Test](https://github.com/psrockstar098/rockzy-link/actions/workflows/test.yml/badge.svg)](https://github.com/psrockstar098/rockzy-link/actions/workflows/test.yml)
[![Size](https://github.com/psrockstar098/rockzy-link/actions/workflows/size.yml/badge.svg)](https://github.com/psrockstar098/rockzy-link/actions/workflows/size.yml)
[![Benchmark](https://github.com/psrockstar098/rockzy-link/actions/workflows/benchmark.yml/badge.svg)](https://github.com/psrockstar098/rockzy-link/actions/workflows/benchmark.yml)
[![Security](https://github.com/psrockstar098/rockzy-link/actions/workflows/security.yml/badge.svg)](https://github.com/psrockstar098/rockzy-link/actions/workflows/security.yml)

## Why Use It?

Normal links navigate. `rockzy-link` coordinates the parts around navigation:

- blocks unsafe URLs like `javascript:`
- prefetches likely routes without flooding the network
- dedupes prefetches across links and tabs
- caches route/data responses with TTL, tags, and mutation invalidation
- restores scroll and hash positions
- supports View Transitions without ignoring reduced-motion users
- announces route changes and restores focus
- queues optimistic offline navigations
- works with React, Next.js, React Router, TanStack Router, Remix, Vue, Nuxt, SvelteKit, Angular, Solid, Qwik, Astro, htmx, and vanilla JS

It is best described as a **navigation acceleration layer**, not a router replacement. Your router still owns route matching and rendering.

## Install

```bash
npm install rockzy-link
```

React is a peer dependency. If your app already uses React, you are set.

## Quick Start

```tsx
import {
  Link,
  LinkRuntimeProvider,
  createLinkRuntime
} from "rockzy-link";

const runtime = createLinkRuntime({
  prefetch: {
    concurrency: 4,
    bandwidthBudgetBytesPerMinute: 2_500_000,
    crossTabDedupe: true
  },
  a11y: {
    announce: true,
    restoreFocus: true
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

Use `href` for Next-style links and `to` for React Router-style links:

```tsx
<Link href="/docs">Docs</Link>
<Link to="/settings">Settings</Link>
```

## The Mental Model

There are two paths:

1. **Prefetch path**: hover, focus, viewport, idle, or pointerdown tells the scheduler a route may be needed soon.
2. **Navigation path**: click runs safety checks, guards, router delegation, scroll/focus work, transitions, and offline recovery.

For the fastest simple router path, pass the work you do not need:

```ts
await runtime.navigate("/dashboard", {
  router,
  scroll: false,
  announce: false,
  focus: false
});
```

That path avoids snapshot, scroll, accessibility, and transition overhead.

## Prefetch Modes

```tsx
<Link href="/pricing" prefetch="hover">Pricing</Link>
<Link href="/dashboard" prefetch="viewport">Dashboard</Link>
<Link href="/legal" prefetch="idle">Legal</Link>
<Link href="/checkout" prefetch="none">Checkout</Link>
```

| Mode | Meaning | Best For |
| --- | --- | --- |
| `hover` | High-confidence user intent | Menus, sidebars, expensive pages |
| `viewport` | Link entered the viewport | Primary content links |
| `idle` | Browser has idle time | Cheap background warming |
| `none` or `false` | Disable prefetch | Private, mutation-sensitive, or heavy routes |
| `true` or `null` | Use default hover behavior | Next-style boolean compatibility |

`<Link>` also starts a high-priority prefetch on `pointerdown`, using the short time between press and click.

## Router Adapters

A router adapter only needs `push`; `prefetch` is optional.

```ts
const router = {
  push: (href: string, opts?: { replace?: boolean; state?: unknown }) => {
    if (opts?.replace) return appRouter.replace(href);
    return appRouter.push(href);
  },
  prefetch: (href: string) => appRouter.prefetch?.(href)
};
```

React Router-style wrapper:

```tsx
import { useNavigate } from "react-router";
import { Link } from "rockzy-link";

export function SmartReactRouterLink(
  props: Omit<React.ComponentProps<typeof Link>, "router" | "href"> & {
    to: React.ComponentProps<typeof Link>["to"];
  }
) {
  const navigate = useNavigate();

  return (
    <Link
      {...props}
      router={{
        push: (href, opts) =>
          navigate(href, {
            replace: opts?.replace,
            state: opts?.state
          })
      }}
    />
  );
}
```

Next.js App Router-style wrapper:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Link } from "rockzy-link";

export function SmartNextLink(
  props: Omit<React.ComponentProps<typeof Link>, "router">
) {
  const router = useRouter();

  return (
    <Link
      {...props}
      router={{
        push: (href, opts) => {
          if (opts?.replace) router.replace(href);
          else router.push(href);
        },
        prefetch: (href) => router.prefetch(href)
      }}
    />
  );
}
```

## Route Cache

Use the route cache for client-side reuse and invalidation.

```ts
runtime.routeCache.set("/api/projects", "api", projects, {
  ttlMs: 60_000,
  staleWhileRevalidateMs: 10_000,
  tags: ["projects"]
});

const cached = runtime.routeCache.get<Project[]>("/api/projects", "api");

if (runtime.routeCache.has("/api/projects", "api")) {
  // fast presence check without counting a read hit
}
```

Invalidate after mutations:

```ts
runtime.routeCache.invalidateTag("projects");
runtime.routeCache.invalidateMutation("/projects/42", [
  "project:42",
  "projects"
]);
```

Cache kinds:

`route-data`, `rsc`, `loader`, `api`, `html`, `script`, `image`, `font`

## Scroll, Focus, And Accessibility

Default behavior:

- scrolls to top after route changes
- scrolls to hash targets
- can restore nested scroll containers
- announces route changes through a hidden live region
- restores focus to a useful page target

Nested scroll container:

```tsx
<aside data-scroll-restoration-id="sidebar" />
```

Focus target:

```tsx
<main>
  <h1 data-route-focus>Dashboard</h1>
</main>
```

Skip link:

```tsx
import { SkipNavigation } from "rockzy-link";

<SkipNavigation targetId="main-content" />
```

Disable scroll reset for React Router-style behavior:

```tsx
<Link to="/inbox" preventScrollReset>
  Inbox
</Link>
```

## View Transitions

```tsx
<Link href="/photos/42" viewTransition>
  Open photo
</Link>
```

The runtime uses `document.startViewTransition()` when available. Reduced-motion users are respected by default.

## Navigation Guards

Use guards to stop navigation when a session expired or a form has unsaved changes.

```ts
const unregister = runtime.beforeNavigate([
  async ({ href }) => confirmSession(href),
  async ({ from, href }) => confirmUnsavedChanges({ from, href })
]);
```

Per-link:

```tsx
<Link
  href="/account"
  beforeNavigate={async () => await confirmSession()}
>
  Account
</Link>
```

Return `false` to block the navigation.

## Offline Navigation

```ts
runtime.offline.register("/sw.js");
```

You can write the packaged worker into your app:

```ts
import { writeFileSync } from "node:fs";
import { OFFLINE_NAVIGATION_SERVICE_WORKER } from "rockzy-link/service-worker";

writeFileSync("public/sw.js", OFFLINE_NAVIGATION_SERVICE_WORKER);
```

Offline lifecycle callbacks:

```ts
createLinkRuntime({
  offline: {
    enabled: true,
    optimistic: true,
    onOfflineQueueAdded: ({ navigation }) => {
      console.log("Queued", navigation.href);
    },
    onOfflineSyncing: ({ queueLength }) => {
      console.log("Syncing", queueLength);
    },
    onOfflineSynced: ({ syncedCount }) => {
      console.log("Synced", syncedCount);
    }
  }
});
```

Events are also dispatched on `window`:

`offline-queue:added`, `syncing`, `synced`

## URL Security

```tsx
<Link href={userProvidedHref}>Open</Link>
```

Unsafe URLs are rendered as `#`.

```ts
import { classifyHref, sanitizeHref } from "rockzy-link/security";

const info = classifyHref(userProvidedHref);
const safeHref = sanitizeHref(userProvidedHref);
```

Blocked protocols include `javascript:`, `vbscript:`, and `data:`.

## Public Imports

| Import | Use |
| --- | --- |
| `rockzy-link` | React component and public utilities |
| `rockzy-link/runtime` | Framework-neutral runtime |
| `rockzy-link/cache` | In-memory route cache |
| `rockzy-link/cache/browser` | Browser Cache Storage helpers |
| `rockzy-link/cache/node` | Node cache adapter |
| `rockzy-link/prefetch` | Smart prefetch scheduler |
| `rockzy-link/security` | URL classification and sanitization |
| `rockzy-link/navigation/scroll` | Scroll restoration manager |
| `rockzy-link/navigation/view-transitions` | View Transition helper |
| `rockzy-link/service-worker` | Offline service worker script |

## Benchmarks

These are local results from Windows, Node `v24.12.0`, and headless Chromium on May 28, 2026. Treat them as directional, not universal.

### Browser Interaction

Command:

```bash
npm run benchmark:browser
```

| Benchmark | mean | median | p95 | p99 |
| --- | ---: | ---: | ---: | ---: |
| `rockzy-link` React click-to-render | 16.54 ms | 16.7 ms | 17.6 ms | 17.9 ms |
| React controlled anchor click-to-render | 16.64 ms | 16.6 ms | 17.6 ms | 18.4 ms |
| Native `history.pushState` | 0.3372 ms | 0.3 ms | 0.6 ms | 1 ms |
| React hydrate route shell | 16.32 ms | 16.3 ms | 17.7 ms | 18.1 ms |

Real React Router, Next Link, and TanStack Router browser benchmarks are skipped until those packages are installed in the workspace.

### Runtime Throughput

Command:

```bash
npm run benchmark:ci
```

| Benchmark | ops/sec |
| --- | ---: |
| Route cache set/get HTML | 329,490 |
| Prefetch scheduler enqueue and pump | 193,899 |
| Navigation runtime router navigation | 1,050,434 |
| Guarded navigation | 597,499 |
| Warm cache navigation | 467,771 |
| Prefetched navigation | 705,081 |

### Bundle Size

Command:

```bash
npm run benchmark:bundle-size
```

| Package / Library | Raw | Minified | Gzip | Brotli |
| --- | ---: | ---: | ---: | ---: |
| `rockzy-link` core + link | 13.89 KB | 10.29 KB | 3.03 KB | 2.70 KB |
| React Router DOM comparison | 162.00 KB | 57.00 KB | 18.00 KB | 15.50 KB |
| TanStack Router comparison | 280.00 KB | 95.00 KB | 26.00 KB | 22.50 KB |
| Next Link simulated context | 24.00 KB | 9.50 KB | 3.40 KB | 3.00 KB |

Size-limit output from `npm run publish:check`:

| Entry | Brotli |
| --- | ---: |
| Core entry | 350 B |
| React link component | 2.86 KB |
| Navigation runtime | 3.37 KB |
| Prefetch scheduler | 4.24 KB |

### Memory

Command:

```bash
npm run benchmark:memory
```

| Scenario | Result |
| --- | --- |
| 5,000 cache inserts with max 500 entries | Cache stayed at 500 entries |
| Cache heap growth | 0.40 MB |
| Tag invalidation stress | Final cache size 0 |
| 10,000 long-session prefetch/navigation loops | 4.10 MB heap growth |

## Scripts

| Command | What It Does |
| --- | --- |
| `npm test` | Run Vitest tests |
| `npm run typecheck` | Type-check source |
| `npm run build` | Build `dist` |
| `npm run ci` | Typecheck, test, and build |
| `npm run benchmark` | Run Tinybench locally |
| `npm run benchmark:ci` | Run benchmark regression gate |
| `npm run benchmark:browser` | Run Playwright Chromium benchmark |
| `npm run benchmark:bundle-size` | Run bundle comparison report |
| `npm run benchmark:memory` | Run memory stability benchmark |
| `npm run size` | Run size-limit |
| `npm run publish:check` | Run the full pre-publish check |

Use `npm run publish:check`, not `publish:check` directly.

## More Docs

- [Package overview](docs/package-overview.md)
- [API reference](docs/api-reference.md)
- [Developer guide](docs/dev-guide.md)
- [Framework recipes](docs/framework-recipes.md)
- [Code snippets](docs/code-snaps.md)
- [Lessons and tips](docs/lessons-and-tips.md)
- [Benchmarks](docs/benchmarks.md)

## License

MIT. See [LICENSE](LICENSE).
