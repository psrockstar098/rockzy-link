import { RouteCache, estimateBytes } from "../cache/route-cache.js";
import type { CacheKind } from "../cache/route-cache.js";
import { isBrowser } from "../environment.js";
import type { PrefetchPriority } from "../types.js";
import { CrossTabPrefetchDedupe } from "./cross-tab-dedupe.js";
import {
  NetworkBudget,
  canPrefetchOnCurrentDevice
} from "./network-budget.js";
import type { DevicePrefetchPolicy } from "./network-budget.js";

export interface PrefetchContext {
  signal: AbortSignal;
  priority: PrefetchPriority;
  cache: RouteCache;
}

export type PrefetchFetcher = (
  href: string,
  context: PrefetchContext
) => void | Response | Promise<void | Response>;

export interface PrefetchAsset {
  href: string;
  rel?: "preload" | "modulepreload" | undefined;
  as?: string | undefined;
  type?: string | undefined;
  crossOrigin?: "" | "anonymous" | "use-credentials" | undefined;
  integrity?: string | undefined;
  media?: string | undefined;
  referrerPolicy?: ReferrerPolicy | undefined;
  fetchPriority?: "high" | "low" | "auto" | undefined;
  module?: boolean | undefined;
}

export type PrefetchAssetInput = string | PrefetchAsset;

export interface SpeculationRulesOptions {
  action?: "prefetch" | "prerender" | "both" | undefined;
  eagerness?:
    | "immediate"
    | "eager"
    | "moderate"
    | "conservative"
    | undefined;
  referrerPolicy?: ReferrerPolicy | undefined;
}

export interface AdaptivePrefetchOptions {
  enabled?: boolean | undefined;
  lowBatteryThreshold?: number | undefined;
  minDeviceMemoryGb?: number | undefined;
}

export type PrefetchDiagnosticReason =
  | "scheduled"
  | "cache-hit"
  | "completed"
  | "failed"
  | "cancelled"
  | "retried"
  | "navigation";

export interface PrefetchDiagnostics {
  reason: PrefetchDiagnosticReason;
  href?: string | undefined;
  queued: number;
  inFlight: number;
  scheduledPrefetches: number;
  completedPrefetches: number;
  failedPrefetches: number;
  cancelledPrefetches: number;
  retriedPrefetches: number;
  cacheHits: number;
  cacheHitRate: number;
  totalBytesFetched: number;
  navigationCount: number;
  prefetchedNavigationCount: number;
  prefetchToClickRatio: number;
  prefetchedNavigationRatio: number;
}

export interface PrefetchTaskOptions {
  priority: PrefetchPriority;
  kind?: CacheKind | undefined;
  tags?: readonly string[] | undefined;
  ttlMs?: number | undefined;
  staleWhileRevalidateMs?: number | undefined;
  estimateBytes?: number | undefined;
  staleAfterMs?: number | undefined;
  timeoutMs?: number | undefined;
  maxRetries?: number | undefined;
  retryBaseDelayMs?: number | undefined;
  retryMaxDelayMs?: number | undefined;
  retryBackoffFactor?: number | undefined;
  retryJitterRatio?: number | undefined;
  viewportScore?: number | undefined;
  assets?: readonly PrefetchAssetInput[] | undefined;
  speculationRules?: boolean | SpeculationRulesOptions | undefined;
}

export interface PrefetchSchedulerOptions {
  concurrency?: number | undefined;
  maxRetries?: number | undefined;
  retryBaseDelayMs?: number | undefined;
  retryMaxDelayMs?: number | undefined;
  retryBackoffFactor?: number | undefined;
  retryJitterRatio?: number | undefined;
  staleTaskMs?: number | undefined;
  requestTimeoutMs?: number | undefined;
  bandwidthBudgetBytesPerMinute?: number | undefined;
  memoryBudgetBytes?: number | undefined;
  crossTabDedupe?: boolean | undefined;
  routeCache?: RouteCache | undefined;
  fetcher?: PrefetchFetcher | undefined;
  adaptive?: boolean | AdaptivePrefetchOptions | undefined;
  speculationRules?: boolean | SpeculationRulesOptions | undefined;
  onDiagnostics?: ((diagnostics: PrefetchDiagnostics) => void) | undefined;
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
  attemptController?: AbortController | undefined;
}

