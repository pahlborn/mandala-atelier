'use strict';

/* ============================================================================
   Testlauf für das Fassungsregal unter /v/.

     npm run test:regal

   Ein Regal, das nur so aussieht, als stünden dort alte Fassungen, wäre
   schlimmer als keines: Man vergliche zwei Dinge und hielte das Ergebnis für
   einen Befund. Geprüft wird deshalb an echten Fassungen im echten Browser:

     * Eine eingefrorene Fassung läuft überhaupt.
     * Sie meldet **keinen** Service Worker an. Täte sie es, löschte ihr
       `activate` den Offline-Vorrat der laufenden App – ein Regal, das die
       Wohnung anzündet.
     * Sie schreibt in einen **eigenen** Speicher. Täte sie es nicht, schöbe
       sie einem bemalten Blatt einen fremden Grundriss unter: Dieselbe Seed,
       ein anderer Generator, dasselbe Fach.
     * Sie sagt sichtbar, dass sie aus dem Regal kommt.
     * Und sie ist wirklich alt: 3.2 muss die Griffkurve von damals tragen,
       3.13 die von heute. Genau dieser Unterschied ist der Grund für das
       ganze Regal.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');

const befunde = [];
function prüfe(name, ok, notiz) {
  console.log((ok ? '  ok    ' : '  FEHLT ') + name.padEnd(46) + (notiz || ''));
  if (!ok) befunde.push(name);
}

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

function server() {
  return new Promise(function (fertig) {
    const s = http.createServer(function (req, res) {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const datei = path.join(ROOT, p);
      if (datei.indexOf(ROOT) !== 0 || !fs.existsSync(datei)) {
        res.writeHead(404); res.end('weg'); return;
      }
      res.writeHead(200, {
        'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream'
      });
      res.end(fs.readFileSync(datei));
    });
    s.listen(0, '127.0.0.1', function () {
      fertig({ url: 'http://127.0.0.1:' + s.address().port, zu: function () { s.close(); } });
    });
  });
}

(async function () {
  const srv = await server();
  const browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log('\nDas Fassungsregal\n');

  const fächer = fs.readdirSync(path.join(ROOT, 'v'))
    .filter(function (n) { return /^\d+\.\d+$/.test(n); });
  const blatt = fächer.filter(function (n) { return n[0] === '3'; });
  const atelier = fächer.filter(function (n) { return n[0] === '2'; });
  prüfe('das Regal ist gefüllt', blatt.length >= 10 && atelier.length >= 10,
        atelier.length + ' Fassungen Atelier, ' + blatt.length + ' Blatt');

  /* Kein Fach darf Schriften oder Symbole doppeln – das war der Unterschied
     zwischen 350 kB und 23 MB. */
  const doppelt = fächer.filter(function (n) {
    return fs.existsSync(path.join(ROOT, 'v', n, 'fonts.css')) ||
           fs.existsSync(path.join(ROOT, 'v', n, 'icon-192.png'));
  });
  prüfe('kein Fach doppelt Schriften oder Symbole', doppelt.length === 0,
        doppelt.length ? doppelt.join(', ') : 'nur das, was das Verhalten ausmacht');

  const öffne = async function (nummer) {
    const fehler = [];
    page.on('pageerror', function (e) { fehler.push(String(e)); });
    await page.goto(srv.url + '/v/' + nummer + '/index.html');
    const app = nummer[0] === '3' ? 'window.Blatt' : 'window.MandalaAtelier';
    await page.waitForFunction(app, null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const stand = await page.evaluate(async function () {
      const regs = await navigator.serviceWorker.getRegistrations();
      const banner = document.body.firstElementChild;
      return {
        worker: regs.map(function (r) { return r.scope; }),
        banner: banner ? (banner.textContent || '').slice(0, 60) : '',
        griff: window.Blatt && window.Blatt.griff ? window.Blatt.griff() : null,
        quelle: document.documentElement.outerHTML.length
      };
    });
    stand.fehler = fehler;
    return stand;
  };

  /* 3.2 – die Fassung, an die eine Erinnerung hing und die es beinahe nicht
     mehr gegeben hätte. */
  console.log('');
  const alt = await öffne('3.2');
  prüfe('eine alte Fassung läuft', alt.fehler.length === 0,
        alt.fehler[0] || 'Blatt 3.2 startet ohne Fehler');
  prüfe('sie meldet keinen Service Worker an', alt.worker.length === 0,
        alt.worker.length ? alt.worker.join(', ') : 'kein Worker – wie vorgesehen');
  prüfe('sie sagt, dass sie aus dem Regal kommt', /Regal/.test(alt.banner),
        alt.banner.replace(/\s+/g, ' ').trim());

  /* Der Speicher. Gemessen wird an dem, was der Browser wirklich angelegt
     hat – nicht daran, was im Quelltext steht. */
  const speicher = await page.evaluate(async function () {
    const namen = (await indexedDB.databases()).map(function (d) { return d.name; });
    const keys = Object.keys(localStorage);
    return { db: namen, keys: keys };
  });
  prüfe('sie schreibt in einen eigenen Speicher',
        speicher.db.every(function (n) { return /regal/.test(n); }) &&
        speicher.keys.every(function (k) { return /regal/.test(k); }),
        'Datenbanken: ' + (speicher.db.join(', ') || 'noch keine') +
        ' · Schlüssel: ' + (speicher.keys.join(', ') || 'noch keine'));

  const neu = await öffne('3.13');
  prüfe('die laufende Fassung steht ebenfalls im Regal', neu.fehler.length === 0,
        'Blatt 3.13');

  /* Und der Kern: Trägt das Regal wirklich verschiedene Fassungen?

     Gelesen wird die Griffkurve aus dem eingefrorenen Quelltext, nicht aus
     dem Fenster: Die alten Fassungen exportieren `griff()` noch gar nicht —
     es kam erst mit 3.6, zusammen mit dem Vergleich selbst.

     Geprüft werden drei Punkte, und zusammen erzählen sie die ganze
     Geschichte: 3.2 hatte die zeichnende Kurve, 3.7 hatte sie verloren, und
     3.13 hat sie zurück. Ohne das Regal wäre das eine Behauptung. */
  const kurve = function (nummer) {
    const quelle = fs.readFileSync(path.join(ROOT, 'v', nummer, 'app.js'), 'utf8');
    const g = quelle.match(/zeichnend:\s*\{\s*light:\s*([\d.]+)/);
    if (g) {
      const vor = quelle.match(/GRIFF_VOREINSTELLUNG = '(\w+)'/);
      if (vor && vor[1] === 'zeichnend') return Number(g[1]);
    }
    const m = quelle.match(/(?:const|let)\s+GAMMA_LIGHT\s*=\s*([\d.]+)/);
    return m ? Number(m[1]) : null;
  };

  const punkte = { '3.2': kurve('3.2'), '3.7': kurve('3.7'), '3.13': kurve('3.13') };
  console.log('');
  Object.keys(punkte).forEach(function (n) {
    console.log('  Blatt ' + n.padEnd(6) + 'GAMMA_LIGHT ' + punkte[n]);
  });
  prüfe('3.2 trägt die zeichnende Kurve', punkte['3.2'] === 3.6,
        'GAMMA_LIGHT ' + punkte['3.2']);
  prüfe('3.7 hatte sie verloren', punkte['3.7'] === 2.0,
        'GAMMA_LIGHT ' + punkte['3.7']);
  prüfe('3.13 hat sie zurück', punkte['3.13'] === 3.6,
        'GAMMA_LIGHT ' + punkte['3.13']);

  await browser.close();
  srv.zu();

  console.log('');
  if (befunde.length) {
    befunde.forEach(function (f) { console.log('  FEHLT ' + f); });
    process.exit(1);
  }
  console.log('  Das Regal trägt.');
})();
