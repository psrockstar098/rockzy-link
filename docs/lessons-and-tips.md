# Lessons And Tips

These are the practical rules.

## Prefetch Less, But Earlier

Do not prefetch everything.

Use:

- `hover` for strong intent
- `viewport` for important visible links
- `idle` for cheap background work
- `none` for sensitive or expensive routes

## Sidebars Should Usually Use Hover

Dense menus can trigger too many viewport prefetches.

```tsx
<Link href="/customers" prefetch="hover" estimateBytes={96_000}>
  Customers
</Link>
```

## Pick One Budget Owner

Avoid three systems all prefetching the same page.

Good split:

- `rockzy-link` owns navigation intent and prefetch budget
- your router owns route state
- your query layer owns data freshness

## Tag Cache Entries

Good tags:

- `project:42`
- `projects`
- `settings`
- `billing`

Then mutation cleanup is simple:

```ts
runtime.routeCache.invalidateTags(["projects", "project:42"]);
```

## Use A Fast Path For Plain Router Navigation

If you do not need scroll, focus, announcements, transitions, or snapshots:

```ts
runtime.navigate("/dashboard", {
  router,
  scroll: false,
  announce: false,
  focus: false
});
```

That keeps runtime overhead tiny.

## Respect Reduced Motion

Keep this default:

```ts
createLinkRuntime({
  viewTransition: {
    enabled: true,
    respectReducedMotion: true
  }
});
```

## Add Focus Targets

```tsx
<h1 data-route-focus>Reports</h1>
```

This makes keyboard and screen-reader navigation feel much better.

## Offline Is Recovery, Not Magic

Offline navigation works best when:

- route shells are cacheable
- stale data is clearly labeled
- mutations have their own queue/conflict strategy

## Measure Before Tuning

Start with:

```bash
npm run benchmark:browser
npm run benchmark:memory
```

Then adjust concurrency, payload sizes, or cache TTLs.

## Production Checklist

- Unsafe URLs sanitize to `#`.
- External links get `noopener noreferrer`.
- Private routes use `prefetch="none"`.
- Dense menus use `prefetch="hover"`.
- Mutation data has cache tags.
- Pages include `data-route-focus`.
- Important scroll panels have `data-scroll-restoration-id`.
- Reduced-motion users are respected.
- `npm run publish:check` passes.
