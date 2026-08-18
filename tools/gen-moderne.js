'use strict';

/* ============================================================================
   Erzeugt docs/moderne.html – die Schautafel der Neuzeit.

     node tools/gen-moderne.js

   Schwesterseite zu docs/motive.html, gleicher Maßstab, gleiche Strichsprache,
   damit sich beide nebeneinander lesen lassen. Dort stehen fünfzehn Ordnungen
   aus der Baugeschichte; hier fünfzehn aus der Neuzeit.

   Anlass war die Frage nach einem Ausmalbild „modernes Designhaus“ – ein Haus
   in Perspektive, mit Horizont, Himmel und Rasen. Das geht in diesen beiden
   Apps nicht, und zwar nicht aus Aufwand, sondern aus Bauart: Beide sind
   radialsymmetrische Maschinen. Im Atelier wird ein Segment n-mal gedreht, in
   Blatt das Relief über einen einzigen Keil gerechnet und n-mal gedreht. Ein
   perspektivisches Haus hat null Drehsymmetrie.

   Die Moderne hat aber eigene Ordnungen, und viele davon sind von Haus aus
   rund. Sie stehen hier – als Schemata, nicht als Rekonstruktionen. Gezeichnet
   aus Koordinaten, weil in diesem Projekt nichts von außen geholt wird.
   ========================================================================== */

const fs = require('fs');
const nodePath = require('path');

const S = 200;
const C = S / 2;
const R = 88;
const TAU = Math.PI * 2;
const UP = -Math.PI / 2;

function pol(r, a) { return [C + Math.cos(a) * r, C + Math.sin(a) * r]; }
function n(v) { return Math.round(v * 100) / 100; }
function d(pts, close) {
  return 'M' + pts.map(function (p, i) {
    return (i ? 'L' : '') + n(p[0]) + ' ' + n(p[1]);
  }).join(' ') + (close ? 'Z' : '');
}
function circle(r, cls) {
  return '<circle cx="' + C + '" cy="' + C + '" r="' + n(r) + '"' +
         (cls ? ' class="' + cls + '"' : '') + '/>';
}
function dot(x, y, r, cls) {
  return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '"' +
         (cls ? ' class="' + cls + '"' : '') + '/>';
}
function line(x1, y1, x2, y2, cls) {
  return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) +
         '" y2="' + n(y2) + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
}
function path(dd, cls) {
  return '<path d="' + dd + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
}

/* Speichen zwischen zwei Radien. */
function spokes(r0, r1, count, phase, cls) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = UP + (i + (phase || 0)) * (TAU / count);
    const p0 = pol(r0, a), p1 = pol(r1, a);
    out += line(p0[0], p0[1], p1[0], p1[1], cls);
  }
  return out;
}

/* Ein Kranz aus Punkten – Spiegel, Kabinen, Stützen. */
function kranz(r, count, rho, phase, cls) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const p = pol(r, UP + (i + (phase || 0)) * (TAU / count));
    out += dot(p[0], p[1], rho, cls);
  }
  return out;
}

/* Dreiecksnetz zwischen zwei Ringen – die geodätische Teilung. */
function netz(r0, r1, count, cls) {
  const pts = [];
  for (let i = 0; i <= count * 2; i++) {
    const a = UP + (i / 2) * (TAU / count);
    pts.push(pol(i % 2 ? r1 : r0, a));
  }
  return path(d(pts, false), cls);
}

/* Eine Spirale, als Polylinie. */
function spirale(rVon, rBis, windungen, phase, schritte, cls) {
  const pts = [];
  const m = schritte || 160;
  for (let i = 0; i <= m; i++) {
    const t = i / m;
    pts.push(pol(rVon + (rBis - rVon) * t,
                 UP + (phase || 0) + t * windungen * TAU));
  }
  return path(d(pts, false), cls);
}

/* Etwas n-mal um die Mitte drehen. */
function mal(count, inner, phase) {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += '<g transform="rotate(' +
           n((i + (phase || 0)) * 360 / count) + ' ' + C + ' ' + C + ')">' +
           inner + '</g>';
  }
  return out;
}


/* ---------------------------------------------------------------------------
   Die Schemata
   ------------------------------------------------------------------------- */

