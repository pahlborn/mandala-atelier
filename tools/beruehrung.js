'use strict';
/* Polygone in Berührung (Hankin), radial — ein VERSUCH, kein Teil der App.

   Er gehört zu docs/beruehrung.html und liegt hier, damit die Seite
   nachgerechnet werden kann statt nur geglaubt. Die App lädt diese Datei
   nicht; sw.js kennt sie nicht.

   Die Methode, nachgebaut: Man legt ein Netz aus Polygonen. In der MITTE
   JEDER KANTE kreuzen sich zwei Linien unter EINEM Winkel, der für das ganze
   Muster gilt. Man verlängert sie, bis sie auf andere treffen.

   Der Unterschied zu allem, was ich bisher gezeichnet habe: Kein Winkel wird
   gewählt. Alle folgen aus dem einen Kontaktwinkel. Deshalb stimmen die
   Kreuzungen überein - und das ist es, was zwingend aussieht. */

const CX = 450, CY = 450, TAU = Math.PI * 2, UP = -Math.PI / 2;

function pol(r, a) { return [CX + Math.cos(a) * r, CY + Math.sin(a) * r]; }

/* Ein regelmäßiges n-Eck auf dem Radius r, um `dreh` gedreht. */
function ngon(n, r, dreh) {
  const p = [];
  for (let i = 0; i < n; i++) p.push(pol(r, UP + dreh + i * TAU / n));
  return p;
}

function schnitt(p, d, q, e) {
  const nenner = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(nenner) < 1e-9) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / nenner;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

function dreh(v, w) {
  const c = Math.cos(w), s = Math.sin(w);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/* Hankins Regel für EINE Kachel. Aus jeder Kantenmitte zwei Strahlen unter
   dem Kontaktwinkel; der vorwärts laufende trifft den rückwärts laufenden
   der nächsten Kante. Die Verbindung Mitte → Treffpunkt → nächste Mitte ist
   das Muster in dieser Kachel. Weil benachbarte Kacheln dieselbe Kantenmitte
   teilen, wachsen die Stücke von selbst zusammen. */
function picKachel(pts, winkelGrad) {
  const w = winkelGrad * Math.PI / 180;
  const n = pts.length;
  const mitte = [], vor = [], zurueck = [];
  /* Umlaufsinn bestimmen, damit „innen" wirklich innen ist. */
  let flaeche = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    flaeche += a[0] * b[1] - b[0] * a[1];
  }
  const vz = flaeche > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    mitte.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const e = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    vor.push(dreh(e, -vz * w));
    zurueck.push(dreh([-e[0], -e[1]], vz * w));
  }
  const stuecke = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const t = schnitt(mitte[i], vor[i], mitte[j], zurueck[j]);
    /* Der Treffpunkt muss IN der Kachel liegen. Ohne diese Prüfung laufen
       zwei fast parallele Strahlen bis zu ihrem Schnittpunkt weit draußen -
       im ersten Versuch schossen Linien quer über das ganze Blatt hinaus.
       Treffen sie sich nicht drinnen, verbindet eine gerade Sehne die
       beiden Kantenmitten; das ist der Grenzfall derselben Regel. */
    if (t && drin(pts, t)) stuecke.push([mitte[i], t, mitte[j]]);
    else stuecke.push([mitte[i], mitte[j]]);
  }
  return stuecke;
}

/* Punkt in konvexem Vieleck: Liegt er auf derselben Seite jeder Kante? */
function drin(pts, q) {
  const n = pts.length;
  let plus = 0, minus = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const kreuz = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    if (kreuz > 1e-6) plus++;
    if (kreuz < -1e-6) minus++;
  }
  return plus === 0 || minus === 0;
}

/* Das radiale Netz: konzentrische n-Ecke, jeder zweite Ring um eine halbe
   Teilung gedreht. Zwischen zwei Ringen liegen dann Dreiecke statt Vierecke -
   und Dreiecke ergeben Sterne. Genau so ist die persische Schamsa gebaut. */
