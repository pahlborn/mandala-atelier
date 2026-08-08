/* ============================================================================
   Mandala Atelier – Service Worker

   WICHTIG: Bei jedem Release die Cache-Version erhöhen. Sonst zeigt das iPad
   weiter die alte Fassung, auch wenn die Dateien längst neu sind.
   ========================================================================== */

const CACHE = 'mandala-atelier-v1-1';

const SHELL = [
  './',
  './index.html',
  './fonts.css',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-72.png',
  './icon-120.png',
  './icon-152.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return key === CACHE ? null : caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* Die App holt nichts von außen – Schriften stecken als Daten-URI in
   fonts.css. Deshalb genügt hier ein Weg: erst Cache, dann Netz. */
self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(function (hit) {
      return hit || fetch(request).then(function (response) {
        return store(request, response);
      });
    })
  );
});

function store(request, response) {
  if (response && response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
  }
  return response;
}