/* 1. Gartenstadt — Howard 1898. Sechs Stadtteile, Ringbahn, Boulevards. */
function gartenstadt() {
  let g = circle(R) + circle(80) + circle(58) + circle(56, 'thin') + circle(32);
  g += circle(13, 'fill');
  /* sechs radiale Boulevards, vom Park bis zum Landgürtel */
  g += spokes(13, R, 6, 0);
  /* Wohnring, Grand Avenue, Gewerbe am Bahnring */
  g += kranz(45, 24, 2.6, 0.5, 'thin');
  g += kranz(69, 18, 3.4, 0.5);
  /* die Ringbahn als Doppellinie liegt zwischen 80 und R */
  g += spokes(80, R, 24, 0, 'thin');
  return g;
}

/* 2. Verkehrsstern — fünf Arme, drei Fahrspuren, Mittelinsel. */
function verkehr() {
  let g = circle(78) + circle(64, 'thin') + circle(50, 'thin') + circle(36, 'fill');
  /* fünf Zufahrten, je zwei Fahrbahnen, mit Tropfeninsel dazwischen */
  const arm =
    line(C - 11, C - 78, C - 11, C - S / 2 + 4) +
    line(C + 11, C - 78, C + 11, C - S / 2 + 4) +
    line(C, C - 78, C, C - S / 2 + 4, 'thin');
  g += mal(5, arm);
  /* die Inseln zwischen den Armen */
  g += mal(5, path(d([pol(80, UP + 0.36), pol(94, UP + 0.30),
                      pol(94, UP + 0.44), pol(80, UP + 0.50)], true), 'fill'), 0);
  return g;
}

/* 3. Rundterminal — Flughafensatellit, Ring mit Fingern und leerer Mitte. */
function terminal() {
  let g = circle(74) + circle(56) + circle(30) + circle(24, 'thin');
  /* sieben Fluggastbrücken nach außen, jede mit Standplatz */
  g += mal(7, line(C, C - 74, C, C - 86) +
              '<circle cx="' + C + '" cy="' + (C - 90) + '" r="6"/>');
  /* die Gates am inneren Ringrand */
  g += kranz(65, 21, 2.2, 0.5, 'thin');
  /* die Röhren durch die leere Mitte — das Bild dieses Bautyps */
  g += mal(2, line(C - 30, C, C + 30, C, 'thin'), 0.25);
  g += spokes(24, 30, 8, 0, 'thin');
  return g;
}

/* 4. Rippenkuppel — Nervi 1957, ein Rautennetz aus Fertigteilrippen. */
function rippen() {
  let g = circle(R) + circle(78) + circle(20);
  /* zwei gegenläufige Scharen von Rippen: daraus entstehen die Rauten */
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 18; i++) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        pts.push(pol(20 + (78 - 20) * t,
                     UP + i * (TAU / 18) + s * t * 0.62));
      }
      g += path(d(pts, false), 'thin');
    }
  }
  /* der gewellte Rand, der auf den Y-Stützen aufsitzt */
  const welle = [];
  for (let i = 0; i <= 144; i++) {
    const a = UP + (i / 144) * TAU;
    welle.push(pol(R + Math.cos(a * 18) * 3, a));
  }
  g += path(d(welle, true));
  return g;
}

/* 5. Geodätische Kuppel — Fuller, Dreiecke statt Ringe. */
function geodaet() {
  let g = circle(R) + circle(66) + circle(44) + circle(22);
  g += netz(R, 66, 18, 'thin');
  g += netz(66, 44, 12, 'thin');
  g += netz(44, 22, 8, 'thin');
  g += spokes(0, 22, 6, 0, 'thin');
  return g;
}

/* 6. Speichenrad — Seilbinderdach: Druckring außen, Zugring innen. */
function speichenrad() {
  let g = circle(R) + circle(82) + circle(26) + circle(21);
  /* zweiunddreißig Seile, im Wechsel ober- und unterseitig */
  g += spokes(26, 82, 32, 0);
  /* die Öffnung über der Mitte */
  g += circle(12, 'thin');
  /* Verstrebung der beiden Ringe */
  g += spokes(R, 82, 32, 0.5, 'thin');
  g += spokes(21, 26, 32, 0.5, 'thin');
  return g;
}

