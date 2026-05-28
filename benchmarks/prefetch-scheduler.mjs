import { installBenchmarkDom } from "./helpers/dom.mjs";

export async function setup(bench) {
  const cleanup = installBenchmarkDom();
  const { SmartPrefetchScheduler } = await import("../dist/prefetch/scheduler.js");

  const scheduler = new SmartPrefetchScheduler({
    adaptive: false,
    concurrency: 256,
    crossTabDedupe: false,
    fetcher: () => undefined,
    memoryBudgetBytes: 100_000_000
  });
  let enqueueId = 0;

  bench.add(
    "prefetch-scheduler: enqueue and pump",
    async () => {
      scheduler.prefetch(`/bench/prefetch/${enqueueId++}`, undefined, {
        estimateBytes: 1,
        priority: "high"
      });
      await Promise.resolve();
    },
    { async: true }
  );

  const escalationScheduler = new SmartPrefetchScheduler({
    adaptive: false,
    bandwidthBudgetBytesPerMinute: 1,
    concurrency: 64,
    crossTabDedupe: false,
    fetcher: () => undefined,
    memoryBudgetBytes: 100_000_000
  });
  let escalationId = 0;

  bench.add(
    "prefetch-scheduler: priority escalation",
    async () => {
      const href = `/bench/escalate/${escalationId++}`;
      escalationScheduler.prefetch(href, undefined, {
        estimateBytes: 100_000,
        priority: "low"
      });
      escalationScheduler.prefetch(href, undefined, {
        estimateBytes: 100_000,
        priority: "high"
      });
      await Promise.resolve();
    },
    { async: true }
  );

  process.once("exit", () => {
    scheduler.destroy();
    escalationScheduler.destroy();
    cleanup();
  });
}
