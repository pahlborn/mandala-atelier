'use strict';

/* ============================================================================
   Erzeugt docs/motive.html – die Schautafel der Motivfamilien.

     node tools/gen-motive.js

   Warum gezeichnet und nicht fotografiert: Bilder aus dem Netz einzubinden
   verbietet sich hier doppelt – rechtlich, und weil in diesem Projekt nichts
   von außen geholt wird. Alle Grundrisse entstehen deshalb aus Koordinaten,
   im selben Maßstab und derselben Strichsprache. Erst dadurch lassen sie
   sich überhaupt vergleichen: Ein Foto einer Thangka und eine Bauzeichnung
   nebeneinander vergleicht man nicht, man bestaunt sie.

   Die Zeichnungen sind **Schemata**, keine Rekonstruktionen. Sie zeigen die
   Ordnung, nicht die Ausführung – Zahl der Ringe, Lage der Tore, Art der
   Teilung. Wo eine Vorlage komplizierter ist als das Schema, steht es dabei.
   ========================================================================== */

const fs = require('fs');
const nodePath = require('path');

const S = 200;                 // Kantenlänge des Feldes
const C = S / 2;
const R = 88;                  // Außenradius, wo es einen gibt
const TAU = Math.PI * 2;

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
function rect(half, cls) {
  return '<rect x="' + n(C - half) + '" y="' + n(C - half) + '" width="' +
         n(half * 2) + '" height="' + n(half * 2) + '"' +
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
    const a = -Math.PI / 2 + (i + (phase || 0)) * (TAU / count);
    const p0 = pol(r0, a), p1 = pol(r1, a);
    out += line(p0[0], p0[1], p1[0], p1[1], cls);
  }
  return out;
}

/* Etwas viermal um die Mitte drehen – die vier Himmelsrichtungen. */
function vier(inner) {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += '<g transform="rotate(' + (i * 90) + ' ' + C + ' ' + C + ')">' +
           inner + '</g>';
  }
  return out;
}


/* ---------------------------------------------------------------------------
   Die Grundrisse
   ------------------------------------------------------------------------- */

/* 1. Der tibetische Palast – das, was im Atelier steht. */
function tibet() {
  const wall = 50, win = 45, hof = 30, kam = 18;
  let g = circle(R) + circle(78) + circle(68);
  g += spokes(68, 78, 24, 0.5, 'thin') + spokes(78, R, 24, 0, 'thin');
  g += rect(wall) + rect(win) + rect(hof) + circle(10);
  /* vier Tore, nach außen abnehmend */
  g += vier(
    '<rect x="' + (C - 13) + '" y="' + (C - wall - 8) + '" width="26" height="8"/>' +
    '<rect x="' + (C - 9) + '" y="' + (C - wall - 14) + '" width="18" height="6"/>' +
    '<rect x="' + (C - 5) + '" y="' + (C - wall - 18) + '" width="10" height="4"/>');
  /* Binder in der Mauer und Teilung des Hofes */
  g += vier(line(C - 30, C - wall, C - 30, C - win, 'thin') +
            line(C + 30, C - wall, C + 30, C - win, 'thin') +
            line(C - hof, C - win, C - hof, C - hof, 'thin') +
            line(C + hof, C - win, C + hof, C - hof, 'thin') +
            line(C, C - hof, C, C - kam, 'thin'));
  g += rect(kam, 'thin');
  return g;
}

/* 2. Die äußeren Ringe des Kalachakra – die Schutzbereiche. */
function ringe() {
  let g = '';
  /* Feuerwall: Zacken */
  const zack = [];
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * TAU - Math.PI / 2;
    zack.push(pol(i % 2 ? R : R - 7, a));
  }
  g += path(d(zack, true));
  g += circle(R - 7);
  /* Vajra-Zaun: Striche */
  g += circle(R - 15) + spokes(R - 15, R - 7, 48, 0, 'thin');
  /* Lotoszaun: Blätter */
  let lotos = '';
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU - Math.PI / 2;
    const p = pol(R - 22, a);
    lotos += '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="3.4" class="thin"/>';
  }
  g += lotos + circle(R - 26);
  /* Weltozean: Wellen */
  const welle = [];
  for (let i = 0; i <= 240; i++) {
    const a = (i / 240) * TAU;
    welle.push(pol((R - 33) + Math.cos(a * 24) * 2.6, a - Math.PI / 2));
  }
  g += path(d(welle, true), 'thin');
  /* und ganz innen erst der Palast */
  g += rect(34) + rect(29, 'thin') + circle(8);
  g += vier('<rect x="' + (C - 9) + '" y="' + (C - 42) + '" width="18" height="8"/>');
  return g;
}