/* 7. Heliostatenfeld — ein Turm, ringsum tausende Spiegel. */
function helio() {
  let g = circle(9, 'fill') + circle(15, 'thin');
  const ringe = [[26, 14], [38, 20], [50, 26], [62, 32], [74, 38], [85, 44]];
  ringe.forEach(function (r, i) {
    g += kranz(r[0], r[1], 2.3, i % 2 ? 0.5 : 0, 'thin');
  });
  return g;
}

/* 8. Parabolschüssel — Paneelringe, Rippen, Empfänger im Brennpunkt. */
function schuessel() {
  let g = circle(R) + circle(72) + circle(55) + circle(38) + circle(20);
  g += spokes(72, R, 32, 0, 'thin');
  g += spokes(55, 72, 24, 0.5, 'thin');
  g += spokes(38, 55, 16, 0, 'thin');
  g += spokes(20, 38, 8, 0.5, 'thin');
  /* der Vierbeinträger, von vorn gesehen */
  g += mal(4, line(C, C - 78, C, C - 8), 0.5);
  g += circle(7, 'fill');
  return g;
}

/* 9. Rotor — drei Blätter, das einzige dreizählige Schema hier. */
function rotor() {
  let g = circle(14) + circle(7, 'fill');
  const blatt =
    path(d([pol(14, UP - 0.20), pol(40, UP - 0.13), pol(70, UP - 0.06),
            pol(R, UP - 0.015), pol(R, UP + 0.015), pol(70, UP + 0.05),
            pol(40, UP + 0.10), pol(14, UP + 0.16)], true)) +
    path(d([pol(20, UP - 0.02), pol(84, UP + 0.005)], false), 'thin');
  g += mal(3, blatt);
  return g;
}

/* 10. Spiralrampe — Guggenheim: ein einziger Weg, fünf Windungen. */
function rampe() {
  let g = circle(R) + circle(20, 'thin');
  g += spirale(84, 26, 2.4, 0, 200);
  g += spirale(72, 16, 2.4, 0, 200, 'thin');
  /* die Brüstungsstützen quer zur Rampe */
  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const a = UP + t * 2.4 * TAU;
    const p0 = pol(84 + (26 - 84) * t, a);
    const p1 = pol(72 + (16 - 72) * t, a);
    g += line(p0[0], p0[1], p1[0], p1[1], 'thin');
  }
  return g;
}

/* 11. Doppelwendel — zwei Treppen, die sich nie begegnen. */
function wendel() {
  let g = circle(R) + circle(16);
  for (let s = 0; s < 2; s++) {
    g += spirale(80, 22, 1.5, s * Math.PI, 140);
    g += spirale(46, 18, 1.5, s * Math.PI, 140, 'thin');
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const a = UP + s * Math.PI + t * 1.5 * TAU;
      const p0 = pol(80 + (22 - 80) * t, a);
      const p1 = pol(46 + (18 - 46) * t, a);
      g += line(p0[0], p0[1], p1[0], p1[1], 'thin');
    }
  }
  return g;
}

/* 12. Riesenrad — Felge, Speichen aus Draht, Gondeln außen. */
function riesenrad() {
  let g = circle(R) + circle(82) + circle(18) + circle(10, 'fill');
  g += spokes(18, 82, 36, 0, 'thin');
  g += spokes(18, 82, 36, 0.5, 'thin');
  g += mal(12, '<rect x="' + (C - 5) + '" y="' + (C - R - 9) +
               '" width="10" height="9" rx="3"/>');
  return g;
}

/* 13. Arena — Sitzringe, versetzte Zugänge, Spielfeld. */
function arena() {
  let g = circle(R) + circle(74) + circle(60) + circle(46) + circle(34, 'fill');
  g += spokes(60, 74, 24, 0.5, 'thin');
  g += spokes(74, R, 24, 0, 'thin');
  g += spokes(46, 60, 12, 0.5, 'thin');
  /* vier Tunnel, die alle Ringe durchstoßen */
  g += mal(4, line(C - 6, C - 34, C - 6, C - R) +
              line(C + 6, C - 34, C + 6, C - R));
  return g;
}

