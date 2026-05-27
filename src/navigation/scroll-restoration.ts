import { getCurrentHref, isBrowser } from "../environment.js";

export interface ContainerScrollSnapshot {
  id: string;
  top: number;
  left: number;
}

export interface ScrollSnapshot {
  routeKey: string;
  windowTop: number;
  windowLeft: number;
  containers: ContainerScrollSnapshot[];
  createdAt: number;
}

export interface ScrollRestoreOptions {
  behavior?: ScrollBehavior | undefined;
  hashOffset?: number | undefined;
}

export class ScrollRestorationManager {
  private readonly snapshots = new Map<string, ScrollSnapshot>();
  private readonly containers = new Map<string, WeakRef<HTMLElement>>();
  private maxSnapshots = 80;

  constructor() {
    if (!isBrowser()) return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.addEventListener("pagehide", () => {
      this.save(getCurrentHref());
    });
  }

  registerContainer(id: string, element: HTMLElement): () => void {
    this.containers.set(id, new WeakRef(element));
    return () => this.containers.delete(id);
  }

  save(routeKey = getCurrentHref()): ScrollSnapshot | undefined {
    if (!isBrowser()) return undefined;

    const snapshot: ScrollSnapshot = {
      routeKey,
      windowTop: window.scrollY,
      windowLeft: window.scrollX,
      containers: this.collectContainers(),
      createdAt: Date.now()
    };

    this.snapshots.set(routeKey, snapshot);
    this.evictOldSnapshots();
    return snapshot;
  }

  get(routeKey: string): ScrollSnapshot | undefined {
    return this.snapshots.get(routeKey);
  }

  restore(routeKey = getCurrentHref(), options: ScrollRestoreOptions = {}): boolean {
    if (!isBrowser()) return false;

    const hash = new URL(routeKey, window.location.origin).hash;
    if (hash) {
      return this.scrollToHash(hash, options);
    }

    const snapshot = this.snapshots.get(routeKey);
    if (!snapshot) return false;

    window.scrollTo({
      top: snapshot.windowTop,
      left: snapshot.windowLeft,
      behavior: options.behavior ?? "auto"
    });

    for (const container of snapshot.containers) {
      const element = this.resolveContainer(container.id);
      if (!element) continue;
      element.scrollTop = container.top;
      element.scrollLeft = container.left;
    }
    return true;
  }

  scrollToTop(behavior: ScrollBehavior = "auto"): void {
    if (!isBrowser()) return;
    window.scrollTo({ top: 0, left: 0, behavior });
  }

  scrollToElement(
    idOrHash: string,
    options: ScrollRestoreOptions = {}
  ): boolean {
    const id = idOrHash.startsWith("#")
      ? decodeURIComponent(idOrHash.slice(1))
      : idOrHash;
    const target = document.getElementById(id);
    if (!target) return false;

    const offset = options.hashOffset ?? readHashOffset();
    const top =
      target.getBoundingClientRect().top + window.scrollY - Math.max(0, offset);
    window.scrollTo({
      top,
      behavior: options.behavior ?? "auto"
    });
    return true;
  }

  private scrollToHash(hash: string, options: ScrollRestoreOptions): boolean {
    if (hash.length <= 1) return false;
    return this.scrollToElement(hash, options);
  }

  private collectContainers(): ContainerScrollSnapshot[] {
    const seen = new Set<string>();
    const snapshots: ContainerScrollSnapshot[] = [];

    for (const [id, ref] of this.containers) {
      const element = ref.deref();
      if (!element) continue;
      seen.add(id);
      snapshots.push({
        id,
        top: element.scrollTop,
        left: element.scrollLeft
      });
    }

    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-scroll-restoration-id]"
    )) {
      const id = element.dataset.scrollRestorationId;
      if (!id || seen.has(id)) continue;
      snapshots.push({
        id,
        top: element.scrollTop,
        left: element.scrollLeft
      });
    }

    return snapshots;
  }

  private resolveContainer(id: string): HTMLElement | undefined {
    const registered = this.containers.get(id)?.deref();
    if (registered) return registered;
    return document.querySelector<HTMLElement>(
      `[data-scroll-restoration-id="${cssEscape(id)}"]`
    ) ?? undefined;
  }

  private evictOldSnapshots(): void {
    while (this.snapshots.size > this.maxSnapshots) {
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

function readHashOffset(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--route-scroll-offset")
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cssEscape(value: string): string {
  if ("CSS" in window && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
