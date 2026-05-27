import { isBrowser } from "../environment.js";

export interface QueuedNavigation {
  href: string;
  replace: boolean;
  state: unknown;
  createdAt: number;
}

export class OfflineNavigationManager {
  private readonly queueKey = "production-link-offline-navigation-queue";

  async register(scriptUrl = "/sw.js", options?: RegistrationOptions): Promise<ServiceWorkerRegistration | undefined> {
    if (!isBrowser() || !("serviceWorker" in navigator)) return undefined;
    return navigator.serviceWorker.register(scriptUrl, options);
  }

  queueNavigation(href: string, replace: boolean, state: unknown): void {
    if (!isBrowser()) return;

    const queue = this.readQueue();
    queue.push({ href, replace, state, createdAt: Date.now() });
    this.writeQueue(queue.slice(-50));

    navigator.serviceWorker?.controller?.postMessage({
      type: "PRODUCTION_LINK_QUEUE_NAVIGATION",
      payload: { href, replace, state }
    });
  }

  async flushQueue(callback: (navigation: QueuedNavigation) => void | Promise<void>): Promise<void> {
    if (!isBrowser() || !navigator.onLine) return;

    const queue = this.readQueue();
    this.writeQueue([]);

    for (const navigation of queue) {
      try {
        await callback(navigation);
      } catch {
        this.queueNavigation(navigation.href, navigation.replace, navigation.state);
      }
    }
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
}
