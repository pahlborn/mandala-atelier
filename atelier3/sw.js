/* ============================================================================
   Atelier 3.0 – Service Worker

   Eigener Geltungsbereich (/atelier3/) und eigener Cache-Name. Beides ist
   zwingend: Ohne das griffe diese App dem Mandala Atelier in den Cache, und
   auf dem iPad läge am Ende nur noch eine der beiden im Speicher. Für den
   Vergleich müssen sie sich vollständig aus dem Weg gehen.

   WICHTIG: Bei jedem Release die Version erhöhen.
   ========================================================================== */

const CACHE = 'atelier3-v1-0';

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
          /* Nur die eigenen alten Fassungen wegräumen – der Cache der
             Schwester-App geht uns nichts an. */
          if (key === CACHE) return null;
          return key.indexOf('atelier3-') === 0 ? caches.delete(key) : null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* Diese App holt nichts von außen – keine Schriften, keine Klänge, keine
   Bilder. Deshalb genügt ein Weg: erst Cache, dann Netz. */
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
