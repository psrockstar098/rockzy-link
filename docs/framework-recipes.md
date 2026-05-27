# Framework Recipes

The rule: let the framework own route state, and let this package own intent, safety, cache coordination, scroll, a11y, offline recovery, and budgeting.

React apps can use:

```ts
import { Link } from "rockzy-link";
```

Other frameworks should use:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";
```

## Adapter Shape

Every framework adapter eventually maps to this:

```ts
const router = {
  push: (href: string, opts?: { replace?: boolean; state?: unknown }) => {
    // framework navigation here
  },
  prefetch: (href: string) => {
    // optional framework preload here
  }
};
```

Then:

```ts
runtime.prefetch("/docs", { priority: "high" });
runtime.navigate("/docs", { router, viewTransition: true });
```

## Next.js App Router

Next.js already has built-in link prefetching, a client-side Router Cache, and server cache/revalidation APIs. Use this package when you want stricter prefetch budgeting, cross-tab dedupe, custom client cache invalidation, offline queuing, or consistent accessibility/scroll behavior across multiple app surfaces.

Client wrapper:

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  Link,
  LinkRuntimeProvider,
  createLinkRuntime
} from "rockzy-link";

const runtime = createLinkRuntime({
  prefetch: {
    concurrency: 3,
    bandwidthBudgetBytesPerMinute: 2_000_000
  }
});

export function SmartNextLink(
  props: Omit<React.ComponentProps<typeof Link>, "router">
) {
  const nextRouter = useRouter();

  return (
    <LinkRuntimeProvider runtime={runtime}>
      <Link
        {...props}
        router={{
          push: (href, opts) => {
            if (opts?.replace) nextRouter.replace(href);
            else nextRouter.push(href);
          },
          prefetch: (href) => nextRouter.prefetch(href)
        }}
      />
    </LinkRuntimeProvider>
  );
}
```

Tips:

- Keep the wrapper as a client component.
- Let this runtime own the prefetch budget if the page has many links.
- For expensive dynamic routes, prefer `prefetch="hover"` or `prefetch="none"`.
- After mutations, call this package's client invalidation and use Next's own server revalidation APIs for server-side data.

Official references:

- https://nextjs.org/docs/app/guides/prefetching
- https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating
- https://nextjs.org/docs/app/building-your-application/caching

## Next.js Pages Router

```tsx
import { useRouter } from "next/router";
import { Link } from "rockzy-link";

export function SmartPagesLink(
  props: Omit<React.ComponentProps<typeof Link>, "router">
) {
  const router = useRouter();

  return (
    <Link
      {...props}
      router={{
        push: (href, opts) => {
          if (opts?.replace) return router.replace(href, undefined, { scroll: false });
          return router.push(href, undefined, { scroll: false });
        },
        prefetch: (href) => router.prefetch(href)
      }}
    />
  );
}
```

## React Router

```tsx
import { useNavigate } from "react-router";
import { Link } from "rockzy-link";

export function SmartReactRouterLink(
  props: Omit<React.ComponentProps<typeof Link>, "router">
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

With a query client:

```tsx
<Link
  href="/projects"
  router={{
    push: (href) => navigate(href),
    prefetch: () => queryClient.prefetchQuery(projectsQueryOptions)
  }}
>
  Projects
</Link>
```

Official reference:

- https://reactrouter.com/start/framework/navigating

## TanStack Router

TanStack Router supports route preloading. This package can coordinate user intent and budgets, then delegate actual route loading to TanStack.

```tsx
import { useRouter } from "@tanstack/react-router";
import { Link } from "rockzy-link";

export function SmartTanStackLink({
  to,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href" | "router"> & {
  to: string;
}) {
  const router = useRouter();

  return (
    <Link
      {...props}
      href={to}
      router={{
        push: (href, opts) =>
          router.navigate({
            to: href,
            replace: opts?.replace
          }),
        prefetch: (href) =>
          router.preloadRoute({
            to: href
          })
      }}
    />
  );
}
```

Official references:

- https://tanstack.com/router/latest/docs/guide/preloading
- https://tanstack.com/router/v1/docs/guide/navigation

## Remix

Remix has its own `<Link>` prefetch modes. Use this package for guarded links, shared component libraries, offline queues, route announcements, view transitions, and stricter prefetch budgeting.

```tsx
import { useNavigate } from "@remix-run/react";
import { Link } from "rockzy-link";

