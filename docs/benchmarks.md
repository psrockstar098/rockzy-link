# Benchmarks

These are the latest local numbers shared from Windows, Node `v24.12.0`, and headless Chromium on May 28, 2026.

Benchmarks vary by machine. Use them as directional proof, then run them in your own app.

## Browser Benchmark

Command:

```bash
npm run benchmark:browser
```

This benchmark launches Chromium with Playwright. It measures real DOM events, React rendering, History API updates, and hydration.

| Benchmark | mean | median | p95 | p99 | Samples |
| --- | ---: | ---: | ---: | ---: | ---: |
| `rockzy-link` React click-to-render | 16.54 ms | 16.7 ms | 17.6 ms | 17.9 ms | 250 |
| React controlled anchor click-to-render | 16.64 ms | 16.6 ms | 17.6 ms | 18.4 ms | 250 |
| Native `history.pushState` | 0.3372 ms | 0.3 ms | 0.6 ms | 1 ms | 250 |
| React hydrate route shell | 16.32 ms | 16.3 ms | 17.7 ms | 18.1 ms | 250 |

Skipped until dependencies are installed:

- React Router
- Next Link
- TanStack Router

## Runtime Benchmark

Command:

```bash
npm run benchmark:ci
```

| Benchmark | ops/sec | p99 latency |
| --- | ---: | ---: |
| Route cache set/get HTML | 329,490 | 0.0084 ms |
| Route cache tag invalidation | 18,217 | 0.1052 ms |
| Prefetch scheduler enqueue and pump | 193,899 | 0.0103 ms |
| Prefetch scheduler priority escalation | 179,738 | 0.0086 ms |
| Navigation runtime router navigation | 1,050,434 | 0.0015 ms |
| Guarded navigation | 597,499 | 0.0033 ms |
| `rockzy-link` simulated comparison | 1,028,632 | 0.0014 ms |
| React Router simulated comparison | 16,094 | 0.3601 ms |
| Next Link simulated comparison | 21,040 | 0.152 ms |
| Native browser simulated comparison | 18,729 | 0.1291 ms |
| Warm cache navigation | 467,771 | 0.0032 ms |
| Prefetched navigation | 705,081 | 0.0022 ms |

The simulated framework rows are useful for smoke tests, but real browser integrations are more important for credibility.

## Bundle Size Benchmark

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

Size-limit output:

| Entry | Brotli |
| --- | ---: |
| Core entry | 350 B |
| React link component | 2.86 KB |
| Navigation runtime | 3.37 KB |
| Prefetch scheduler | 4.24 KB |

## Memory Benchmark

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

## Publish Check

Command:

```bash
npm run publish:check
```

This runs typecheck, tests, build, size checks, CI benchmarks, security audit, and dry-run packing.

Use `npm run publish:check`, not `publish:check` by itself.
