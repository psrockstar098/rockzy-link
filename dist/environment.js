export function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}
export function getCurrentOrigin() {
    if (!isBrowser())
        return undefined;
    return window.location.origin;
}
export function getCurrentHref() {
    if (!isBrowser())
        return "/";
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
export function supportsRequestIdleCallback() {
    return isBrowser() && "requestIdleCallback" in window;
}
export function requestIdle(callback, timeout = 1500) {
    if (!isBrowser())
        return () => undefined;
    if (supportsRequestIdleCallback()) {
        const id = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(callback, Math.min(timeout, 250));
    return () => window.clearTimeout(id);
}
export function prefersReducedMotion() {
    if (!isBrowser() || typeof window.matchMedia !== "function")
        return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
export function queueMicrotaskSafe(callback) {
    if (typeof queueMicrotask === "function") {
        queueMicrotask(callback);
        return;
    }
    Promise.resolve().then(callback).catch(() => undefined);
}
//# sourceMappingURL=environment.js.map