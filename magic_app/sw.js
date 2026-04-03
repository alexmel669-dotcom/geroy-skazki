// sw.js - Service Worker с автоматическим обновлением
const CACHE_NAME = 'lucik-v2';  // ← МЕНЯЙ ВЕРСИЮ ПРИ КАЖДОМ ОБНОВЛЕНИИ
const ASSETS = [
    './',
    './index.html',
    './avatar.png',
    './manifest.json',
    './purr.mp3'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('🦁 Service Worker установлен');
    self.skipWaiting();  // Заставляет обновиться сразу
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
    console.log('🦁 Service Worker активирован');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('🗑️ Удаляем старый кэш:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            // Захватываем контроль над всеми страницами
            return self.clients.claim();
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    // API запросы не кэшируем
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('deepseek.com') ||
        event.request.method !== 'GET') {
        return event.respondWith(fetch(event.request));
    }
    
    // Остальное — из кэша или сети
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(event.request).then((response) => {
                // Кэшируем новые файлы
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            });
        })
    );
});

// Проверка обновлений каждые 6 часов
self.addEventListener('message', (event) => {
    if (event.data === 'checkForUpdates') {
        self.skipWaiting();
    }
});
