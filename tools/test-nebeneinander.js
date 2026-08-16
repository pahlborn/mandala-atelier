'use strict';

/* ============================================================================
   Prüft, ob sich die beiden Apps unter derselben Adresse aus dem Weg gehen.

     npm install
     node tools/test-nebeneinander.js

   Beide liegen auf GitHub Pages unter einem Origin: das Mandala Atelier im
   Wurzelverzeichnis, „Blatt“ in /atelier3/. Der Service Worker der ersten
   liegt damit eine Ebene über der zweiten, und sein Geltungsbereich schließt
   sie mit ein. Daraus folgen zwei Gefahren, und genau die werden hier
   geprüft:

     1. Das Aufräumen alter Caches beim Aktivieren darf nur die eigenen
        treffen. Vorher traf es alle – bei jedem Release des Mandala Ateliers
        wäre Blatt der Offline-Vorrat gelöscht worden.

     2. Der Worker der ersten App darf Abrufe unter /atelier3/ nicht in den
        eigenen Vorrat ziehen. Sonst lägen die Dateien der zweiten App
        doppelt und veralteten unbemerkt.

     3. Eine neue Fassung von Blatt muss auf dem Gerät ankommen, auch wenn
        die Cache-Version einmal zu erhöhen vergessen wurde. Genau das ist
        zweimal passiert, und das Gerät blieb stumm auf der alten Fassung
        stehen – ein Fehler, den man auf dem Schreibtisch nie sieht, weil
        dort kein Worker läuft.

   Dafür braucht es einen echten Origin – über file:// gibt es keine Service
   Worker. Der Testlauf startet deshalb kurz einen winzigen Dateiserver.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const FREMD = 'atelier3-fremder-vorrat';

/* Zehn Minuten vergehen lassen: den HTTP-Vorrat des Browsers leeren. Die
   Sitzung hängt an einer Seite, also jedes Mal neu – die alte ist zu. */
async function zehnMinuten(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await cdp.detach();
}

/* Die App wirklich schließen und wieder öffnen. */
async function neuOeffnen(context, alt, url) {
  await alt.close();
  const neu = await context.newPage();
  await neu.goto(url);
  return neu;
}

const befunde = [];
function prüfe(name, ok, notiz) {
  console.log((ok ? '  ok    ' : '  FEHLT ') + pad(name, 44) + (notiz || ''));
  if (!ok) befunde.push(name);
}

