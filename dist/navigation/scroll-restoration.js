import { getCurrentHref, isBrowser } from "../environment.js";
export class ScrollRestorationManager {
    snapshots = new Map();
    containers = new Map();
    maxSnapshots = 80;
    constructor() {
        if (!isBrowser())
            return;
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }
        window.addEventListener("pagehide", () => {
            this.save(getCurrentHref());
        });
    }
    registerContainer(id, element) {
        this.containers.set(id, new WeakRef(element));
        return () => this.containers.delete(id);
    }
    save(routeKey = getCurrentHref()) {
        if (!isBrowser())
            return undefined;
        const snapshot = {
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
    get(routeKey) {
        return this.snapshots.get(routeKey);
    }
    restore(routeKey = getCurrentHref(), options = {}) {
        if (!isBrowser())
            return false;
        const hash = new URL(routeKey, window.location.origin).hash;
        if (hash) {
            return this.scrollToHash(hash, options);
        }
        const snapshot = this.snapshots.get(routeKey);
        if (!snapshot)
            return false;
        window.scrollTo({
            top: snapshot.windowTop,
            left: snapshot.windowLeft,
            behavior: options.behavior ?? "auto"
        });
        for (const container of snapshot.containers) {
            const element = this.resolveContainer(container.id);
            if (!element)
                continue;
            element.scrollTop = container.top;
            element.scrollLeft = container.left;
        }
        return true;
    }
    scrollToTop(behavior = "auto") {
        if (!isBrowser())
            return;
        window.scrollTo({ top: 0, left: 0, behavior });
    }
    scrollToElement(idOrHash, options = {}) {
        const id = idOrHash.startsWith("#")
            ? decodeURIComponent(idOrHash.slice(1))
            : idOrHash;
        let target = document.getElementById(id);
        if (!target) {
            target = document.querySelector(`a[name="${cssEscape(id)}"]`);
        }
        if (!target)
            return false;
        const offset = options.hashOffset ?? readHashOffset();
        const top = target.getBoundingClientRect().top + window.scrollY - Math.max(0, offset);
        window.scrollTo({
            top,
            behavior: options.behavior ?? "auto"
        });
        return true;
    }
    scrollToHash(hash, options) {
        if (hash.length <= 1)
            return false;
        return this.scrollToElement(hash, options);
    }
    collectContainers() {
        const seen = new Set();
        const snapshots = [];
        for (const [id, ref] of this.containers) {
            const element = ref.deref();
            if (!element)
                continue;
            seen.add(id);
            snapshots.push({
                id,
                top: element.scrollTop,
                left: element.scrollLeft
            });
        }
        for (const element of document.querySelectorAll("[data-scroll-restoration-id]")) {
            const id = element.dataset.scrollRestorationId;
            if (!id || seen.has(id))
                continue;
            snapshots.push({
                id,
                top: element.scrollTop,
                left: element.scrollLeft
            });
        }
        return snapshots;
    }
    resolveContainer(id) {
        const registered = this.containers.get(id)?.deref();
        if (registered)
            return registered;
        return document.querySelector(`[data-scroll-restoration-id="${cssEscape(id)}"]`) ?? undefined;
    }
    evictOldSnapshots() {
        while (this.snapshots.size > this.maxSnapshots) {
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
function readHashOffset() {
    const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--route-scroll-offset")
        .trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}
function cssEscape(value) {
    if ("CSS" in window && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }
    return value.replace(/["\\]/g, "\\$&");
}
//# sourceMappingURL=scroll-restoration.js.map