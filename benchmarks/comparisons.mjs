import { installBenchmarkDom } from "./helpers/dom.mjs";

export async function setup(bench) {
  const cleanup = installBenchmarkDom();
  const { createLinkRuntime } = await import("../dist/runtime/link-runtime.js");

  // Initialize rockzy-link runtime
  const runtime = createLinkRuntime({
    a11y: { announce: false, restoreFocus: false },
    offline: { enabled: false },
    prefetch: { adaptive: false, crossTabDedupe: false }
  });

  const router = { push: () => undefined };
  let routeId = 0;

  // 1. rockzy-link navigation
  bench.add(
    "comparisons: rockzy-link navigation",
    async () => {
      await runtime.navigate(`/bench/comp/rockzy/${routeId++}`, {
        announce: false,
        focus: false,
        router,
        scroll: false
      });
    },
    { async: true }
  );

  // 2. Simulated React Router Navigation (executes user guards & history push)
  const rrGuards = [() => true];
  let rrRouteId = 0;
  bench.add(
    "comparisons: React Router navigation (simulated)",
    async () => {
      const href = `/bench/comp/rr/${rrRouteId++}`;
      // Simulate react-router lifecycle: beforeNavigate / guards check
      for (const guard of rrGuards) {
        if (guard() === false) return;
      }
      // Simulate pushing state and triggering popstate/listeners
      window.history.pushState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    },
    { async: true }
  );

  // 3. Simulated Next.js Link (prefetch trigger & routing push)
  let nextRouteId = 0;
  const nextPrefetchCache = new Set();
  bench.add(
    "comparisons: Next Link navigation (simulated)",
    async () => {
      const href = `/bench/comp/next/${nextRouteId++}`;
      // Simulated Next prefetch check and fetch
      if (!nextPrefetchCache.has(href)) {
        nextPrefetchCache.add(href);
        // Mock preloading component/JS chunks
        await Promise.resolve();
      }
      // Router transition
      window.history.pushState({}, "", href);
    },
    { async: true }
  );

  // 4. Native Browser Navigation (no routing library overhead)
  let nativeRouteId = 0;
  bench.add(
    "comparisons: Native Browser navigation",
    () => {
      const href = `/bench/comp/native/${nativeRouteId++}`;
      window.history.pushState({}, "", href);
    }
  );

  process.once("exit", () => {
    runtime.destroy();
    cleanup();
  });
}
