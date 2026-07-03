const CACHE_NAME = 'geroy-skazki-v5.3.7';
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
  '/assets/images/parent-bg.png',
  '/assets/images/avatar.svg',
  '/assets/images/avatar.png',
  '/assets/images/kid1.svg',
  '/assets/images/kid1.png',
  '/assets/images/kid2.svg',
  '/assets/images/kid2.png',
  '/assets/images/mom.svg',
  '/assets/images/mom.png',
  '/assets/images/dad.svg',
  '/assets/images/dad.png',
  '/assets/images/parent-bg.svg',
  '/js/main.js',
  '/js/core.js',
  '/js/config.js',
  '/js/ui.js',
  '/js/mic.js',
  '/js/ai.js',
  '/js/auth.js',
  '/js/security.js',
  '/js/grammar.js',
  '/js/avatar.js',
  '/js/onboarding.js',
  '/js/error-monitor.js',
  '/js/game-engine.js',
  '/js/audio.js',
  '/js/context.js',
  '/js/dictionary.js',
  '/js/gender.js',
  '/assets/images/icon-192.svg',
  '/assets/images/icon-512.svg',
  '/assets/images/icon-192.png',
  '/assets/images/icon-512.png',
  '/js/tamagotchi.js',
  '/js/games/game-difficulty.js',
  '/js/analytics.js',
  '/js/achievements.js',
  '/js/notifications.js',
  '/js/retention.js',
  '/js/child-mode.js',
  '/js/child-swipe.js',
  '/js/game-progress.js',
  '/js/games/game-ui.js',
  '/js/games/fish.js',
  '/js/games/memory.js',
  '/js/games/puzzle.js',
  '/js/games/riddles.js',
  '/js/games/quest.js',
  '/js/games/maze.js',
  '/js/games/quiz.js',
  '/js/games/runner.js',
  '/js/leaderboard.js',
  '/js/storybook.js',
  '/js/games/draw-ai.js',
  '/js/games/music-cat.js',
  '/js/games/constellation.js',
  '/js/games/pop-fears.js',
  '/js/parent-dashboard.js',
  '/js/feedback.js',
  '/js/admin-dashboard.js',
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

  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/assets/')) {
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
