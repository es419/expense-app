// Service worker: offline app shell with fresh code on every online launch.

const CACHE_NAME = "expense-ledger-v28";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js?v=28",
  "./firebase-config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./vendor-chartjs.js",
  "./vendor-xlsx.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/manifest.json");

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      })
    )
  );
});