/* 14. Planetarium — Kuppel von unten, Sitzreihen als Bögen. */
function planetarium() {
  let g = circle(R) + circle(80);
  g += spokes(80, R, 36, 0, 'thin');
  /* Sitzreihen: konzentrisch, in Blöcke geteilt */
  [70, 61, 52, 43, 34].forEach(function (r) { g += circle(r, 'thin'); });
  g += mal(6, line(C, C - 74, C, C - 30, 'thin'), 0.5);
  /* der Projektor in der Mitte */
  g += circle(14) + circle(8, 'fill');
  g += spokes(14, 20, 8, 0, 'thin');
  return g;
}

/* 15. Panoptikum — Zellenring und Inspektionsturm. */
function panoptikum() {
  let g = circle(R) + circle(64) + circle(56);
  /* vierundzwanzig Zellen, jede mit Fenster nach außen */
  g += spokes(64, R, 24, 0);
  g += kranz(R - 4, 24, 1.8, 0.5, 'thin');
  /* der Turm: von hier sieht einer alles, ohne gesehen zu werden */
  g += circle(22) + circle(16, 'thin');
  g += spokes(16, 22, 8, 0.5, 'thin');
  return g;
}


/* ---------------------------------------------------------------------------
   Die Tafel
   ------------------------------------------------------------------------- */