/* 3. Vastu Purusha Mandala – 9 × 9 Felder, kein Kreis. */
function vastu() {
  const a = 18, b = 182, step = (b - a) / 9;
  let g = '<rect x="' + a + '" y="' + a + '" width="' + (b - a) +
          '" height="' + (b - a) + '"/>';
  for (let i = 1; i < 9; i++) {
    g += line(a + i * step, a, a + i * step, b, 'thin');
    g += line(a, a + i * step, b, a + i * step, 'thin');
  }
  /* Brahmasthana: die neun Felder in der Mitte gehören zusammen */
  g += '<rect x="' + (a + 3 * step) + '" y="' + (a + 3 * step) + '" width="' +
       (3 * step) + '" height="' + (3 * step) + '" class="fill"/>';
  g += line(a, a, b, b, 'thin') + line(b, a, a, b, 'thin');
  return g;
}

/* 4. Neun Versammlungen – das Diamant-Mandala als Tafel. */
function neunfeld() {
  const a = 18, b = 182, step = (b - a) / 3;
  let g = '<rect x="' + a + '" y="' + a + '" width="' + (b - a) +
          '" height="' + (b - a) + '"/>';
  for (let i = 1; i < 3; i++) {
    g += line(a + i * step, a, a + i * step, b);
    g += line(a, a + i * step, b, a + i * step);
  }
  /* in jedem Feld ein eigenes kleines Mandala */
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = a + (c + 0.5) * step, cy = a + (r + 0.5) * step;
      const mitte = (r === 1 && c === 1);
      g += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' +
           (mitte ? 15 : 13) + '" class="thin"/>';
      g += '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="4" class="' +
           (mitte ? 'fill' : 'thin') + '"/>';
      for (let k = 0; k < 4; k++) {
        const ang = k * (TAU / 4) - Math.PI / 2;
        g += '<circle cx="' + n(cx + Math.cos(ang) * 8.5) + '" cy="' +
             n(cy + Math.sin(ang) * 8.5) + '" r="2.6" class="thin"/>';
      }
    }
  }
  return g;
}

/* 5. Borobudur – unten quadratisch, oben rund. */
function borobudur() {
  let g = '';
  /* Fuenf quadratische Umgaenge mit vorspringender Mitte je Seite - der
     redentierte Grundriss. Wichtig: Die letzte Ecke einer Seite muss die
     erste der naechsten sein, sonst schneidet die Drehung die Ecken ab und
     aus dem Quadrat wird ein Achteck. */
  for (let i = 0; i < 5; i++) {
    const h = 86 - i * 9;
    const k = h * 0.44;                       // halbe Breite des Vorsprungs
    const v = h * 0.12;                       // wie weit er vortritt
    const seite = [[-h, -h], [-k, -h], [-k, -h - v], [k, -h - v], [k, -h], [h, -h]];
    const pts = [];
    for (let q = 0; q < 4; q++) {
      const rot = q * (Math.PI / 2);
      seite.forEach(function (p) {
        const x = p[0] * Math.cos(rot) - p[1] * Math.sin(rot);
        const y = p[0] * Math.sin(rot) + p[1] * Math.cos(rot);
        pts.push([C + x, C + y]);
      });
    }
    g += path(d(pts, true), i ? 'thin' : '');
  }
  /* drei Rundterrassen mit 32, 24, 16 Stupas */
  [[36, 32], [27, 24], [19, 16]].forEach(function (t) {
    g += circle(t[0], 'thin');
    for (let i = 0; i < t[1]; i++) {
      const a = (i / t[1]) * TAU - Math.PI / 2;
      const p = pol(t[0], a);
      g += '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="2" class="thin"/>';
    }
  });
  g += circle(9, 'fill');
  return g;
}

