/* ── KSPEAK$ PWA SERVICE WORKER (v2.0) ── */
const CACHE_NAME = 'kspeaks-pwa-v2';
const OFFLINE_URL = '/offline/';

const PRECACHE_ASSETS = [
    '/',
    '/offline/',
    '/blog/',
    '/athereal/',
    '/ai-magazine/',
    '/Karuwaki/static/web3/kspeaks-web3-logo.png',
    '/Karuwaki/static/web3/fav-icon/favicon-32x32.png',
    '/Karuwaki/static/web3/fav-icon/icon-192.png',
    '/static/js/pwa-vault.js',
    '/static/js/athereal-engine.js',
    'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css'
];

// 1. Install Event: Pre-cache core shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate Event: Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event: Network-first for pages, cache-first for static assets
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle GET requests
    if (request.method !== 'GET') return;

    // A. Navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    // Clone and save response to cache for offline reading
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed: try cache, else return /offline/
                    return caches.match(request).then(cachedResponse => {
                        return cachedResponse || caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // B. Static assets (images, styles, scripts)
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                // Return cached version, update in background if needed
                fetch(request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
                }
                return networkResponse;
            });
        })
    );
});
