const CACHE_NAME = "store-manager-v14";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./app.css", "./onboarding.js", "./branding.js", "./scanner.js"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(APP_FILES.map(url =>
    fetch(url, { cache: "reload" }).then(res => res.ok && cache.put(url, res)).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith("store-manager-") && key !== CACHE_NAME)
    .map(key => caches.delete(key)))));
  self.clients.claim();
});

// Network first, so updates appear on the next open; the cache is only the offline fallback.
// Only the app page itself falls back to index.html; other pages (privacy, terms) are left alone.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isAppPage = url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request.url, { cache: "no-cache" });
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request.url, copy));
      }
      return res;
    } catch (err) {
      const cached = await caches.match(event.request.url) || (isAppPage ? await caches.match("./index.html") : null);
      if (cached) return cached;
      throw err;
    }
  })());
});
