export interface ViewTransitionConfig {
    enabled?: boolean;
    respectReducedMotion?: boolean;
}
export declare function runWithViewTransition(callback: () => void | Promise<void>, config?: ViewTransitionConfig): void | Promise<void>;
//# sourceMappingURL=view-transitions.d.ts.map