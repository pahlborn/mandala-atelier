'use strict';

/* ============================================================================
   Erzeugt docs/fassungen.html — das Regal zum Anfassen.

     node tools/gen-fassungen.js

   Je Fassung eine Zeile: Nummer, Datum, was sich geändert hat, und der Link
   zum Ausprobieren. Der Text kommt aus der Betreffzeile des Commits, in dem
   die Cache-Version hochgezählt wurde — der Ort, an dem ohnehin steht, was
   diese Fassung ausmacht.

   Warum es diese Seite gibt: Als es darum ging, wann sich der Farbauftrag von
   Blatt verändert hat, musste die Commit-Historie durchsucht werden. Die
   Antwort war eindeutig und stand vier Tage lang niemandem zur Verfügung.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ZIEL = path.join(ROOT, 'docs', 'fassungen.html');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 })
    .toString().trim();
}

/* Zu jeder Fassung der Commit, in dem ihre Nummer entstand. */
function fassungen(app) {
  const sw = app === 'blatt' ? 'atelier3/sw.js' : 'sw.js';
  const muster = app === 'blatt' ? /atelier3-v1-(\d+)/ : /mandala-atelier-v1-(\d+)/;
  const stamm = app === 'blatt' ? '3' : '2';

  const commits = git(['log', '--format=%H|%ad|%s', '--date=short', '--reverse',
                       '--', sw]).split('\n').filter(Boolean);
  /* Nach Nummer sammeln, nicht der Reihe nach.

     Der erste Anlauf verglich jede Fassung nur mit ihrer Vorgängerin — und
     die Liste bekam eine doppelte 2.2 und geriet aus der Ordnung. Grund: Beim
     Zusammenführen zweier Zweige ist die Cache-Nummer einmal zurückgesprungen
     und danach wieder hochgezählt. Wer nur den letzten Wert im Blick hat,
     hält dasselbe Fach für zwei. Es zählt also die Nummer selbst, und es gilt
     der **früheste** Commit, der sie eingeführt hat. */
  const nach = {};
  commits.forEach(function (zeile) {
    const teile = zeile.split('|');
    const hash = teile[0], datum = teile[1], betreff = teile.slice(2).join('|');
    let inhalt;
    try { inhalt = git(['show', hash + ':' + sw]); } catch (err) { return; }
    const m = inhalt.match(muster);
    if (!m || nach[m[1]]) return;
    nach[m[1]] = { nummer: stamm + '.' + m[1], zahl: Number(m[1]),
                   datum: datum, betreff: betreff, hash: hash.slice(0, 7) };
  });
  return Object.keys(nach).map(function (k) { return nach[k]; })
    .sort(function (a, b) { return b.zahl - a.zahl; });
}

function schütze(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tabelle(liste, app) {
  const zeilen = liste.map(function (f) {
    const da = fs.existsSync(path.join(ROOT, 'v', f.nummer));
    const link = da
      ? '<a href="../v/' + f.nummer + '/index.html">' + f.nummer + '</a>'
      : '<span class="fehlt">' + f.nummer + '</span>';
    return '      <tr><td class="nr">' + link + '</td><td class="tag">' +
           f.datum + '</td><td>' + schütze(f.betreff) + '</td></tr>';
  }).join('\n');
  return '    <table class="fassungen">\n' +
         '      <tr><th>' + app + '</th><th>vom</th><th>was sich änderte</th></tr>\n' +
         zeilen + '\n    </table>';
}

const blatt = fassungen('blatt');
const atelier = fassungen('atelier');

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Fassungen</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Jede Fassung beider Apps, zum Nachsehen und zum Ausprobieren.">
<meta name="theme-color" content="#efe9dd" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16151a" media="(prefers-color-scheme: dark)">
<link rel="icon" href="../beide-icon-192.png">

<!--
  Erzeugt von tools/gen-fassungen.js — nicht von Hand ändern.
-->

<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --room: #efe9dd; --card: #f8f4ea; --ink: #2f2a22;
    --quiet: #6d6355; --edge: rgba(60, 48, 32, 0.16);
  }
  @media (prefers-color-scheme: dark) {
    :root { --room: #16151a; --card: #201f25; --ink: #e8e2d6;
            --quiet: #9a9287; --edge: rgba(0, 0, 0, 0.5); }
  }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    padding: clamp(20px, 5vw, 48px) clamp(16px, 4vw, 36px)
             calc(clamp(20px, 5vw, 48px) + env(safe-area-inset-bottom));
    background: var(--room); color: var(--ink);
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 800px; margin: 0 auto; }
  h1 { font-size: clamp(24px, 5vw, 32px); margin: 0 0 .4rem; font-weight: 600; }
  h2 { font-size: 17px; margin: 2.2rem 0 .6rem; font-weight: 600; }
  p { margin: 0 0 1rem; }
  .lede { color: var(--quiet); margin-bottom: 1.6rem; }
  table.fassungen { width: 100%; border-collapse: collapse; font-size: 14.5px; }
  table.fassungen th, table.fassungen td {
    padding: 7px 12px 7px 0; text-align: left;
    border-bottom: 1px solid var(--edge); vertical-align: top;
  }
  table.fassungen th { font-weight: 600; font-size: 13px;
    text-transform: uppercase; letter-spacing: .05em; color: var(--quiet); }
  td.nr { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  td.nr a { color: inherit; }
  td.tag { font-variant-numeric: tabular-nums; color: var(--quiet); white-space: nowrap; }
  .fehlt { color: var(--quiet); opacity: .5; }
  .note {
    font-size: 14.5px; color: var(--quiet);
    border-left: 2px solid var(--edge); padding-left: 14px; margin: 1.6rem 0;
  }
  a { color: inherit; }
  footer { margin-top: 2.4rem; font-size: 13.5px; color: var(--quiet); }
</style>
</head>
<body>
<main>

  <h1>Fassungen</h1>
  <p class="lede">Jede Fassung beider Apps steht hier — und lässt sich
     antippen. Die Nummer ist ein Link: Sie öffnet genau diese Fassung, so wie
     sie damals war.</p>

  <p class="note">
    <strong>Was eine eingefrorene Fassung ist und was nicht.</strong> Sie ist
    zum <em>Vergleichen</em> da. Sie läuft nur online, lässt sich nicht auf den
    Homescreen legen, und sie hat ihren eigenen Speicher — was dort entsteht,
    berührt die laufende App nicht, und umgekehrt. Beides ist Absicht: Eine
    alte Fassung baut für dieselbe Seed ein anderes Relief, und sie dürfte
    einem längst bemalten Blatt keinen fremden Grundriss unterschieben.
  </p>

${tabelle(blatt, 'Blatt')}

${tabelle(atelier, 'Mandala Atelier')}

  <p class="note">
    <strong>Warum es dieses Regal gibt.</strong> Über zwölf Fassungen hinweg
    hatte sich der Farbauftrag von Blatt still verändert, und aufgefallen ist
    es nur, weil auf einem Gerät zufällig noch eine alte Fassung lief. Ohne
    diesen Zufall wäre die Frage nicht zu beantworten gewesen. Zufälle sind
    eine schlechte Grundlage, also steht jetzt jede Fassung da.
  </p>

  <footer>
    Erzeugt aus der Versionsgeschichte. Zurück zur
    <a href="../beide.html">Einstiegsseite</a>.
  </footer>

</main>
</body>
</html>
`;

fs.writeFileSync(ZIEL, html);
console.log('docs/fassungen.html: ' + blatt.length + ' Fassungen Blatt, ' +
            atelier.length + ' Atelier');
