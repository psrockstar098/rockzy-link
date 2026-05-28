import { installBenchmarkDom } from "./helpers/dom.mjs";

export async function setup(bench) {
  const cleanup = installBenchmarkDom();
  const { createLinkRuntime } = await import("../dist/runtime/link-runtime.js");

  const router = {
    push: () => undefined
  };

  const runtime = createLinkRuntime({
    a11y: {
      announce: false,
      restoreFocus: false
    },
    offline: {
      enabled: false
    },
    prefetch: {
      adaptive: false,
      crossTabDedupe: false
    }
  });
  let routeId = 0;

  bench.add(
    "navigation-runtime: router navigation",
    async () => {
      await runtime.navigate(`/bench/runtime/${routeId++}`, {
        announce: false,
        focus: false,
        router,
        scroll: false
      });
    },
    { async: true }
  );

  const guardedRuntime = createLinkRuntime({
    a11y: {
      announce: false,
      restoreFocus: false
    },
    beforeNavigate: [
      () => true,
      async () => true
    ],
    offline: {
      enabled: false
    },
    prefetch: {
      adaptive: false,
      crossTabDedupe: false
    }
  });
  let guardedRouteId = 0;

  bench.add(
    "navigation-runtime: guarded navigation",
    async () => {
      await guardedRuntime.navigate(`/bench/runtime/guarded/${guardedRouteId++}`, {
        announce: false,
        focus: false,
        guards: [() => true],
        router,
        scroll: false
      });
    },
    { async: true }
  );

  process.once("exit", () => {
    runtime.destroy();
    guardedRuntime.destroy();
    cleanup();
  });
}
