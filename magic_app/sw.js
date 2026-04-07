// sw.js - Service Worker с автообновлением
const CACHE_NAME = 'lucik-v6';

const ASSETS = [
    './',
    './index.html',
    './avatar.png',
    './manifest.json',
    './purr.mp3',
    './privacy.html'
];

self.addEventListener('install', (event) => {
    console.log('🦁 SW установлен');
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const asset of ASSETS) {
                try {
                    const response = await fetch(asset);
                    if (response.ok) await cache.put(asset, response);
                } catch(e) { console.log(`❌ ${asset}`); }
            }
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log('🦁 SW активирован');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/') || 
        url.hostname.includes('deepseek.com')) {
        return event.respondWith(fetch(event.request));
    }
    event.respondWith(
        caches.match(event.request).then(r => r || fetch(event.request))
    );
});

setInterval(() => {
    console.log('🔄 Проверка обновлений');
    self.registration.update();
}, 6 * 60 * 60 * 1000);
