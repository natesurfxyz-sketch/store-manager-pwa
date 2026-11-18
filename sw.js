const CACHE_NAME = "store-manager-v9";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./app.css", "./onboarding.js", "./scanner.js"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith("store-manager-") && key !== CACHE_NAME)
    .map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isDocument = event.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    try {
      const response = cached || await fetch(event.request);
      if (!response.ok) return response;
      if (isDocument) {
        let html = await response.text();
        if (!html.includes('id="onboarding-assets"')) {
          html = html.replace("</head>", '<link id="onboarding-assets" rel="stylesheet" href="./app.css"></head>')
            .replace("</body>", '<script src="./onboarding.js"></script><script src="./scanner.js"></script></body>');
        }
        return new Response(html, { status: response.status, statusText: response.statusText, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
      }
      if (!cached) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    } catch (error) {
      if (cached && isDocument) {
        let html = await cached.text();
        if (!html.includes('id="onboarding-assets"')) {
          html = html.replace("</head>", '<link id="onboarding-assets" rel="stylesheet" href="./app.css"></head>')
            .replace("</body>", '<script src="./onboarding.js"></script><script src="./scanner.js"></script></body>');
        }
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (isDocument) {
        const fallback = await caches.match("./index.html");
        if (fallback) {
          let html = await fallback.text();
          html = html.replace("</head>", '<link id="onboarding-assets" rel="stylesheet" href="./app.css"></head>')
            .replace("</body>", '<script src="./onboarding.js"></script><script src="./scanner.js"></script></body>');
          return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
      }
      throw error;
    }
  })());
});
