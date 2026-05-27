import { isBrowser } from "../environment.js";
export class NetworkBudget {
    availableBytes;
    windowStartedAt = Date.now();
    bytesPerMinute;
    memoryBudgetBytes;
    constructor(options = {}) {
        this.bytesPerMinute = options.bytesPerMinute ?? 2_500_000;
        this.memoryBudgetBytes = options.memoryBudgetBytes ?? 50_000_000;
        this.availableBytes = this.bytesPerMinute;
    }
    get memoryBudget() {
        return this.memoryBudgetBytes;
    }
    canSpend(bytes, priority) {
        this.refill();
        if (priority === "high")
            return true;
        return this.availableBytes >= bytes;
    }
    spend(bytes, priority) {
        this.refill();
        if (priority === "high")
            return;
        this.availableBytes = Math.max(0, this.availableBytes - bytes);
    }
    refill() {
        const now = Date.now();
        const elapsed = now - this.windowStartedAt;
        if (elapsed < 60_000)
            return;
        const windows = Math.floor(elapsed / 60_000);
        this.windowStartedAt += windows * 60_000;
        this.availableBytes = Math.min(this.bytesPerMinute, this.availableBytes + windows * this.bytesPerMinute);
    }
}
export function canPrefetchOnCurrentDevice(priority) {
    if (!isBrowser())
        return false;
    const connection = getConnection();
    if (connection?.saveData)
        return priority === "high";
    if (connection?.effectiveType === "slow-2g")
        return false;
    if (connection?.effectiveType === "2g")
        return priority === "high";
    const memory = getDeviceMemory();
    if (memory !== undefined && memory <= 1)
        return priority === "high";
    if (document.visibilityState === "hidden" && priority !== "high")
        return false;
    return true;
}
function getConnection() {
    const navigatorWithConnection = navigator;
    return navigatorWithConnection.connection;
}
function getDeviceMemory() {
    const navigatorWithMemory = navigator;
    return navigatorWithMemory.deviceMemory;
}
//# sourceMappingURL=network-budget.js.map