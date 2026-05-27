# Production Link

A production-ready navigation runtime with a React `<Link>` component.

Use the React component in React-based apps, or import the framework-neutral runtime from `rockzy-link/runtime` in Vue, Nuxt, SvelteKit, Angular, Solid, Qwik, Astro, or vanilla JavaScript.

It includes:

- URL object support and SSR-safe URL sanitization.
- Smart prefetch scheduling for hover, viewport, and idle intent.
- Concurrency, retry, bandwidth, memory, and device-aware budgeting.
- Cross-tab request deduplication via `BroadcastChannel` with a storage fallback.
- Multi-layer route cache for route data, RSC payloads, loaders, APIs, HTML, chunks, images, and fonts.
- TTL, stale-while-revalidate, tag invalidation, and mutation invalidation.
- Browser cache and optional `@cacheable/node-cache` adapters.
- Scroll restoration for routes, hashes, and nested scroll containers.
- Native View Transitions API integration with reduced-motion handling.
- Route announcements, focus restoration, skip navigation, and keyboard intent support.
- Offline navigation hooks, queued navigations, and service worker helpers.
- Instant back/forward navigation snapshots.

## Install

```bash
npm install rockzy-link react @cacheable/node-cache
```

For non-React usage, React is optional:

```bash
npm install rockzy-link
```

## Usage

```tsx
import { Link, LinkRuntimeProvider, createLinkRuntime } from "rockzy-link";

const runtime = createLinkRuntime({
  prefetch: {
    concurrency: 4,
    bandwidthBudgetBytesPerMinute: 3_000_000,
    memoryBudgetBytes: 30_000_000
  }
});

export function App() {
  return (
    <LinkRuntimeProvider runtime={runtime}>
      <Link href="/dashboard" prefetch="viewport" viewTransition>
        Dashboard
      </Link>
    </LinkRuntimeProvider>
  );
}
```

Priority mapping:

- `prefetch="hover"` schedules high-priority prefetch after pointer intent is clear.
- `prefetch="viewport"` schedules medium-priority prefetch and orders links by visibility.
- `prefetch="idle"` schedules low-priority prefetch when the browser is idle.

## Offline service worker

The package exports a service worker script string so apps can write it to their public directory or serve it from their framework route.

```ts
import { OFFLINE_NAVIGATION_SERVICE_WORKER } from "rockzy-link/service-worker";
```

Register it:

```ts
runtime.offline.register("/sw.js");
```

## Cache invalidation

```ts
runtime.routeCache.invalidateTag("user:42");
runtime.routeCache.invalidateMutation("/settings", ["settings", "user:42"]);
```

## Scroll containers

```tsx
<aside data-scroll-restoration-id="sidebar" />
```

The runtime also exposes `runtime.scroll.registerContainer("sidebar", element)` for controlled components.

## Documentation

- [Package overview](./docs/package-overview.md)
- [Developer guide](./docs/dev-guide.md)
- [API reference](./docs/api-reference.md)
- [Code snaps](./docs/code-snaps.md)
- [Framework recipes](./docs/framework-recipes.md)
- [Lessons, tips, and tricks](./docs/lessons-and-tips.md)
