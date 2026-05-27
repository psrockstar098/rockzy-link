export declare function isBrowser(): boolean;
export declare function getCurrentOrigin(): string | undefined;
export declare function getCurrentHref(): string;
export declare function supportsRequestIdleCallback(): boolean;
export declare function requestIdle(callback: () => void, timeout?: number): () => void;
export declare function prefersReducedMotion(): boolean;
export declare function queueMicrotaskSafe(callback: () => void): void;
//# sourceMappingURL=environment.d.ts.map