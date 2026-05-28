# Benchmarks

This folder contains four benchmark groups.

## Runtime Benchmarks

```bash
npm run benchmark
npm run benchmark:ci
```

`benchmark` runs the local Tinybench suite.

`benchmark:ci` runs the same suite with longer timing and checks `benchmarks/baseline.json`.

Latest CI-style local highlights:

| Benchmark | ops/sec |
| --- | ---: |
| Route cache set/get HTML | 329,490 |
| Prefetch scheduler enqueue and pump | 193,899 |
| Navigation runtime router navigation | 1,050,434 |
| Guarded navigation | 597,499 |
| Warm cache navigation | 467,771 |
| Prefetched navigation | 705,081 |

## Browser Benchmark

```bash
npm run benchmark:browser
```

This launches Chromium with Playwright and measures real DOM clicks, React rendering, History API updates, and hydration.

Latest local results:

| Benchmark | mean | p99 |
| --- | ---: | ---: |
| `rockzy-link` React click-to-render | 16.54 ms | 17.9 ms |
| React controlled anchor click-to-render | 16.64 ms | 18.4 ms |
| Native `history.pushState` | 0.3372 ms | 1 ms |
| React hydrate route shell | 16.32 ms | 18.1 ms |

React Router, Next Link, and TanStack Router real integration rows are skipped until those packages are installed.

## Bundle Size Benchmark

```bash
npm run benchmark:bundle-size
```

Latest local report:

| Package / Library | Raw | Minified | Gzip | Brotli |
| --- | ---: | ---: | ---: | ---: |
| `rockzy-link` core + link | 13.89 KB | 10.29 KB | 3.03 KB | 2.70 KB |
| React Router DOM comparison | 162.00 KB | 57.00 KB | 18.00 KB | 15.50 KB |
| TanStack Router comparison | 280.00 KB | 95.00 KB | 26.00 KB | 22.50 KB |
| Next Link simulated context | 24.00 KB | 9.50 KB | 3.40 KB | 3.00 KB |

## Memory Benchmark

```bash
npm run benchmark:memory
```

Latest local report:

| Scenario | Result |
| --- | --- |
| 5,000 cache inserts with max 500 entries | Cache stayed at 500 entries |
| Cache heap growth | 0.40 MB |
| Tag invalidation stress | Final cache size 0 |
| 10,000 long-session prefetch/navigation loops | 4.10 MB heap growth |

## Output Files

Results are written under `benchmarks/results/`.

Common files:

- `benchmark-results.json`
- `benchmark-results.md`
- `browser-benchmark-results.json`
- `browser-benchmark-results.md`
- `bundle-size-results.json`
- `bundle-size-comparison.md`
- `memory-benchmark-results.json`
- `memory-benchmark-results.md`

## Updating Baselines

Only update baselines after intentional performance changes:

```bash
npm run build && node benchmarks/run.mjs --update-baseline
```

## Publish Check

Run the full release check with:

```bash
npm run publish:check
```

Do not run `publish:check` directly in PowerShell; it is an npm script name.
