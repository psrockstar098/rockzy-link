import { isBrowser } from "../environment.js";
import type { PrefetchPriority } from "../types.js";

export interface NetworkBudgetOptions {
  bytesPerMinute?: number | undefined;
  memoryBudgetBytes?: number | undefined;
}

export class NetworkBudget {
  private availableBytes: number;
  private windowStartedAt = Date.now();
  private readonly bytesPerMinute: number;
  private readonly memoryBudgetBytes: number;

  constructor(options: NetworkBudgetOptions = {}) {
    this.bytesPerMinute = options.bytesPerMinute ?? 2_500_000;
    this.memoryBudgetBytes = options.memoryBudgetBytes ?? 50_000_000;
    this.availableBytes = this.bytesPerMinute;
  }

  get memoryBudget(): number {
    return this.memoryBudgetBytes;
  }

  canSpend(bytes: number, priority: PrefetchPriority): boolean {
    this.refill();
    if (priority === "high") return true;
    return this.availableBytes >= bytes;
  }

  spend(bytes: number, priority: PrefetchPriority): void {
    this.refill();
    if (priority === "high") return;
    this.availableBytes = Math.max(0, this.availableBytes - bytes);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.windowStartedAt;
    if (elapsed < 60_000) return;

    const windows = Math.floor(elapsed / 60_000);
    this.windowStartedAt += windows * 60_000;
    this.availableBytes = Math.min(
      this.bytesPerMinute,
      this.availableBytes + windows * this.bytesPerMinute
    );
  }
}

export function canPrefetchOnCurrentDevice(priority: PrefetchPriority): boolean {
  if (!isBrowser()) return false;
  const connection = getConnection();

  if (connection?.saveData) return priority === "high";
  if (connection?.effectiveType === "slow-2g") return false;
  if (connection?.effectiveType === "2g") return priority === "high";

  const memory = getDeviceMemory();
  if (memory !== undefined && memory <= 1) return priority === "high";

  if (document.visibilityState === "hidden" && priority !== "high") return false;
  return true;
}

function getConnection():
  | {
      saveData?: boolean;
      effectiveType?: string;
    }
  | undefined {
  const navigatorWithConnection = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return navigatorWithConnection.connection;
}

function getDeviceMemory(): number | undefined {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return navigatorWithMemory.deviceMemory;
}