/* 6. Srirangam – sieben Ringe, und die Tore werden nach innen kleiner. */
function srirangam() {
  let g = '';
  const tor = function (h, w, t) {
    return vier('<rect x="' + n(C - w / 2) + '" y="' + n(C - h - t) +
                '" width="' + n(w) + '" height="' + n(t) + '"/>');
  };
  for (let i = 0; i < 7; i++) {
    const h = 88 - i * 12;
    g += rect(h, i ? 'thin' : '');
    if (i < 6) g += tor(h, 20 - i * 2.4, 7 - i * 0.8);
  }
  g += rect(6, 'fill');
  return g;
}

/* 7. Chahar Bagh – vier Wasserläufe aus einem Becken. */
function chahar() {
  const a = 16, b = 184;
  let g = '<rect x="' + a + '" y="' + a + '" width="' + (b - a) +
          '" height="' + (b - a) + '"/>';
  g += '<rect x="' + (a + 8) + '" y="' + (a + 8) + '" width="' + (b - a - 16) +
       '" height="' + (b - a - 16) + '" class="thin"/>';
  /* die Kreuzachsen als Kanäle */
  g += '<rect x="' + (C - 5) + '" y="' + (a + 8) + '" width="10" height="' +
       (b - a - 16) + '" class="thin"/>';
  g += '<rect x="' + (a + 8) + '" y="' + (C - 5) + '" width="' + (b - a - 16) +
       '" height="10" class="thin"/>';
  /* Becken in der Mitte, achteckig */
  const acht = [];
  for (let i = 0; i < 8; i++) acht.push(pol(15, (i / 8) * TAU + Math.PI / 8));
  g += path(d(acht, true));
  /* jedes Viertel noch einmal geviertelt, mit Baumreihen */
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
    const x0 = C + q[0] * 13, x1 = C + q[0] * 76;
    const y0 = C + q[1] * 13, y1 = C + q[1] * 76;
    g += line((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, 'thin');
    g += line(x0, (y0 + y1) / 2, x1, (y0 + y1) / 2, 'thin');
    for (let i = 0; i < 4; i++) {
      const px = x0 + (x1 - x0) * (0.25 + 0.5 * (i % 2));
      const py = y0 + (y1 - y0) * (0.25 + 0.5 * ((i / 2) | 0));
      g += '<circle cx="' + n(px) + '" cy="' + n(py) + '" r="4.5" class="thin"/>';
    }
  });
  return g;
}

/* 8. Palmanova – neuneckige Sternfestung mit Radialstraßen. */
function palmanova() {
  const N = 9;
  let g = '';
  const ecke = function (r, i, off) { return pol(r, (i + (off || 0)) * (TAU / N) - Math.PI / 2); };
  /* Kurtinen und Bastionen */
  const mauer = [], stern = [];
  for (let i = 0; i < N; i++) {
    mauer.push(ecke(74, i));
    stern.push(ecke(74, i));
    stern.push(ecke(88, i, 0.5));
  }
  g += path(d(stern, true));
  g += path(d(mauer, true), 'thin');
  /* innerer Häuserring */
  const innen = [];
  for (let i = 0; i < N; i++) innen.push(ecke(48, i));
  g += path(d(innen, true), 'thin');
  /* Piazza als Sechseck */
  const piazza = [];
  for (let i = 0; i < 6; i++) piazza.push(pol(16, (i / 6) * TAU - Math.PI / 2));
  g += path(d(piazza, true));
  /* Radialstraßen: drei zu den Toren, die übrigen zum Ring */
  for (let i = 0; i < N; i++) {
    const p = ecke(74, i);
    const q = pol(16, ((i + 0) * (TAU / N) - Math.PI / 2));
    g += line(q[0], q[1], p[0], p[1], i % 3 === 0 ? '' : 'thin');
  }
  for (let i = 0; i < N; i++) {
    const p0 = ecke(48, i, 0.5), p1 = ecke(74, i, 0.5);
    g += line(p0[0], p0[1], p1[0], p1[1], 'thin');
  }
  return g;
}

