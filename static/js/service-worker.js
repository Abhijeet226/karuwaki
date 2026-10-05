
const version = "0.6.18";
const cacheName = `karuwaki-${version}`;
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll([
        `/`,
        `/index.html`,
        `/css/style.css`,
        `/images/icon/apple-icon-76x76.png`,
        `/images/icon/apple-icon-72x72.png`,
        `/images/icon/apple-icon-60x60.png`,
        `/images/icon/apple-icon-57x57.png`,
        `/images/icon/apple-icon-114x114.png`,
        `/images/icon/apple-icon-144x144.png`,
        `/images/icon/apple-icon-120x120.png`,
        `/images/icon/apple-icon-152x152.png`,
        `/images/icon/android-icon-192x192.png`,
        `/images/icon/favicon-32x32.png`,
        `/images/icon/favicon-96x96.png`,
        `/images/icon/favicon-16x16.png`,
        `/images/icon/favicon.ico`,
        
        
      ])
          .then(() => self.skipWaiting());
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(cacheName)
      .then(cache => cache.match(event.request, {ignoreSearch: true}))
      .then(response => {
      return response || fetch(event.request);
    })
  );
});