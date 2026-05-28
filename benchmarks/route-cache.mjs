export async function setup(bench) {
  const { RouteCache } = await import("../dist/cache/route-cache.js");

  const hotCache = new RouteCache({
    maxEntries: 20_000,
    maxBytes: 100_000_000
  });
  let hotId = 0;

  bench.add("route-cache: set/get html", () => {
    const id = hotId++ % 20_000;
    const key = `/docs/${id}`;
    hotCache.set(key, "html", `<main>${id}</main>`, {
      tags: [`docs:${id % 50}`],
      ttlMs: 60_000
    });
    hotCache.get(key, "html");
  });

  let batch = 0;
  bench.add("route-cache: tag invalidation", () => {
    const cache = new RouteCache({
      maxEntries: 200,
      maxBytes: 5_000_000
    });
    const tag = `project:${batch++}`;

    for (let index = 0; index < 25; index += 1) {
      cache.set(`/api/projects/${batch}/${index}`, "api", { index }, { tags: [tag] });
    }

    cache.invalidateTag(tag);
  });
}
