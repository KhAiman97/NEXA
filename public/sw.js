/* Service worker: makes the app installable and shows a friendly page offline.
 *
 * Deliberately conservative for a personal-finance app. The rule is: cache the shell, never the data.
 *
 *   /_next/static/*   immutable, content-hashed  -> cache first
 *   icons, artwork    rarely change              -> stale while revalidate
 *   navigations       per-user HTML              -> network only; on failure, the offline page
 *   /api, /auth, RSC payloads, server actions, non-GET -> not touched at all
 *
 * Cross-origin requests (Supabase, fonts, etc.) are left entirely to the browser.
 * Bump VERSION on any change to this file: the old caches are dropped on activate.
 */
const VERSION = "v4";
const SHELL_CACHE = `nexa-shell-${VERSION}`;
const STATIC_CACHE = `nexa-static-${VERSION}`;
const ASSET_CACHE = `nexa-assets-${VERSION}`;
const CURRENT = new Set([SHELL_CACHE, STATIC_CACHE, ASSET_CACHE]);

const OFFLINE_URL = "/offline";
const SHELL_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png"];

/** Caps on the runtime caches, so a long-lived install can't grow without bound. */
const STATIC_LIMIT = 220;
const ASSET_LIMIT = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      // One by one rather than addAll: a single 404 would reject the whole install and leave no worker at all.
      await Promise.all(
        SHELL_ASSETS.map((url) => shell.add(new Request(url, { cache: "reload" })).catch(() => undefined)),
      );

      // The offline page plus the CSS/JS it needs, so it renders styled with no network.
      // A redirected response is skipped: that would be the login page, not the offline page.
      const response = await fetch(OFFLINE_URL, { cache: "reload" }).catch(() => undefined);
      if (response && response.ok && !response.redirected) {
        const html = await response.clone().text();
        await shell.put(OFFLINE_URL, response);
        const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)]+\.(?:css|js)/g) || []);
        const statics = await caches.open(STATIC_CACHE);
        await Promise.all([...assets].map((url) => statics.add(url).catch(() => undefined)));
      }
      // No skipWaiting here: see the message handler below.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !CURRENT.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/* The page asking to be updated now.
 * Nothing skips waiting on its own: a worker that activates mid-session swaps the build under a running app,
 * and the next lazy import asks for a file the new build renamed. The page offers a reload; only a yes gets here. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** True for anything that must never be served from, or written to, a cache. */
function isPrivate(url, request) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    // The RSC payload of a page is the page's data. Same rule as the HTML.
    url.searchParams.has("_rsc") ||
    request.headers.has("Next-Action") ||
    request.headers.get("RSC") === "1"
  );
}

/** Content-hashed build output (fonts included): the URL changes when the bytes do. */
function isImmutable(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Public artwork: icons, the logo, the social images. */
function isAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    /\.(?:png|jpe?g|svg|gif|webp|avif|ico|woff2?)$/i.test(url.pathname)
  );
}

/** Oldest-first eviction. Cache order is insertion order, so trimming the front is enough. */
async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
    trim(cacheName, limit).catch(() => undefined);
  }
  return response;
}

/** Artwork: instant from cache, refreshed in the background for next time. */
async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(request)) || (await caches.match(request, { cacheName: SHELL_CACHE }));

  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.type === "basic") {
        cache.put(request, response.clone());
        trim(cacheName, limit).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  return hit || (await network) || Response.error();
}

/** A page. The response is never stored; the cache only holds the one static page that says the network is gone. */
async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
    return (
      offline ||
      new Response("<!doctype html><meta charset=utf-8><title>Offline</title><p>Nexa is offline.", {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigations first, /auth included: navigate() writes nothing to any cache, and it is the only way
  // an installed app opened offline while signed out lands on the offline page instead of a browser error.
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (isPrivate(url, request)) return;

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, STATIC_LIMIT));
    return;
  }

  if (isAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE, ASSET_LIMIT));
  }
  // Everything else: untouched.
});
