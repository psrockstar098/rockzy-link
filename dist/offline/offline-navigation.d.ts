export interface QueuedNavigation {
    href: string;
    replace: boolean;
    state: unknown;
    createdAt: number;
}
export declare class OfflineNavigationManager {
    private readonly queueKey;
    register(scriptUrl?: string, options?: RegistrationOptions): Promise<ServiceWorkerRegistration | undefined>;
    queueNavigation(href: string, replace: boolean, state: unknown): void;
    flushQueue(callback: (navigation: QueuedNavigation) => void | Promise<void>): Promise<void>;
    readQueue(): QueuedNavigation[];
    private writeQueue;
}
//# sourceMappingURL=offline-navigation.d.ts.map