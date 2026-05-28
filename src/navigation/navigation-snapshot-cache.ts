import { getCurrentHref, isBrowser } from "../environment.js";
import { ScrollRestorationManager } from "./scroll-restoration.js";
import type { ScrollSnapshot } from "./scroll-restoration.js";

export interface NavigationSnapshot {
  key: string;
  html?: string | undefined;
  state: unknown;
  scroll?: ScrollSnapshot | undefined;
  createdAt: number;
}

export interface NavigationSnapshotOptions {
  maxEntries?: number | undefined;
  rootSelector?: string | undefined;
  restoreDom?: boolean | undefined;
}

export class NavigationSnapshotCache {
  private readonly snapshots = new Map<string, NavigationSnapshot>();
  private readonly maxEntries: number;
  private readonly rootSelector: string;
  private readonly restoreDom: boolean;

  constructor(
    private readonly scroll: ScrollRestorationManager,
    options: NavigationSnapshotOptions = {}
  ) {
    this.maxEntries = options.maxEntries ?? 30;
    this.rootSelector = options.rootSelector ?? "[data-route-root], #root, main";
    this.restoreDom = options.restoreDom ?? false;
  }

  capture(key = getCurrentHref()): NavigationSnapshot | undefined {
    if (!isBrowser()) return undefined;

    const root = document.querySelector<HTMLElement>(this.rootSelector);
    const snapshot: NavigationSnapshot = {
      key,
      html: this.restoreDom ? root?.innerHTML : undefined,
      state: window.history.state,
      scroll: this.scroll.save(key),
      createdAt: Date.now()
    };

    this.snapshots.set(key, snapshot);
    this.evict();
    return snapshot;
  }

  restore(
    key = getCurrentHref(),
    options: Pick<NavigationSnapshotOptions, "restoreDom"> = {}
  ): NavigationSnapshot | undefined {
    if (!isBrowser()) return undefined;

    const snapshot = this.snapshots.get(key);
    if (!snapshot) return undefined;

    if (options.restoreDom && snapshot.html !== undefined) {
      const root = document.querySelector<HTMLElement>(this.rootSelector);
      if (root) {
        root.innerHTML = snapshot.html;
        window.dispatchEvent(
          new CustomEvent("production-link:dom-snapshot-restored", {
            detail: { key }
          })
        );
      }
    }

    this.scroll.restore(key);
    return snapshot;
  }

  clear(): void {
    this.snapshots.clear();
  }

  private evict(): void {
    while (this.snapshots.size > this.maxEntries) {
      let oldestKey: string | undefined;
      let oldestTime = Number.POSITIVE_INFINITY;
      for (const [key, snapshot] of this.snapshots) {
        if (snapshot.createdAt < oldestTime) {
          oldestTime = snapshot.createdAt;
          oldestKey = key;
        }
      }
      if (!oldestKey) return;
      this.snapshots.delete(oldestKey);
    }
  }
}
