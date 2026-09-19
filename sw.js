// Service worker: caches the app shell so the app opens instantly and
// works offline. Firestore's own SDK handles data offline-sync separately.

const CACHE_NAME = "expense-ledger-v27";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./vendor-chartjs.js",
  "./vendor-xlsx.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests with the app-shell cache.
  // Everything else (Firebase, Chart.js CDN, fonts) goes straight to network.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // The HTML shell (the page itself) is the one file that changes whenever
  // we ship a fix, so it must always try the network first — falling back
  // to the cache only when offline. Otherwise a stale copy of index.html
  // can keep being served indefinitely even after a fresh deploy, since a
  // cache-first strategy always prefers whatever was cached last time.
  const isAppShellHtml =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  if (isAppShellHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (JS bundles, icons, manifest) rarely changes, so it's
  // fine — and faster, and offline-friendly — to serve from cache first
  // while quietly refreshing the cache in the background.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