const PRIORITY_SCORE: Record<PrefetchPriority, number> = {
  high: 3,
  medium: 2,
  low: 1
};

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  level: number;
}

interface PrefetchMetrics {
  scheduledPrefetches: number;
  completedPrefetches: number;
  failedPrefetches: number;
  cancelledPrefetches: number;
  retriedPrefetches: number;
  cacheHits: number;
  totalBytesFetched: number;
  navigationCount: number;
  prefetchedNavigationCount: number;
}

export class SmartPrefetchScheduler {
  private readonly queue = new Map<string, QueuedTask>();
  private readonly inFlight = new Map<string, QueuedTask>();
  private readonly completed = new Set<string>();
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly retryBackoffFactor: number;
  private readonly retryJitterRatio: number;
  private readonly staleTaskMs: number;
  private readonly requestTimeoutMs: number;
  private readonly routeCache: RouteCache;
  private readonly budget: NetworkBudget;
  private readonly dedupe: CrossTabPrefetchDedupe | undefined;
  private readonly defaultFetcher: PrefetchFetcher | undefined;
  private readonly adaptive: AdaptivePrefetchOptions;
  private readonly defaultSpeculationRules:
    | boolean
    | SpeculationRulesOptions
    | undefined;
  private readonly onDiagnostics:
    | ((diagnostics: PrefetchDiagnostics) => void)
    | undefined;
  private readonly now: () => number;
  private readonly metrics: PrefetchMetrics = {
    scheduledPrefetches: 0,
    completedPrefetches: 0,
    failedPrefetches: 0,
    cancelledPrefetches: 0,
    retriedPrefetches: 0,
    cacheHits: 0,
    totalBytesFetched: 0,
    navigationCount: 0,
    prefetchedNavigationCount: 0
  };
  private batteryState:
    | {
        level: number;
        charging: boolean;
      }
    | undefined;
  private batteryCleanup: (() => void) | undefined;
  private pumpQueued = false;
  private destroyed = false;

  constructor(options: PrefetchSchedulerOptions = {}) {
    this.concurrency = options.concurrency ?? 4;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 350;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 8_000;
    this.retryBackoffFactor = options.retryBackoffFactor ?? 2;
    this.retryJitterRatio = options.retryJitterRatio ?? 1;
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
    this.adaptive = normalizeAdaptiveOptions(options.adaptive);
    this.defaultSpeculationRules = options.speculationRules;
    this.onDiagnostics = options.onDiagnostics;
    this.now = options.now ?? Date.now;
    this.installBatteryMonitor();
  }

