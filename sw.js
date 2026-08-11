/* ============================================================================
   Mandala Atelier – Service Worker

   WICHTIG: Bei jedem Release die Cache-Version erhöhen. Sonst zeigt das iPad
   weiter die alte Fassung, auch wenn die Dateien längst neu sind.
   ========================================================================== */

const CACHE = 'mandala-atelier-v1-8';

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
          /* Nur die eigenen alten Fassungen wegräumen. Unter derselben
             Adresse liegt in /atelier3/ die Schwester-App „Blatt“; ein
             pauschales Aufräumen würde ihr bei jedem Release hier den
             Offline-Vorrat löschen. */
          if (key === CACHE) return null;
          return key.indexOf('mandala-atelier-') === 0 ? caches.delete(key) : null;
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

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Der Geltungsbereich dieses Workers schließt /atelier3/ mit ein, weil er
     eine Ebene darüber liegt. Die Schwester-App hat aber ihren eigenen
     Worker und ihren eigenen Vorrat – hier nichts anfassen, sonst lägen
     ihre Dateien doppelt und veralteten unbemerkt. */
  if (url.pathname.indexOf('/atelier3/') !== -1) return;

  /* PA-APPS.html ist die Arbeitsseite: Preise, Texte und Beispielbilder
     ändern sich dort laufend. Erst-Cache-dann-Netz würde genau das
     einfrieren – wer die Adresse weitergegeben hat, bekäme wochenlang den
     alten Stand zu sehen, ohne dass es jemandem auffällt. Deshalb hier
     nichts anfassen: Die Seite gehört nicht zur App und muss nicht ohne
     Netz laufen. */
  if (url.pathname.indexOf('/PA-APPS.html') !== -1) return;
  if (url.pathname.indexOf('/pa-apps/') !== -1) return;

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
