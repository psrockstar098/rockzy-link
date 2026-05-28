import { installBenchmarkDom } from "./helpers/dom.mjs";

export async function setup(bench) {
  const cleanup = installBenchmarkDom();
  const { createLinkRuntime } = await import("../dist/runtime/link-runtime.js");

  // Create runtime with cache enabled and mock prefetch fetcher to succeed instantly
  const runtime = createLinkRuntime({
    a11y: { announce: false, restoreFocus: false },
    offline: { enabled: false },
    prefetch: {
      adaptive: false,
      crossTabDedupe: false,
      concurrency: 4,
      fetcher: () => new Response("<div>Prefetched Content</div>")
    }
  });

  const router = { push: () => undefined };
  let coldId = 0;
  let warmId = 0;
  let prefetchId = 0;
  const scenarioPoolSize = 128;
  const warmHrefs = Array.from(
    { length: scenarioPoolSize },
    (_, index) => `/bench/scenarios/warm/${index}`
  );
  const prefetchedHrefs = Array.from(
    { length: scenarioPoolSize },
    (_, index) => `/bench/scenarios/pref/${index}`
  );

  for (const href of warmHrefs) {
    runtime.routeCache.set(href, "html", "<div>Warm Content</div>");
  }

  for (const href of prefetchedHrefs) {
    runtime.prefetch(href, { priority: "high" });
  }
  await waitForPrefetches(runtime, prefetchedHrefs);

  // 1. Cold navigation (must do full "network fetch")
  // We override the fetcher to simulate network delay (e.g. 5ms)
  const mockFetcher = () => new Promise((resolve) => setTimeout(resolve, 5));

  bench.add(
    "cache-scenarios: Cold navigation (network request)",
    async () => {
      const href = `/bench/scenarios/cold/${coldId++}`;
      // Simulate navigate needing to fetch data because it's not cached
      await mockFetcher(href);
      await runtime.navigate(href, {
        announce: false,
        focus: false,
        router,
        scroll: false
      });
    },
    { async: true }
  );

  // 2. Warm cache navigation (cache exists)
  // We prepopulate the cache
  const warmCache = runtime.routeCache;
  bench.add(
    "cache-scenarios: Warm cache navigation",
    async () => {
      const href = warmHrefs[warmId++ % warmHrefs.length];
      // Retrieve and navigate
      warmCache.get(href, "html");
      await runtime.navigate(href, {
        announce: false,
        focus: false,
        router,
        scroll: false
      });
    },
    { async: true }
  );

  // 3. Prefetched navigation
  // Prefetch scheduler enqueues and completes, then we navigate
  bench.add(
    "cache-scenarios: Prefetched navigation",
    async () => {
      const href = prefetchedHrefs[prefetchId++ % prefetchedHrefs.length];
      // Retrieve prefetched content from cache
      runtime.routeCache.get(href, "html");
      await runtime.navigate(href, {
        announce: false,
        focus: false,
        router,
        scroll: false
      });
    },
    { async: true }
  );

  process.once("exit", () => {
    runtime.destroy();
    cleanup();
  });
}

async function waitForPrefetches(runtime, hrefs) {
  const pending = new Set(hrefs);

  for (let attempt = 0; attempt < 100 && pending.size > 0; attempt += 1) {
    await Promise.resolve();
    for (const href of Array.from(pending)) {
      if (runtime.routeCache.has(href, "html")) pending.delete(href);
    }
  }

  if (pending.size > 0) {
    throw new Error(`Timed out waiting for ${pending.size} prefetched routes`);
  }
}
