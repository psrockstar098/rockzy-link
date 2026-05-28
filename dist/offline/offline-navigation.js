import { isBrowser } from "../environment.js";
export class OfflineNavigationManager {
    options;
    queueKey = "production-link-offline-navigation-queue";
    constructor(options = {}) {
        this.options = options;
    }
    async register(scriptUrl = "/sw.js", options) {
        if (!isBrowser() || !("serviceWorker" in navigator))
            return undefined;
        return navigator.serviceWorker.register(scriptUrl, options);
    }
    queueNavigation(href, replace = false, state) {
        if (!isBrowser())
            return;
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
    async flushQueue(callback) {
        if (!isBrowser() || !navigator.onLine)
            return;
        const queue = this.readQueue();
        if (queue.length === 0)
            return;
        this.emit("syncing", { queueLength: queue.length });
        let syncedCount = 0;
        let requeuedCount = 0;
        for (const navigation of queue) {
            try {
                await callback(navigation);
                syncedCount += 1;
                const currentQueue = this.readQueue();
                const index = currentQueue.findIndex((q) => q.href === navigation.href && q.createdAt === navigation.createdAt);
                if (index >= 0) {
                    currentQueue.splice(index, 1);
                    this.writeQueue(currentQueue);
                }
            }
            catch {
                requeuedCount += 1;
            }
        }
        this.emit("synced", {
            syncedCount,
            requeuedCount,
            queueLength: this.readQueue().length
        });
    }
    readQueue() {
        if (!isBrowser())
            return [];
        try {
            return JSON.parse(window.localStorage.getItem(this.queueKey) ?? "[]");
        }
        catch {
            return [];
        }
    }
    writeQueue(queue) {
        try {
            window.localStorage.setItem(this.queueKey, JSON.stringify(queue));
        }
        catch {
            // Storage can be full or disabled; offline queueing is best effort.
        }
    }
    emit(name, detail) {
        if (name === "offline-queue:added") {
            this.options.onOfflineQueueAdded?.(detail);
        }
        else if (name === "syncing") {
            this.options.onOfflineSyncing?.(detail);
        }
        else {
            this.options.onOfflineSynced?.(detail);
        }
        if (!isBrowser())
            return;
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }
}
//# sourceMappingURL=offline-navigation.js.map