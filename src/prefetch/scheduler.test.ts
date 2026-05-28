import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmartPrefetchScheduler } from "./scheduler.js";

describe("SmartPrefetchScheduler", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

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

  it("pumps a budget-blocked queued task when escalation makes it high priority", async () => {
    const fetcher = vi.fn();
    const scheduler = new SmartPrefetchScheduler({
      concurrency: 1,
      bandwidthBudgetBytesPerMinute: 1,
      fetcher,
      crossTabDedupe: false
    });

    scheduler.prefetch("/blocked", undefined, {
      priority: "low",
      estimateBytes: 10_000
    });
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();

    scheduler.prefetch("/blocked", undefined, {
      priority: "high",
      estimateBytes: 10_000
    });
    await Promise.resolve();

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
      retryJitterRatio: 0,
      crossTabDedupe: false
    });

    scheduler.prefetch("/retry", undefined, { priority: "high" });
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    expect(fetcher).toHaveBeenCalledTimes(2);
    scheduler.destroy();
    vi.useRealTimers();
  });

  it("honors per-task retry overrides", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const scheduler = new SmartPrefetchScheduler({
      concurrency: 1,
      fetcher,
      maxRetries: 0,
      crossTabDedupe: false
    });

    scheduler.prefetch("/task-retry", undefined, {
      priority: "high",
      maxRetries: 1,
      retryBaseDelayMs: 1,
      retryJitterRatio: 0
    });
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    expect(fetcher).toHaveBeenCalledTimes(2);
    scheduler.destroy();
    vi.useRealTimers();
  });

  it("injects asset preloads and speculation rules during prefetch", async () => {
    const fetcher = vi.fn();
    const scheduler = new SmartPrefetchScheduler({
      concurrency: 1,
      fetcher,
      crossTabDedupe: false
    });

    scheduler.prefetch("/native", undefined, {
      priority: "high",
      assets: ["/assets/app.css", { href: "/assets/app.js", module: true }],
      speculationRules: { action: "both" }
    });
    await Promise.resolve();

    const links = Array.from(document.head.querySelectorAll("link"));
    expect(links.some((link) => link.href.endsWith("/assets/app.css"))).toBe(true);
    expect(
      links.some(
        (link) =>
          link.href.endsWith("/assets/app.js") &&
          link.getAttribute("rel") === "modulepreload"
      )
    ).toBe(true);

    const script = document.getElementById("production-link-speculation-rules");
    expect(script?.getAttribute("type")).toBe("speculationrules");
    const rules = JSON.parse(script?.textContent ?? "{}") as {
      prefetch?: Array<{ urls: string[] }>;
      prerender?: Array<{ urls: string[] }>;
    };
    expect(rules.prefetch?.[0]?.urls).toContain("/native");
    expect(rules.prerender?.[0]?.urls).toContain("/native");

    scheduler.destroy();
  });
});
