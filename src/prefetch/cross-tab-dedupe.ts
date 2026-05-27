import { isBrowser } from "../environment.js";

interface CrossTabMessage {
  type: "start" | "done";
  href: string;
  tabId: string;
  expiresAt: number;
}

export class CrossTabPrefetchDedupe {
  private readonly tabId = Math.random().toString(36).slice(2);
  private readonly active = new Map<string, number>();
  private readonly channel?: BroadcastChannel;
  private readonly storageKey = "production-link-prefetch";

  constructor(private readonly ttlMs = 20_000) {
    if (!isBrowser()) return;

    if ("BroadcastChannel" in window) {
      this.channel = new BroadcastChannel("production-link-prefetch");
      this.channel.addEventListener("message", (event) => {
        this.receive(event.data as CrossTabMessage);
      });
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== this.storageKey || !event.newValue) return;
      try {
        this.receive(JSON.parse(event.newValue) as CrossTabMessage);
      } catch {
        // Ignore malformed cross-tab messages from other scripts.
      }
    });
  }

  isActiveElsewhere(href: string): boolean {
    this.prune();
    return (this.active.get(href) ?? 0) > Date.now();
  }

  markStart(href: string): void {
    this.broadcast({
      type: "start",
      href,
      tabId: this.tabId,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  markDone(href: string): void {
    this.active.delete(href);
    this.broadcast({
      type: "done",
      href,
      tabId: this.tabId,
      expiresAt: Date.now()
    });
  }

  close(): void {
    this.channel?.close();
  }

  private receive(message: CrossTabMessage): void {
    if (!message || message.tabId === this.tabId) return;
    if (message.type === "start") this.active.set(message.href, message.expiresAt);
    else this.active.delete(message.href);
  }

  private broadcast(message: CrossTabMessage): void {
    if (!isBrowser()) return;
    this.channel?.postMessage(message);
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(message));
    } catch {
      // Storage can be disabled in private browsing; BroadcastChannel is enough.
    }
  }

  private prune(): void {
    const now = Date.now();
    for (const [href, expiresAt] of this.active) {
      if (expiresAt <= now) this.active.delete(href);
    }
  }
}
