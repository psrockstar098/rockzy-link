import { isBrowser } from "../environment.js";

export interface QueuedNavigation {
  href: string;
  replace: boolean;
  state: unknown;
  createdAt: number;
}

export interface OfflineQueueAddedDetail {
  navigation: QueuedNavigation;
  queueLength: number;
}

export interface OfflineSyncingDetail {
  queueLength: number;
}

export interface OfflineSyncedDetail {
  syncedCount: number;
  requeuedCount: number;
  queueLength: number;
}

export interface OfflineNavigationManagerOptions {
  onOfflineQueueAdded?:
    | ((detail: OfflineQueueAddedDetail) => void)
    | undefined;
  onOfflineSyncing?: ((detail: OfflineSyncingDetail) => void) | undefined;
  onOfflineSynced?: ((detail: OfflineSyncedDetail) => void) | undefined;
}

export class OfflineNavigationManager {
  private readonly queueKey = "production-link-offline-navigation-queue";

  constructor(private readonly options: OfflineNavigationManagerOptions = {}) {}

  async register(scriptUrl = "/sw.js", options?: RegistrationOptions): Promise<ServiceWorkerRegistration | undefined> {
    if (!isBrowser() || !("serviceWorker" in navigator)) return undefined;
    return navigator.serviceWorker.register(scriptUrl, options);
  }

  queueNavigation(href: string, replace = false, state?: unknown): void {
    if (!isBrowser()) return;

    const queue = this.readQueue();
    const navigation = { href, replace, state, createdAt: Date.now() };
    const nextQueue = [...queue, navigation].slice(-50);
    this.writeQueue(nextQueue);

    navigator.serviceWorker?.controller?.postMessage({
      type: "PRODUCTION_LINK_QUEUE_NAVIGATION",
      payload: { href, replace, state }
    });

    this.emit("offline-queue:added", {
      navigation,
      queueLength: nextQueue.length
    });
  }

  async flushQueue(callback: (navigation: QueuedNavigation) => void | Promise<void>): Promise<void> {
    if (!isBrowser() || !navigator.onLine) return;

    const queue = this.readQueue();
    if (queue.length === 0) return;

    this.emit("syncing", { queueLength: queue.length });

    let syncedCount = 0;
    let requeuedCount = 0;
    for (const navigation of queue) {
      try {
        await callback(navigation);
        syncedCount += 1;

        const currentQueue = this.readQueue();
        const index = currentQueue.findIndex(
          (q) => q.href === navigation.href && q.createdAt === navigation.createdAt
        );
        if (index >= 0) {
          currentQueue.splice(index, 1);
          this.writeQueue(currentQueue);
        }
      } catch {
        requeuedCount += 1;
      }
    }

    this.emit("synced", {
      syncedCount,
      requeuedCount,
      queueLength: this.readQueue().length
    });
  }

  readQueue(): QueuedNavigation[] {
    if (!isBrowser()) return [];
    try {
      return JSON.parse(window.localStorage.getItem(this.queueKey) ?? "[]") as QueuedNavigation[];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: QueuedNavigation[]): void {
    try {
      window.localStorage.setItem(this.queueKey, JSON.stringify(queue));
    } catch {
      // Storage can be full or disabled; offline queueing is best effort.
    }
  }

  private emit(
    name: "offline-queue:added",
    detail: OfflineQueueAddedDetail
  ): void;
  private emit(name: "syncing", detail: OfflineSyncingDetail): void;
  private emit(name: "synced", detail: OfflineSyncedDetail): void;
  private emit(
    name: "offline-queue:added" | "syncing" | "synced",
    detail: OfflineQueueAddedDetail | OfflineSyncingDetail | OfflineSyncedDetail
  ): void {
    if (name === "offline-queue:added") {
      this.options.onOfflineQueueAdded?.(detail as OfflineQueueAddedDetail);
    } else if (name === "syncing") {
      this.options.onOfflineSyncing?.(detail as OfflineSyncingDetail);
    } else {
      this.options.onOfflineSynced?.(detail as OfflineSyncedDetail);
    }

    if (!isBrowser()) return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}