export function SmartRemixLink(
  props: Omit<React.ComponentProps<typeof Link>, "router">
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

Official reference:

- https://v2.remix.run/docs/components/link

## Vue 3 + Vue Router

Use the runtime subpath so Vue does not import React.

`src/navigation/runtime.ts`:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export const runtime = createLinkRuntime({
  prefetch: {
    concurrency: 4,
    crossTabDedupe: true
  }
});
```

`SmartLink.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { runtime } from "./navigation/runtime";

const props = defineProps<{
  to: string;
  replace?: boolean;
  prefetch?: "hover" | "viewport" | "idle" | "none";
}>();

const router = useRouter();
const href = computed(() => props.to);

function priority() {
  if (props.prefetch === "viewport") return "medium";
  if (props.prefetch === "idle") return "low";
  return "high";
}

function warm() {
  if (props.prefetch === "none") return;
  runtime.prefetch(href.value, { priority: priority() });
}

async function go(event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();

  await runtime.navigate(href.value, {
    router: {
      push: (url) => {
        if (props.replace) return router.replace(url);
        return router.push(url);
      }
    },
    viewTransition: true
  });
}
</script>

<template>
  <a :href="href" @mouseenter="warm" @focus="warm" @click="go">
    <slot />
  </a>
</template>
```

Official reference:

- https://router.vuejs.org/guide/essentials/navigation.html

## Nuxt

Nuxt already prefetches linked routes through `<NuxtLink>` and exposes utilities such as `navigateTo()` and `preloadRouteComponents()`. Use this package when you need a single global budget, pointer-intent delays, cache tagging, or cross-tab dedupe.

`plugins/production-link.client.ts`:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export default defineNuxtPlugin(() => {
  const runtime = createLinkRuntime({
    prefetch: {
      concurrency: 3,
      bandwidthBudgetBytesPerMinute: 2_000_000
    }
  });

  return {
    provide: {
      productionLink: runtime
    }
  };
});
```

Component:

```vue
<script setup lang="ts">
const props = defineProps<{ to: string }>();
const { $productionLink } = useNuxtApp();

function warm() {
  $productionLink.prefetch(props.to, {
    priority: "high",
    fetcher: async (href) => {
      await preloadRouteComponents(href);
    }
  });
}

async function go(event: MouseEvent) {
  event.preventDefault();
  await $productionLink.navigate(props.to, {
    router: {
      push: (href) => navigateTo(href)
    },
    viewTransition: true
  });
}
</script>

<template>
  <a :href="to" @mouseenter="warm" @focus="warm" @click="go">
    <slot />
  </a>
</template>
```

Official references:

- https://nuxt.com/docs/3.x/api/components/nuxt-link
- https://nuxt.com/docs/3.x/api/utils/preload-route-components
- https://nuxt.com/docs/4.x/api/utils/navigate-to

## SvelteKit

SvelteKit has `goto()`, `preloadData()`, and link-level preload attributes. Use the runtime when you want more control over budgets, retries, and cross-tab dedupe.

`src/lib/navigation.ts`:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export const runtime = createLinkRuntime();
```

`SmartLink.svelte`:

```svelte
<script lang="ts">
  import { goto, preloadData } from "$app/navigation";
  import { runtime } from "$lib/navigation";

  export let href: string;
  export let replace = false;

  function warm() {
    runtime.prefetch(href, {
      priority: "high",
      fetcher: async (url) => {
        await preloadData(url);
      }
    });
  }

  async function go(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    await runtime.navigate(href, {
      router: {
        push: (url) => goto(url, { replaceState: replace, noScroll: true })
      },
      viewTransition: true
    });
  }
</script>

<a {href} on:mouseenter={warm} on:focus={warm} on:click={go}>
  <slot />
</a>
```

Official reference:

- https://svelte.dev/docs/kit/$app-navigation

## Angular

Use an Angular directive and the runtime subpath. Angular Router owns actual route state; the runtime schedules and coordinates.

`production-link.runtime.ts`:

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export const productionLinkRuntime = createLinkRuntime();
```

Directive:

```ts
import { Directive, HostListener, Input } from "@angular/core";
import { Router } from "@angular/router";
import { productionLinkRuntime } from "./production-link.runtime";

@Directive({
  selector: "a[productionLink]",
  standalone: true
})
export class ProductionLinkDirective {
  @Input("productionLink") href = "/";
  @Input() replace = false;

  constructor(private readonly router: Router) {}

  @HostListener("mouseenter")
  @HostListener("focus")
  warm() {
    productionLinkRuntime.prefetch(this.href, { priority: "high" });
  }

  @HostListener("click", ["$event"])
  async click(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    await productionLinkRuntime.navigate(this.href, {
      router: {
        push: (href) =>
          this.router.navigateByUrl(href, {
            replaceUrl: this.replace
          })
      },
      viewTransition: true
    });
  }
}
```

Template:

```html
<a productionLink="/dashboard">Dashboard</a>
```

Official references:

- https://angular.dev/guide/routing
- https://angular.dev/api/router/Router

## Solid Router

Solid Router supports route preloading. Use this runtime when you need global budget control and cross-tab dedupe around that preloading.

```tsx
import { useNavigate } from "@solidjs/router";
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

export function SmartSolidLink(props: {
  href: string;
  children: any;
}) {
  const navigate = useNavigate();

  const warm = () => {
    runtime.prefetch(props.href, { priority: "high" });
  };

  const go = async (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    await runtime.navigate(props.href, {
      router: {
        push: (href) => navigate(href)
      },
      viewTransition: true
    });
  };

  return (
    <a href={props.href} onMouseEnter={warm} onFocus={warm} onClick={go}>
      {props.children}
    </a>
  );
}
```

Official references:

- https://docs.solidjs.com/solid-router/advanced-concepts/preloading
- https://docs.solidjs.com/solid-router/reference/preload-functions/preload

## Qwik City

Qwik City has its own `<Link>` and `useNavigate()`. Use this runtime carefully: Qwik optimizes around resumability, so do not turn every link into eager JavaScript. Good uses are high-value dashboards, authenticated apps, and custom menu systems.

```tsx
import { component$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

export const SmartQwikLink = component$((props: { href: string }) => {
  const nav = useNavigate();

  return (
    <a
      href={props.href}
      onMouseEnter$={() => runtime.prefetch(props.href, { priority: "high" })}
      onClick$={async (event) => {
        event.preventDefault();
        await runtime.navigate(props.href, {
          router: {
            push: (href) => nav(href)
          }
        });
      }}
    >
      <slot />
    </a>
  );
});
```

Official references:

- https://qwik.dev/docs/routing/
- https://qwik.dev/docs/api/

## Astro

Astro can use normal links, built-in prefetch behavior, and view transitions. Use this runtime in a React island or a small client script when you need budgeted navigation.

React island:

```tsx
import { Link } from "rockzy-link";

export function NavIsland() {
  return (
    <Link href="/docs" prefetch="viewport" viewTransition>
      Docs
    </Link>
  );
}
```

Framework-neutral client script:

```astro
---
---

<a href="/docs" data-smart-link>Docs</a>

<script>
  import { createLinkRuntime } from "rockzy-link/runtime";

  const runtime = createLinkRuntime();

  for (const link of document.querySelectorAll("[data-smart-link]")) {
    const href = link.getAttribute("href");
    if (!href) continue;

    link.addEventListener("mouseenter", () => {
      runtime.prefetch(href, { priority: "high" });
    });

    link.addEventListener("click", (event) => {
      event.preventDefault();
      runtime.navigate(href, { viewTransition: true });
    });
  }
</script>
```

Official reference:

- https://docs.astro.build/en/guides/view-transitions/

## Vite SPA or Vanilla JavaScript

No router is required. The runtime falls back to the History API and dispatches route events.

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const anchor = target.closest<HTMLAnchorElement>("a[data-route]");
  if (!anchor) return;

  event.preventDefault();
  await runtime.navigate(anchor.href, {
    viewTransition: true
  });
});

