export interface PointerIntentOptions {
    hoverDelayMs?: number;
    fastPointerDelayMs?: number;
    fastPointerVelocity?: number;
}
export declare class PointerIntentTracker {
    private last;
    private previous;
    private cleanups;
    private readonly hoverDelayMs;
    private readonly fastPointerDelayMs;
    private readonly fastPointerVelocity;
    constructor(options?: PointerIntentOptions);
    schedule(element: Element, callback: () => void): void;
    cancel(element: Element): void;
    destroy(): void;
    private readonly track;
    private currentVelocity;
}
//# sourceMappingURL=pointer-intent.d.ts.map