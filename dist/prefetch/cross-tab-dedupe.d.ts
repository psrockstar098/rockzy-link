export declare class CrossTabPrefetchDedupe {
    private readonly ttlMs;
    private readonly tabId;
    private readonly active;
    private readonly channel?;
    private readonly storageKey;
    constructor(ttlMs?: number);
    isActiveElsewhere(href: string): boolean;
    markStart(href: string): void;
    markDone(href: string): void;
    close(): void;
    private receive;
    private broadcast;
    private prune;
}
//# sourceMappingURL=cross-tab-dedupe.d.ts.map