  prefetch(
    href: string,
    fetcher: PrefetchFetcher | undefined,
    options: PrefetchTaskOptions
  ): AbortController {
    const cached = this.routeCache.get(href, options.kind ?? "html");
    if (cached && !cached.stale) {
      injectSpeculationRules(
        href,
        options.speculationRules ?? this.defaultSpeculationRules,
        options.priority
      );
      injectAssetPreloads(options.assets, options.priority);
      this.completed.add(href);
      this.metrics.cacheHits += 1;
      this.emitDiagnostics("cache-hit", href);
      return new AbortController();
    }

    const existing = this.queue.get(href) ?? this.inFlight.get(href);
    if (existing) {
      this.escalate(existing, options);
      this.schedulePump();
      return existing.controller;
    }

    if (this.completed.has(href)) {
      injectSpeculationRules(
        href,
        options.speculationRules ?? this.defaultSpeculationRules,
        options.priority
      );
      injectAssetPreloads(options.assets, options.priority);
      this.metrics.cacheHits += 1;
      this.emitDiagnostics("cache-hit", href);
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
    this.metrics.scheduledPrefetches += 1;
    this.emitDiagnostics("scheduled", href);
    this.schedulePump();
    return controller;
  }

  cancel(href: string): void {
    const queued = this.queue.get(href);
    if (queued) {
      this.markCancelled(queued);
      queued.controller.abort();
      this.queue.delete(href);
      return;
    }

    const running = this.inFlight.get(href);
    if (running) {
      this.markCancelled(running);
      running.controller.abort();
      running.attemptController?.abort();
      this.inFlight.delete(href);
      this.dedupe?.markDone(href);
    }
  }

  cancelStale(maxAgeMs = this.staleTaskMs): number {
    const cutoff = this.now() - maxAgeMs;
    let count = 0;
    for (const [href, task] of this.queue) {
      if (task.priority === "high" || task.touchedAt > cutoff) continue;
      this.markCancelled(task);
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
    this.destroyed = true;
    this.clear();
    this.dedupe?.close();
    this.batteryCleanup?.();
  }

  recordNavigation(href: string): void {
    this.metrics.navigationCount += 1;
    if (this.completed.has(href) || this.hasCachedDocument(href)) {
      this.metrics.prefetchedNavigationCount += 1;
    }
    this.emitDiagnostics("navigation", href);
  }

  getDiagnostics(reason: PrefetchDiagnosticReason = "scheduled"): PrefetchDiagnostics {
    return this.createDiagnostics(reason);
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
      if (!canPrefetchOnCurrentDevice(task.priority, this.getDevicePolicy())) return;
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

    const attemptController = new AbortController();
    task.attemptController = attemptController;
    const abortAttempt = () => attemptController.abort();
    task.controller.signal.addEventListener("abort", abortAttempt, { once: true });
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      attemptController.abort();
    }, task.timeoutMs ?? this.requestTimeoutMs);

    try {
      injectSpeculationRules(
        task.href,
        task.speculationRules ?? this.defaultSpeculationRules,
        task.priority
      );
      injectAssetPreloads(task.assets, task.priority);

      const response = await task.fetcher(task.href, {
        signal: attemptController.signal,
        priority: task.priority,
        cache: this.routeCache
      });

      if (task.controller.signal.aborted) {
        this.markCancelled(task);
        return;
      }

      if (response instanceof Response) {
        const bytes = estimateBytes(response);
        this.routeCache.set(task.href, task.kind ?? "html", response.clone(), {
          tags: task.tags,
          ttlMs: task.ttlMs,
          staleWhileRevalidateMs: task.staleWhileRevalidateMs,
          bytes
        });
        this.metrics.totalBytesFetched += bytes;
      }

      task.state = "done";
      this.completed.add(task.href);
      this.metrics.completedPrefetches += 1;
      this.emitDiagnostics("completed", task.href);
    } catch (error) {
      if (task.controller.signal.aborted) {
        this.markCancelled(task);
      } else if (task.attempts <= (task.maxRetries ?? this.maxRetries)) {
        task.state = "queued";
        task.touchedAt = this.now();
        this.metrics.retriedPrefetches += 1;
        this.emitDiagnostics("retried", task.href);
        setTimeout(() => {
          if (task.controller.signal.aborted) {
            this.markCancelled(task);
            return;
          }
          this.queue.set(task.href, task);
          this.schedulePump();
        }, backoff(task.attempts, {
          baseDelayMs: task.retryBaseDelayMs ?? this.retryBaseDelayMs,
          maxDelayMs: task.retryMaxDelayMs ?? this.retryMaxDelayMs,
          factor: task.retryBackoffFactor ?? this.retryBackoffFactor,
          jitterRatio: task.retryJitterRatio ?? this.retryJitterRatio
        }));
      } else {
        task.state = "failed";
        this.metrics.failedPrefetches += 1;
        this.emitDiagnostics("failed", task.href);
      }
    } finally {
      clearTimeout(timeoutId);
      task.controller.signal.removeEventListener("abort", abortAttempt);
      task.attemptController = undefined;
      this.inFlight.delete(task.href);
      this.dedupe?.markDone(task.href);
      this.schedulePump();
    }
  }

