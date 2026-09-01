const CACHE_PREFIX = "timmy-timer-";
const STATIC_CACHE = `${CACHE_PREFIX}static-v4`;
const PAGE_CACHE = `${CACHE_PREFIX}pages-v4`;
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith(CACHE_PREFIX) &&
                  key !== STATIC_CACHE &&
                  key !== PAGE_CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.registration.navigationPreload?.enable(),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Application records are deliberately network-only so D1 data is never
  // persisted in the service worker cache.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  if (
    ["font", "image", "script", "style"].includes(request.destination) ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstNavigation(event) {
  try {
    const response =
      (await event.preloadResponse) || (await fetch(event.request));
    if (isCacheable(response)) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(event.request, { ignoreSearch: true })) ||
      (await caches.match("/offline")) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());

  return cached || network;
}

function isCacheable(response) {
  return response.ok && response.type === "basic" && !response.redirected;
}
