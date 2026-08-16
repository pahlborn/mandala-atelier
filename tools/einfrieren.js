'use strict';

/* ============================================================================
   Eine Fassung ins Regal stellen.

     node tools/einfrieren.js            die laufende Fassung einfrieren
     node tools/einfrieren.js <commit>   eine vergangene einfrieren

   Sie landet unter /v/<nummer>/ und bleibt dort für immer erreichbar. Damit
   ist „zurück auf 3.7“ ein Link statt eines Auftrags, und ein Vergleich
   zwischen zwei Fassungen ist zwei Adressen weit entfernt.

   Warum das nötig wurde: Über Wochen hatte sich die Griffkurve von Blatt
   still verändert. Aufgefallen ist es nur, weil auf einem Gerät zufällig noch
   eine alte Fassung lief — und die wäre um ein Haar von einem Cache-Fix
   gelöscht worden. Ein Regal ist kein Luxus, es ist das, was diese
   Untersuchung überhaupt möglich gemacht hat.

   ZWEI KOLLISIONEN, und beide würden Schaden anrichten, wenn man einfach
   Dateien kopierte:

   1. Der Service Worker. Eine eingefrorene Fassung brächte ihren eigenen mit,
      und dessen `activate` löscht **alles**, was mit `atelier3-` bzw.
      `mandala-atelier-` anfängt — also den Offline-Vorrat der laufenden App.
      Ein Regal, das die Wohnung anzündet. Deshalb: eingefrorene Fassungen
      bekommen **gar keinen** Worker. Sie laufen nur online. Das ist kein
      Mangel, sondern ihr Zweck: Sie sind zum Vergleichen da, nicht zum
      Ablegen auf den Homescreen.

   2. Der Speicher. Alle Fassungen teilen sich denselben Origin und damit
      dieselbe Datenbank und dieselben localStorage-Schlüssel. Eine alte
      Fassung läse und **überschriebe** das laufende Blatt — und da sie für
      denselben Seed ein anderes Relief baut, schöbe sie einem bemalten Blatt
      einen fremden Grundriss unter. Genau die Regel, die sonst hochgehalten
      wird, von außen gebrochen. Deshalb wird jeder Speichername mit der
      Fassungsnummer gestempelt.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REGAL = path.join(ROOT, 'v');

/* Was zu einer Fassung gehört: das, was ihr Verhalten ausmacht. Nicht dabei
   sind

     * die Werkstattseiten — sie gehören keinem Release an und sollen immer
       die neuesten sein;
     * das Manifest — eine eingefrorene Fassung soll sich nicht auf den
       Homescreen legen lassen;
     * Schriften und Symbole — 400 kB je Fassung, und beide haben sich seit
       ihrer Entstehung kein einziges Mal geändert. Ein Regal, das 15 MB
       gleicher Bytes trägt, ist ein schlechtes Regal. Die Verweise darauf
       werden stattdessen nach oben umgebogen.

   Damit wiegt eine Fassung rund 150 kB statt 720. */
const TEILE = {
  atelier: ['index.html', 'style.css', 'app.js'],
  blatt:   ['atelier3/index.html', 'atelier3/style.css', 'atelier3/app.js']
};

/* Schriften und Symbole liegen oben, nicht im Regalfach. */
function biegeVerweise(html, app) {
  const hoch = app === 'blatt' ? '../../atelier3/' : '../../';
  return html
    .replace(/<link rel="manifest"[^>]*>\n?/, '')
    .replace(/href="(fonts\.css)"/g, 'href="../../$1"')
    .replace(/href="(icon-\d+\.png)"/g, 'href="' + hoch + '$1"');
}

