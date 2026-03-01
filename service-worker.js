/* ═══════════════════════════════════════════
   demonbazillionz — Service Worker v6
   Bump CACHE_VERSION on every deploy to push
   updates to all installed users automatically
═══════════════════════════════════════════ */
const CACHE_VERSION = "v6";
const CACHE_NAME    = "dbz-" + CACHE_VERSION;
const OFFLINE_URL   = "./offline.html";

const PRECACHE = [
  "./index.html",
  "./manifest.json",
  "./matrix.js",
  "./offline.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(clients => clients.forEach(c => c.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION })))
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (!["http:","https:"].includes(url.protocol)) return;
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(r => {
        if (r && r.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