const FAMILIEN = [
  { gruppe: 'Stadt und Verkehr' },

  { id: 'gartenstadt', name: 'Gartenstadt', zeichnung: gartenstadt,
    herkunft: 'Ebenezer Howard, 1898',
    was: 'Sechs Stadtteile um einen Park, Ringbahn außen, sechs Boulevards ' +
         'nach innen, dazwischen Wohnring und Gewerbe. Das berühmteste ' +
         'Diagramm der modernen Stadtplanung ist ein Kreis.',
    fracht: 'keine — ein Planungsdiagramm',
    taugt: 'sehr — sechszählig, und die Ringe haben verschiedene Aufgaben' },

  { id: 'verkehr', name: 'Verkehrsstern', zeichnung: verkehr,
    herkunft: 'Kreisverkehr, 20. Jh.',
    was: 'Drei Fahrspuren um eine Mittelinsel, fünf Zufahrten, dazwischen ' +
         'Tropfeninseln. Die Ordnung ist reine Bewegungsführung — nichts ' +
         'daran ist Zierde.',
    fracht: 'keine',
    taugt: 'fünfzählig und sehr karg — als Gegenstück zur Fülle' },

  { id: 'terminal', name: 'Rundterminal', zeichnung: terminal,
    herkunft: 'Flughafensatellit, ab 1974',
    was: 'Ein bewohnter Ring mit leerer Mitte, sieben Brücken nach außen zu ' +
         'den Standplätzen, durch die Mitte nur Röhren. Das Gegenteil ' +
         'unserer Anlagen: Hier ist die Mitte der Hohlraum.',
    fracht: 'keine',
    taugt: 'sehr — die leere Mitte als Loch statt als Ziel' },

  { gruppe: 'Tragwerk — das Dach von unten' },

  { id: 'rippen', name: 'Rippenkuppel', zeichnung: rippen,
    herkunft: 'Pier Luigi Nervi, 1957',
    was: 'Zwei gegenläufige Scharen von Fertigteilrippen, aus deren Kreuzung ' +
         'ein Rautennetz entsteht. Der Rand wellt sich und sitzt auf ' +
         'Y-Stützen auf.',
    fracht: 'keine',
    taugt: 'sehr — verwandt mit unserer Kuppel, aber Rauten statt Kassetten' },

  { id: 'geodaet', name: 'Geodätische Kuppel', zeichnung: geodaet,
    herkunft: 'Buckminster Fuller, ab 1954',
    was: 'Kein Ring, kein Bogen: lauter Dreiecke. Die Teilung wird nach ' +
         'innen gröber, weil die Kugel dort flacher wird. Alle Stäbe fast ' +
         'gleich lang.',
    fracht: 'keine',
    taugt: 'ein Ordnungsprinzip, das im Katalog völlig fehlt' },

  { id: 'speichenrad', name: 'Speichenrad', zeichnung: speichenrad,
    herkunft: 'Seilbinderdach, ab 1960',
    was: 'Ein Druckring außen, ein Zugring innen, dazwischen nur Seile. Das ' +
         'ganze Dach ist ein Fahrradrad — und in der Mitte bleibt die ' +
         'Öffnung über dem Spielfeld.',
    fracht: 'keine',
    taugt: 'sehr — äußerste Sparsamkeit, viele schmale Felder' },

  { gruppe: 'Ingenieurbau' },

  { id: 'helio', name: 'Heliostatenfeld', zeichnung: helio,
    herkunft: 'Solarturmkraftwerk, ab 2007',
    was: 'Ein Turm, ringsum tausende einzeln gestellte Spiegel in ' +
         'konzentrischen Ringen, nach außen immer mehr. Keine Linie, keine ' +
         'Mauer — die Ordnung besteht nur aus Punkten.',
    fracht: 'keine',
    taugt: 'sehr — lauter kleine Felder, und ein Bild aus reiner Streuung' },

  { id: 'schuessel', name: 'Parabolschüssel', zeichnung: schuessel,
    herkunft: 'Radioteleskop, ab 1957',
    was: 'Paneelringe, nach außen feiner geteilt, dazu die Rippen und der ' +
         'Vierbeinträger mit dem Empfänger im Brennpunkt. Von vorn ist es ' +
         'eine Rosette aus Blech.',
    fracht: 'keine',
    taugt: 'sehr — die Staffelung fällt hier aus der Statik' },

  { id: 'rotor', name: 'Rotor', zeichnung: rotor,
    herkunft: 'Windkraftanlage, ab 1980',
    was: 'Drei Blätter, zur Spitze hin schmaler und verwunden. Nichts ' +
         'daran ist Ornament; jede Kurve steht dort, wo der Wind sie ' +
         'verlangt.',
    fracht: 'keine',
    taugt: 'wäre das erste **dreizählige** Motiv — bisher gibt es keines' },

  { gruppe: 'Bewegung — die Ordnung hat einen Drehsinn' },

  { id: 'rampe', name: 'Spiralrampe', zeichnung: rampe,
    herkunft: 'Frank Lloyd Wright, 1959',
    was: 'Kein Grundriss aus Ringen, sondern ein einziger Weg, der sich nach ' +
         'innen aufwickelt. Wer ankommt, ist nicht in der Mitte, sondern ' +
         'oben.',
    fracht: 'keine',
    taugt: 'als Motiv mehrarmig — eine einzelne Spirale ist nicht n-zählig' },

  { id: 'wendel', name: 'Doppelwendel', zeichnung: wendel,
    herkunft: 'Doppelhelixtreppe',
    was: 'Zwei Treppen im selben Schacht, um eine halbe Windung versetzt. ' +
         'Man geht nebeneinander, ohne sich je zu begegnen.',
    fracht: 'keine',
    taugt: 'zweizählig und gedreht — das kann bisher nichts im Katalog' },

  { id: 'riesenrad', name: 'Riesenrad', zeichnung: riesenrad,
    herkunft: 'George Ferris, 1893',
    was: 'Felge, Nabe, und dazwischen nur gespannter Draht — die Speichen ' +
         'tragen nicht auf Druck, sondern auf Zug. Außen hängen die Gondeln ' +
         'und bleiben immer waagerecht.',
    fracht: 'keine — Jahrmarkt',
    taugt: 'die Gondeln geben dem Rand einen Rhythmus, den wir nicht haben' },

  { gruppe: 'Versammlung' },

  { id: 'arena', name: 'Arena', zeichnung: arena,
    herkunft: 'Rundstadion, 20. Jh.',
    was: 'Ränge in Ringen, versetzte Treppen dazwischen, vier Tunnel, die ' +
         'alles durchstoßen, und das Spielfeld in der Mitte.',
    fracht: 'keine',
    taugt: 'mäßig — die große Mitte ist genau das, was beim Ausmalen stört' },

  { id: 'planetarium', name: 'Planetarium', zeichnung: planetarium,
    herkunft: 'Zeiss, ab 1923',
    was: 'Die Kuppel von unten, darunter Sitzreihen in Bögen, in der Mitte ' +
         'der Projektor. Ein Raum, dessen ganzer Zweck es ist, dass alle ' +
         'nach oben sehen.',
    fracht: 'keine',
    taugt: 'ruhig und sehr gleichmäßig — nahe an unserer Kuppel' },

  { id: 'panoptikum', name: 'Panoptikum', zeichnung: panoptikum,
    herkunft: 'Jeremy Bentham, 1791',
    was: 'Zellen im Ring, in der Mitte ein Turm, von dem aus einer alle ' +
         'sieht, ohne selbst gesehen zu werden. Die vollkommenste radiale ' +
         'Ordnung der Neuzeit — und die unangenehmste.',
    fracht: 'hoch — als Gefängnis der totalen Überwachung entworfen',
    taugt: 'die Ordnung ja, der Gedanke nicht — dann aber ohne den Namen' }
];

