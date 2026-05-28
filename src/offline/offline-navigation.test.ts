import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineNavigationManager } from "./offline-navigation.js";

describe("OfflineNavigationManager", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true
    });
  });

  it("emits an event and callback when navigation is queued", () => {
    const onOfflineQueueAdded = vi.fn();
    const eventListener = vi.fn();
    const manager = new OfflineNavigationManager({ onOfflineQueueAdded });
    window.addEventListener("offline-queue:added", eventListener);

    manager.queueNavigation("/queued", true, { source: "test" });

    expect(onOfflineQueueAdded).toHaveBeenCalledWith(
      expect.objectContaining({ queueLength: 1 })
    );
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(manager.readQueue()[0]).toEqual(
      expect.objectContaining({ href: "/queued", replace: true })
    );

    window.removeEventListener("offline-queue:added", eventListener);
  });

  it("emits syncing and synced events while flushing", async () => {
    const onOfflineSyncing = vi.fn();
    const onOfflineSynced = vi.fn();
    const syncingListener = vi.fn();
    const syncedListener = vi.fn();
    const manager = new OfflineNavigationManager({
      onOfflineSyncing,
      onOfflineSynced
    });
    window.addEventListener("syncing", syncingListener);
    window.addEventListener("synced", syncedListener);

    manager.queueNavigation("/sync");
    await manager.flushQueue(vi.fn());

    expect(onOfflineSyncing).toHaveBeenCalledWith({ queueLength: 1 });
    expect(onOfflineSynced).toHaveBeenCalledWith({
      syncedCount: 1,
      requeuedCount: 0,
      queueLength: 0
    });
    expect(syncingListener).toHaveBeenCalledTimes(1);
    expect(syncedListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("syncing", syncingListener);
    window.removeEventListener("synced", syncedListener);
  });
});
