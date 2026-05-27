export const OFFLINE_NAVIGATION_SERVICE_WORKER = `
const CACHE_NAME = "production-link-offline-v1";
const OFFLINE_URLS = ["/"];
const navigationQueue = [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PRODUCTION_LINK_QUEUE_NAVIGATION") {
    navigationQueue.push(event.data.payload);
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match("/");
      })
  );
});
`;
//# sourceMappingURL=service-worker-script.js.map