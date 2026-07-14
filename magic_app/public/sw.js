const CACHE_NAME = 'geroy-skazki-v6.2.0';
const ASSETS = [
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
  '/manifest.json',
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
  '/assets/images/lucik-run-1.svg',
  '/assets/images/lucik-run-2.svg',
  '/assets/images/lucik-run-3.svg',
  '/assets/images/lucik-run-4.svg',
  '/assets/images/lucik-run-1.png',
  '/assets/images/lucik-run-2.png',
  '/assets/images/lucik-run-3.png',
  '/assets/images/lucik-run-4.png',
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
  '/js/progression.js',
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
  '/js/admin-dashboard.js',
  '/js/feedback.js'
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

  // Корень — отдавать index.html (не fetch("/") — Pages может ответить 301/302)
  if (url.pathname === '/' || url.pathname === '') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        if (cached) return cached;
        return fetch('/index.html', { redirect: 'follow' }).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        });
      })
    );
    return;
  }

  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/css/') || url.pathname.endsWith('.html') || url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(event.request, { redirect: 'follow' })
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
      return fetch(event.request, { redirect: 'follow' }).catch(() => new Response('Нет сети', { status: 503 }));
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