/* 9. Das Labyrinth von Chartres – ein einziger Weg, schematisch. */
function labyrinth() {
  let g = circle(R);
  /* elf Umgänge; die Lücken sitzen abwechselnd auf den vier Achsen und
     erzeugen die Wendungen. Das echte Muster ist unregelmäßiger – hier geht
     es um das Prinzip: ein Weg, keine Abzweigung. */
  for (let i = 0; i < 11; i++) {
    const r = R - 4 - i * 6;
    const achse = (i % 4) * (Math.PI / 2) - Math.PI / 2;
    const luecke = 0.16;
    const pts = [];
    for (let k = 0; k <= 120; k++) {
      const a = achse + luecke + (TAU - 2 * luecke) * (k / 120);
      pts.push(pol(r, a));
    }
    g += path(d(pts, false), 'thin');
  }
  /* Rosette in der Mitte: sechs Blätter */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    const p = pol(9, a);
    g += '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="7" class="thin"/>';
  }
  g += circle(9);
  return g;
}

/* 10. Die Rundstadt Bagdad – ein Kreis als Stadtplan. */
function bagdad() {
  let g = circle(R) + circle(80) + circle(58);
  /* Wohnring zwischen den Mauern, in Parzellen geteilt */
  g += spokes(58, 80, 48, 0, 'thin');
  /* vier Tore auf den Diagonalen, dahinter je eine gerade Straße zur Mitte */
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * (Math.PI / 2);
    const p0 = pol(30, a), p1 = pol(R, a);
    g += line(p0[0], p0[1], p1[0], p1[1]);
    const t0 = pol(80, a), t1 = pol(R + 2, a);
    g += line(t0[0] - Math.sin(a) * 6, t0[1] + Math.cos(a) * 6,
              t1[0] - Math.sin(a) * 6, t1[1] + Math.cos(a) * 6);
    g += line(t0[0] + Math.sin(a) * 6, t0[1] - Math.cos(a) * 6,
              t1[0] + Math.sin(a) * 6, t1[1] - Math.cos(a) * 6);
  }
  /* in der Mitte nur Palast und Moschee, sonst nichts */
  g += circle(30);
  g += rect(15) + '<rect x="' + (C - 15) + '" y="' + (C - 15) +
       '" width="15" height="30" class="fill"/>';
  return g;
}

/* 11. Das römische Lager – zwei Achsen, ein Raster. */
function castrum() {
  const x0 = 16, x1 = 184, y0 = 34, y1 = 166;
  let g = '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) +
          '" height="' + (y1 - y0) + '"/>';
  g += '<rect x="' + (x0 + 6) + '" y="' + (y0 + 6) + '" width="' + (x1 - x0 - 12) +
       '" height="' + (y1 - y0 - 12) + '" class="thin"/>';
  /* cardo und decumanus als Straßen, nicht als Striche */
  g += '<rect x="' + (C - 7) + '" y="' + y0 + '" width="14" height="' +
       (y1 - y0) + '" class="thin"/>';
  g += '<rect x="' + x0 + '" y="' + (C - 7) + '" width="' + (x1 - x0) +
       '" height="14" class="thin"/>';
  /* Insulae */
  for (let i = 1; i < 4; i++) {
    const x = x0 + 6 + (C - 7 - x0 - 6) * (i / 4);
    g += line(x, y0 + 6, x, y1 - 6, 'thin');
    g += line(x1 - (x - x0), y0 + 6, x1 - (x - x0), y1 - 6, 'thin');
  }
  for (let i = 1; i < 3; i++) {
    const y = y0 + 6 + (C - 7 - y0 - 6) * (i / 3);
    g += line(x0 + 6, y, x1 - 6, y, 'thin');
    g += line(x0 + 6, y1 - (y - y0), x1 - 6, y1 - (y - y0), 'thin');
  }
  /* Forum am Kreuz, vier Tore an den Achsen */
  g += '<rect x="' + (C - 22) + '" y="' + (C - 18) + '" width="44" height="36" class="fill"/>';
  g += '<rect x="' + (C - 22) + '" y="' + (C - 18) + '" width="44" height="36"/>';
  [[C, y0, 16, 5], [C, y1 - 5, 16, 5]].forEach(function (t) {
    g += '<rect x="' + (t[0] - t[2] / 2) + '" y="' + t[1] + '" width="' + t[2] +
         '" height="' + t[3] + '" class="fill"/>';
  });
  [[x0, C, 5, 16], [x1 - 5, C, 5, 16]].forEach(function (t) {
    g += '<rect x="' + t[0] + '" y="' + (t[1] - t[3] / 2) + '" width="' + t[2] +
         '" height="' + t[3] + '" class="fill"/>';
  });
  return g;
}

