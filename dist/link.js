import { jsx as _jsx } from "react/jsx-runtime";
import React, { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { requestIdle } from "./environment.js";
import { PointerIntentTracker } from "./prefetch/pointer-intent.js";
import { LinkRuntime, getDefaultLinkRuntime } from "./runtime/link-runtime.js";
import { classifyHref } from "./security/url.js";
const LinkRuntimeContext = createContext(null);
let pointerIntent;
export function LinkRuntimeProvider({ runtime, children }) {
    return (_jsx(LinkRuntimeContext.Provider, { value: runtime, children: children }));
}
export function useLinkRuntime() {
    return useContext(LinkRuntimeContext) ?? getDefaultLinkRuntime();
}
export const Link = forwardRef(({ href, to, replace = false, scroll = true, scrollBehavior = "auto", prefetch = "hover", prefetchPriority, router, state, onBeforeNavigate, beforeNavigate, onNavigate, onNavigateError, onClick, onPointerDown, onMouseEnter, onPointerEnter, onPointerLeave, onFocus, target, rel, download, disabled = false, children, viewTransition = false, cacheTags, cacheTtlMs, staleWhileRevalidateMs, estimateBytes, prefetchTimeoutMs, prefetchMaxRetries, prefetchRetryBaseDelayMs, prefetchRetryMaxDelayMs, prefetchRetryBackoffFactor, prefetchRetryJitterRatio, preloadAssets, speculationRules, viewportScrollDebounceMs = 120, viewportScrollVelocityThreshold = 1.4, hashOffset, focus, announce, fallbackHref, reloadDocument = false, preventScrollReset = false, ...rest }, ref) => {
    const runtime = useLinkRuntime();
    const anchorRef = useRef(null);
    const resolvedHref = href ?? to ?? "#";
    const hrefInfo = useMemo(() => classifyHref(resolvedHref), [resolvedHref]);
    const behavior = normalizePrefetchBehavior(prefetch);
    const priority = prefetchPriority ?? priorityForBehavior(behavior);
    const prefetchFetcher = useMemo(() => createRouterPrefetcher(router), [router]);
    const setRef = useCallback((node) => {
        anchorRef.current = node;
        if (typeof ref === "function")
            ref(node);
        else if (ref) {
            ref.current = node;
        }
    }, [ref]);
    const schedulePrefetch = useCallback((viewportScore, priorityOverride) => {
        if (behavior === "none")
            return;
        if (hrefInfo.isUnsafe || hrefInfo.isExternal || hrefInfo.isHash)
            return;
        runtime.prefetch(hrefInfo.href, {
            priority: priorityOverride ?? priority,
            fetcher: prefetchFetcher,
            kind: "html",
            tags: cacheTags,
            ttlMs: cacheTtlMs,
            staleWhileRevalidateMs,
            estimateBytes,
            timeoutMs: prefetchTimeoutMs,
            maxRetries: prefetchMaxRetries,
            retryBaseDelayMs: prefetchRetryBaseDelayMs,
            retryMaxDelayMs: prefetchRetryMaxDelayMs,
            retryBackoffFactor: prefetchRetryBackoffFactor,
            retryJitterRatio: prefetchRetryJitterRatio,
            viewportScore,
            assets: preloadAssets,
            speculationRules
        });
    }, [
        behavior,
        cacheTags,
        cacheTtlMs,
        estimateBytes,
        hrefInfo.href,
        hrefInfo.isExternal,
        hrefInfo.isHash,
        hrefInfo.isUnsafe,
        preloadAssets,
        prefetchFetcher,
        prefetchMaxRetries,
        prefetchRetryBackoffFactor,
        prefetchRetryBaseDelayMs,
        prefetchRetryJitterRatio,
        prefetchRetryMaxDelayMs,
        prefetchTimeoutMs,
        priority,
        runtime,
        speculationRules,
        staleWhileRevalidateMs
    ]);
    useEffect(() => {
        if (behavior !== "viewport")
            return;
        if (hrefInfo.isUnsafe || hrefInfo.isExternal || hrefInfo.isHash)
            return;
        const element = anchorRef.current;
        if (!element || typeof IntersectionObserver === "undefined")
            return;
        let cancelPendingPrefetch;
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting)
                    continue;
                const score = scoreViewportEntry(entry);
                cancelPendingPrefetch = scheduleViewportPrefetchAfterScroll(element, score, schedulePrefetch, viewportScrollDebounceMs, viewportScrollVelocityThreshold);
                observer.unobserve(entry.target);
            }
        }, { rootMargin: "200px", threshold: [0, 0.25, 0.5, 0.75, 1] });
        observer.observe(element);
        return () => {
            cancelPendingPrefetch?.();
            observer.disconnect();
        };
    }, [
        behavior,
        hrefInfo.isExternal,
        hrefInfo.isHash,
        hrefInfo.isUnsafe,
        schedulePrefetch,
        viewportScrollDebounceMs,
        viewportScrollVelocityThreshold
    ]);
    useEffect(() => {
        if (behavior !== "idle")
            return;
        if (hrefInfo.isUnsafe || hrefInfo.isExternal || hrefInfo.isHash)
            return;
        return requestIdle(() => schedulePrefetch(), 2500);
    }, [
        behavior,
        hrefInfo.isExternal,
        hrefInfo.isHash,
        hrefInfo.isUnsafe,
        schedulePrefetch
    ]);
    const navigate = useCallback(async (event) => {
        onClick?.(event);
        if (event.defaultPrevented)
            return;
        if (hrefInfo.isUnsafe) {
            event.preventDefault();
            return;
        }
        if (event.button !== 0)
            return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        if (target && target !== "_self")
            return;
        if (hrefInfo.isExternal || hrefInfo.isHash)
            return;
        if (download)
            return;
        if (reloadDocument)
            return;
        event.preventDefault();
        if (onBeforeNavigate) {
            const result = await onBeforeNavigate(hrefInfo.href);
            if (result === false)
                return;
        }
        try {
            await runtime.navigate(hrefInfo.href, {
                router,
                replace,
                state,
                scroll: preventScrollReset ? false : scroll,
                scrollBehavior,
                hashOffset,
                viewTransition,
                focus,
                announce,
                fallbackHref,
                guards: beforeNavigate
            });
            onNavigate?.(hrefInfo.href);
        }
        catch (error) {
            onNavigateError?.(error, hrefInfo.href);
        }
    }, [
        announce,
        download,
        fallbackHref,
        focus,
        hashOffset,
        hrefInfo.href,
        hrefInfo.isExternal,
        hrefInfo.isHash,
        hrefInfo.isUnsafe,
        beforeNavigate,
        onBeforeNavigate,
        onClick,
        onNavigate,
        onNavigateError,
        preventScrollReset,
        replace,
        reloadDocument,
        router,
        runtime,
        scroll,
        scrollBehavior,
        state,
        target,
        viewTransition
    ]);
    const handlePointerDown = useCallback((event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || behavior === "none")
            return;
        if (event.button !== 0)
            return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        if (target && target !== "_self")
            return;
        if (download)
            return;
        schedulePrefetch(undefined, "high");
    }, [behavior, download, onPointerDown, schedulePrefetch, target]);
    const handlePointerEnter = useCallback((event) => {
        onPointerEnter?.(event);
        if (event.defaultPrevented || behavior !== "hover")
            return;
        const element = anchorRef.current;
        if (!element)
            return;
        getPointerIntent().schedule(element, () => schedulePrefetch());
    }, [behavior, onPointerEnter, schedulePrefetch]);
    const handlePointerLeave = useCallback((event) => {
        onPointerLeave?.(event);
        const element = anchorRef.current;
        if (element)
            getPointerIntent().cancel(element);
    }, [onPointerLeave]);
    const handleMouseEnter = useCallback((event) => {
        onMouseEnter?.(event);
        if (event.defaultPrevented || behavior !== "hover")
            return;
        if ("PointerEvent" in window)
            return;
        schedulePrefetch();
    }, [behavior, onMouseEnter, schedulePrefetch]);
    const handleFocus = useCallback((event) => {
        onFocus?.(event);
        if (!event.defaultPrevented && behavior === "hover")
            schedulePrefetch();
    }, [behavior, onFocus, schedulePrefetch]);
    const computedRel = useMemo(() => mergeRel(rel, target, hrefInfo.isExternal), [hrefInfo.isExternal, rel, target]);
    if (disabled) {
        return (_jsx("span", { role: "link", "aria-disabled": "true", tabIndex: -1, ...rest, children: children }));
    }
    const downloadAttr = download === true ? "" : download || undefined;
    return (_jsx("a", { ...rest, ref: setRef, href: hrefInfo.safeHref, target: target, rel: computedRel, download: downloadAttr, onClick: navigate, onPointerDown: handlePointerDown, onPointerEnter: handlePointerEnter, onPointerLeave: handlePointerLeave, onMouseEnter: handleMouseEnter, onFocus: handleFocus, children: children }));
});
Link.displayName = "Link";
export function SkipNavigation({ targetId = "main-content", children = "Skip to content", onClick, ...props }) {
    return (_jsx("a", { href: `#${targetId}`, ...props, onClick: (event) => {
            onClick?.(event);
            if (event.defaultPrevented)
                return;
            const target = document.getElementById(targetId);
            if (!target)
                return;
            event.preventDefault();
            target.setAttribute("tabindex", target.getAttribute("tabindex") ?? "-1");
            target.focus({ preventScroll: false });
        }, children: children }));
}
function createRouterPrefetcher(router) {
    if (!router?.prefetch)
        return undefined;
    return async (href) => {
        await router.prefetch?.(href);
    };
}
function priorityForBehavior(behavior) {
    if (behavior === "hover")
        return "high";
    if (behavior === "viewport")
        return "medium";
    return "low";
}
function normalizePrefetchBehavior(behavior) {
    if (behavior === false || behavior === "none")
        return "none";
    if (behavior === "viewport" || behavior === "idle")
        return behavior;
    return "hover";
}
function scoreViewportEntry(entry) {
    const viewportHeight = window.innerHeight || 1;
    const distanceFromTop = Math.max(0, entry.boundingClientRect.top);
    const topScore = 1 - Math.min(1, distanceFromTop / viewportHeight);
    return entry.intersectionRatio * 100 + topScore;
}
function scheduleViewportPrefetchAfterScroll(element, viewportScore, callback, debounceMs, velocityThreshold) {
    let cancelled = false;
    let timeout;
    const run = () => {
        if (cancelled)
            return;
        if (isScrollingQuickly(velocityThreshold)) {
            timeout = window.setTimeout(run, debounceMs);
            return;
        }
        if (isNearViewport(element))
            callback(viewportScore);
    };
    timeout = window.setTimeout(run, isScrollingQuickly(velocityThreshold) ? debounceMs : 0);
    return () => {
        cancelled = true;
        if (timeout !== undefined)
            window.clearTimeout(timeout);
    };
}
let scrollTrackerInstalled = false;
let lastScrollY = 0;
let lastScrollAt = 0;
let lastScrollEventAt = 0;
let scrollVelocity = 0;
function isScrollingQuickly(velocityThreshold) {
    installScrollTracker();
    if (performance.now() - lastScrollEventAt > 140)
        return false;
    return scrollVelocity > velocityThreshold;
}
function installScrollTracker() {
    if (scrollTrackerInstalled || typeof window === "undefined")
        return;
    scrollTrackerInstalled = true;
    lastScrollY = window.scrollY;
    lastScrollAt = performance.now();
    window.addEventListener("scroll", () => {
        const now = performance.now();
        const elapsed = Math.max(1, now - lastScrollAt);
        const nextY = window.scrollY;
        scrollVelocity = Math.abs(nextY - lastScrollY) / elapsed;
        lastScrollY = nextY;
        lastScrollAt = now;
        lastScrollEventAt = now;
    }, { passive: true });
}
function isNearViewport(element, margin = 200) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
}
function mergeRel(rel, target, isExternal) {
    if (target !== "_blank" && !isExternal)
        return rel;
    const tokens = new Set((rel ?? "").split(/\s+/).filter(Boolean));
    tokens.add("noopener");
    tokens.add("noreferrer");
    return Array.from(tokens).join(" ");
}
function getPointerIntent() {
    pointerIntent ??= new PointerIntentTracker();
    return pointerIntent;
}
//# sourceMappingURL=link.js.map