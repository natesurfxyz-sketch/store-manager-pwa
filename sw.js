const CACHE_NAME = "store-manager-v10";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./app.css", "./onboarding.js", "./scanner.js"];
const ASSET_LINK = '<link id="onboarding-assets" rel="stylesheet" href="./app.css">';
const ASSET_JS = '<script src="./onboarding.js"></script><script src="./scanner.js"></script>';

function inject(html) {
  if (html.includes('id="onboarding-assets"')) return html;
  return html.replace("</head>", ASSET_LINK + "</head>").replace("</body>", ASSET_JS + "</body>");
}
async function docResponse(res) {
  return new Response(inject(await res.text()), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
}

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

// Network first, so updates appear on the next open; cache is only the offline fallback.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isDoc = event.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request.url, { cache: "no-cache" });
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(isDoc ? "./index.html" : event.request, copy));
      }
      return isDoc && res.ok ? docResponse(res) : res;
    } catch (err) {
      const cached = await caches.match(isDoc ? "./index.html" : event.request);
      if (cached) return isDoc ? docResponse(cached) : cached;
      throw err;
    }
  })());
});
