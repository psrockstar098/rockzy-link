import { ScrollRestorationManager } from "./scroll-restoration.js";
import type { ScrollSnapshot } from "./scroll-restoration.js";
export interface NavigationSnapshot {
    key: string;
    html?: string | undefined;
    state: unknown;
    scroll?: ScrollSnapshot | undefined;
    createdAt: number;
}
export interface NavigationSnapshotOptions {
    maxEntries?: number | undefined;
    rootSelector?: string | undefined;
    restoreDom?: boolean | undefined;
}
export declare class NavigationSnapshotCache {
    private readonly scroll;
    private readonly snapshots;
    private readonly maxEntries;
    private readonly rootSelector;
    private readonly restoreDom;
    constructor(scroll: ScrollRestorationManager, options?: NavigationSnapshotOptions);
    capture(key?: string): NavigationSnapshot | undefined;
    restore(key?: string, options?: Pick<NavigationSnapshotOptions, "restoreDom">): NavigationSnapshot | undefined;
    clear(): void;
    private evict;
}
//# sourceMappingURL=navigation-snapshot-cache.d.ts.map