const CSS = `
*, *::before, *::after { box-sizing: border-box; }
:root {
  --room:#efe9dd; --card:#f8f4ea; --ink:#2f2a22; --quiet:#6d6355;
  --edge:rgba(60,48,32,0.16); --stroke:#3a332a;
}
@media (prefers-color-scheme: dark) {
  :root { --room:#16151a; --card:#201f25; --ink:#e8e2d6; --quiet:#9a9287;
          --edge:rgba(0,0,0,0.5); --stroke:#d8d2c6; }
}
html { -webkit-text-size-adjust:100%; }
body {
  margin:0; background:var(--room); color:var(--ink);
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  line-height:1.6; -webkit-font-smoothing:antialiased;
  padding: clamp(24px,6vw,64px) clamp(18px,5vw,40px)
           calc(clamp(24px,6vw,64px) + env(safe-area-inset-bottom));
}
main { max-width:60rem; margin:0 auto; }
h1 { margin:0 0 .15em; font-family:ui-serif,'Iowan Old Style',Georgia,serif;
     font-weight:500; font-size:clamp(28px,6vw,40px); letter-spacing:-.01em; }
.lede { margin:0 0 2.2rem; color:var(--quiet); max-width:44rem; }
h2 { margin:2.8rem 0 1rem; font-size:14px; font-weight:600; letter-spacing:.08em;
     text-transform:uppercase; color:var(--quiet);
     border-top:1px solid var(--edge); padding-top:1.2rem; }
.tafel { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); }
.karte { background:var(--card); border-radius:16px; padding:18px;
         box-shadow:0 1px 2px var(--edge), 0 10px 28px -16px var(--edge); }
.karte svg { display:block; width:100%; height:auto; margin-bottom:14px; }
.karte h3 { margin:0; font-size:17px; font-weight:600; }
.karte .herkunft { margin:0 0 .6rem; font-size:13.5px; color:var(--quiet); }
.karte p { margin:0 0 .6rem; font-size:14.5px; }
.karte dl { margin:0; font-size:13.5px; color:var(--quiet); }
.karte dt { float:left; clear:left; width:5.6em; font-weight:600; color:var(--ink); }
.karte dd { margin:0 0 .2em 5.6em; }
svg .thin { stroke-width:.7; }
svg .fill { fill:var(--stroke); fill-opacity:.14; }
svg * { fill:none; stroke:var(--stroke); stroke-width:1.25;
        stroke-linejoin:round; stroke-linecap:round; vector-effect:non-scaling-stroke; }
svg rect.fill, svg circle.fill, svg path.fill { fill:var(--stroke); fill-opacity:.14; }
.note { margin:2.6rem 0 0; padding:16px 18px; border-radius:14px;
        border:1px solid var(--edge); font-size:14.5px; color:var(--quiet); }
.note strong { color:var(--ink); }
.note + .note { margin-top:1rem; }
footer { margin-top:2.4rem; font-size:13.5px; color:var(--quiet); }
a { color:inherit; }
`;

function karte(f) {
  return '<article class="karte">' +
    '<svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="Schema: ' +
      f.name + '">' + f.zeichnung() + '</svg>' +
    '<h3>' + f.name + '</h3>' +
    '<p class="herkunft">' + f.herkunft + '</p>' +
    '<p>' + f.was.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>' +
    '<dl><dt>Fracht</dt><dd>' + f.fracht + '</dd>' +
        '<dt>Taugt</dt><dd>' + f.taugt.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') +
        '</dd></dl>' +
  '</article>';
}

