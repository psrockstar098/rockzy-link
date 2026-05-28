import React from "react";
import type { PrefetchAssetInput, SpeculationRulesOptions } from "./prefetch/scheduler.js";
import { LinkRuntime } from "./runtime/link-runtime.js";
import type { NavigationGuard } from "./runtime/link-runtime.js";
import type { Href, LinkRouter, PrefetchBehavior, PrefetchPriority, ScrollBehavior } from "./types.js";
export type { Href, LinkRouter, PrefetchBehavior, PrefetchPriority, ScrollBehavior } from "./types.js";
export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "download" | "href"> {
    href?: Href;
    to?: Href;
    replace?: boolean;
    scroll?: boolean | string;
    scrollBehavior?: ScrollBehavior;
    prefetch?: PrefetchBehavior | boolean | null;
    prefetchPriority?: PrefetchPriority;
    router?: LinkRouter;
    state?: unknown;
    onBeforeNavigate?: (href: string) => boolean | void | Promise<boolean | void>;
    beforeNavigate?: NavigationGuard | readonly NavigationGuard[];
    onNavigate?: (href: string) => void;
    onNavigateError?: (error: unknown, href: string) => void;
    "aria-label"?: string;
    download?: boolean | string;
    disabled?: boolean;
    viewTransition?: boolean;
    cacheTags?: readonly string[];
    cacheTtlMs?: number;
    staleWhileRevalidateMs?: number;
    estimateBytes?: number;
    prefetchTimeoutMs?: number;
    prefetchMaxRetries?: number;
    prefetchRetryBaseDelayMs?: number;
    prefetchRetryMaxDelayMs?: number;
    prefetchRetryBackoffFactor?: number;
    prefetchRetryJitterRatio?: number;
    preloadAssets?: readonly PrefetchAssetInput[];
    speculationRules?: boolean | SpeculationRulesOptions;
    viewportScrollDebounceMs?: number;
    viewportScrollVelocityThreshold?: number;
    hashOffset?: number;
    focus?: boolean | string;
    announce?: boolean | string;
    fallbackHref?: string;
    reloadDocument?: boolean;
    preventScrollReset?: boolean;
}
export declare function LinkRuntimeProvider({ runtime, children }: {
    runtime: LinkRuntime;
    children: React.ReactNode;
}): React.ReactElement;
export declare function useLinkRuntime(): LinkRuntime;
export declare const Link: React.ForwardRefExoticComponent<LinkProps & React.RefAttributes<HTMLAnchorElement>>;
export declare function SkipNavigation({ targetId, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    targetId?: string;
}): React.ReactElement;
//# sourceMappingURL=link.d.ts.map