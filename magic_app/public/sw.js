// Service Worker v6.2.1 — отключён для сброса кэша
// После загрузки этого SW все старые кэши удалятся
// и сайт будет работать без кэширования

const CACHE_NAME = 'geroy-skazki-v6.2.1-reset';

self.addEventListener('install', (event) => {
  // Пропускаем ожидание, активируемся сразу
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Удаляем ВСЕ старые кэши
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Перезагружаем все открытые вкладки
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Пропускаем всё без кэширования
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
