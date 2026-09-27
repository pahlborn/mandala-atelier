'use strict';

/* ============================================================================
   Die Fassungsmeldung prüfen.

     node tools/test-fassungsmeldung.js

   Fünf Haken, alle im echten Browser über HTTP gemessen — über file:// ginge
   kein fetch und der Lauf prüfte nichts:

   1. AB WERK STILL. Ohne Zutun des Anwenders geht KEIN Abruf hinaus. Das ist
      der Haken, an dem die ganze Regeländerung hängt.
   2. Angeschaltet wird genau EINE Adresse geholt, und es ist fassung.json.
   3. Ist die gemeldete Nummer neuer, erscheint das Band. Ist sie gleich oder
      älter, erscheint es nicht.
   4. Ohne Netz passiert nichts und es erscheint kein Fehler.
   5. ?fassung=aus schaltet alles ab — sonst geriete das Band in jedes Bild,
      das die zehn Werkzeuge rendern.

   Jeder Haken ist so gebaut, dass er auch anschlagen KANN; ein Prüflauf, der
   das nicht tut, ist wertlos.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { launch } = require('./browser.js');

const ROOT = path.join(__dirname, '..');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp' };

/* Der Server darf die Fassungsdatei unterwegs ersetzen — so lässt sich eine
   neuere Fassung vortäuschen, ohne eine Datei anzufassen. */
let gefaelscht = null;
/* „kein Netz" wird nicht über setOffline nachgestellt: Das greift bei
   localhost nicht durch, der Abruf ging trotzdem hinaus und der Lauf bestand
   falsch. Stattdessen verweigert der Server die Datei - aus Sicht der App
   ist das derselbe Fall, und er ist verlässlich herstellbar. */
let kaputt = false;

function server() {
  return new Promise(function (ok) {
    const s = http.createServer(function (req, res) {
      const rein = decodeURIComponent(req.url.split('?')[0]);
      if (kaputt && /\/fassung\.json$/.test(rein)) {
        res.writeHead(503); return res.end('kein Netz');
      }
      if (gefaelscht && /\/fassung\.json$/.test(rein)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(gefaelscht));
      }
      const p = path.join(ROOT, path.normalize(rein).replace(/^(\.\.[/\\])+/, ''));
      const datei = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
      if (!fs.existsSync(datei)) { res.writeHead(404); return res.end('weg'); }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
      res.end(fs.readFileSync(datei));
    });
    s.listen(0, '127.0.0.1', function () { ok({ s: s, port: s.address().port }); });
  });
}