function netz(n, radien, versetzt) {
  const ringe = radien.map(function (r, j) {
    return ngon(n, r, versetzt && j % 2 ? Math.PI / n : 0);
  });
  const kacheln = [];
  for (let j = 0; j < ringe.length - 1; j++) {
    const A = ringe[j], B = ringe[j + 1];
    const gedreht = versetzt && (j % 2 === 0);
    for (let i = 0; i < n; i++) {
      if (!versetzt) {
        kacheln.push([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]]);
      } else if (gedreht) {
        kacheln.push([A[i], A[(i + 1) % n], B[i]]);
        kacheln.push([A[(i + 1) % n], B[(i + 1) % n], B[i]]);
      } else {
        kacheln.push([A[i], B[(i + 1) % n], B[i]]);
        kacheln.push([A[i], A[(i + 1) % n], B[(i + 1) % n]]);
      }
    }
  }
  return { kacheln: kacheln, ringe: ringe };
}

function d(pts) {
  return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
}

function zeichne(n, radien, winkel, versetzt, opt) {
  opt = opt || {};
  const { kacheln, ringe } = netz(n, radien, versetzt);
  let out = '';
  if (opt.netzZeigen) {
    out += '<g stroke="#c9bfae" stroke-width="0.8" fill="none">';
    kacheln.forEach(function (k) { out += '<path d="' + d(k) + ' Z"/>'; });
    out += '</g>';
  }
  out += '<g stroke="#3a3226" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="' + (opt.strich || 2) + '">';
  kacheln.forEach(function (k) {
    picKachel(k, winkel).forEach(function (s) { out += '<path d="' + d(s) + '"/>'; });
  });
  out += '</g>';
  if (opt.rahmen !== false) {
    out += '<circle cx="450" cy="450" r="' + radien[radien.length - 1] + '" fill="none" stroke="#3a3226" stroke-width="2.6"/>';
  }
  return out;
}

function svg(inner, groesse) {
  return '<svg viewBox="0 0 900 900" width="' + (groesse || 300) + '" height="' + (groesse || 300) +
         '" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="900" fill="#f8f4ea"/>' + inner + '</svg>';
}

module.exports = { zeichne, svg, netz, picKachel };

if (require.main === module) {
  /* Genau die Radien und die Nabe der Seite docs/beruehrung.html. */
  const R = [110, 190, 270, 345, 410];
  const NABE = '<circle cx="450" cy="450" r="46" fill="none" stroke="#3a3226" stroke-width="2.6"/>';
  const proben = [
    ['8 Achsen · 72°',   zeichne(8,  R, 72, true, { strich: 2.6 })],
    ['10 Achsen · 72°',  zeichne(10, R, 72, true, { strich: 2.6 })],
    ['12 Achsen · 72°',  zeichne(12, R, 72, true, { strich: 2.6 })],
    ['12 Achsen · 55°',  zeichne(12, R, 55, true, { strich: 2.6 })],
    ['12 Achsen · 80°',  zeichne(12, R, 80, true, { strich: 2.6 })],
    ['Netz sichtbar',    zeichne(12, R, 72, true, { strich: 2.6, netzZeigen: true })]
  ];
  const fs = require('fs');
  const ziel = process.argv[2] || '.';
  let h = '<style>body{background:#efe9dd;font:13px sans-serif;margin:0;padding:8px}' +
          'figure{display:inline-block;text-align:center;margin:4px;width:310px}' +
          'figcaption{font-weight:600}</style>';
  proben.forEach(function (p) { h += '<figure>' + svg(p[1] + NABE) + '<figcaption>' + p[0] + '</figcaption></figure>'; });
  fs.writeFileSync(ziel + '/beruehrung-proben.html', h);
  console.log('geschrieben nach ' + ziel + '/beruehrung-proben.html');
}
