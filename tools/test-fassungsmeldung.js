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

   Dazu die Wege, die seit 3.24 dazugekommen sind:

   6. Beim allerersten Start wird EINMAL gefragt. Danach nie wieder.
   7. Still gestellt wird beim Fund nur GEMERKT, nicht geladen - niemand
      verliert sein Blatt mitten in der Arbeit.
   8. Beim nächsten Start wird das Gemerkte angewendet, und danach sagt ein
      Toast, dass es geklappt hat.

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

/* Beide Apps, damit keine ohne Haken bleibt. Sie unterscheiden sich in drei
   Dingen: wo sie liegen, wie ihre Speicherschlüssel heißen (Blatt schreibt
   roh, das Atelier über einen Store mit Präfix und JSON) und wie ihr
   öffentlicher Name lautet. */
const APPS = [
  { name: 'Blatt', pfad: '/atelier3/', global: 'Blatt', regal: '3.',
    setz: function (o) {
      if (o.an) localStorage.setItem('atelier3-fassungsmeldung', 'an');
      if (o.still) localStorage.setItem('atelier3-fassung-still', 'an');
      if (o.gefragt !== false) localStorage.setItem('atelier3-fassung-gefragt', '1');
      if (o.bereit) localStorage.setItem('atelier3-fassung-bereit', o.bereit);
      if (o.getan) localStorage.setItem('atelier3-fassung-getan', o.getan);
    },
    liesBereit: function () { return localStorage.getItem('atelier3-fassung-bereit'); } },
  { name: 'Atelier', pfad: '/', global: 'MandalaAtelier', regal: '2.',
    setz: function (o) {
      const P = 'mandala-atelier.';
      const J = function (k, v) { localStorage.setItem(P + k, JSON.stringify(v)); };
      if (o.an) J('fassungsmeldung', true);
      if (o.still) J('fassung-still', true);
      if (o.gefragt !== false) J('fassung-gefragt', true);
      if (o.bereit) J('fassung-bereit', o.bereit);
      if (o.getan) J('fassung-getan', o.getan);
    },
    liesBereit: function () {
      const r = localStorage.getItem('mandala-atelier.fassung-bereit');
      try { const v = JSON.parse(r); return v === '' ? null : v; } catch (e) { return r; }
    } }
];

