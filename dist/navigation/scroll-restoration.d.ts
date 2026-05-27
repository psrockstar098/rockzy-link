export interface ContainerScrollSnapshot {
    id: string;
    top: number;
    left: number;
}
export interface ScrollSnapshot {
    routeKey: string;
    windowTop: number;
    windowLeft: number;
    containers: ContainerScrollSnapshot[];
    createdAt: number;
}
export interface ScrollRestoreOptions {
    behavior?: ScrollBehavior | undefined;
    hashOffset?: number | undefined;
}
export declare class ScrollRestorationManager {
    private readonly snapshots;
    private readonly containers;
    private maxSnapshots;
    constructor();
    registerContainer(id: string, element: HTMLElement): () => void;
    save(routeKey?: string): ScrollSnapshot | undefined;
    get(routeKey: string): ScrollSnapshot | undefined;
    restore(routeKey?: string, options?: ScrollRestoreOptions): boolean;
    scrollToTop(behavior?: ScrollBehavior): void;
    scrollToElement(idOrHash: string, options?: ScrollRestoreOptions): boolean;
    private scrollToHash;
    private collectContainers;
    private resolveContainer;
    private evictOldSnapshots;
}
//# sourceMappingURL=scroll-restoration.d.ts.map