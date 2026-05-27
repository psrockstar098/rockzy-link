import { RouteCache, estimateBytes } from "../cache/route-cache.js";
import type { CacheKind } from "../cache/route-cache.js";
import { isBrowser } from "../environment.js";
import type { PrefetchPriority } from "../types.js";
import { CrossTabPrefetchDedupe } from "./cross-tab-dedupe.js";
import {
  NetworkBudget,
  canPrefetchOnCurrentDevice
} from "./network-budget.js";

export interface PrefetchContext {
  signal: AbortSignal;
  priority: PrefetchPriority;
  cache: RouteCache;
}

export type PrefetchFetcher = (
  href: string,
  context: PrefetchContext
) => void | Response | Promise<void | Response>;

export interface PrefetchTaskOptions {
  priority: PrefetchPriority;
  kind?: CacheKind | undefined;
  tags?: readonly string[] | undefined;
  ttlMs?: number | undefined;
  staleWhileRevalidateMs?: number | undefined;
  estimateBytes?: number | undefined;
  staleAfterMs?: number | undefined;
  timeoutMs?: number | undefined;
  viewportScore?: number | undefined;
}

export interface PrefetchSchedulerOptions {
  concurrency?: number | undefined;
  maxRetries?: number | undefined;
  retryBaseDelayMs?: number | undefined;
  staleTaskMs?: number | undefined;
  requestTimeoutMs?: number | undefined;
  bandwidthBudgetBytesPerMinute?: number | undefined;
  memoryBudgetBytes?: number | undefined;
  crossTabDedupe?: boolean | undefined;
  routeCache?: RouteCache | undefined;
  fetcher?: PrefetchFetcher | undefined;
  now?: (() => number) | undefined;
}

interface QueuedTask extends PrefetchTaskOptions {
  href: string;
  fetcher: PrefetchFetcher;
  controller: AbortController;
  attempts: number;
  queuedAt: number;
  touchedAt: number;
  state: "queued" | "running" | "done" | "failed" | "cancelled";
}

const PRIORITY_SCORE: Record<PrefetchPriority, number> = {
  high: 3,
  medium: 2,
  low: 1
};

export class SmartPrefetchScheduler {
  private readonly queue = new Map<string, QueuedTask>();
  private readonly inFlight = new Map<string, QueuedTask>();
  private readonly completed = new Set<string>();
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly staleTaskMs: number;
  private readonly requestTimeoutMs: number;
  private readonly routeCache: RouteCache;
  private readonly budget: NetworkBudget;
  private readonly dedupe: CrossTabPrefetchDedupe | undefined;
  private readonly defaultFetcher: PrefetchFetcher | undefined;
  private readonly now: () => number;
  private pumpQueued = false;

  constructor(options: PrefetchSchedulerOptions = {}) {
    this.concurrency = options.concurrency ?? 4;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 350;
    this.staleTaskMs = options.staleTaskMs ?? 10_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 8_000;
    this.routeCache = options.routeCache ?? new RouteCache();
    this.budget = new NetworkBudget({
      bytesPerMinute: options.bandwidthBudgetBytesPerMinute,
      memoryBudgetBytes: options.memoryBudgetBytes
    });
    this.routeCache.setMemoryBudget(this.budget.memoryBudget);
    this.dedupe =
      options.crossTabDedupe === false
        ? undefined
        : new CrossTabPrefetchDedupe();
    this.defaultFetcher = options.fetcher;
    this.now = options.now ?? Date.now;
  }

  prefetch(
    href: string,
    fetcher: PrefetchFetcher | undefined,
    options: PrefetchTaskOptions
  ): AbortController {
    const existing = this.queue.get(href) ?? this.inFlight.get(href);
    if (existing) {
      this.escalate(existing, options);
      return existing.controller;
    }

    if (this.completed.has(href)) {
      return new AbortController();
    }

    const controller = new AbortController();
    const task: QueuedTask = {
      ...options,
      href,
      fetcher: fetcher ?? this.defaultFetcher ?? defaultDocumentPrefetch,
      controller,
      attempts: 0,
      queuedAt: this.now(),
      touchedAt: this.now(),
      state: "queued"
    };

    this.queue.set(href, task);
    this.schedulePump();
    return controller;
  }

  cancel(href: string): void {
    const queued = this.queue.get(href);
    if (queued) {
      queued.state = "cancelled";
      queued.controller.abort();
      this.queue.delete(href);
      return;
    }

    const running = this.inFlight.get(href);
    if (running) {
      running.state = "cancelled";
      running.controller.abort();
      this.inFlight.delete(href);
      this.dedupe?.markDone(href);
    }
  }

