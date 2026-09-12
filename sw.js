/*
 * demonbazillionz — Service Worker
 * Production-grade offline caching for a static retro PWA.
 */

const SW_VERSION = "v1";
const CACHE_STATIC = `static-${SW_VERSION}`;
const CACHE_PAGES  = `pages-${SW_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const EXTERNAL_ASSETS = [
  "https://i.ibb.co/39F2XkQs/demonbazillionz.png"
];

/* ---------- Install ---------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(CACHE_STATIC);
      await staticCache.addAll(SHELL_ASSETS);

      /* Best-effort cache of external avatar so offline works.
         If the CDN is unreachable during install, continue anyway. */
      try {
        const pageCache = await caches.open(CACHE_PAGES);
        await Promise.allSettled(
          EXTERNAL_ASSETS.map((url) =>
            fetch(url, { mode: "cors" })
              .then((res) => {
                if (res.ok) return pageCache.put(url, res);
              })
              .catch(() => {})
          )
        );
      } catch (_) {
        /* non-critical */
      }

      self.skipWaiting();
    })()
  );
});

/* ---------- Activate ---------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_PAGES)
          .map((key) => caches.delete(key))
      );
      self.clients.claim();
    })()
  );
});

/* ---------- Fetch strategies ---------- */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  /* Only handle same-origin GET requests */
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* Navigation requests — network first, fall back to cached shell */
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          /* Cache the fresh page for offline */
          const pageCache = await caches.open(CACHE_PAGES);
          pageCache.put(request, fresh.clone());
          return fresh;
        } catch (_) {
          const cached = await caches.match(request);
          if (cached) return cached;
          /* Offline fallback: serve the shell index */
          return caches.match("./index.html");
        }
      })()
    );
    return;
  }

  /* Static assets (same-origin) — cache first, network fallback */
  if (url.origin === location.origin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          /* Only cache successful responses for same-origin */
          if (fresh.ok) {
            const cache = await caches.open(CACHE_STATIC);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (_) {
          return new Response("", { status: 508, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  /* External resources (avatar, fonts, etc.) — stale-while-revalidate */
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const fetchPromise = fetch(request)
        .then((fresh) => {
          if (fresh.ok) {
            const pageCache = caches.open(CACHE_PAGES);
            pageCache.then((c) => c.put(request, fresh.clone()));
          }
          return fresh;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })()
  );
});