/* 12. Das himmlische Jerusalem – ein Quadrat mit zwölf Toren. */
function jerusalem() {
  const h = 82, w = 74;
  let g = rect(h) + rect(w, 'thin');
  /* drei Tore je Seite */
  g += vier((function () {
    let s = '';
    [-40, 0, 40].forEach(function (off) {
      s += '<rect x="' + (C + off - 8) + '" y="' + (C - h - 1) +
           '" width="16" height="' + (h - w + 2) + '" class="fill"/>';
      s += '<rect x="' + (C + off - 8) + '" y="' + (C - h - 1) +
           '" width="16" height="' + (h - w + 2) + '"/>';
    });
    return s;
  })());
  /* zwölf Grundsteine als Teilung des Mauerbandes */
  g += vier((function () {
    let s = '';
    [-62, -20, 20, 62].forEach(function (off) {
      s += line(C + off, C - h, C + off, C - w, 'thin');
    });
    return s;
  })());
  /* Straßen zur Mitte – und die Mitte bleibt leer */
  g += vier(line(C, C - w, C, C - 22, 'thin'));
  g += circle(22, 'thin');
  return g;
}

/* 13. Die Fensterrose – Architektur, frontal gesehen. */
function rosette() {
  let g = circle(R) + circle(80, 'thin');
  /* zwölf äußere Pässe */
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU - Math.PI / 2;
    const p = pol(63, a);
    g += '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="15"/>';
    g += '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="8" class="thin"/>';
  }
  /* zwölf Vierpässe im Zwischenring */
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * TAU - Math.PI / 2;
    const p = pol(37, a);
    for (let k = 0; k < 4; k++) {
      const b = k * (TAU / 4) + a;
      g += '<circle cx="' + n(p[0] + Math.cos(b) * 3.4) + '" cy="' +
           n(p[1] + Math.sin(b) * 3.4) + '" r="3.6" class="thin"/>';
    }
  }
  g += circle(22);
  /* Mitte: sechs Blätter */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    const p = pol(11, a);
    g += '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="8" class="thin"/>';
  }
  g += circle(6, 'fill');
  return g;
}

/* 14. Die Sternkuppel – ein Gewölbe von unten. */
function sternkuppel() {
  const N = 16;
  let g = circle(R);
  /* äußerer Kranz aus langgezogenen Sechsecken */
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU - Math.PI / 2;
    const b = ((i + 1) / N) * TAU - Math.PI / 2;
    const m = (a + b) / 2;
    g += path(d([pol(88, a), pol(66, a), pol(52, m), pol(66, b), pol(88, b)], false), 'thin');
  }
  g += circle(66, 'thin');
  /* Rautenkranz */
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU - Math.PI / 2;
    const s = TAU / N / 2;
    g += path(d([pol(66, a), pol(50, a - s), pol(34, a), pol(50, a + s)], true), 'thin');
  }
  /* der Stern in der Mitte */
  const stern = [];
  for (let i = 0; i < N * 2; i++) {
    stern.push(pol(i % 2 ? 34 : 16, (i / (N * 2)) * TAU - Math.PI / 2));
  }
  g += path(d(stern, true));
  g += circle(10, 'fill');
  return g;
}

