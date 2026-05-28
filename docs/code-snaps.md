# Code Snaps

Small copy-paste examples.

## React App Root

```tsx
import { createRoot } from "react-dom/client";
import {
  LinkRuntimeProvider,
  createLinkRuntime
} from "rockzy-link";
import { App } from "./app";

const runtime = createLinkRuntime();

createRoot(document.getElementById("root")!).render(
  <LinkRuntimeProvider runtime={runtime}>
    <App />
  </LinkRuntimeProvider>
);
```

## Basic Links

```tsx
<Link href="/dashboard">Dashboard</Link>
<Link to="/settings">Settings</Link>
<Link href="/docs" prefetch>Docs</Link>
<Link href="/checkout" prefetch="none">Checkout</Link>
```

## React Router-Style Link

```tsx
<Link to="/inbox" preventScrollReset>
  Inbox
</Link>
```

## Full Document Navigation

```tsx
<Link href="/legacy-page" reloadDocument>
  Legacy page
</Link>
```

## Router Adapter

```tsx
const router = {
  push: (href: string, opts?: { replace?: boolean; state?: unknown }) => {
    navigate(href, {
      replace: opts?.replace,
      state: opts?.state
    });
  },
  prefetch: (href: string) => warmRoute(href)
};

<Link href="/settings" router={router}>
  Settings
</Link>
```

## Fast Runtime Navigation

```ts
await runtime.navigate("/dashboard", {
  router,
  scroll: false,
  announce: false,
  focus: false
});
```

## Protected Route

```tsx
<Link
  href="/account"
  prefetch="none"
  beforeNavigate={async () => await confirmSession()}
>
  Account
</Link>
```

## Global Guards

```ts
const unregister = runtime.beforeNavigate([
  async ({ href }) => confirmSession(href),
  async ({ from, href }) => confirmUnsavedChanges({ from, href })
]);
```

## Route Cache

```ts
runtime.routeCache.set("/api/projects", "api", projects, {
  ttlMs: 60_000,
  staleWhileRevalidateMs: 10_000,
  tags: ["projects"]
});

const cached = runtime.routeCache.get<Project[]>("/api/projects", "api");
```

## Cache Presence

```ts
if (runtime.routeCache.has("/api/projects", "api")) {
  // Present and not expired. This does not count as a read hit.
}
```

## Mutation Invalidation

```ts
await api.projects.update(project);

runtime.routeCache.invalidateMutation("/projects/" + project.id, [
  "projects",
  "project:" + project.id
]);
```

## Asset Preload During Prefetch

```tsx
<Link
  href="/reports"
  prefetch="viewport"
  preloadAssets={[
    "/assets/reports.css",
    { href: "/assets/reports.js", module: true }
  ]}
>
  Reports
</Link>
```

## Speculation Rules

```tsx
<Link
  href="/docs"
  prefetch="viewport"
  speculationRules={{ action: "prefetch", eagerness: "moderate" }}
>
  Docs
</Link>
```

## Hash Offset

```tsx
<Link href="/docs#install" scrollBehavior="smooth" hashOffset={80}>
  Install
</Link>
```

## Nested Scroll Restoration

```tsx
<aside data-scroll-restoration-id="sidebar" />
```

## Focus Target

```tsx
<main id="main-content">
  <h1 data-route-focus>Dashboard</h1>
</main>
```

## Skip Navigation

```tsx
import { SkipNavigation } from "rockzy-link";

<SkipNavigation targetId="main-content" />
```

## View Transition

```tsx
<Link href="/photos/42" viewTransition>
  Open photo
</Link>
```

## Browser Cache Prefetch

```ts
import { prefetchToBrowserCache } from "rockzy-link/cache/browser";

await prefetchToBrowserCache("/docs/getting-started");
```

## Node Cache Adapter

```ts
import { createNodeRouteCache } from "rockzy-link/cache/node";

const cache = await createNodeRouteCache({
  maxEntries: 2_000,
  maxBytes: 200_000_000
});
```

## URL Safety

```ts
import { classifyHref, sanitizeHref } from "rockzy-link/security";

const info = classifyHref(userHref);
const href = sanitizeHref(userHref);
```

## Offline Worker File

```ts
import { writeFileSync } from "node:fs";
import { OFFLINE_NAVIGATION_SERVICE_WORKER } from "rockzy-link/service-worker";

writeFileSync("public/sw.js", OFFLINE_NAVIGATION_SERVICE_WORKER);
```

## Vanilla Smart Link

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

document.addEventListener("click", (event) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
    "a[data-smart-link]"
  );
  if (!link) return;

  event.preventDefault();
  runtime.navigate(link.href, { viewTransition: true });
});
```

## Benchmark Commands

```bash
npm run benchmark:browser
npm run benchmark:bundle-size
npm run benchmark:memory
npm run publish:check
```
