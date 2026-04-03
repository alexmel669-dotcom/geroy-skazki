// sw.js - Service Worker для PWA "Люцик"
// Версия кэша - увеличивай при каждом обновлении приложения
const CACHE_NAME = 'lucik-v4';

// Файлы, которые будут кэшироваться при установке
const ASSETS = [
    './',
    './index.html',
    './avatar.png',
    './manifest.json',
    './purr.mp3'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('🦁 [SW] Установка Service Worker v4');
    
    // Заставляем Service Worker активироваться сразу
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('🦁 [SW] Кэширование файлов');
            
            const cachePromises = ASSETS.map(async (asset) => {
                try {
                    const response = await fetch(asset);
                    if (response.ok) {
                        await cache.put(asset, response);
                        console.log(`✅ [SW] Кэширован: ${asset}`);
                    } else {
                        console.log(`⚠️ [SW] Не удалось кэшировать: ${asset}`);
                    }
                } catch (error) {
                    console.log(`❌ [SW] Ошибка кэширования ${asset}:`, error);
                }
            });
            
            await Promise.all(cachePromises);
            console.log('🦁 [SW] Кэширование завершено');
        })
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('🦁 [SW] Активация Service Worker v4');
    
    event.waitUntil(
        (async () => {
            // Удаляем старые версии кэша
            const cacheNames = await caches.keys();
            const oldCaches = cacheNames.filter(name => name !== CACHE_NAME);
            
            await Promise.all(
                oldCaches.map(async (oldCache) => {
                    console.log(`🗑️ [SW] Удаляем старый кэш: ${oldCache}`);
                    await caches.delete(oldCache);
                })
            );
            
            // Захватываем контроль над всеми страницами
            console.log('🦁 [SW] Захват контроля над страницами');
            await self.clients.claim();
            
            // Уведомляем все клиенты об обновлении
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_ACTIVATED',
                    version: CACHE_NAME
                });
            });
            
            console.log('🦁 [SW] Активация завершена');
        })()
    );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // API запросы НЕ кэшируем (важно для Edge TTS и DeepSeek)
    if (url.pathname.startsWith('/api/')) {
        console.log(`🌐 [SW] API запрос: ${url.pathname}`);
        return event.respondWith(fetch(event.request));
    }
    
    // Запросы к DeepSeek API НЕ кэшируем
    if (url.hostname.includes('deepseek.com')) {
        console.log(`🌐 [SW] DeepSeek API запрос`);
        return event.respondWith(fetch(event.request));
    }
    
    // Запросы к Edge TTS НЕ кэшируем (всегда свежие голоса)
    if (url.hostname.includes('speech.platform.bing.com')) {
        console.log(`🌐 [SW] Edge TTS запрос`);
        return event.respondWith(fetch(event.request));
    }
    
    // Аудиофайлы (mp3, wav) — не кэшируем, они динамические
    if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.wav')) {
        console.log(`🌐 [SW] Аудио файл (не кэшируем): ${url.pathname}`);
        return event.respondWith(fetch(event.request));
    }
    
    // Не GET запросы пропускаем
    if (event.request.method !== 'GET') {
        return event.respondWith(fetch(event.request));
    }
    
    // Для остальных запросов: сначала проверяем кэш, потом сеть
    event.respondWith(
        (async () => {
            try {
                // Пытаемся найти в кэше
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    console.log(`💾 [SW] Из кэша: ${url.pathname}`);
                    return cachedResponse;
                }
                
                // Если нет в кэше - идём в сеть
                console.log(`🌐 [SW] Из сети: ${url.pathname}`);
                const networkResponse = await fetch(event.request);
                
                // Кэшируем только успешные ответы (не API, не аудио)
                if (networkResponse && networkResponse.status === 200) {
                    const contentType = networkResponse.headers.get('content-type') || '';
                    if (!contentType.includes('audio') && !url.pathname.startsWith('/api')) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, networkResponse.clone());
                    }
                }
                
                return networkResponse;
            } catch (error) {
                console.log(`❌ [SW] Ошибка загрузки: ${url.pathname}`, error);
                
                // Возвращаем заглушку для ошибок сети
                return new Response(
                    '🦁 Люцик временно недоступен. Проверь подключение к интернету!',
                    {
                        status: 200,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                    }
                );
            }
        })()
    );
});

// Обработка сообщений от страницы
self.addEventListener('message', (event) => {
    console.log(`📨 [SW] Получено сообщение: ${event.data}`);
    
    switch (event.data) {
        case 'skipWaiting':
            self.skipWaiting();
            break;
        case 'checkForUpdates':
            self.registration.update();
            break;
        default:
            if (event.data && event.data.type === 'GET_VERSION') {
                event.source.postMessage({
                    type: 'VERSION_INFO',
                    version: CACHE_NAME
                });
            }
    }
});

// Периодическая проверка обновлений (каждые 6 часов)
setInterval(() => {
    console.log('🔄 [SW] Периодическая проверка обновлений');
    self.registration.update();
}, 6 * 60 * 60 * 1000);