  private escalate(task: QueuedTask, options: PrefetchTaskOptions): void {
    if (PRIORITY_SCORE[options.priority] > PRIORITY_SCORE[task.priority]) {
      task.priority = options.priority;
    }
    if (options.kind !== undefined) task.kind = options.kind;
    if (options.tags !== undefined) task.tags = options.tags;
    if (options.ttlMs !== undefined) task.ttlMs = options.ttlMs;
    if (options.staleWhileRevalidateMs !== undefined) {
      task.staleWhileRevalidateMs = options.staleWhileRevalidateMs;
    }
    if (options.estimateBytes !== undefined) task.estimateBytes = options.estimateBytes;
    if (options.staleAfterMs !== undefined) task.staleAfterMs = options.staleAfterMs;
    if (options.timeoutMs !== undefined) task.timeoutMs = options.timeoutMs;
    if (options.maxRetries !== undefined) task.maxRetries = options.maxRetries;
    if (options.retryBaseDelayMs !== undefined) {
      task.retryBaseDelayMs = options.retryBaseDelayMs;
    }
    if (options.retryMaxDelayMs !== undefined) {
      task.retryMaxDelayMs = options.retryMaxDelayMs;
    }
    if (options.retryBackoffFactor !== undefined) {
      task.retryBackoffFactor = options.retryBackoffFactor;
    }
    if (options.retryJitterRatio !== undefined) {
      task.retryJitterRatio = options.retryJitterRatio;
    }
    if (options.assets !== undefined) task.assets = options.assets;
    if (options.speculationRules !== undefined) {
      task.speculationRules = options.speculationRules;
    }
    task.viewportScore = Math.max(task.viewportScore ?? 0, options.viewportScore ?? 0);
    task.touchedAt = this.now();
  }

  private markCancelled(task: QueuedTask): void {
    if (task.state === "cancelled") return;
    task.state = "cancelled";
    this.metrics.cancelledPrefetches += 1;
    this.emitDiagnostics("cancelled", task.href);
  }

  private hasCachedDocument(href: string): boolean {
    return this.routeCache.has(href, "html");
  }

  private getDevicePolicy(): DevicePrefetchPolicy {
    return {
      adaptive: this.adaptive.enabled,
      batteryLevel: this.batteryState?.level,
      batteryCharging: this.batteryState?.charging,
      lowBatteryThreshold: this.adaptive.lowBatteryThreshold,
      minDeviceMemoryGb: this.adaptive.minDeviceMemoryGb
    };
  }

  private installBatteryMonitor(): void {
    if (!isBrowser() || this.adaptive.enabled === false) return;

    const navigatorWithBattery = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };
    if (typeof navigatorWithBattery.getBattery !== "function") return;

    void navigatorWithBattery.getBattery().then((battery) => {
      if (this.destroyed) return;
      const update = () => {
        this.batteryState = {
          level: battery.level,
          charging: battery.charging
        };
        this.schedulePump();
      };

      update();
      battery.addEventListener("levelchange", update);
      battery.addEventListener("chargingchange", update);
      this.batteryCleanup = () => {
        battery.removeEventListener("levelchange", update);
        battery.removeEventListener("chargingchange", update);
      };
    }).catch(() => undefined);
  }

  private emitDiagnostics(
    reason: PrefetchDiagnosticReason,
    href?: string
  ): void {
    this.onDiagnostics?.(this.createDiagnostics(reason, href));
  }

  private createDiagnostics(
    reason: PrefetchDiagnosticReason,
    href?: string
  ): PrefetchDiagnostics {
    const completedOrHits =
      this.metrics.completedPrefetches + this.metrics.cacheHits;
    return {
      reason,
      href,
      queued: this.queue.size,
      inFlight: this.inFlight.size,
      ...this.metrics,
      cacheHitRate:
        completedOrHits === 0 ? 0 : this.metrics.cacheHits / completedOrHits,
      prefetchToClickRatio:
        this.metrics.navigationCount === 0
          ? this.metrics.completedPrefetches
          : this.metrics.completedPrefetches / this.metrics.navigationCount,
      prefetchedNavigationRatio:
        this.metrics.navigationCount === 0
          ? 0
          : this.metrics.prefetchedNavigationCount /
            this.metrics.navigationCount
    };
  }
}

