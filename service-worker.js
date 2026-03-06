const CACHE_NAME = "dbz-pwa-cache-v4";

const urlsToCache = [
  './index.html',
  './manifest.json',
  './hacker-bg.css',
  './matrix.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Security headers injected on every cached response
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Install event - cache essential files
self.addEventListener("install", event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching essential files');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('Cache.addAll error:', err);
        });
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache, always inject security headers
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Block any non-HTTPS requests (except localhost for dev)
  if (url.protocol === 'http:' && url.hostname !== 'localhost') {
    const httpsUrl = request.url.replace('http:', 'https:');
    event.respondWith(Response.redirect(httpsUrl, 301));
    return;
  }

  // Skip cross-origin requests entirely
  if (url.origin !== location.origin) {
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return caches.match('./index.html');
          }
          return addSecurityHeaders(response);
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For other requests: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (!response || response.status !== 200) {
          return caches.match(request);
        }
        const secureResponse = addSecurityHeaders(response.clone());
        // Cache the secured response
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, response.clone());
        });
        return secureResponse;
      })
      .catch(() => caches.match(request))
  );
});