/* 15. Bandwerk – Architektur als Ornament, nicht als Raum. */
function bandwerk() {
  let g = '';
  /* Mäander */
  const m = [];
  let x = 14;
  const y0 = 40, h = 22;
  while (x < 186) {
    m.push([x, y0 + h], [x, y0], [x + 14, y0], [x + 14, y0 + h - 6],
           [x + 7, y0 + h - 6], [x + 7, y0 + 6], [x + 21, y0 + 6], [x + 21, y0 + h]);
    x += 28;
  }
  g += path(d(m, false));
  /* Flechtband */
  const w1 = [], w2 = [];
  for (let i = 0; i <= 172; i++) {
    const t = 14 + i;
    w1.push([t, 100 + Math.sin(i / 172 * TAU * 6) * 11]);
    w2.push([t, 100 - Math.sin(i / 172 * TAU * 6) * 11]);
  }
  g += path(d(w1, false), 'thin') + path(d(w2, false), 'thin');
  for (let i = 0; i < 6; i++) {
    g += '<circle cx="' + n(14 + 172 * ((i + 0.5) / 6)) + '" cy="100" r="4" class="thin"/>';
  }
  /* Zahnschnitt und Rosetten */
  for (let i = 0; i < 12; i++) {
    const bx = 14 + i * 14.6;
    g += '<rect x="' + n(bx) + '" y="140" width="9" height="9" class="thin"/>';
    g += '<circle cx="' + n(bx + 4.5) + '" cy="166" r="5" class="thin"/>';
    g += '<circle cx="' + n(bx + 4.5) + '" cy="166" r="1.6" class="fill"/>';
  }
  return g;
}


/* ---------------------------------------------------------------------------
   Die Tafel
   ------------------------------------------------------------------------- */

