const CACHE_NAME = 'geroy-skazki-v4.6.0';
const ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/login.html',
  '/register.html',
  '/pricing.html',
  '/parent.html',
  '/admin.html',
  '/privacy.html',
  '/terms.html',
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
  '/js/notifications.js',
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

const NOTIFICATION_ICON = '/assets/images/avatar.svg';

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

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Герой Сказок';
  const options = {
    body: data.body || 'Люцик ждёт тебя!',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/app.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/app.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