(async () => {
  const { s, port } = await server();
  const b = await launch();
  const befunde = [];
  for (const APP of APPS) {
  const basis = 'http://127.0.0.1:' + port + APP.pfad;

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
    if (!opt.offline) {
      /* Der Vorbereitungslauf MUSS abgeschaltet sein. Sonst fährt die App auch
         dort hoch, ihr start() verbraucht die eben gesetzten Merker - etwa
         „getan" für den Toast - und der eigentliche Lauf findet nichts mehr
         vor. Genau daran scheiterte der Toast-Haken zuerst. */
      await p.goto(basis + '?fassung=aus', { waitUntil: 'load' });
      /* „schon gefragt" ist der Regelfall aller älteren Haken - sonst käme
         statt der Prüfung die Erststart-Frage. */
      await p.evaluate(new Function('o', '(' + APP.setz.toString() + ')(o)'),
                       { an: opt.an, still: opt.still, gefragt: opt.gefragt,
                         bereit: opt.bereit, getan: opt.getan });
    }
    await p.goto(basis + (opt.zusatz || ''), { waitUntil: 'load' });
    if (opt.offline) {
      await p.waitForTimeout(1600);
      raus.length = 0;
      kaputt = true;
      await p.evaluate(function (g) { window[g].FASSUNGSMELDUNG.schalten(true); }, APP.global);
    }
    await p.waitForTimeout(2600);
    const sicht = await p.evaluate(new Function(
      'var LIES = ' + APP.liesBereit.toString() + '; var GLOBAL = ' + JSON.stringify(APP.global) + ';' +
      'return (' + (function () {
      const t = function (id) {
        const d = document.getElementById(id);
        return d ? d.textContent.replace(/\s+/g, ' ').trim() : null;
      };
      return { band: t('fassungsband'), frage: t('fassungsfrage'), toast: t('fassungstoast'),
               bereit: LIES(), fassung: (window[GLOBAL] && window[GLOBAL].FASSUNG) || null };
    }).toString() + ')();')).catch(function () { return {}; });
    await ctx.close();
    return { name: name, abrufe: raus.filter(u => /fassung\.json/.test(u)),
             fremd: raus.filter(u => u.indexOf('FREMD') === 0),
             band: sicht.band, frage: sicht.frage, toast: sicht.toast,
             bereit: sicht.bereit, fassung: sicht.fassung, fehler: fehler };
  }

  /* Die Wahrheit ist, was die App SAGT, nicht was in fassung.json steht.
     Der erste Entwurf verglich gegen die Datei - und meldete drei Befunde,
     sobald die Nummer erhöht, die Datei aber noch nicht neu geschrieben war.
     Ein Prüflauf, der bei einem Versionssprung von selbst rot wird, erzieht
     nur dazu, ihn zu ignorieren. */
  gefaelscht = null;
  let r = await lauf('ab Werk', { an: false });
  const hier = { fassung: r.fassung };
  console.log('\nFassungsmeldung — ' + APP.name + ' ' + hier.fassung + '\n');

  /* 1 — ab Werk still */
  let ok1 = r.abrufe.length === 0 && r.fremd.length === 0 && !r.band;
  console.log('  ab Werk aus          ' + (ok1 ? 'kein Abruf, kein Band'
    : 'ABRUF TROTZ AUS: ' + r.abrufe.concat(r.fremd).join(', ')));
  if (!ok1) befunde.push(APP.name + '/ab Werk');

  /* 2+3 — angeschaltet, neuere Fassung vorgetäuscht */
  gefaelscht = { fassung: '9.99', seit: '2099-01-01', was: 'Probefassung' };
  r = await lauf('neuer', { an: true });
  const ok2 = r.abrufe.length === 1 && r.fremd.length === 0;
  const ok3 = !!r.band && r.band.indexOf('9.99') >= 0;
  console.log('  angeschaltet         ' + (ok2 ? 'genau ein Abruf: ' + r.abrufe[0].split('?')[0]
    : r.abrufe.length + ' ABRUFE' + (r.fremd.length ? ' + FREMD' : '')));
  console.log('  neuere Fassung       ' + (ok3 ? 'Band da: „' + r.band + '"' : 'KEIN BAND'));
  if (!ok2) befunde.push(APP.name + '/Abrufzahl');
  if (!ok3) befunde.push(APP.name + '/Band fehlt');

  /* 3b — gleiche Nummer: kein Band */
  gefaelscht = { fassung: hier.fassung, seit: hier.seit, was: hier.was };
  r = await lauf('gleich', { an: true });
  const ok3b = !r.band;
  console.log('  gleiche Fassung      ' + (ok3b ? 'kein Band, richtig' : 'BAND OBWOHL GLEICH'));
  if (!ok3b) befunde.push(APP.name + '/Band bei gleicher Nummer');

  /* 4 — ohne Netz */
  gefaelscht = { fassung: '9.99', seit: '2099-01-01', was: 'Probefassung' };
  r = await lauf('offline', { an: true, offline: true });
  kaputt = false;
  const ok4 = !r.band && r.fehler.length === 0 && r.abrufe.length === 1;
  console.log('  Abruf scheitert      ' + (ok4 ? 'versucht, gescheitert, nichts passiert'
    : (r.band ? 'BAND TROTZ FEHLSCHLAG'
      : (r.abrufe.length !== 1 ? 'gar nicht erst versucht' : 'FEHLERMELDUNG: ' + r.fehler[0]))));
  if (!ok4) befunde.push(APP.name + '/ohne Netz');

  /* 5 — Abschalter für die Werkzeuge */
  r = await lauf('abgeschaltet', { an: true, zusatz: '?fassung=aus' });
  const ok5 = r.abrufe.length === 0 && !r.band;
  console.log('  ?fassung=aus         ' + (ok5 ? 'kein Abruf, kein Band' : 'GREIFT NICHT'));
  if (!ok5) befunde.push(APP.name + '/?fassung=aus');

  /* 6 — die einmalige Frage beim ersten Start. */
  gefaelscht = null;
  r = await lauf('erster Start', { an: false, gefragt: false });
  const ok6 = !!r.frage && r.abrufe.length === 0;
  console.log('  erster Start         ' + (ok6
    ? 'fragt einmal, und holt vorher nichts'
    : (r.frage ? 'FRAGT, ABER HOLT SCHON: ' + r.abrufe.length : 'FRAGT NICHT')));
  if (!ok6) befunde.push(APP.name + '/Erststart-Frage');

  /* 6b — schon gefragt: nie wieder fragen. */
  r = await lauf('schon gefragt', { an: true });
  const ok6b = !r.frage;
  console.log('  schon gefragt        ' + (ok6b ? 'fragt nicht noch einmal' : 'FRAGT WIEDER'));
  if (!ok6b) befunde.push(APP.name + '/fragt wieder');

  /* 7 — still gestellt: merken statt laden. Das ist der Haken, an dem das
     Blatt eines Kindes hängt: Wird hier geladen, ist die Arbeit weg. */
  gefaelscht = { fassung: '9.99', seit: '2099-01-01', was: 'Probefassung' };
  r = await lauf('still', { an: true, still: true });
  const ok7 = r.bereit === '9.99' && !r.band && r.fassung === hier.fassung;
  console.log('  still gestellt       ' + (ok7
    ? 'gemerkt (9.99), kein Band, nicht geladen'
    : 'gemerkt: ' + r.bereit + ', Band: ' + !!r.band + ', Fassung: ' + r.fassung));
  if (!ok7) befunde.push(APP.name + '/stilles Merken');

  /* 8 — beim nächsten Start anwenden. Vorgemerkt wird eine Nummer, die es
     WIRKLICH gibt, sonst liefe der Versuch ins Leere. Angewendet heißt hier:
     Vorrat geräumt und neu geladen; dass die Fassung danach dieselbe ist,
     liegt daran, dass es keine neuere Datei gibt - der Toast schweigt dann
     zu Recht. */
  gefaelscht = null;
  r = await lauf('anwenden', { an: true, bereit: '9.99' });
  const ok8 = r.bereit === null && r.fassung === hier.fassung && !r.band;
  console.log('  Gemerktes anwenden   ' + (ok8
    ? 'angewendet und wieder vergessen - kein Kreisen'
    : 'bereit danach: ' + r.bereit + ', Fassung: ' + r.fassung));
  if (!ok8) befunde.push(APP.name + '/Anwenden');

  /* 8b — der Toast nach gelungenem Update. */
  r = await lauf('toast', { an: true, getan: 'ALT' });
  const ok8b = !!r.toast && r.toast.indexOf(hier.fassung) >= 0;
  console.log('  Toast danach         ' + (ok8b ? 'sagt: „' + r.toast + '"'
    : (r.toast ? 'TOAST OHNE NUMMER: ' + r.toast : 'KEIN TOAST')));
  if (!ok8b) befunde.push(APP.name + '/Toast');

  /* 8c — und er schweigt, wenn es NICHT geklappt hat. */
  r = await lauf('toast still', { an: true, getan: '9.99' });
  const ok8c = !r.toast;
  console.log('  Toast bei Fehlschlag ' + (ok8c ? 'schweigt, richtig' : 'MELDET ERFOLG OBWOHL NICHT'));
  if (!ok8c) befunde.push(APP.name + '/Toast bei Fehlschlag');

  /* 9 — die Regalfassung. Sie traegt den Block, aber stillgelegt: kein Abruf,
     kein Band, und vor allem kein Knopf, der den Vorrat der laufenden App
     raeumen koennte. Geprueft wird die NEUESTE eingefrorene Fassung, denn nur
     die hat den Block ueberhaupt. */
  const regalNr = fs.readdirSync(path.join(ROOT, 'v'))
    .filter(function (n) { return n.indexOf(APP.regal) === 0 &&
      fs.existsSync(path.join(ROOT, 'v', n, 'app.js')) &&
      fs.readFileSync(path.join(ROOT, 'v', n, 'app.js'), 'utf8').indexOf('FASSUNGSMELDUNG') >= 0; })
    .sort(function (a, c) { return parseFloat(a) - parseFloat(c); }).pop();

  if (!regalNr) {
    console.log('  Regalfassung         keine mit Block vorhanden — Haken übersprungen');
    befunde.push(APP.name + '/Regalfassung fehlt');
  } else {
    gefaelscht = { fassung: '9.99', seit: '2099-01-01', was: 'Probefassung' };
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const raus = [];
    p.on('request', function (r) { if (/fassung\.json/.test(r.url())) raus.push(r.url()); });
    await p.goto('http://127.0.0.1:' + port + '/v/' + regalNr + '/', { waitUntil: 'load' });
    /* Erst hochfahren lassen: window.Blatt entsteht am Ende des Startlaufs.
       Ohne das Warten meldete der Haken „kein Modul" statt „stillgelegt". */
    await p.waitForFunction('window.' + APP.global + ' && window.' + APP.global + '.FASSUNGSMELDUNG',
                            null, { timeout: 8000 }).catch(function () {});
    const zustand = await p.evaluate(function (g) {
      /* Anschalten VERSUCHEN - und zwar so, wie der Knopf im Fach es täte. */
      const M = window[g] && window[g].FASSUNGSMELDUNG;
      /* Anschalten VERSUCHEN - so, wie der Schalter es täte. */
      if (M) { M.schalten(true); M.sehen(true); }
      return { erlaubt: M ? M.erlaubt() : null, hatModul: !!M };
    }, APP.global);
    await p.waitForTimeout(2200);
    const band = await p.evaluate(function () { return !!document.getElementById('fassungsband'); });
    await ctx.close();
    const ok6 = zustand.hatModul && zustand.erlaubt === false && raus.length === 0 && !band;
    console.log('  Regalfassung ' + regalNr.padEnd(8) +
      (ok6 ? 'stillgelegt: kein Abruf, kein Band, erlaubt() falsch'
           : 'NICHT STILLGELEGT — Abrufe: ' + raus.length + ', Band: ' + band +
             ', erlaubt: ' + zustand.erlaubt));
    if (!ok6) befunde.push(APP.name + '/Regalfassung');
  }

  }
  await b.close(); s.close();
  console.log('\n' + (befunde.length ? '  ' + befunde.length + ' Befund(e): ' + befunde.join(', ')
                                     : '  Fassungsmeldung in Ordnung.') + '\n');
  process.exit(befunde.length ? 1 : 0);
})();
