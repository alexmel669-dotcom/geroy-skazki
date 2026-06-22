const CACHE_NAME = 'geroy-skazki-v4.0.11';
const ASSETS = [
  '/',
  '/app.html',
  '/login.html',
  '/register.html',
  '/parent.html',
  '/css/main.css',
  '/css/auth.css',
  '/js/config.js',
  '/js/core.js',
  '/js/security.js',
  '/js/auth.js',
  '/js/audio.js',
  '/js/ai.js',
  '/js/mic.js',
  '/js/ui.js',
  '/js/analytics.js',
  '/js/achievements.js',
  '/js/main.js',
  '/js/games/fish.js',
  '/js/games/memory.js',
  '/js/games/puzzle.js',
  '/js/games/coloring.js',
  '/js/games/emotion.js',
  '/js/parent-dashboard.js',
  '/assets/images/avatar.svg',
  '/assets/images/kid1.svg',
  '/assets/images/kid2.svg',
  '/assets/images/parent-bg.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(err => {
        console.error('Failed to cache some assets:', err);
      }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