  cancelStale(maxAgeMs = this.staleTaskMs): number {
    const cutoff = this.now() - maxAgeMs;
    let count = 0;
    for (const [href, task] of this.queue) {
      if (task.priority === "high" || task.touchedAt > cutoff) continue;
      task.state = "cancelled";
      task.controller.abort();
      this.queue.delete(href);
      count += 1;
    }
    return count;
  }

  clear(): void {
    for (const href of Array.from(this.queue.keys())) this.cancel(href);
    for (const href of Array.from(this.inFlight.keys())) this.cancel(href);
    this.completed.clear();
  }

  destroy(): void {
    this.clear();
    this.dedupe?.close();
  }

  private schedulePump(): void {
    if (this.pumpQueued || !isBrowser()) return;
    this.pumpQueued = true;
    queueMicrotask(() => {
      this.pumpQueued = false;
      this.pump();
    });
  }

  private pump(): void {
    this.cancelStale();

    while (this.inFlight.size < this.concurrency) {
      const task = this.nextTask();
      if (!task) return;

      const estimate = task.estimateBytes ?? 128_000;
      if (!canPrefetchOnCurrentDevice(task.priority)) return;
      if (!this.budget.canSpend(estimate, task.priority)) return;

      this.queue.delete(task.href);

      if (this.dedupe?.isActiveElsewhere(task.href)) {
        this.completed.add(task.href);
        continue;
      }

      this.budget.spend(estimate, task.priority);
      this.run(task);
    }
  }

  private nextTask(): QueuedTask | undefined {
    return Array.from(this.queue.values()).sort(compareTasks)[0];
  }

  private async run(task: QueuedTask): Promise<void> {
    task.state = "running";
    task.attempts += 1;
    this.inFlight.set(task.href, task);
    this.dedupe?.markStart(task.href);

    const timeoutId = setTimeout(() => {
      task.controller.abort();
    }, task.timeoutMs ?? this.requestTimeoutMs);

    try {
      const response = await task.fetcher(task.href, {
        signal: task.controller.signal,
        priority: task.priority,
        cache: this.routeCache
      });

      if (response instanceof Response) {
        this.routeCache.set(task.href, task.kind ?? "html", response.clone(), {
          tags: task.tags,
          ttlMs: task.ttlMs,
          staleWhileRevalidateMs: task.staleWhileRevalidateMs,
          bytes: estimateBytes(response)
        });
      }

      task.state = "done";
      this.completed.add(task.href);
    } catch (error) {
      if (task.controller.signal.aborted) {
        task.state = "cancelled";
      } else if (task.attempts <= this.maxRetries) {
        task.state = "queued";
        task.touchedAt = this.now();
        setTimeout(() => {
          this.queue.set(task.href, task);
          this.schedulePump();
        }, backoff(task.attempts, this.retryBaseDelayMs));
      } else {
        task.state = "failed";
      }
    } finally {
      clearTimeout(timeoutId);
      this.inFlight.delete(task.href);
      this.dedupe?.markDone(task.href);
      this.schedulePump();
    }
  }

  private escalate(task: QueuedTask, options: PrefetchTaskOptions): void {
    if (PRIORITY_SCORE[options.priority] > PRIORITY_SCORE[task.priority]) {
      task.priority = options.priority;
    }
    task.viewportScore = Math.max(task.viewportScore ?? 0, options.viewportScore ?? 0);
    task.touchedAt = this.now();
  }
}

function compareTasks(a: QueuedTask, b: QueuedTask): number {
  const priorityDelta = PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];
  if (priorityDelta !== 0) return priorityDelta;

  const viewportDelta = (b.viewportScore ?? 0) - (a.viewportScore ?? 0);
  if (viewportDelta !== 0) return viewportDelta;

  return a.queuedAt - b.queuedAt;
}

function backoff(attempt: number, baseDelayMs: number): number {
  const jitter = Math.floor(Math.random() * baseDelayMs);
  return baseDelayMs * 2 ** Math.max(0, attempt - 1) + jitter;
}

async function defaultDocumentPrefetch(
  href: string,
  context: PrefetchContext
): Promise<Response | undefined> {
  if (!isBrowser() || typeof fetch !== "function") return undefined;
  return fetch(href, {
    credentials: "same-origin",
    signal: context.signal,
    priority: context.priority === "high" ? "high" : "low"
  } as RequestInit);
}
