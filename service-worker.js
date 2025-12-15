// Минимальный Service Worker для оффлайн-работы
const CACHE_NAME = 'ne2pi-v1';

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll([
                '/',
                '/index.html',
                '/terminal.css',
                '/terminal.js'
            ]))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('fetch', event => {
    // Пропускаем запросы к PeerJS
    if (event.request.url.includes('peerjs')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
