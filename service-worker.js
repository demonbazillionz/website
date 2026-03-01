/* ═══════════════════════════════════════════════════
   demonbazillionz — Service Worker v5.0
   AUTO-UPDATE SYSTEM — one install, forever fresh
   ───────────────────────────────────────────────────
   HOW TO PUSH AN UPDATE TO ALL INSTALLED USERS:
   1. Edit your files (index.html, matrix.js, etc.)
   2. Bump CACHE_VERSION below  (v5 → v6 → v7 ...)
   3. git push to GitHub Pages
   That's it. Every installed PWA auto-updates itself.
═══════════════════════════════════════════════════ */
const CACHE_VERSION = "v5";
const CACHE_NAME    = `dbz-pwa-${CACHE_VERSION}`;
const OFFLINE_URL   = "./offline.html";

const PRE_CACHE = [
  "./index.html",
  "./manifest.json",
  "./matrix.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./offline.html"
];

/* ════════════════════════════════════════
   INSTALL — pre-cache all shell files
════════════════════════════════════════ */
self.addEventListener("install", event => {
  console.log(`[DBZ-SW] installing ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRE_CACHE)
        .catch(err => console.warn("[DBZ-SW] pre-cache partial fail:", err))
      )
      .then(() => {
        console.log(`[DBZ-SW] ${CACHE_NAME} ready — skipping wait`);
        return self.skipWaiting(); // activate immediately
      })
  );
});

/* ════════════════════════════════════════
   ACTIVATE — purge old caches, claim all
   clients, then BROADCAST update to every
   open tab so the page can auto-reload
════════════════════════════════════════ */
self.addEventListener("activate", event => {
  console.log(`[DBZ-SW] activating ${CACHE_NAME}`);
  event.waitUntil(
    // Step 1: delete all old version caches
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log(`[DBZ-SW] purging old cache: ${k}`);
            return caches.delete(k);
          })
      ))
      // Step 2: claim all open clients immediately
      .then(() => self.clients.claim())
      // Step 3: tell every open window/tab that an update happened
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then(clients => {
        console.log(`[DBZ-SW] broadcasting update to ${clients.length} client(s)`);
        clients.forEach(client => {
          client.postMessage({
            type: "SW_UPDATED",
            version: CACHE_VERSION,
            cacheName: CACHE_NAME
          });
        });
      })
  );
});

/* ════════════════════════════════════════
   FETCH — smart tiered caching
   ┌─ navigate  → network-first, offline fallback
   ├─ assets    → cache-first + background revalidate
   └─ others    → network-first, cache fallback
════════════════════════════════════════ */
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET over http(s)
  if (!["http:", "https:"].includes(url.protocol)) return;
  if (url.origin !== location.origin) return;
  if (request.method !== "GET") return;

  /* ── Navigation (HTML pages) ── */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  /* ── Static assets: stale-while-revalidate ── */
  const isAsset = ["script","style","image","font","manifest"].includes(request.destination);
  if (isAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(res => {
          if (res && res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          }
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    );
    return;
  }

  /* ── Everything else: network-first ── */
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

/* ════════════════════════════════════════
   MESSAGE — commands from the page
════════════════════════════════════════ */
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "GET_VERSION") {
    event.source?.postMessage({ type: "SW_VERSION", version: CACHE_VERSION });
  }
});

/* ════════════════════════════════════════
   PUSH — future notifications
════════════════════════════════════════ */
self.addEventListener("push", event => {
  const data = event.data?.json() ?? { title: "demonbazillionz", body: "daemon signal received" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      vibrate: [200, 100, 200],
      tag: "dbz-notification",
      renotify: true
    })
  );
});