(async () => {
  const { s, port } = await server();
  const b = await launch();
  const basis = 'http://127.0.0.1:' + port + '/atelier3/';
  const befunde = [];

  /* Ein Durchgang: frischer Browserzustand, Schalter nach Wunsch, dann
     zählen, was hinausgeht und was zu sehen ist. */
  async function lauf(name, opt) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const raus = [], fehler = [];
    p.on('request', function (r) {
      const u = r.url();
      if (u.indexOf('http://127.0.0.1:' + port) !== 0) raus.push('FREMD ' + u);
      else if (/fassung\.json/.test(u)) raus.push(u.replace('http://127.0.0.1:' + port, ''));
    });
    p.on('pageerror', e => fehler.push(e.message));
    p.on('console', function (m) {
      /* „Failed to load resource" meldet der Browser selbst, wenn eine
         Anfrage scheitert - das ist nicht unsere Fehlermeldung und für den
         Anwender unsichtbar. Gezählt wird nur, was aus dem Code kommt. */
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text());
    });

    /* Im Offline-Lauf bleibt der Schalter beim Laden AUS - sonst pruefte die
       App beim Start noch mit Netz, das Band stuende schon da, und der Lauf
       meldete es hinterher als „Band ohne Netz". Erst laden, dann das Netz
       kappen, dann anschalten; schalten() prueft sofort. */
    if (opt.an && !opt.offline) {
      await p.goto(basis, { waitUntil: 'load' });
      await p.evaluate(function () { localStorage.setItem('atelier3-fassungsmeldung', 'an'); });
    }
    await p.goto(basis + (opt.zusatz || ''), { waitUntil: 'load' });
    if (opt.offline) {
      await p.waitForTimeout(1600);
      raus.length = 0;
      kaputt = true;
      await p.evaluate(function () { window.Blatt.FASSUNGSMELDUNG.schalten(true); });
    }
    await p.waitForTimeout(2600);
    const band = await p.evaluate(function () {
      const d = document.getElementById('fassungsband');
      return d ? d.textContent.replace(/\s+/g, ' ').trim() : null;
    }).catch(function () { return null; });
    await ctx.close();
    return { name: name, abrufe: raus.filter(u => /fassung\.json/.test(u)),
             fremd: raus.filter(u => u.indexOf('FREMD') === 0),
             band: band, fehler: fehler };
  }

  const hier = JSON.parse(fs.readFileSync(path.join(ROOT, 'atelier3', 'fassung.json'), 'utf8'));
  console.log('\nFassungsmeldung — Blatt ' + hier.fassung + '\n');

  /* 1 — ab Werk still */
  gefaelscht = null;
  let r = await lauf('ab Werk', { an: false });
  let ok1 = r.abrufe.length === 0 && r.fremd.length === 0 && !r.band;
  console.log('  ab Werk aus          ' + (ok1 ? 'kein Abruf, kein Band'
    : 'ABRUF TROTZ AUS: ' + r.abrufe.concat(r.fremd).join(', ')));
  if (!ok1) befunde.push('ab Werk');

  /* 2+3 — angeschaltet, neuere Fassung vorgetäuscht */
  gefaelscht = { fassung: '9.99', seit: '2099-01-01', was: 'Probefassung' };
  r = await lauf('neuer', { an: true });
  const ok2 = r.abrufe.length === 1 && r.fremd.length === 0;
  const ok3 = !!r.band && r.band.indexOf('9.99') >= 0;
  console.log('  angeschaltet         ' + (ok2 ? 'genau ein Abruf: ' + r.abrufe[0].split('?')[0]
    : r.abrufe.length + ' ABRUFE' + (r.fremd.length ? ' + FREMD' : '')));
  console.log('  neuere Fassung       ' + (ok3 ? 'Band da: „' + r.band + '"' : 'KEIN BAND'));
  if (!ok2) befunde.push('Abrufzahl');
  if (!ok3) befunde.push('Band fehlt');

  /* 3b — gleiche Nummer: kein Band */
  gefaelscht = { fassung: hier.fassung, seit: hier.seit, was: hier.was };
  r = await lauf('gleich', { an: true });
  const ok3b = !r.band;
  console.log('  gleiche Fassung      ' + (ok3b ? 'kein Band, richtig' : 'BAND OBWOHL GLEICH'));
  if (!ok3b) befunde.push('Band bei gleicher Nummer');

  /* 4 — ohne Netz */
  gefaelscht = { fassung: '9.99', seit: '2099-01-01', was: 'Probefassung' };
  r = await lauf('offline', { an: true, offline: true });
  kaputt = false;
  const ok4 = !r.band && r.fehler.length === 0 && r.abrufe.length === 1;
  console.log('  Abruf scheitert      ' + (ok4 ? 'versucht, gescheitert, nichts passiert'
    : (r.band ? 'BAND TROTZ FEHLSCHLAG'
      : (r.abrufe.length !== 1 ? 'gar nicht erst versucht' : 'FEHLERMELDUNG: ' + r.fehler[0]))));
  if (!ok4) befunde.push('ohne Netz');

  /* 5 — Abschalter für die Werkzeuge */
  r = await lauf('abgeschaltet', { an: true, zusatz: '?fassung=aus' });
  const ok5 = r.abrufe.length === 0 && !r.band;
  console.log('  ?fassung=aus         ' + (ok5 ? 'kein Abruf, kein Band' : 'GREIFT NICHT'));
  if (!ok5) befunde.push('?fassung=aus');

  /* 6 — die Regalfassung. Sie traegt den Block, aber stillgelegt: kein Abruf,
     kein Band, und vor allem kein Knopf, der den Vorrat der laufenden App
     raeumen koennte. Geprueft wird die NEUESTE eingefrorene Fassung, denn nur
     die hat den Block ueberhaupt. */
  const regalNr = fs.readdirSync(path.join(ROOT, 'v'))
    .filter(function (n) { return n.indexOf('3.') === 0 &&
      fs.existsSync(path.join(ROOT, 'v', n, 'app.js')) &&
      fs.readFileSync(path.join(ROOT, 'v', n, 'app.js'), 'utf8').indexOf('FASSUNGSMELDUNG') >= 0; })
    .sort(function (a, c) { return parseFloat(a) - parseFloat(c); }).pop();

  if (!regalNr) {
    console.log('  Regalfassung         keine mit Block vorhanden — Haken übersprungen');
    befunde.push('Regalfassung fehlt');
  } else {
    gefaelscht = { fassung: '9.99', seit: '2099-01-01', was: 'Probefassung' };
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const raus = [];
    p.on('request', function (r) { if (/fassung\.json/.test(r.url())) raus.push(r.url()); });
    await p.goto('http://127.0.0.1:' + port + '/v/' + regalNr + '/', { waitUntil: 'load' });
    /* Erst hochfahren lassen: window.Blatt entsteht am Ende des Startlaufs.
       Ohne das Warten meldete der Haken „kein Modul" statt „stillgelegt". */
    await p.waitForFunction('window.Blatt && window.Blatt.FASSUNGSMELDUNG', null,
                            { timeout: 8000 }).catch(function () {});
    const zustand = await p.evaluate(function () {
      /* Anschalten VERSUCHEN - und zwar so, wie der Knopf im Fach es täte. */
      try { localStorage.setItem('atelier3-fassungsmeldung', 'an'); } catch (e) {}
      const M = window.Blatt && window.Blatt.FASSUNGSMELDUNG;
      if (M) { M.schalten(true); M.sehen(true); }
      return { erlaubt: M ? M.erlaubt() : null, hatModul: !!M };
    });
    await p.waitForTimeout(2200);
    const band = await p.evaluate(function () { return !!document.getElementById('fassungsband'); });
    await ctx.close();
    const ok6 = zustand.hatModul && zustand.erlaubt === false && raus.length === 0 && !band;
    console.log('  Regalfassung ' + regalNr.padEnd(8) +
      (ok6 ? 'stillgelegt: kein Abruf, kein Band, erlaubt() falsch'
           : 'NICHT STILLGELEGT — Abrufe: ' + raus.length + ', Band: ' + band +
             ', erlaubt: ' + zustand.erlaubt));
    if (!ok6) befunde.push('Regalfassung');
  }

  await b.close(); s.close();
  console.log('\n' + (befunde.length ? '  ' + befunde.length + ' Befund(e): ' + befunde.join(', ')
                                     : '  Fassungsmeldung in Ordnung.') + '\n');
  process.exit(befunde.length ? 1 : 0);
})();
