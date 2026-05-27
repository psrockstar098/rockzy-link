export interface AnnounceOptions {
    label?: string | undefined;
    polite?: boolean | undefined;
}
export interface FocusRestoreOptions {
    selector?: string | undefined;
    preventScroll?: boolean | undefined;
}
export declare class AccessibilityManager {
    private liveRegion?;
    private readonly defaultFocusSelector;
    announceRouteChange(href: string, options?: AnnounceOptions): void;
    restoreFocus(options?: FocusRestoreOptions): boolean;
    shouldReduceMotion(): boolean;
    private ensureLiveRegion;
}
//# sourceMappingURL=accessibility-manager.d.ts.map