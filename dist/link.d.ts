import React from "react";
import { LinkRuntime } from "./runtime/link-runtime.js";
import type { Href, LinkRouter, PrefetchBehavior, PrefetchPriority, ScrollBehavior } from "./types.js";
export type { Href, LinkRouter, PrefetchBehavior, PrefetchPriority, ScrollBehavior } from "./types.js";
export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "download" | "href"> {
    href: Href;
    replace?: boolean;
    scroll?: boolean | string;
    scrollBehavior?: ScrollBehavior;
    prefetch?: PrefetchBehavior | false;
    prefetchPriority?: PrefetchPriority;
    router?: LinkRouter;
    state?: unknown;
    onBeforeNavigate?: (href: string) => boolean | void | Promise<boolean | void>;
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
    hashOffset?: number;
    focus?: boolean | string;
    announce?: boolean | string;
    fallbackHref?: string;
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