/* =========================================================
   Migraine Risk Monitor — Service Worker
   =========================================================
   Provides basic offline support by caching the "app shell"
   (HTML/CSS/JS/icons) so the dashboard UI can still open even
   if the network drops. It does NOT cache live sensor data —
   that always comes from demo simulation or a live fetch.
   ========================================================= */

const CACHE_NAME = "migraine-monitor-shell-v1";

// Everything needed to render the dashboard UI itself.
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/config.js",
  "./js/utils.js",
  "./js/theme.js",
  "./js/connection.js",
  "./js/history.js",
  "./js/chart.js",
  "./js/alerts.js",
  "./js/render.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Cache the app shell as soon as the service worker installs.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .catch((err) => {
        // Don't let a single missing file block installation entirely.
        console.warn("Service worker: some app shell files failed to cache.", err);
      })
  );
  self.skipWaiting();
});

// Clean up old cache versions when a new service worker activates.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Cache-first strategy for app shell files, falling back to network
// for anything else (e.g. a future /api/latest call, CDN assets).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).catch(() => {
        // If both cache and network fail for a navigation request,
        // fall back to the cached index page so the app still opens.
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return undefined;
      });
    })
  );
});
