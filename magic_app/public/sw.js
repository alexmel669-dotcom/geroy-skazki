// Service Worker — кэширование + offline fallback
// Версия кэша: увеличивай при обновлении файлов, чтобы форсировать обновление
const CACHE_NAME = 'geroy-skazki-v1';
const OFFLINE_URL = 'offline.html';

// Файлы, которые кэшируем сразу при установке
const PRECACHE_URLS = [
  './',
  'index.html',
  'app.html',
  'register.html',
  'login.html',
  'offline.html',
  'manifest.json',
  'assets/images/icon-192.png',
  'assets/images/icon-512.png'
];

// === INSTALL: кэшируем статику ===
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Кэшируем по одному — чтобы один упавший файл не сломал всю установку
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Не удалось закэшировать:', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// === ACTIVATE: чистим старые версии кэша ===
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// === FETCH: стратегия ===
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Игнорируем не-GET и запросы к API (их кэшировать нельзя)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API-запросы — всегда в сеть, без кэша
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ error: 'offline', message: 'Нет подключения' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Для навигационных запросов (открытие страницы) — network-first с fallback на offline.html
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          // Обновляем кэш свежей версией
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() => {
          // Сети нет — пробуем кэш, иначе offline.html
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            return caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Для статики (css, js, img) — cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        // Кэшируем только успешные ответы с нашего origin
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return response;
      }).catch(() => {
        // Если совсем ничего — для картинок вернём пустую
        if (req.destination === 'image') {
          return new Response('', { status: 404 });
        }
        throw new Error('offline');
      });
    })
  );
});

// === MESSAGE: возможность сбросить кэш из UI ===
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))));
  }
});
