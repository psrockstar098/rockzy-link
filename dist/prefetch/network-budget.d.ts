import type { PrefetchPriority } from "../types.js";
export interface NetworkBudgetOptions {
    bytesPerMinute?: number | undefined;
    memoryBudgetBytes?: number | undefined;
}
export interface DevicePrefetchPolicy {
    adaptive?: boolean | undefined;
    batteryLevel?: number | undefined;
    batteryCharging?: boolean | undefined;
    lowBatteryThreshold?: number | undefined;
    minDeviceMemoryGb?: number | undefined;
}
export declare class NetworkBudget {
    private availableBytes;
    private windowStartedAt;
    private readonly bytesPerMinute;
    private readonly memoryBudgetBytes;
    constructor(options?: NetworkBudgetOptions);
    get memoryBudget(): number;
    canSpend(bytes: number, priority: PrefetchPriority): boolean;
    spend(bytes: number, priority: PrefetchPriority): void;
    private refill;
}
export declare function canPrefetchOnCurrentDevice(priority: PrefetchPriority, policy?: DevicePrefetchPolicy): boolean;
//# sourceMappingURL=network-budget.d.ts.map