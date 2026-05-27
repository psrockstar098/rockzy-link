import { RouteCache, estimateBytes } from "../cache/route-cache.js";
import { isBrowser } from "../environment.js";
import { CrossTabPrefetchDedupe } from "./cross-tab-dedupe.js";
import { NetworkBudget, canPrefetchOnCurrentDevice } from "./network-budget.js";
const PRIORITY_SCORE = {
    high: 3,
    medium: 2,
    low: 1
};
export class SmartPrefetchScheduler {
    queue = new Map();
    inFlight = new Map();
    completed = new Set();
    concurrency;
    maxRetries;
    retryBaseDelayMs;
    staleTaskMs;
    requestTimeoutMs;
    routeCache;
    budget;
    dedupe;
    defaultFetcher;
    now;
    pumpQueued = false;
    constructor(options = {}) {
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
    prefetch(href, fetcher, options) {
        const existing = this.queue.get(href) ?? this.inFlight.get(href);
        if (existing) {
            this.escalate(existing, options);
            return existing.controller;
        }
        if (this.completed.has(href)) {
            return new AbortController();
        }
        const controller = new AbortController();
        const task = {
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
    cancel(href) {
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
    cancelStale(maxAgeMs = this.staleTaskMs) {
        const cutoff = this.now() - maxAgeMs;
        let count = 0;
        for (const [href, task] of this.queue) {
            if (task.priority === "high" || task.touchedAt > cutoff)
                continue;
            task.state = "cancelled";
            task.controller.abort();
            this.queue.delete(href);
            count += 1;
        }
        return count;
    }
    clear() {
        for (const href of Array.from(this.queue.keys()))
            this.cancel(href);
        for (const href of Array.from(this.inFlight.keys()))
            this.cancel(href);
        this.completed.clear();
    }
    destroy() {
        this.clear();
        this.dedupe?.close();
    }
    schedulePump() {
        if (this.pumpQueued || !isBrowser())
            return;
        this.pumpQueued = true;
        queueMicrotask(() => {
            this.pumpQueued = false;
            this.pump();
        });
    }
    pump() {
        this.cancelStale();
        while (this.inFlight.size < this.concurrency) {
            const task = this.nextTask();
            if (!task)
                return;
            const estimate = task.estimateBytes ?? 128_000;
            if (!canPrefetchOnCurrentDevice(task.priority))
                return;
            if (!this.budget.canSpend(estimate, task.priority))
                return;
            this.queue.delete(task.href);
            if (this.dedupe?.isActiveElsewhere(task.href)) {
                this.completed.add(task.href);
                continue;
            }
            this.budget.spend(estimate, task.priority);
            this.run(task);
        }
    }
    nextTask() {
        return Array.from(this.queue.values()).sort(compareTasks)[0];
    }
    async run(task) {
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
        }
        catch (error) {
            if (task.controller.signal.aborted) {
                task.state = "cancelled";
            }
            else if (task.attempts <= this.maxRetries) {
                task.state = "queued";
                task.touchedAt = this.now();
                setTimeout(() => {
                    this.queue.set(task.href, task);
                    this.schedulePump();
                }, backoff(task.attempts, this.retryBaseDelayMs));
            }
            else {
                task.state = "failed";
            }
        }
        finally {
            clearTimeout(timeoutId);
            this.inFlight.delete(task.href);
            this.dedupe?.markDone(task.href);
            this.schedulePump();
        }
    }
    escalate(task, options) {
        if (PRIORITY_SCORE[options.priority] > PRIORITY_SCORE[task.priority]) {
            task.priority = options.priority;
        }
        task.viewportScore = Math.max(task.viewportScore ?? 0, options.viewportScore ?? 0);
        task.touchedAt = this.now();
    }
}
function compareTasks(a, b) {
    const priorityDelta = PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];
    if (priorityDelta !== 0)
        return priorityDelta;
    const viewportDelta = (b.viewportScore ?? 0) - (a.viewportScore ?? 0);
    if (viewportDelta !== 0)
        return viewportDelta;
    return a.queuedAt - b.queuedAt;
}
function backoff(attempt, baseDelayMs) {
    const jitter = Math.floor(Math.random() * baseDelayMs);
    return baseDelayMs * 2 ** Math.max(0, attempt - 1) + jitter;
}
async function defaultDocumentPrefetch(href, context) {
    if (!isBrowser() || typeof fetch !== "function")
        return undefined;
    return fetch(href, {
        credentials: "same-origin",
        signal: context.signal,
        priority: context.priority === "high" ? "high" : "low"
    });
}
//# sourceMappingURL=scheduler.js.map