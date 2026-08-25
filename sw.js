/* ============================================================================
   Mandala Atelier – Service Worker

   WICHTIG: Bei jedem Release die Cache-Version erhöhen. Sonst zeigt das iPad
   weiter die alte Fassung, auch wenn die Dateien längst neu sind.
   ========================================================================== */

const CACHE = 'mandala-atelier-v1-27';

const SHELL = [
  './',
  './index.html',
  './fonts.css',
  './style.css',
  './app.js',
  './sprache.js',
  './manifest.webmanifest',
  './icon-72.png',
  './icon-120.png',
  './icon-152.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

/* Jeder Abruf am HTTP-Vorrat des Browsers vorbei.

   GitHub Pages liefert alles mit `Cache-Control: max-age=600`. Ein schlichtes
   fetch() aus dem Worker fragt zuerst den HTTP-Vorrat des Browsers und bekommt
   zehn Minuten lang genau die alte Datei zurück, die gerade ersetzt werden
   soll — das Auffrischen legte also die alte Fassung wieder in den Vorrat.
   Zusammen mit dem HTTP-Vorrat für sw.js selbst (siehe `updateViaCache` in
   app.js) ergab das ein Gerät, das nie wieder etwas Neues sah. Aufgefallen
   ist es an Blatt; hier stand derselbe Fehler. */
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

  /* Werkstattseiten: erst Netz, dann Vorrat.

     Das war ein echter Fehler und hat jemanden eine Stunde gekostet. Der Weg
     unten lautet „erst Vorrat, dann Netz“ – und store() legt *jede* je
     abgerufene Datei ab, nicht nur den Vorrat aus SHELL. Damit landete auch
     beide.html im Cache und wurde von da an ewig von dort bedient. Wer die
     Seite ändert, sieht die Änderung nie: Sie steht in keiner SHELL-Liste,
     also denkt niemand daran, dafür die Cache-Version zu erhöhen, und selbst
     wer es tut, ist auf ein Gerät angewiesen, das den Worker auch wirklich
     erneuert.

     Für die App bleibt es beim alten Weg – ihr Start soll sofort kommen, und
     ihre Dateien hängen alle an der Cache-Version. Für Seiten, die sich
     unabhängig davon ändern, gilt das Gegenteil. Offline bleiben sie
     erreichbar, nur eben in der Fassung von zuletzt. */
  if (istWerkstatt(url.pathname)) {
    event.respondWith(
      vomNetz(request)
        .then(function (response) { return store(request, response); })
        .catch(function () {
          return caches.match(request).then(function (hit) {
            return hit || Response.error();
          });
        })
    );
    return;
  }

  /* Erst Vorrat, dann Netz – und **immer** im Hintergrund auffrischen.

     Das Auffrischen fehlte hier, und das war der eigentliche Fehler: Ohne
     es kommt eine neue Fassung nur an, wenn sich die Cache-Version ändert
     *und* das Gerät den Worker auch wirklich erneuert. Auf dem iPad ist das
     zweite nicht verlässlich – Safari sieht Monate später noch die alte App.
     Blatt macht es seit seiner ersten Fassung richtig; hier stand es falsch,
     und deshalb kamen dort Änderungen an und hier nicht.

     Der Start bleibt trotzdem sofort und offlinefähig: Ausgeliefert wird der
     Vorrat, das Netz läuft daneben. Die neue Fassung ist beim nächsten
     Öffnen da. */
  event.respondWith(
    caches.match(request).then(function (hit) {
      const frisch = vomNetz(request)
        .then(function (response) { return store(request, response); })
        .catch(function () { return hit; });

      /* Das Nachladen muss den Worker am Leben halten, sonst bricht es ab,
         sobald die Antwort aus dem Vorrat draußen ist. */
      if (hit) { event.waitUntil(frisch.catch(function () {})); return hit; }
      return frisch;
    })
  );
});

/* Alles, was nicht die App selbst ist: die Einstiegsseite und die Papiere
   unter docs/. Sie gehören keinem Release an. */
function istWerkstatt(pfad) {
  return /(^|\/)beide\.html$/.test(pfad) || pfad.indexOf('/docs/') !== -1;
}

function store(request, response) {
  if (response && response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
  }
  return response;
}