let body = '';
let offen = false;
FAMILIEN.forEach(function (f) {
  if (f.gruppe) {
    if (offen) body += '</div>\n';
    body += '<h2>' + f.gruppe + '</h2>\n<div class="tafel">\n';
    offen = true;
  } else {
    body += karte(f) + '\n';
  }
});
if (offen) body += '</div>\n';

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Moderne</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Fünfzehn radiale Ordnungen aus der Neuzeit, im selben Maßstab gezeichnet.">
<meta name="theme-color" content="#efe9dd" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16151a" media="(prefers-color-scheme: dark)">
<link rel="icon" href="../beide-icon-192.png">

<!-- Erzeugt von tools/gen-moderne.js — nicht von Hand ändern. -->

<style>${CSS}</style>
</head>
<body>
<main>

  <h1>Moderne</h1>
  <p class="lede">Fünfzehn Ordnungen aus der Neuzeit, die rund sind — im
     selben Maßstab und derselben Strichsprache wie die
     <a href="motive.html">Schautafel der Motivfamilien</a>, damit sich beide
     nebeneinander lesen lassen.</p>

  <p class="note">
    <strong>Warum keine Häuser.</strong> Der Anstoß war ein Ausmalbild
    „modernes Designhaus“ — ein Haus in Perspektive, mit Horizont, Himmel und
    Rasen. Das geht in diesen beiden Apps nicht, und zwar nicht aus Aufwand,
    sondern aus Bauart: Beide sind <em>radialsymmetrische Maschinen</em>. Im
    Atelier wird ein Segment gezeichnet und n-mal gedreht; in Blatt wird das
    Relief über einen einzigen Keil gerechnet und n-mal gedreht. Ein
    perspektivisches Haus hat null Drehsymmetrie — es wäre kein schwieriges
    Motiv, sondern ein Fremdkörper. Dazu kämen Himmel, Wand und Rasen als
    große Flächen, und genau dort wird Farbe von Hand streifig.
  </p>

  <p class="note">
    <strong>Die Moderne hat trotzdem eigene runde Ordnungen.</strong> Sie
    stehen hier. Wie auf der Schwesterseite sind es <em>Schemata</em>, keine
    Rekonstruktionen: Sie zeigen die Ordnung, nicht die Ausführung. Gezeichnet
    aus Koordinaten, weil in diesem Projekt nichts von außen geholt wird —
    weder Bilder noch Schriften.
  </p>

${body}
  <p class="note">
    <strong>Was auffällt.</strong> Bei den alten Vorbildern stand in der Spalte
    <em>Fracht</em> fast immer etwas — ein Gottheitenprogramm, ein Bildzyklus,
    eine Bedeutung, die man nicht mit übernehmen will. Hier steht dreizehnmal
    „keine“. Ingenieurbau trägt nichts, was zu klären wäre. Die eine Ausnahme
    ist das Panoptikum, und sie ist eine gründliche: Die Ordnung ist
    vollkommen, der Gedanke dahinter abscheulich. Es gilt dieselbe Regel wie
    bei den religiösen Vorbildern — übernommen würde die Ordnung, nicht die
    Bedeutung, und dann ohne den Namen.
  </p>

  <p class="note">
    <strong>Und was technisch neu wäre.</strong> Drei Schemata können die Apps
    heute noch nicht: ein <em>dreizähliges</em> Motiv (Rotor), etwas
    <em>Gedrehtes</em> mit Drehsinn (Spiralrampe, Doppelwendel — bisher ist
    jedes Motiv spiegelsymmetrisch), und ein <em>Dreiecksnetz</em> statt Ringen
    und Speichen (Geodätische Kuppel). Das sind keine Hindernisse, sondern der
    eigentliche Gewinn: An ihnen wächst der Generator.
  </p>

  <footer>
    Zurück zur <a href="../beide.html">Einstiegsseite</a> ·
    <a href="motive.html">Schautafel der Motivfamilien</a> ·
    <a href="fassungen.html">Fassungen</a>
  </footer>

</main>
</body>
</html>
`;

const ziel = nodePath.join(__dirname, '..', 'docs', 'moderne.html');
fs.writeFileSync(ziel, html);
console.log('docs/moderne.html: ' +
            FAMILIEN.filter(function (f) { return !f.gruppe; }).length +
            ' Schemata in ' +
            FAMILIEN.filter(function (f) { return f.gruppe; }).length + ' Gruppen');