const FAMILIEN = [
  { gruppe: 'Grundriss — das Mandala als Bauplan' },

  { id: 'tibet', name: 'Tibetischer Palast', zeichnung: tibet,
    herkunft: 'Tibet, ab dem 11. Jh.',
    was: 'Runder Schutzbereich, quadratischer Palast mit vier Toren, Innenhöfe, ' +
         'Kammer, Mitte. Was im Atelier als „Anlage“ steht.',
    fracht: 'hoch — im Original mit Gottheitenprogramm besetzt',
    taugt: 'gebaut' },

  { id: 'ringe', name: 'Die äußeren Ringe', zeichnung: ringe,
    herkunft: 'Kalachakra-Mandala',
    was: 'Nach außen folgt Ring auf Ring: Weltozean, Lotoszaun, Vajra-Zaun, ' +
         'Feuerwall. Der Palast selbst nimmt nur die Mitte ein. Wir haben ' +
         'derzeit zwei Ringe, hier sind es vier bis sechs.',
    fracht: 'hoch — Flammen und Leichenfelder sind Bildprogramm',
    taugt: 'Struktur ja, Bildsprache nein' },

  { id: 'vastu', name: 'Vastu Purusha Mandala', zeichnung: vastu,
    herkunft: 'Indien, Vastu Shastra',
    was: 'Kein Kreis, sondern ein Raster: 8 × 8 oder 9 × 9 Felder. In der ' +
         'Mitte das Brahmasthana. Daraus werden Tempel, Häuser und Städte ' +
         'abgeleitet — es ist ein Bauplan-Generator.',
    fracht: 'mittel — jedes Feld trägt im Original eine Gottheit',
    taugt: 'sehr — bricht mit allem im Katalog' },

  { id: 'neunfeld', name: 'Neun Versammlungen', zeichnung: neunfeld,
    herkunft: 'Japan, Shingon',
    was: 'Neun eigenständige Mandalas als Tafel nebeneinander. Kein „von ' +
         'außen nach innen“, sondern ein Nebeneinander — die Ordnung liegt ' +
         'in der Wiederholung des Feldes.',
    fracht: 'mittel',
    taugt: 'als ganz anderes Ordnungsprinzip' },

  { gruppe: 'Aufriss — Mandalas, die gebaut wurden' },

  { id: 'borobudur', name: 'Borobudur', zeichnung: borobudur,
    herkunft: 'Java, 9. Jh.',
    was: 'Neun Plattformen: sechs quadratische mit vorspringenden Ecken, ' +
         'darüber drei runde mit 72 Stupas, oben der Hauptstupa. Das ' +
         'Quadrat wird nach innen zum Kreis.',
    fracht: 'mittel — die Form selbst ist unbelastet',
    taugt: 'sehr — eckig außen, rund innen ist bei uns umgekehrt' },

  { id: 'srirangam', name: 'Srirangam', zeichnung: srirangam,
    herkunft: 'Südindien, Tempelstadt',
    was: 'Sieben konzentrische Mauerringe, 21 Tortürme — und der höchste ' +
         'steht außen, der niedrigste innen. Die äußeren zwei Ringe sind ' +
         'bewohnte Stadt, die inneren fünf Tempel.',
    fracht: 'mittel',
    taugt: 'die umgekehrte Hierarchie ist ein eigener Gedanke' },

  { gruppe: 'Stadt und Anlage — Ordnung ohne Kult' },

  { id: 'chahar', name: 'Chahar Bagh', zeichnung: chahar,
    herkunft: 'Persien, achämenidisch',
    was: 'Vier Wasserläufe aus einem Mittelbecken in die vier ' +
         'Himmelsrichtungen, ummauert, nach innen gewandt. Jedes Viertel ' +
         'noch einmal geviertelt.',
    fracht: 'gering — Gartenbaukunst',
    taugt: 'sehr — unsere Anlage, aber weltlich' },

  { id: 'palmanova', name: 'Palmanova', zeichnung: palmanova,
    herkunft: 'Venedig, 1593',
    was: 'Neuneckige Sternfestung: neun Bastionen, Ringmauer, sechseckige ' +
         'Piazza, Radialstraßen zu den Toren. Reine Geometrie aus ' +
         'Verteidigung und Ordnung.',
    fracht: 'keine',
    taugt: 'sehr — Zacken statt Ringe' },

  { id: 'bagdad', name: 'Rundstadt Bagdad', zeichnung: bagdad,
    herkunft: 'Abbasiden, 762',
    was: 'Eine Stadt als Kreis: drei konzentrische Mauern, vier Tore, von ' +
         'jedem eine gerade Straße zur Mitte. Dazwischen der Wohnring in ' +
         'Parzellen. In der Mitte nur Palast und Moschee — sonst nichts.',
    fracht: 'keine — Stadtplanung',
    taugt: 'sehr — der leere Mittelbezirk ist genau unser Gedanke' },

  { id: 'castrum', name: 'Römisches Lager', zeichnung: castrum,
    herkunft: 'Rom, republikanisch',
    was: 'Zwei Achsen, cardo und decumanus, kreuzen sich am Forum; vier ' +
         'Tore, dazwischen ein Raster aus Insulae. Das nüchternste Schema ' +
         'von allen — und das langlebigste.',
    fracht: 'keine',
    taugt: 'als rechteckige Gegenprobe zum Kreis' },

  { id: 'jerusalem', name: 'Himmlisches Jerusalem', zeichnung: jerusalem,
    herkunft: 'Offenbarung 21, Bildtradition',
    was: 'Ein Quadrat mit zwölf Toren — drei je Seite statt einem — auf ' +
         'zwölf Grundsteinen. Und ausdrücklich ohne Tempel in der Mitte: ' +
         '„einen Tempel sah ich nicht darin.“',
    fracht: 'mittel — christliche Bildtradition, aber als Stadtplan gedacht',
    taugt: 'drei Tore je Seite ändern den Rhythmus völlig' },

  { id: 'labyrinth', name: 'Labyrinth von Chartres', zeichnung: labyrinth,
    herkunft: 'Frankreich, 13. Jh.',
    was: 'Elf Umgänge, vierteilige Symmetrie, in der Mitte eine ' +
         'sechsblättrige Rosette. Kein Raumgefüge, sondern ein einziger ' +
         'Weg — ohne Abzweigung, ohne Sackgasse.',
    fracht: 'gering',
    taugt: 'sehr — „nach innen“ hieße hier etwas ganz anderes' },

  { gruppe: 'Von unten und von vorn — Gewölbe und Fenster' },

  { id: 'rosette', name: 'Fensterrose', zeichnung: rosette,
    herkunft: 'Gotik, 12.–14. Jh.',
    was: 'Kein Grundriss, sondern ein Bauteil von vorn: zwölf Pässe außen, ' +
         'Vierpässe im Zwischenring, in der Mitte eine kleine Rose. Radial ' +
         'geteilt wie ein Mandala, aber aus Maßwerk statt aus Räumen.',
    fracht: 'gering',
    taugt: 'sehr — dichtes Rundmuster ohne jede Fremdheit' },

  { id: 'sternkuppel', name: 'Sternkuppel', zeichnung: sternkuppel,
    herkunft: 'Islamische Baukunst, Girih',
    was: 'Ein Gewölbe von unten gesehen: sechzehnstrahliger Stern, ' +
         'Rautenkranz, außen langgezogene Zellen. Die Ordnung entsteht aus ' +
         'Verflechtung, nicht aus Ringen.',
    fracht: 'gering — Geometrie, keine Figur',
    taugt: 'sehr — Sternpolygone kann das Atelier noch nicht' },

  { gruppe: 'Ornament — Architektur als Vokabular' },

  { id: 'bandwerk', name: 'Bandwerk', zeichnung: bandwerk,
    herkunft: 'Antike bis Klassizismus',
    was: 'Mäander, Flechtband, Zahnschnitt, Rosetten. Kein Grundriss, ' +
         'sondern die Sprache der Bauzier. Das Bild, das den Anstoß gab, ' +
         'ist überwiegend dies.',
    fracht: 'keine',
    taugt: 'am leichtesten zu bauen — das Atelier kann Bänder längst' }
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
svg rect.fill, svg circle.fill { fill:var(--stroke); fill-opacity:.14; }
.note { margin:2.6rem 0 0; padding:16px 18px; border-radius:14px;
        border:1px solid var(--edge); font-size:14.5px; color:var(--quiet); }
.note strong { color:var(--ink); }
footer { margin-top:2.4rem; font-size:13.5px; color:var(--quiet); }
`;

function karte(f) {
  return '<article class="karte">' +
    '<svg viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="Schema: ' +
      f.name + '">' + f.zeichnung() + '</svg>' +
    '<h3>' + f.name + '</h3>' +
    '<p class="herkunft">' + f.herkunft + '</p>' +
    '<p>' + f.was + '</p>' +
    '<dl><dt>Fracht</dt><dd>' + f.fracht + '</dd>' +
        '<dt>Taugt</dt><dd>' + f.taugt + '</dd></dl>' +
  '</article>';
}

let body = '';
let offen = false;
FAMILIEN.forEach(function (f) {
  if (f.gruppe) {
    if (offen) body += '</div>';
    body += '<h2>' + f.gruppe + '</h2><div class="tafel">';
    offen = true;
  } else {
    body += karte(f);
  }
});
if (offen) body += '</div>';

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Motivfamilien</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Architektonische Mandalas: Grundrisse im Vergleich.">
<meta name="theme-color" content="#efe9dd" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16151a" media="(prefers-color-scheme: dark)">
<link rel="icon" href="../icon-192.png">
<!--
  Erzeugt von tools/gen-motive.js – nicht von Hand ändern.

  Alle Zeichnungen entstehen aus Koordinaten. Es wird nichts von außen
  geholt: kein Bild, keine Schrift, kein Skript. Das ist hier nicht nur
  Prinzip, sondern auch die einzige Art, zehn sehr verschiedene Vorlagen
  überhaupt vergleichbar zu machen.
-->
<style>${CSS}</style>
</head>
<body>
<main>
  <h1>Motivfamilien</h1>
  <p class="lede">Zehn Ordnungen, die in der Literatur unter „architektonisches
     Mandala“ laufen — im selben Maßstab und derselben Strichsprache gezeichnet,
     damit man sie nebeneinanderhalten kann. Es sind <b>Schemata</b>: Sie zeigen
     die Ordnung, nicht die Ausführung.</p>
  ${body}
  <p class="note">
    <strong>Zu „Fracht“:</strong> gemeint ist, wie viel religiöse Bedeutung an
    der Form hängt, wenn man sie übernimmt. Die Regel des Projekts lautet: keine
    religiös aufgeladenen Zeichen ohne Rücksprache. Eine Bauordnung ist kein
    Zeichen — aber je näher man an das Bildprogramm rückt, desto weniger stimmt
    das. Deshalb steht es bei jeder Familie dabei.
  </p>
  <footer>
    Gezeichnet, nicht abfotografiert: aus Koordinaten erzeugt von
    <code>tools/gen-motive.js</code>. Nichts an dieser Seite wird von außen
    geladen.
  </footer>
</main>
</body>
</html>
`;

const out = nodePath.join(__dirname, '..', 'docs', 'motive.html');
fs.writeFileSync(out, html);
console.log('geschrieben: docs/motive.html  (' + (html.length / 1024).toFixed(0) + ' kB)');
