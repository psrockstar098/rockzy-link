export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getCurrentOrigin(): string | undefined {
  if (!isBrowser()) return undefined;
  return window.location.origin;
}

export function getCurrentHref(): string {
  if (!isBrowser()) return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function supportsRequestIdleCallback(): boolean {
  return isBrowser() && "requestIdleCallback" in window;
}

export function requestIdle(
  callback: () => void,
  timeout = 1500
): () => void {
  if (!isBrowser()) return () => undefined;

  if (supportsRequestIdleCallback()) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(callback, Math.min(timeout, 250));
  return () => window.clearTimeout(id);
}

export function prefersReducedMotion(): boolean {
  if (!isBrowser() || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function queueMicrotaskSafe(callback: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback).catch(() => undefined);
}
