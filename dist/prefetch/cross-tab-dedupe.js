import { isBrowser } from "../environment.js";
export class CrossTabPrefetchDedupe {
    ttlMs;
    tabId = Math.random().toString(36).slice(2);
    active = new Map();
    channel;
    storageKey = "production-link-prefetch";
    constructor(ttlMs = 20_000) {
        this.ttlMs = ttlMs;
        if (!isBrowser())
            return;
        if ("BroadcastChannel" in window) {
            this.channel = new BroadcastChannel("production-link-prefetch");
            this.channel.addEventListener("message", (event) => {
                this.receive(event.data);
            });
        }
        window.addEventListener("storage", (event) => {
            if (event.key !== this.storageKey || !event.newValue)
                return;
            try {
                this.receive(JSON.parse(event.newValue));
            }
            catch {
                // Ignore malformed cross-tab messages from other scripts.
            }
        });
    }
    isActiveElsewhere(href) {
        this.prune();
        return (this.active.get(href) ?? 0) > Date.now();
    }
    markStart(href) {
        this.broadcast({
            type: "start",
            href,
            tabId: this.tabId,
            expiresAt: Date.now() + this.ttlMs
        });
    }
    markDone(href) {
        this.active.delete(href);
        this.broadcast({
            type: "done",
            href,
            tabId: this.tabId,
            expiresAt: Date.now()
        });
    }
    close() {
        this.channel?.close();
    }
    receive(message) {
        if (!message || message.tabId === this.tabId)
            return;
        if (message.type === "start")
            this.active.set(message.href, message.expiresAt);
        else
            this.active.delete(message.href);
    }
    broadcast(message) {
        if (!isBrowser())
            return;
        this.channel?.postMessage(message);
        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(message));
        }
        catch {
            // Storage can be disabled in private browsing; BroadcastChannel is enough.
        }
    }
    prune() {
        const now = Date.now();
        for (const [href, expiresAt] of this.active) {
            if (expiresAt <= now)
                this.active.delete(href);
        }
    }
}
//# sourceMappingURL=cross-tab-dedupe.js.map