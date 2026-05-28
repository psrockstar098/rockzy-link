# Developer Guide

This guide keeps the setup simple first, then shows the knobs when you need them.

## 1. Start Small

```tsx
import {
  Link,
  LinkRuntimeProvider,
  createLinkRuntime
} from "rockzy-link";

const runtime = createLinkRuntime();

export function App() {
  return (
    <LinkRuntimeProvider runtime={runtime}>
      <Link href="/dashboard">Dashboard</Link>
    </LinkRuntimeProvider>
  );
}
```

That gives you safe URL handling, hover prefetch, scroll handling, and accessibility defaults.

## 2. Pick A Prefetch Mode

```tsx
<Link href="/pricing" prefetch="hover">Pricing</Link>
<Link href="/dashboard" prefetch="viewport">Dashboard</Link>
<Link href="/legal" prefetch="idle">Legal</Link>
<Link href="/checkout" prefetch="none">Checkout</Link>
```

| Mode | Use When |
| --- | --- |
| `hover` | The route is useful, but you only want strong user intent |
| `viewport` | The link is important and visible on the page |
| `idle` | The route is cheap and can warm in the background |
| `none` | The route is private, expensive, or mutation-sensitive |

## 3. Connect A Router

```tsx
const router = {
  push: (href: string, opts?: { replace?: boolean; state?: unknown }) => {
    if (opts?.replace) return appRouter.replace(href);
    return appRouter.push(href);
  },
  prefetch: (href: string) => appRouter.prefetch?.(href)
};

<Link href="/settings" router={router}>
  Settings
</Link>
```

For non-React frameworks, use the runtime directly:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

await runtime.navigate("/settings", {
  router,
  scroll: false,
  announce: false,
  focus: false
});
```

## 4. Cache Data With Tags

```ts
runtime.routeCache.set("/api/projects", "api", projects, {
  ttlMs: 60_000,
  staleWhileRevalidateMs: 10_000,
  tags: ["projects"]
});

const cached = runtime.routeCache.get<Project[]>("/api/projects", "api");
```

After a mutation:

```ts
runtime.routeCache.invalidateTag("projects");
```

Use tags that match product concepts:

- `project:42`
- `projects`
- `user:me`
- `billing`

## 5. Restore Scroll And Focus

Nested scroll area:

```tsx
<section data-scroll-restoration-id="inbox-list" />
```

Focus target after navigation:

```tsx
<h1 data-route-focus>Inbox</h1>
```

Disable scroll reset for a link:

```tsx
<Link to="/inbox" preventScrollReset>
  Inbox
</Link>
```

## 6. Add View Transitions

```tsx
<Link href="/photos/42" viewTransition>
  Open
</Link>
```

The runtime falls back to normal navigation when the browser does not support View Transitions.

## 7. Add Guards

```ts
runtime.beforeNavigate([
  async ({ href }) => confirmSession(href),
  async ({ from, href }) => confirmUnsavedChanges({ from, href })
]);
```

Return `false` to block navigation.

## 8. Add Offline Recovery

```ts
const runtime = createLinkRuntime({
  offline: {
    enabled: true,
    optimistic: true
  }
});

runtime.offline.register("/sw.js");
```

Offline navigation is best effort. It helps route shells recover, but your app still needs real offline data and mutation handling.

## 9. Tune Production Defaults

```ts
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

## 10. Measure It

```bash
npm run benchmark
npm run benchmark:browser
npm run benchmark:bundle-size
npm run benchmark:memory
npm run publish:check
```

Use `npm run publish:check`, not `publish:check` by itself.

## Common Mistakes

- Using `viewport` on every sidebar item.
- Prefetching private or mutation-heavy routes.
- Letting multiple libraries prefetch the same route independently.
- Caching data without tags.
- Forgetting `data-route-focus` on pages.
- Importing `rockzy-link` root in non-React framework code when `rockzy-link/runtime` is enough.
