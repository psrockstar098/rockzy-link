import { describe, expect, it, vi } from "vitest";
import { RouteCache } from "./route-cache.js";

describe("RouteCache", () => {
  it("supports TTL and stale-while-revalidate", () => {
    let now = 0;
    const revalidate = vi.fn();
    const cache = new RouteCache({ now: () => now });

    cache.set("/profile", "route-data", { name: "Ada" }, {
      ttlMs: 100,
      staleWhileRevalidateMs: 50,
      revalidate
    });

    now = 40;
    expect(cache.get("/profile", "route-data")?.stale).toBe(false);

    now = 60;
    expect(cache.get("/profile", "route-data")?.stale).toBe(true);
    expect(revalidate).toHaveBeenCalledTimes(1);

    now = 101;
    expect(cache.has("/profile", "route-data")).toBe(false);
    expect(cache.get("/profile", "route-data")).toBeUndefined();
  });

  it("checks cache presence without counting a read hit", () => {
    const cache = new RouteCache();
    const entry = cache.set("/dashboard", "html", "<main />");

    expect(cache.has("/dashboard", "html")).toBe(true);
    expect(entry.hits).toBe(0);
    expect(cache.get("/dashboard", "html")?.entry.hits).toBe(1);
  });

  it("invalidates tags and mutation-related layers", () => {
    const cache = new RouteCache();
    cache.set("/settings", "route-data", "a", { tags: ["settings"] });
    cache.set("/settings", "html", "b");
    cache.set("/asset.js", "script", "c", { tags: ["settings"] });

    expect(cache.invalidateMutation("/settings", ["settings"])).toBe(3);
    expect(cache.get("/settings", "route-data")).toBeUndefined();
    expect(cache.get("/settings", "html")).toBeUndefined();
    expect(cache.get("/asset.js", "script")).toBeUndefined();
  });

  it("evicts least-used entries when memory budget is exceeded", () => {
    const cache = new RouteCache({ maxBytes: 10 });
    cache.set("/a", "html", "12345", { bytes: 5 });
    cache.set("/b", "html", "12345", { bytes: 5 });
    cache.get("/b", "html");
    cache.set("/c", "html", "12345", { bytes: 5 });

    expect(cache.get("/a", "html")).toBeUndefined();
    expect(cache.get("/b", "html")?.value).toBe("12345");
    expect(cache.get("/c", "html")?.value).toBe("12345");
  });
});