window.addEventListener("production-link:navigate", (event) => {
  const href = (event as CustomEvent).detail.href;
  renderRoute(href);
});
```

## htmx

For htmx, keep htmx in charge of swaps. Use this runtime for URL safety and cache warming only.

```html
<a href="/inbox" hx-get="/inbox" hx-target="#main" data-smart-prefetch>
  Inbox
</a>

<script type="module">
  import { createLinkRuntime } from "rockzy-link/runtime";

  const runtime = createLinkRuntime();

  document.addEventListener("mouseenter", (event) => {
    const link = event.target.closest("[data-smart-prefetch]");
    if (!link) return;
    runtime.prefetch(link.href, { priority: "high" });
  }, true);
</script>
```

## Framework Selection Guide

| Framework | Use React `<Link>`? | Preferred import | Navigation owner |
| --- | --- | --- | --- |
| React SPA | Yes | root package | Runtime or app router |
| Next.js | Yes, client wrapper | root package | Next router |
| Remix | Yes | root package | Remix router |
| React Router | Yes | root package | React Router |
| TanStack Router | Yes | root package | TanStack Router |
| Vue | No | `/runtime` | Vue Router |
| Nuxt | No | `/runtime` | Nuxt |
| SvelteKit | No | `/runtime` | SvelteKit |
| Angular | No | `/runtime` | Angular Router |
| Solid | Usually no | `/runtime` | Solid Router |
| Qwik | No | `/runtime` | Qwik City |
| Astro | Island optional | root or `/runtime` | Astro or runtime |
| Vanilla | No | `/runtime` | Runtime History API |

