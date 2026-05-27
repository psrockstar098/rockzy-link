# Lessons, Tips, and Tricks

These are the operating rules behind the package.

## 1. Prefetch Less, But Earlier

A fast app does not prefetch everything. It prefetches the right thing at the right time.

Use:

- `hover` for strong intent.
- `viewport` for likely intent.
- `idle` for cheap background warming.
- `none` for routes with sensitive data, heavy server work, or low click-through.

## 2. Sidebars Need Intent Delay

Dense navigation can accidentally trigger dozens of hover events as a pointer crosses the UI. The pointer intent tracker delays fast fly-bys and only prefetches when movement looks intentional.

For sidebars:

```tsx
<Link href="/customers" prefetch="hover" estimateBytes={96_000}>
  Customers
</Link>
```

## 3. Let One Layer Own The Budget

Do not let every framework link, query client, and custom prefetcher independently flood the network.

Pick one budget owner:

- this package for navigation intent and network scheduling
- the framework for actual route state
- your query/cache layer for data reuse

## 4. Expensive Routes Should Start As Hover

Viewport prefetch is powerful, but can be wasteful for dashboards, account pages, and large RSC payloads.

Use:

```tsx
<Link href="/billing" prefetch="hover">
  Billing
</Link>
```

## 5. Disable Prefetch For Mutation Routes

Routes that trigger permission checks, one-time tokens, or server-heavy dynamic work should not prefetch casually.

```tsx
<Link href="/checkout" prefetch="none">
  Checkout
</Link>
```

## 6. Cache Tags Should Match Product Concepts

Prefer tags like:

- `user:42`
- `project:abc`
- `billing`
- `settings`

Avoid tags like:

- `page`
- `data`
- `cache`

Good tags make mutation invalidation obvious.

## 7. Scroll Restoration Is A Feature, Not An Afterthought

For every scrollable panel that matters, add an ID:

```tsx
<section data-scroll-restoration-id="inbox-list" />
```

Back/forward navigation feels dramatically better when nested containers restore too.

## 8. View Transitions Must Respect Reduced Motion

Animations improve perceived speed, but only if they are not forced. Keep `respectReducedMotion: true`.

```ts
createLinkRuntime({
  viewTransition: {
    enabled: true,
    respectReducedMotion: true
  }
});
```

## 9. Announce Real Page Changes

A route change should move focus and announce the new page. Add a stable target:

```tsx
<h1 data-route-focus>Invoices</h1>
```

## 10. Offline Is Best Effort

Offline navigation is not magic. It works best when:

- the destination shell is cacheable
- critical data has fallbacks
- mutations are queued separately
- the UI clearly communicates stale or offline state

## 11. Security Comes First

Never render untrusted URLs directly into `href`.

This package blocks unsafe protocols such as `javascript:` and falls back to `#`.

```tsx
<Link href={userProvidedHref}>Open</Link>
```

## 12. Measure Before Raising Budgets

If pages feel slow, do not immediately increase concurrency.

Check:

- route payload size
- duplicate prefetches
- cache hit rate
- server latency
- whether viewport prefetch is too aggressive

Then tune:

```ts
createLinkRuntime({
  prefetch: {
    concurrency: 3,
    bandwidthBudgetBytesPerMinute: 2_000_000,
    memoryBudgetBytes: 40_000_000
  }
});
```

## Production Checklist

- Unsafe URLs sanitize to `#`.
- External URLs get `noopener noreferrer`.
- Prefetch is disabled for sensitive routes.
- Hover intent does not flood dense menus.
- Viewport links are prioritized by visibility.
- Back/forward restores window and nested scroll.
- Route changes announce and restore focus.
- Reduced-motion users do not get forced transitions.
- Cache tags exist for every mutation domain.
- Offline worker is registered only where supported.
- `npm run typecheck`, `npm run build`, and `npm test` pass.

