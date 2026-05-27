# Code Snaps

Copy-paste snippets for common integration points.

## App Root

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

## Protected Route Link

```tsx
<Link
  href="/account"
  prefetch="none"
  onBeforeNavigate={async () => {
    const ok = await confirmSession();
    return ok;
  }}
>
  Account
</Link>
```

## Mutation Invalidation

```ts
async function updateProfile(input: ProfileInput) {
  await api.profile.update(input);
  runtime.routeCache.invalidateMutation("/profile", ["profile", "user"]);
}
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
  prefetch: (href: string) => {
    return warmRoute(href);
  }
};

<Link href="/settings" router={router}>
  Settings
</Link>
```

## Framework-Neutral Runtime

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

await runtime.navigate("/dashboard", {
  viewTransition: true
});
```

## Vanilla Smart Link

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

document.addEventListener("pointerenter", (event) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
    "a[data-smart-link]"
  );
  if (!link) return;
  runtime.prefetch(link.href, { priority: "high" });
}, true);

document.addEventListener("click", (event) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
    "a[data-smart-link]"
  );
  if (!link) return;
  event.preventDefault();
  runtime.navigate(link.href, { viewTransition: true });
});
```

## Vue Router Adapter

```ts
const routerAdapter = {
  push: (href: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) return vueRouter.replace(href);
    return vueRouter.push(href);
  }
};

await runtime.navigate("/dashboard", {
  router: routerAdapter
});
```

## SvelteKit Adapter

```ts
import { goto, preloadData } from "$app/navigation";

await runtime.navigate("/dashboard", {
  router: {
    push: (href) => goto(href, { noScroll: true }),
    prefetch: (href) => preloadData(href)
  }
});
```

## Angular Adapter

```ts
await runtime.navigate("/dashboard", {
  router: {
    push: (href, opts) =>
      angularRouter.navigateByUrl(href, {
        replaceUrl: opts?.replace
      })
  }
});
```

## URL Object

```tsx
const href = new URL("/reports?range=30d", window.location.origin);

<Link href={href}>Reports</Link>
```

## Smart Sidebar

```tsx
function Sidebar() {
  return (
    <nav>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch="hover"
          estimateBytes={96_000}
          cacheTags={item.tags}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

Pointer intent delays fast fly-by hover events, so a dense sidebar does not fire every route request when the cursor crosses it.

## Hash Offset

```tsx
<Link href="/docs#install" scrollBehavior="smooth" hashOffset={80}>
  Install
</Link>
```

## Shared Element View Transition

```tsx
<Link href="/photos/42" viewTransition>
  <img
    src="/thumbs/42.jpg"
    alt=""
    style={{ viewTransitionName: "photo-42" }}
  />
  Open
</Link>
```

Destination:

```tsx
<img
  src="/photos/42.jpg"
  alt="Photo 42"
  style={{ viewTransitionName: "photo-42" }}
/>
```

## Node Cache Adapter

```ts
import { createNodeRouteCache } from "rockzy-link/cache/node";

const cache = await createNodeRouteCache({
  maxEntries: 2_000,
  maxBytes: 200_000_000
});

cache.set("/api/products", "api", products, {
  ttlMs: 120_000,
  tags: ["products"]
});
```

## Browser Cache Prefetch

```ts
import { prefetchToBrowserCache } from "rockzy-link/cache/browser";

await prefetchToBrowserCache("/docs/getting-started");
```

## Offline Worker File

```ts
import { writeFileSync } from "node:fs";
import { OFFLINE_NAVIGATION_SERVICE_WORKER } from "rockzy-link/service-worker";

writeFileSync("public/sw.js", OFFLINE_NAVIGATION_SERVICE_WORKER);
```