function compareTasks(a: QueuedTask, b: QueuedTask): number {
  const priorityDelta = PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];
  if (priorityDelta !== 0) return priorityDelta;

  const viewportDelta = (b.viewportScore ?? 0) - (a.viewportScore ?? 0);
  if (viewportDelta !== 0) return viewportDelta;

  return a.queuedAt - b.queuedAt;
}

function backoff(
  attempt: number,
  options: {
    baseDelayMs: number;
    maxDelayMs: number;
    factor: number;
    jitterRatio: number;
  }
): number {
  const exponential =
    options.baseDelayMs *
    options.factor ** Math.max(0, attempt - 1);
  const capped = Math.min(options.maxDelayMs, exponential);
  const jitter = Math.floor(Math.random() * options.baseDelayMs * options.jitterRatio);
  return capped + jitter;
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

function normalizeAdaptiveOptions(
  options: boolean | AdaptivePrefetchOptions | undefined
): AdaptivePrefetchOptions {
  if (options === false) return { enabled: false };
  if (options === true || options === undefined) {
    return {
      enabled: true,
      lowBatteryThreshold: 0.2,
      minDeviceMemoryGb: 1
    };
  }
  return {
    enabled: options.enabled ?? true,
    lowBatteryThreshold: options.lowBatteryThreshold ?? 0.2,
    minDeviceMemoryGb: options.minDeviceMemoryGb ?? 1
  };
}

interface SpeculationRuleList {
  prefetch?: SpeculationRule[] | undefined;
  prerender?: SpeculationRule[] | undefined;
}

interface SpeculationRule {
  source: "list";
  urls: string[];
  eagerness?: "immediate" | "eager" | "moderate" | "conservative" | undefined;
  referrer_policy?: ReferrerPolicy | undefined;
}

const SPECULATION_SCRIPT_ID = "production-link-speculation-rules";

function injectSpeculationRules(
  href: string,
  config: boolean | SpeculationRulesOptions | undefined,
  priority: PrefetchPriority
): void {
  const rules = normalizeSpeculationRules(config, priority);
  if (!rules || !isBrowser()) return;

  const existing = document.getElementById(SPECULATION_SCRIPT_ID);
  const script =
    existing instanceof HTMLScriptElement
      ? existing
      : document.createElement("script");

  let documentRules: SpeculationRuleList = {};
  if (script.textContent) {
    try {
      documentRules = JSON.parse(script.textContent) as SpeculationRuleList;
    } catch {
      documentRules = {};
    }
  }

  for (const action of rules.actions) {
    const list = documentRules[action] ?? [];
    if (!list.some((rule) => rule.urls.includes(href))) {
      const rule: SpeculationRule = {
        source: "list",
        urls: [href],
        eagerness: rules.eagerness
      };
      if (rules.referrerPolicy) {
        rule.referrer_policy = rules.referrerPolicy;
      }
      list.push(rule);
    }
    documentRules[action] = list;
  }

  script.id = SPECULATION_SCRIPT_ID;
  script.type = "speculationrules";
  script.textContent = JSON.stringify(documentRules);
  if (!script.isConnected) document.head.append(script);
}

function normalizeSpeculationRules(
  config: boolean | SpeculationRulesOptions | undefined,
  priority: PrefetchPriority
):
  | {
      actions: Array<"prefetch" | "prerender">;
      eagerness: "immediate" | "eager" | "moderate" | "conservative";
      referrerPolicy?: ReferrerPolicy | undefined;
    }
  | undefined {
  if (!config) return undefined;
  const normalized = config === true ? {} : config;
  const action = normalized.action ?? "prefetch";
  const actions =
    action === "both" ? (["prefetch", "prerender"] as const) : ([action] as const);
  return {
    actions: Array.from(actions),
    eagerness: normalized.eagerness ?? eagernessForPriority(priority),
    referrerPolicy: normalized.referrerPolicy
  };
}

function eagernessForPriority(
  priority: PrefetchPriority
): "immediate" | "eager" | "moderate" | "conservative" {
  if (priority === "high") return "immediate";
  if (priority === "medium") return "moderate";
  return "conservative";
}

function injectAssetPreloads(
  assets: readonly PrefetchAssetInput[] | undefined,
  priority: PrefetchPriority
): void {
  if (!assets?.length || !isBrowser()) return;

  for (const asset of assets) {
    const normalized = normalizeAsset(asset, priority);
    if (hasPreload(normalized.href, normalized.rel)) continue;

    const link = document.createElement("link");
    link.rel = normalized.rel;
    link.href = normalized.href;
    link.setAttribute("data-production-link-preload", "");
    if (normalized.rel === "preload" && normalized.as) {
      link.as = normalized.as;
    }
    if (normalized.type) link.type = normalized.type;
    if (normalized.crossOrigin !== undefined) {
      link.crossOrigin = normalized.crossOrigin;
    }
    if (normalized.integrity) link.integrity = normalized.integrity;
    if (normalized.media) link.media = normalized.media;
    if (normalized.referrerPolicy) link.referrerPolicy = normalized.referrerPolicy;
    if (normalized.fetchPriority) {
      link.setAttribute("fetchpriority", normalized.fetchPriority);
    }
    document.head.append(link);
  }
}

interface NormalizedPrefetchAsset extends PrefetchAsset {
  href: string;
  rel: "preload" | "modulepreload";
}

function normalizeAsset(
  asset: PrefetchAssetInput,
  priority: PrefetchPriority
): NormalizedPrefetchAsset {
  const input = typeof asset === "string" ? { href: asset } : asset;
  const inferred = inferAsset(input.href);
  const rel = input.rel ?? (input.module ? "modulepreload" : inferred.rel);
  const normalized: NormalizedPrefetchAsset = {
    ...input,
    href: input.href,
    rel,
    as: input.as ?? inferred.as,
    crossOrigin: input.crossOrigin ?? inferred.crossOrigin,
    fetchPriority: input.fetchPriority ?? (priority === "high" ? "high" : "low")
  };
  return normalized;
}

function inferAsset(href: string): {
  rel: "preload" | "modulepreload";
  as?: string | undefined;
  crossOrigin?: "" | "anonymous" | "use-credentials" | undefined;
} {
  const path = href.split(/[?#]/, 1)[0]?.toLowerCase() ?? href.toLowerCase();
  if (/\.(mjs|js|jsx|ts|tsx)$/.test(path)) {
    return { rel: "modulepreload" };
  }
  if (path.endsWith(".css")) return { rel: "preload", as: "style" };
  if (/\.(woff2?|ttf|otf|eot)$/.test(path)) {
    return { rel: "preload", as: "font", crossOrigin: "anonymous" };
  }
  if (/\.(avif|webp|png|jpe?g|gif|svg)$/.test(path)) {
    return { rel: "preload", as: "image" };
  }
  return { rel: "preload", as: "fetch" };
}

function hasPreload(href: string, rel: "preload" | "modulepreload"): boolean {
  const absoluteHref = resolveHref(href);
  for (const link of Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="preload"], link[rel="modulepreload"]'
    )
  )) {
    if (link.rel !== rel) continue;
    if (link.href === absoluteHref || link.getAttribute("href") === href) {
      return true;
    }
  }
  return false;
}

function resolveHref(href: string): string {
  try {
    return new URL(href, document.baseURI).href;
  } catch {
    return href;
  }
}