function ausCommit(commit, datei) {
  try {
    return execFileSync('git', ['show', commit + ':' + datei],
                        { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  } catch (err) { return null; }
}

function lies(commit, datei) {
  if (commit) return ausCommit(commit, datei);
  const p = path.join(ROOT, datei);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

/* Die Fassungsnummer einer App. Ältere Fassungen tragen sie noch nicht in
   app.js — dann gilt der Cache-Name, aus dem sie ohnehin abgeleitet ist. */
function nummerVon(commit, app) {
  const swPfad  = app === 'blatt' ? 'atelier3/sw.js' : 'sw.js';
  const muster  = app === 'blatt' ? /atelier3-v1-(\d+)/ : /mandala-atelier-v1-(\d+)/;
  const stamm   = app === 'blatt' ? '3' : '2';
  const sw = lies(commit, swPfad);
  if (!sw) return null;
  const m = String(sw).match(muster);
  return m ? stamm + '.' + m[1] : null;
}

/* Der Speicher wird umbenannt, damit eine eingefrorene Fassung der laufenden
   App nicht in die Blätter schreibt. Getroffen werden der Datenbankname und
   alle localStorage-Schlüssel; beide fangen mit demselben Wort an. */
function stempleSpeicher(text, app, nummer) {
  const marke = 'regal' + nummer.replace('.', '-');
  const wort = app === 'blatt' ? 'atelier3' : 'mandala-atelier';
  return text
    .replace(new RegExp("indexedDB\\.open\\('" + wort + "'", 'g'),
             "indexedDB.open('" + wort + '-' + marke + "'")
    .replace(new RegExp("'" + wort + "-([a-z]+)'", 'g'),
             "'" + wort + '-' + marke + "-$1'")
    .replace(new RegExp("'" + wort + "\\.'", 'g'),
             "'" + wort + '-' + marke + ".'");
}

/* Der Worker wird nicht mitgenommen, also darf ihn auch niemand anmelden.

   Der erste Anlauf schnitt den Aufruf mit einem regulären Ausdruck heraus —
   und zerschnitt die neueren Fassungen mitten im Code, weil deren Anmeldung
   inzwischen eine Kette aus .then() und .catch() ist und das erste `});`
   längst nicht mehr ihr Ende markiert. Der Testlauf hat es sofort gemeldet.

   Also gar nichts herausschneiden. Stattdessen wird die Anmeldung selbst
   stillgelegt, und zwar am einzigen Ort, der über alle vierunddreißig
   Fassungen hinweg derselbe ist: der Schnittstelle des Browsers. Sie liefert
   ein Versprechen, das nie eingelöst wird — kein Worker, keine abgewiesene
   Zusage, die irgendwo als Fehler auftaucht, und keine Zeile fremden Codes,
   die verstanden werden müsste. */
const STILLGELEGT =
  '/* Im Regal ohne Service Worker – siehe tools/einfrieren.js.\n' +
  '   Eine eingefrorene Fassung darf keinen anmelden: Ihr `activate` löschte\n' +
  '   den Offline-Vorrat der laufenden App. */\n' +
  "if (typeof navigator !== 'undefined' && navigator.serviceWorker) {\n" +
  '  navigator.serviceWorker.register = function () { return new Promise(function () {}); };\n' +
  '}\n\n';

function entferneWorker(text) {
  /* Hinter ein etwaiges 'use strict', damit das seine Wirkung behält. */
  const m = text.match(/^\s*['"]use strict['"];\s*\n/);
  return m ? m[0] + STILLGELEGT + text.slice(m[0].length)
           : STILLGELEGT + text;
}

/* Ein Hinweis im Blatt bzw. im Atelier, dass man eine Fassung aus dem Regal
   ansieht. Ohne ihn wäre nach zwei Minuten nicht mehr klar, was da läuft –
   und genau diese Verwechslung war der Anlass für das ganze Regal. */
function stempleBanner(html, nummer, app) {
  const name = app === 'blatt' ? 'Blatt' : 'Mandala Atelier';
  const band =
    '<div style="position:fixed;left:0;right:0;top:0;z-index:9999;' +
    'padding:3px 10px;font:11px/1.4 system-ui,sans-serif;text-align:center;' +
    'color:#5b5245;background:rgba(226,214,190,.94);' +
    'padding-top:calc(3px + env(safe-area-inset-top))">' +
    name + ' ' + nummer + ' &middot; Fassung aus dem Regal, nur zum Vergleichen ' +
    '&middot; <a href="../../beide.html" style="color:inherit">zurück</a></div>\n';
  return html.replace(/<body([^>]*)>/, '<body$1>\n' + band);
}

function einfrieren(commit) {
  const wohin = [];
  ['atelier', 'blatt'].forEach(function (app) {
    const nummer = nummerVon(commit, app);
    if (!nummer) { console.log('  ' + app + ': keine Nummer gefunden, übersprungen'); return; }

    const ziel = path.join(REGAL, nummer);
    if (fs.existsSync(ziel)) {
      console.log('  ' + app + ' ' + nummer + ': steht schon im Regal');
      wohin.push(nummer);
      return;
    }

    let gezaehlt = 0;
    TEILE[app].forEach(function (datei) {
      const roh = lies(commit, datei);
      if (!roh) return;
      const flach = datei.replace(/^atelier3\//, '');
      const aus = path.join(ziel, flach);
      fs.mkdirSync(path.dirname(aus), { recursive: true });

      if (/\.js$/.test(flach)) {
        let t = String(roh);
        t = stempleSpeicher(t, app, nummer);
        t = entferneWorker(t);
        fs.writeFileSync(aus, t);
      } else if (/\.html$/.test(flach)) {
        fs.writeFileSync(aus, stempleBanner(biegeVerweise(String(roh), app), nummer, app));
      } else {
        fs.writeFileSync(aus, roh);
      }
      gezaehlt++;
    });
    console.log('  ' + app + ' ' + nummer + ': ' + gezaehlt + ' Dateien → v/' + nummer + '/');
    wohin.push(nummer);
  });
  return wohin;
}

if (require.main === module) {
  const commit = process.argv[2] || null;
  console.log('\nEinfrieren' + (commit ? ' aus ' + commit : ' (Arbeitsstand)') + '\n');
  const wohin = einfrieren(commit);
  console.log('');
  if (!wohin.length) { console.log('  Nichts eingefroren.'); process.exit(1); }
}

module.exports = { einfrieren, nummerVon };
