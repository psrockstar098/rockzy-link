import { describe, expect, it, vi } from "vitest";
import { SmartPrefetchScheduler } from "./scheduler.js";

describe("SmartPrefetchScheduler", () => {
  it("deduplicates and escalates queued tasks", async () => {
    const fetcher = vi.fn();
    const scheduler = new SmartPrefetchScheduler({
      concurrency: 1,
      fetcher,
      crossTabDedupe: false
    });

    scheduler.prefetch("/a", undefined, { priority: "low" });
    scheduler.prefetch("/a", undefined, { priority: "high" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1].priority).toBe("high");

    scheduler.destroy();
  });

  it("retries failed prefetches with backoff", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const scheduler = new SmartPrefetchScheduler({
      concurrency: 1,
      fetcher,
      maxRetries: 1,
      retryBaseDelayMs: 1,
      crossTabDedupe: false
    });

    scheduler.prefetch("/retry", undefined, { priority: "high" });
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    expect(fetcher).toHaveBeenCalledTimes(2);
    scheduler.destroy();
    vi.useRealTimers();
  });
});
