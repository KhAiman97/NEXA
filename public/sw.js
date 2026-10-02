/* Service worker: makes the app installable and shows a friendly page offline.
 *
 * Deliberately conservative for a personal-finance app:
 *   - HTML pages and API/Supabase responses are NEVER cached, so no account data sits in Cache Storage.
 *   - Only immutable build assets (/_next/static) and the icons are cached.
 *   - Cross-origin requests (Supabase, fonts, etc.) are left entirely to the browser.
 * Bump VERSION to force clients to drop old caches.
 */
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);

      // Cache the offline page plus the CSS/JS it needs, so it renders styled with no network.
      const response = await fetch(OFFLINE_URL, { cache: "reload" });
      if (response.ok) {
        const html = await response.clone().text();
        await cache.put(OFFLINE_URL, response);
        const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)]+\.(?:css|js)/g) || []);
        await Promise.all([...assets].map((url) => cache.add(url).catch(() => undefined)));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== STATIC_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: always go to the network; fall back to the offline page only if it fails.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  // Hashed build assets and icons never change for a given URL: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
  // Everything else (RSC payloads, server actions, images, API): untouched.
});
