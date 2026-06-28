/*
 * Service worker — deliberately conservative.
 *
 * Network-first for everything, with a cached fallback only when offline.
 * It calls skipWaiting + clients.claim so a new deploy takes effect immediately
 * instead of serving a stale app (the classic PWA footgun). API calls are never
 * cached.
 */
const CACHE = "vital-signs-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || request.url.includes("/api/")) return;

  e.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match("/");
      }
    })()
  );
});
