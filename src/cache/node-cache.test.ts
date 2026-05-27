import { describe, expect, it } from "vitest";
import { createNodeRouteCache } from "./node-cache.js";

describe("NodeRouteCache", () => {
  it("propagates invalidateTag and invalidateMutation to underlying nodeCache", async () => {
    const cache = await createNodeRouteCache();

    cache.set("/profile", "route-data", "userData", { tags: ["user"] });
    cache.set("/profile", "html", "htmlData");

    expect(cache.get("/profile", "route-data")).toBe("userData");
    expect(cache.get("/profile", "html")).toBe("htmlData");

    // Invalidate tag
    cache.invalidateTag("user");
    expect(cache.get("/profile", "route-data")).toBeUndefined();
    expect(cache.get("/profile", "html")).toBe("htmlData");

    // Re-set and invalidate mutation
    cache.set("/profile", "route-data", "userData", { tags: ["user"] });
    expect(cache.get("/profile", "route-data")).toBe("userData");

    cache.invalidateMutation("/profile", ["user"]);
    expect(cache.get("/profile", "route-data")).toBeUndefined();
    expect(cache.get("/profile", "html")).toBeUndefined();
  });
});
