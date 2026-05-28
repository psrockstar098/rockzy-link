export interface QueuedNavigation {
    href: string;
    replace: boolean;
    state: unknown;
    createdAt: number;
}
export interface OfflineQueueAddedDetail {
    navigation: QueuedNavigation;
    queueLength: number;
}
export interface OfflineSyncingDetail {
    queueLength: number;
}
export interface OfflineSyncedDetail {
    syncedCount: number;
    requeuedCount: number;
    queueLength: number;
}
export interface OfflineNavigationManagerOptions {
    onOfflineQueueAdded?: ((detail: OfflineQueueAddedDetail) => void) | undefined;
    onOfflineSyncing?: ((detail: OfflineSyncingDetail) => void) | undefined;
    onOfflineSynced?: ((detail: OfflineSyncedDetail) => void) | undefined;
}
export declare class OfflineNavigationManager {
    private readonly options;
    private readonly queueKey;
    constructor(options?: OfflineNavigationManagerOptions);
    register(scriptUrl?: string, options?: RegistrationOptions): Promise<ServiceWorkerRegistration | undefined>;
    queueNavigation(href: string, replace?: boolean, state?: unknown): void;
    flushQueue(callback: (navigation: QueuedNavigation) => void | Promise<void>): Promise<void>;
    readQueue(): QueuedNavigation[];
    private writeQueue;
    private emit;
}
//# sourceMappingURL=offline-navigation.d.ts.map