# Framework Recipes

Simple rule:

- React-based apps can use `<Link>`.
- Non-React framework code should use `createLinkRuntime()` from `rockzy-link/runtime`.
- Your framework owns rendering and route matching.
- `rockzy-link` owns safety, prefetch timing, cache coordination, scroll/focus, transitions, and offline recovery.

## Adapter Shape

Every router adapter looks like this:

```ts
const router = {
  push: (href: string, opts?: { replace?: boolean; state?: unknown }) => {
    // framework navigation
  },
  prefetch: (href: string) => {
    // optional framework preload
  }
};
```

Then pass it to `Link` or `runtime.navigate()`.

## React SPA

```tsx
import { Link } from "rockzy-link";

<Link href="/dashboard">Dashboard</Link>
```

With your own router:

```tsx
<Link
  href="/dashboard"
  router={{
    push: (href) => navigate(href),
    prefetch: (href) => preloadRoute(href)
  }}
>
  Dashboard
</Link>
```

## React Router

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

Use:

```tsx
<SmartReactRouterLink to="/inbox" preventScrollReset>
  Inbox
</SmartReactRouterLink>
```

## Next.js App Router

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

Use this when you want stricter prefetch budgets, cross-tab dedupe, custom client cache invalidation, offline recovery, or consistent scroll/a11y behavior.

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
          if (opts?.replace) return router.replace(href);
          return router.push(href);
        },
        prefetch: (href) => router.prefetch(href)
      }}
    />
  );
}
```

## TanStack Router

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

## Remix

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

## Vue 3 + Vue Router

Use the runtime subpath so Vue does not import React.

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export const runtime = createLinkRuntime();
```

```vue
<script setup lang="ts">
import { useRouter } from "vue-router";
import { runtime } from "./runtime";

const props = defineProps<{
  to: string;
  replace?: boolean;
}>();

const router = useRouter();

function warm() {
  runtime.prefetch(props.to, { priority: "high" });
}

async function go(event: MouseEvent) {
  event.preventDefault();

  await runtime.navigate(props.to, {
    router: {
      push: (href) => {
        if (props.replace) return router.replace(href);
        return router.push(href);
      }
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

## Nuxt

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
    }
  });
}
</script>

<template>
  <a :href="to" @mouseenter="warm" @focus="warm" @click="go">
    <slot />
  </a>
</template>
```

## SvelteKit

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export const runtime = createLinkRuntime();
```

```svelte
<script lang="ts">
  import { goto, preloadData } from "$app/navigation";
  import { runtime } from "$lib/runtime";

  export let href: string;

  function warm() {
    runtime.prefetch(href, {
      priority: "high",
      fetcher: async (url) => {
        await preloadData(url);
      }
    });
  }

  async function go(event: MouseEvent) {
    event.preventDefault();
    await runtime.navigate(href, {
      router: {
        push: (url) => goto(url, { noScroll: true })
      }
    });
  }
</script>

<a {href} on:mouseenter={warm} on:focus={warm} on:click={go}>
  <slot />
</a>
```

## Angular

```ts
import { createLinkRuntime } from "rockzy-link/runtime";

export const runtime = createLinkRuntime();
```

```ts
import { Directive, HostListener, Input } from "@angular/core";
import { Router } from "@angular/router";
import { runtime } from "./runtime";

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
    runtime.prefetch(this.href, { priority: "high" });
  }

  @HostListener("click", ["$event"])
  async click(event: MouseEvent) {
    event.preventDefault();

    await runtime.navigate(this.href, {
      router: {
        push: (href) =>
          this.router.navigateByUrl(href, {
            replaceUrl: this.replace
          })
      }
    });
  }
}
```

Use:

```html
<a productionLink="/dashboard">Dashboard</a>
```

## Solid Router

```tsx
import { useNavigate } from "@solidjs/router";
import { createLinkRuntime } from "rockzy-link/runtime";

const runtime = createLinkRuntime();

export function SmartSolidLink(props: { href: string; children: any }) {
  const navigate = useNavigate();

  return (
    <a
      href={props.href}
      onMouseEnter={() => runtime.prefetch(props.href, { priority: "high" })}
      onFocus={() => runtime.prefetch(props.href, { priority: "high" })}
      onClick={(event) => {
        event.preventDefault();
        runtime.navigate(props.href, {
          router: {
            push: (href) => navigate(href)
          }
        });
      }}
    >
      {props.children}
    </a>
  );
}
```

## Qwik City

Use carefully. Qwik optimizes for resumability, so do this only for high-value links.

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

## Astro

React island:

```tsx
import { Link } from "rockzy-link";

export function NavIsland() {
  return <Link href="/docs" prefetch="viewport">Docs</Link>;
}
```

Plain script:

```astro
<a href="/docs" data-smart-link>Docs</a>

<script>
  import { createLinkRuntime } from "rockzy-link/runtime";

  const runtime = createLinkRuntime();

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-smart-link]");
    if (!link) return;
    event.preventDefault();
    runtime.navigate(link.href, { viewTransition: true });
  });
</script>
```

## htmx

Keep htmx in charge of swaps. Use this package for safety and prefetching.

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

## Framework Selection

| Framework | Preferred Import | Navigation Owner |
| --- | --- | --- |
| React SPA | `rockzy-link` | App router or runtime |
| React Router | `rockzy-link` | React Router |
| Next.js | `rockzy-link` | Next router |
| Remix | `rockzy-link` | Remix router |
| TanStack Router | `rockzy-link` | TanStack Router |
| Vue | `rockzy-link/runtime` | Vue Router |
| Nuxt | `rockzy-link/runtime` | Nuxt |
| SvelteKit | `rockzy-link/runtime` | SvelteKit |
| Angular | `rockzy-link/runtime` | Angular Router |
| Solid | `rockzy-link/runtime` | Solid Router |
| Qwik | `rockzy-link/runtime` | Qwik City |
| Astro | root or runtime | Astro/runtime |
| htmx | `rockzy-link/runtime` | htmx |
| Vanilla | `rockzy-link/runtime` | Runtime History API |
