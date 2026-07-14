const CACHE_NAME = 'geroy-skazki-v6.2.2';
const ASSETS = [
  '/',
  '/app',
  '/admin',
  '/register',
  '/pricing',
  '/parent',
  '/css/main.css',
  '/js/config.js',
  '/js/core.js',
  '/js/ai.js',
  '/js/audio.js',
  '/js/mic.js',
  '/js/analytics.js',
  '/js/ui.js',
  '/js/security.js',
  '/js/progression.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('SW: cache failed for some assets', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request, { redirect: 'follow' }).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
