import { isBrowser } from "../environment.js";
export class OfflineNavigationManager {
    queueKey = "production-link-offline-navigation-queue";
    async register(scriptUrl = "/sw.js", options) {
        if (!isBrowser() || !("serviceWorker" in navigator))
            return undefined;
        return navigator.serviceWorker.register(scriptUrl, options);
    }
    queueNavigation(href, replace, state) {
        if (!isBrowser())
            return;
        const queue = this.readQueue();
        queue.push({ href, replace, state, createdAt: Date.now() });
        this.writeQueue(queue.slice(-50));
        navigator.serviceWorker?.controller?.postMessage({
            type: "PRODUCTION_LINK_QUEUE_NAVIGATION",
            payload: { href, replace, state }
        });
    }
    async flushQueue(callback) {
        if (!isBrowser() || !navigator.onLine)
            return;
        const queue = this.readQueue();
        this.writeQueue([]);
        for (const navigation of queue) {
            try {
                await callback(navigation);
            }
            catch {
                this.queueNavigation(navigation.href, navigation.replace, navigation.state);
            }
        }
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
}
//# sourceMappingURL=offline-navigation.js.map