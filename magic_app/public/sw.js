const CACHE_NAME = 'geroy-skazki-v3.4';
const ASSETS = [
  '/',
  '/app.html',
  '/login.html',
  '/register.html',
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
  '/avatar.png',
  '/manifest.json'
];

// Установка
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching assets...');
        return cache.addAll(ASSETS).catch(error => {
          console.error('Failed to cache some assets:', error);
          return Promise.resolve(); // Продолжаем даже с ошибками
        });
      })
  );
  self.skipWaiting();
});

// Активация и очистка старых кешей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  // Не кешируем API запросы
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // Не кешируем POST запросы
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Возвращаем из кеша или делаем запрос
        const fetchPromise = fetch(event.request)
          .then((response) => {
            // Кешируем успешные ответы
            if (response.ok && response.type === 'basic') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                })
                .catch(err => console.warn('Failed to cache:', err));
            }
            return response;
          })
          .catch(() => {
            // Оффлайн - возвращаем из кеша
            return cachedResponse;
          });
        
        return cachedResponse || fetchPromise;
      })
  );
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
