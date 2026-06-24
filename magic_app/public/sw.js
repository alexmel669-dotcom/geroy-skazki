const CACHE_NAME = 'geroy-skazki-v4.5.0';
const ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/login.html',
  '/register.html',
  '/pricing.html',
  '/parent.html',
  '/admin.html',
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
  '/js/admin-dashboard.js',
  '/js/parent-dashboard.js',
  '/js/games/fish.js',
  '/js/games/memory.js',
  '/js/games/puzzle.js',
  '/js/games/riddles.js',
  '/js/games/quest.js',
  '/assets/images/avatar.svg',
  '/assets/images/mom.svg',
  '/assets/images/dad.svg',
  '/assets/images/kid1.svg',
  '/assets/images/kid2.svg',
  '/assets/images/parent-bg.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((err) => console.error('SW install cache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

function offlineResponse() {
  return new Response('Нет сети', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached || offlineResponse())
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
