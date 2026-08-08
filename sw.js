/* ============================================================================
   Mandala Atelier – Service Worker

   WICHTIG: Bei jedem Release die Cache-Version erhöhen. Sonst zeigt das iPad
   weiter die alte Fassung, auch wenn die Dateien längst neu sind.
   ========================================================================== */

const CACHE = 'mandala-atelier-v1-0';

const SHELL = [
  './',
  './index.html',
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

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isFont = url.hostname === 'fonts.googleapis.com' ||
                 url.hostname === 'fonts.gstatic.com';

  /* Eigene Dateien: erst Cache, dann Netz. Die App soll offline starten. */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(function (hit) {
        return hit || fetch(request).then(function (response) {
          return store(request, response);
        });
      })
    );
    return;
  }

  /* Schriften: die einzige externe Ressource. Beim ersten Laden ablegen,
     danach aus dem Cache – so kommt die App auch ohne Netz zurecht. */
  if (isFont) {
    event.respondWith(
      caches.match(request).then(function (hit) {
        return hit || fetch(request).then(function (response) {
          return store(request, response);
        }).catch(function () {
          return hit || Response.error();
        });
      })
    );
  }
});

function store(request, response) {
  if (response && response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
  }
  return response;
}