async function run() {
  /* Der Server hängt sw.js beim zweiten Abruf einen Kommentar an. Das ändert
     die Datei byteweise und zwingt den Browser zu einer Neufassung des
     Workers – nur so lässt sich das Aufräumen beim Aktivieren auslösen. */
  let swAbrufe = 0;
  let frischeFassung = false;
  let frischeSeite = false;
  const server = await startServer(function (rel, body) {
    if (rel === 'sw.js') {
      swAbrufe++;
      if (swAbrufe > 1) return body + '\n/* Neufassung ' + swAbrufe + ' */\n';
    }
    /* Eine neue Fassung von Blatt, ohne dass die Cache-Version steigt. */
    if (rel === 'atelier3/app.js' && frischeFassung) {
      return body + '\nwindow.__frischeFassung = true;\n';
    }
    /* Eine neue Fassung des Ateliers, ebenfalls ohne Versionswechsel. Das
       fehlte lange: Der Worker der App frischte nicht auf, und Änderungen
       kamen auf dem iPad schlicht nie an. */
    if (rel === 'app.js' && frischeFassung) {
      return body + '\nwindow.__frischesAtelier = true;\n';
    }
    /* Und eine geänderte Werkstattseite – sie muss sofort ankommen. */
    if (rel === 'beide.html' && frischeSeite) {
      return String(body).replace('</main>', '<p id="frisch">neu</p></main>');
    }
    return body;
  });

  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  let page = await context.newPage();

  console.log('Zwei Apps, ein Origin\n');

  try {
    /* ---- Beide Apps einmal öffnen, damit beide Worker laufen ------------ */
    await page.goto(server.url + '/index.html');
    await page.waitForFunction('navigator.serviceWorker.controller !== null', { timeout: 15000 });

    /* Beim allerersten Besuch von Blatt ist der Worker des Ateliers schon
       aktiv und kontrolliert die Seite mit – sein Geltungsbereich liegt
       eine Ebene darüber. Erst wenn der eigene Worker installiert ist und
       clients.claim() ruft, übernimmt er. Das darf einen Moment dauern;
       gemessen wird, ob es überhaupt passiert. */
    await page.goto(server.url + '/atelier3/index.html');
    await page.waitForFunction('window.Blatt && window.Blatt.sheet.relief');

    let wer = '(keiner)';
    try {
      await page.waitForFunction(function () {
        const c = navigator.serviceWorker.controller;
        return c !== null && /\/atelier3\/sw\.js$/.test(c.scriptURL);
      }, null, { timeout: 15000 });
      wer = 'atelier3/sw.js';
    } catch (err) {
      wer = await page.evaluate(function () {
        const c = navigator.serviceWorker.controller;
        return c ? c.scriptURL.replace(/^https?:\/\/[^/]+/, '') : '(keiner)';
      });
    }
    prüfe('Blatt übernimmt der eigene Worker', wer === 'atelier3/sw.js', wer);

    /* ---- Kommt eine neue Fassung an, auch ohne Versionswechsel? --------- */
    frischeFassung = true;

    /* Zehn Minuten vergehen lassen: der HTTP-Vorrat des Browsers läuft ab.
       Ohne diesen Schritt kommt überhaupt nichts an, und das ist kein Mangel
       des Tests, sondern die Wirklichkeit — nachgemessen mit echtem Browser. */
    await zehnMinuten(context, page);

    /* Und wirklich **öffnen**, nicht neu laden. Ein reload() bekommt das
       Skript aus dem Arbeitsspeicher des Renderers, noch vor dem Worker —
       der Testlauf sähe die neue Fassung dann selbst dann nicht, wenn sie
       längst im Vorrat liegt. Auf dem iPad entspricht das dem Unterschied
       zwischen „App wieder hervorholen“ und „App wirklich beenden“. */
    page = await neuOeffnen(context, page, server.url + '/atelier3/index.html');
    await page.waitForFunction('window.Blatt && window.Blatt.sheet.relief');
    const nochAlt = await page.evaluate(function () {
      return window.__frischeFassung === true;
    });
    /* Erwartet: noch die alte Fassung, sofort aus dem Vorrat. Im Hintergrund
       wird jetzt nachgeladen. */
    await page.waitForTimeout(1500);

    page = await neuOeffnen(context, page, server.url + '/atelier3/index.html');
    await page.waitForFunction('window.Blatt && window.Blatt.sheet.relief');
    const jetztNeu = await page.evaluate(function () {
      return window.__frischeFassung === true;
    });
    prüfe('neue Fassung von Blatt kommt ohne Versionswechsel an', jetztNeu,
          nochAlt ? 'schon beim ersten Neuladen' : 'beim zweiten Öffnen');

    /* Dasselbe für das Atelier. Beide Worker müssen das können – dass es
       nur einer konnte, hat gekostet: Fünf neue Vorlagen lagen ausgeliefert
       auf dem Server und waren auf dem Gerät trotzdem nicht zu sehen. */
    await zehnMinuten(context, page);
    page = await neuOeffnen(context, page, server.url + '/index.html');
    await page.waitForFunction('window.MandalaAtelier');
    await page.waitForTimeout(1500);
    page = await neuOeffnen(context, page, server.url + '/index.html');
    await page.waitForFunction('window.MandalaAtelier');
    const atelierNeu = await page.evaluate(function () {
      return window.__frischesAtelier === true;
    });
    prüfe('neue Fassung des Ateliers kommt ohne Versionswechsel an', atelierNeu,
          atelierNeu ? 'beim zweiten Öffnen' : 'sie kam nie an – siehe fetch in sw.js');
    page = await neuOeffnen(context, page, server.url + '/atelier3/index.html');
    await page.waitForFunction('window.Blatt');
    prüfe('der Start bleibt sofort und offlinefähig', !nochAlt,
          nochAlt ? 'es wurde aufs Netz gewartet' : 'erst Vorrat, dann auffrischen');

    /* ---- Zieht der Worker des Ateliers fremde Dateien in seinen Vorrat? -- */
    const inhalt = await page.evaluate(async function () {
      const namen = await caches.keys();
      const out = {};
      for (const name of namen) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        out[name] = keys.map(function (r) { return new URL(r.url).pathname; });
      }
      return out;
    });

    const atelierCache = Object.keys(inhalt).filter(function (k) {
      return k.indexOf('mandala-atelier-') === 0;
    });
    const blattCache = Object.keys(inhalt).filter(function (k) {
      return k.indexOf('atelier3-') === 0;
    });

    prüfe('beide Vorräte liegen nebeneinander',
          atelierCache.length === 1 && blattCache.length === 1,
          [].concat(atelierCache, blattCache).join(' + '));

    const eingeschleppt = atelierCache.length
      ? inhalt[atelierCache[0]].filter(function (p) { return p.indexOf('/atelier3/') !== -1; })
      : [];
    prüfe('Atelier fasst /atelier3/ nicht an',
          eingeschleppt.length === 0,
          eingeschleppt.slice(0, 3).join(' '));

    /* ---- Überlebt ein fremder Vorrat die Neufassung des Ateliers? -------- */
    await page.evaluate(async function (name) {
      const cache = await caches.open(name);
      await cache.put(new Request('./marke.txt'), new Response('bleibt'));
    }, FREMD);

    /* Zurück auf das Atelier und den Worker erneuern lassen. Der Server
       liefert jetzt eine geänderte sw.js, also läuft install + activate. */
    await page.goto(server.url + '/index.html');
    await page.evaluate(async function () {
      const reg = await navigator.serviceWorker.getRegistration('./');
      await reg.update();
    });
    await page.waitForTimeout(1500);

    const überlebt = await page.evaluate(function (name) {
      return caches.has(name);
    }, FREMD);
    prüfe('fremder Vorrat überlebt das Aufräumen', überlebt,
          überlebt ? '' : 'wurde gelöscht – siehe activate in sw.js');
    prüfe('sw.js wurde wirklich neu geholt', swAbrufe > 1, swAbrufe + ' Abrufe');

    /* Die Einstiegsseite. Sie führt zu beiden Apps und zusätzlich zu den
       zwei Fassungen des Farbauftrags in Blatt. Geprüft wird nicht, wie sie
       aussieht, sondern dass die Aufrufe wirklich irgendwo ankommen: Ein
       Anhängsel in einer Adresse ist genau die Sorte Sache, die still
       verlorengeht – beim Umbenennen, beim Aufräumen, beim Verschieben. */
    await page.goto(server.url + '/beide.html');
    const seite = await page.evaluate(function () {
      const ziel = function (sel) {
        const a = document.querySelector(sel);
        return a ? a.getAttribute('href') : null;
      };
      const proben = Array.from(document.querySelectorAll('.probe'))
        .map(function (a) { return a.getAttribute('href'); });
      const apple = ziel('link[rel="apple-touch-icon"]');
      return {
        atelier: ziel('.app[href*="index.html"]'),
        blatt: ziel('.app[href*="atelier3"]'),
        proben: proben,
        apple: apple,
        breiter: document.documentElement.scrollWidth >
                 document.documentElement.clientWidth + 1
      };
    });
    seite.appleDa = seite.apple
      ? (await page.request.get(server.url + '/' + seite.apple)).status()
      : 0;
    prüfe('die Einstiegsseite führt zu beiden Apps',
          !!seite.atelier && !!seite.blatt);
    prüfe('sie führt zu beiden Fassungen des Auftrags',
          seite.proben.length === 2 &&
          seite.proben.some(function (h) { return h.indexOf('griff=zart') !== -1; }) &&
          seite.proben.some(function (h) { return h.indexOf('griff=jetzt') !== -1; }),
          seite.proben.join(' · '));
    prüfe('sie ragt nicht seitlich heraus', !seite.breiter);
    /* Ohne apple-touch-icon legt iOS ein Bildschirmfoto auf den Homescreen.
       Und es muss ein eigenes sein: Drei nicht unterscheidbare Symbole
       nebeneinander wären schlimmer als zwei. */
    prüfe('die Einstiegsseite bringt ein eigenes Symbol mit',
          !!seite.apple && seite.apple.indexOf('beide-icon') !== -1 &&
          seite.appleDa === 200,
          seite.apple + ' → HTTP ' + seite.appleDa);

    /* Und der Kern: Kommt hinter dem Aufruf auch wirklich eine andere
       Fassung heraus? Ein Anhängsel, das niemand liest, wäre schlimmer als
       keines – es sähe nach einem Vergleich aus, ohne einer zu sein. */
    const fassungen = {};
    for (const href of seite.proben) {
      await page.goto(server.url + '/' + href.replace(/^\.\//, ''));
      await page.waitForFunction('window.Blatt');
      const g = await page.evaluate(function () { return window.Blatt.griff(); });
      fassungen[href.indexOf('zart') !== -1 ? 'zart' : 'jetzt'] = g;
    }
    /* Die Werkstattseite gehört keinem Release an: Wer sie ändert, erhöht
       keine Cache-Version. Sie muss deshalb beim nächsten Öffnen neu da
       sein – ohne zweites Öffnen, ohne Versionswechsel. Genau das ging
       lange schief, weil der Worker jede je abgerufene Datei ablegte und
       danach ewig aus dem Vorrat bediente. */
    frischeSeite = true;
    await page.goto(server.url + '/beide.html');
    const sofort = await page.evaluate(function () {
      return !!document.getElementById('frisch');
    });
    prüfe('eine geänderte Werkstattseite kommt sofort an', sofort,
          sofort ? 'erst Netz, dann Vorrat' : 'sie kam aus dem Vorrat');

    prüfe('hinter den Aufrufen stehen zwei Fassungen',
          fassungen.zart && fassungen.jetzt &&
          fassungen.zart.light > fassungen.jetzt.light &&
          fassungen.zart.base < fassungen.jetzt.base,
          'zart ' + fassungen.zart.light + '/' + fassungen.zart.base +
          ', jetzt ' + fassungen.jetzt.light + '/' + fassungen.jetzt.base);

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (befunde.length
    ? befunde.length + ' Befund(e): ' + befunde.join(', ')
    : 'Die beiden Apps gehen einander aus dem Weg.'));
  process.exitCode = befunde.length ? 1 : 0;
}

function startServer(verändere) {
  const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png'
  };
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      let file = path.join(ROOT, rel);
      /* Verzeichnisse wie GitHub Pages behandeln: Beide Service Worker haben
         './' in ihrem Vorrat, und ein 404 darauf ließe cache.addAll()
         scheitern – der Worker würde nie aktiv, und der Test liefe ins
         Leere statt einen echten Befund zu melden. */
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      if (file.indexOf(ROOT) !== 0 || !fs.existsSync(file)) {
        res.writeHead(404); res.end('nicht da'); return;
      }
      const body = verändere(rel, fs.readFileSync(file));
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        /* Genau die Kopfzeile, die GitHub Pages schickt.

           Hier stand `no-store`, und das war der Grund, warum dieser Testlauf
           grün blieb, während auf dem iPad tagelang die alte Fassung stand:
           Ohne HTTP-Vorrat des Browsers holt jedes fetch() im Worker wirklich
           vom Netz. Mit `max-age=600` bekommt es zehn Minuten lang genau die
           alte Datei zurück, die ersetzt werden soll — und legt sie wieder in
           den Vorrat. Ein Testlauf, der gutmütiger misst als die Wirklichkeit,
           ist schlimmer als keiner. */
        'Cache-Control': 'max-age=600'
      });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', function () {
      resolve({
        url: 'http://127.0.0.1:' + server.address().port,
        close: function () { server.close(); }
      });
    });
  });
}

function pad(text, width) {
  text = String(text);
  return text.length >= width ? text + '  ' : text + ' '.repeat(width - text.length);
}

run().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
