import { getCurrentHref, isBrowser } from "../environment.js";
import { ScrollRestorationManager } from "./scroll-restoration.js";
export class NavigationSnapshotCache {
    scroll;
    snapshots = new Map();
    maxEntries;
    rootSelector;
    restoreDom;
    constructor(scroll, options = {}) {
        this.scroll = scroll;
        this.maxEntries = options.maxEntries ?? 30;
        this.rootSelector = options.rootSelector ?? "[data-route-root], #root, main";
        this.restoreDom = options.restoreDom ?? false;
    }
    capture(key = getCurrentHref()) {
        if (!isBrowser())
            return undefined;
        const root = document.querySelector(this.rootSelector);
        const snapshot = {
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
    restore(key = getCurrentHref(), options = {}) {
        if (!isBrowser())
            return undefined;
        const snapshot = this.snapshots.get(key);
        if (!snapshot)
            return undefined;
        if (options.restoreDom && snapshot.html !== undefined) {
            const root = document.querySelector(this.rootSelector);
            if (root) {
                root.innerHTML = snapshot.html;
                window.dispatchEvent(new CustomEvent("production-link:dom-snapshot-restored", {
                    detail: { key }
                }));
            }
        }
        this.scroll.restore(key);
        return snapshot;
    }
    clear() {
        this.snapshots.clear();
    }
    evict() {
        while (this.snapshots.size > this.maxEntries) {
            let oldestKey;
            let oldestTime = Number.POSITIVE_INFINITY;
            for (const [key, snapshot] of this.snapshots) {
                if (snapshot.createdAt < oldestTime) {
                    oldestTime = snapshot.createdAt;
                    oldestKey = key;
                }
            }
            if (!oldestKey)
                return;
            this.snapshots.delete(oldestKey);
        }
    }
}
//# sourceMappingURL=navigation-snapshot-cache.js.map