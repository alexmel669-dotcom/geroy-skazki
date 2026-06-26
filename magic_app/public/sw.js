const CACHE_NAME = 'geroy-skazki-v5.0.5';
const ASSETS = [
  '/',
  '/app.html',
  '/index.html',
  '/login.html',
  '/register.html',
  '/parent.html',
  '/admin.html',
  '/pricing.html',
  '/privacy.html',
  '/terms.html',
  '/css/main.css',
  '/css/auth.css',
  '/js/main.js',
  '/js/core.js',
  '/js/config.js',
  '/js/ui.js',
  '/js/mic.js',
  '/js/ai.js',
  '/js/auth.js',
  '/js/security.js',
  '/js/feedback.js',
  '/js/audio.js',
  '/js/context.js',
  '/js/dictionary.js',
  '/js/analytics.js',
  '/js/achievements.js',
  '/js/notifications.js',
  '/js/retention.js',
  '/js/child-mode.js',
  '/js/child-swipe.js',
  '/js/game-progress.js',
  '/js/admin-dashboard.js',
  '/js/parent-dashboard.js',
  '/js/games/fish.js',
  '/js/games/memory.js',
  '/js/games/puzzle.js',
  '/js/games/riddles.js',
  '/js/games/quest.js',
  '/js/games/maze.js',
  '/js/games/quiz.js',
  '/assets/images/avatar.svg',
  '/assets/images/kid1.svg',
  '/assets/images/kid2.svg',
  '/assets/images/mom.svg',
  '/assets/images/dad.svg',
  '/assets/images/parent-bg.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  if (url.pathname.startsWith('/js/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || new Response('Нет сети', { status: 503 })))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => new Response('Нет сети', { status: 503 }));
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Герой Сказок', {
      body: data.body || 'Люцик ждёт тебя!',
      icon: '/assets/images/avatar.svg',
      badge: '/assets/images/avatar.svg',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/app.html' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app.html';
  event.waitUntil(clients.openWindow(targetUrl));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
