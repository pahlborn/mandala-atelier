/* ============================================================================
   Atelier 3.0 – Service Worker

   Eigener Geltungsbereich (/atelier3/) und eigener Cache-Name. Beides ist
   zwingend: Ohne das griffe diese App dem Mandala Atelier in den Cache, und
   auf dem iPad läge am Ende nur noch eine der beiden im Speicher. Für den
   Vergleich müssen sie sich vollständig aus dem Weg gehen.

   WICHTIG: Bei jedem Release die Version erhöhen.
   ========================================================================== */

const CACHE = 'atelier3-v1-19';

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

/* Jeder Abruf am HTTP-Vorrat des Browsers vorbei.

   Das war der zweite, größere Teil des Fehlers, und er hat länger gebraucht
   als er sollte. GitHub Pages liefert alles mit `Cache-Control: max-age=600`.
   Ein schlichtes fetch() aus dem Worker fragt zuerst den HTTP-Vorrat des
   Browsers — und bekommt zehn Minuten lang genau die alte Datei zurück, die
   gerade ersetzt werden soll. Das Auffrischen legte also die alte Fassung
   wieder in den Vorrat, und zwar bei jedem Öffnen aufs Neue. Zusammen mit
   dem HTTP-Vorrat für sw.js selbst (siehe `updateViaCache` in app.js) ergab
   das ein Gerät, das nie wieder etwas Neues sah.

   Nachgespielt mit echtem Browser, echtem Worker und denselben Kopfzeilen,
   die Pages schickt: viermal öffnen, viermal die alte Fassung. Mit
   `cache: 'reload'` kommt sie beim zweiten Öffnen an. */
function vomNetz(request) {
  return fetch(new Request(request, { cache: 'reload' }));
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return Promise.all(SHELL.map(function (pfad) {
          const request = new Request(new URL(pfad, self.location.href).href,
                                      { cache: 'reload' });
          return fetch(request).then(function (response) {
            if (response && response.status === 200) return cache.put(request, response);
          });
        }));
      })
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
   Bilder. Es geht hier also nur um die eigenen Dateien.

   Ausgeliefert wird sofort aus dem Vorrat, damit die App auch ohne Netz und
   ohne Warten startet. Im Hintergrund wird trotzdem nachgesehen, ob es etwas
   Neueres gibt, und der Vorrat aufgefrischt: Beim nächsten Öffnen liegt dann
   die neue Fassung da.

   Das ist ausdrücklich eine Absicherung gegen den eigenen Leichtsinn. Vorher
   galt „erst Vorrat, sonst Netz“, und der Vorrat wurde nur beim Wechsel der
   Cache-Version erneuert. Wird der Wechsel einmal vergessen – und genau das
   ist zweimal hintereinander passiert –, bleibt ein Gerät für immer auf der
   alten Fassung stehen: Der Worker selbst hat sich ja nicht geändert, also
   installiert der Browser auch nichts nach. Ein stiller Fehler, den man auf
   dem Schreibtisch nie sieht, weil dort kein Worker läuft.

   Die Cache-Version bei jedem Release trotzdem erhöhen – sie räumt auf und
   sorgt dafür, dass die neue Fassung sofort und nicht erst beim übernächsten
   Start ankommt. */
self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(function (hit) {
      const fresh = vomNetz(request)
        .then(function (response) { return store(request, response); })
        .catch(function () { return hit; });

      /* Das Nachladen muss den Worker am Leben halten, sonst bricht es ab,
         sobald die Antwort aus dem Vorrat draußen ist. */
      if (hit) { event.waitUntil(fresh.catch(function () {})); return hit; }
      return fresh;
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
