const CACHE_NAME = "dbz-pwa-cache-v3";

const urlsToCache = [
  './index.html',
  './manifest.json',
  './hacker-bg.css',
  './matrix.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

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

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
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
          return response;
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
        // Clone and cache successful responses
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(request))
  );
});
