'use strict';

/* ============================================================================
   Mandala Atelier – gesamte Logik

   Abschnitte
     1.  Konstanten
     2.  Kleiner Speicher (Store)
     3.  Zufall mit festem Seed
     4.  Ebenen und Skalierung
     5.  Geometrie-Bausteine
     6.  Rahmen und Motivkatalog
     7.  Zahlen-, Zähl- und Rechenfelder
     8.  Zeichnen mit Symmetrie
     9.  Füllen (Scanline-Flood-Fill)
     10. Hilfsraster
     11. Verlauf (Rückgängig)
     12. Oberfläche
     13. Start

   Zur Laufzeit gibt es keine Abhängigkeiten. Alles läuft im Browser,
   nichts verlässt das Gerät.
   ========================================================================== */


/* ---------------------------------------------------------------------------
   1. Konstanten
   ------------------------------------------------------------------------- */

const SIZE  = 900;              // logische Kantenlänge aller Ebenen
const CX    = SIZE / 2;
const CY    = SIZE / 2;
const R_OUT = 410;              // Außenring des Rahmens
const R_IN  = 46;               // Innenring (Nabe)
const UP    = -Math.PI / 2;     // Bezugsrichtung aller Motive: nach oben
const TAU   = Math.PI * 2;

const INK   = '#242424';        // Linienfarbe der Vorlagen
const PAPER = '#f6f1e7';        // Papierton für gespeicherte Bilder

/* Gedeckte Pigmente statt Buntstift-Knallfarben – sie tragen die
   erwachsene Anmutung der App wesentlich. */
const PIGMENTS = [
  { name: 'Terrakotta', hex: '#b5654a' },
  { name: 'Rost',       hex: '#8c4a2f' },
  { name: 'Mohn',       hex: '#a8342f' },
  { name: 'Ocker',      hex: '#c89b3c' },
  { name: 'Sand',       hex: '#d9c4a3' },
  { name: 'Olive',      hex: '#6e7233' },
  { name: 'Salbei',     hex: '#7c8c6b' },
  { name: 'Moos',       hex: '#3f5b3a' },
  { name: 'Petrol',     hex: '#2e6b6b' },
  { name: 'Nebelblau',  hex: '#7c93a8' },
  { name: 'Indigo',     hex: '#3b4b7c' },
  { name: 'Pflaume',    hex: '#6b3c5b' },
  { name: 'Anthrazit',  hex: '#333a3f' },
  { name: 'Elfenbein',  hex: '#efe7d8' }
];

const AXES_CHOICES = [6, 8, 10, 12, 16, 24];

/* Verlauf: 20 Schritte, zusätzlich nach oben gedeckelt. Ein Schnappschuss
   einer Ebene belegt bei dpr 2 rund 13 MB – ohne Deckel wäre der Speicher
   auf dem iPad nach wenigen Zügen erschöpft. */
const HISTORY_MAX   = 20;
const HISTORY_BYTES = 128 * 1024 * 1024;

/* Alles unterhalb dieser Deckkraft gilt dem Füllwerkzeug nicht als Wand –
   damit läuft Farbe sauber unter die weichen Kanten der Linien. */
const WALL_ALPHA = 60;


/* ---------------------------------------------------------------------------
   2. Kleiner Speicher

   Absichtlich als Abstraktion und nicht als direkter localStorage-Zugriff:
   im privaten Modus wirft Safari beim Schreiben, und eine spätere Galerie
   soll denselben Weg nehmen.
   ------------------------------------------------------------------------- */

const Store = {
  prefix: 'mandala-atelier.',
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (err) {
      /* Speicher nicht verfügbar – die App läuft trotzdem weiter. */
    }
  }
};


/* ---------------------------------------------------------------------------
   3. Zufall mit festem Seed

   Rechen- und Zählmandalas müssen auf jedem Gerät dieselben Aufgaben zeigen,
   damit eine Lehrkraft ein Blatt ausdrucken und im Unterricht verwenden kann.
   ------------------------------------------------------------------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/* Werte so oft wiederholen, bis alle Felder belegt sind, dann mischen.
   So kommt jeder Wert der Legende garantiert auch im Bild vor. */
function shuffledFill(values, count, rng) {
  const pool = [];
  while (pool.length < count) pool.push(...values);
  pool.length = count;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  return pool;
}


/* ---------------------------------------------------------------------------
   4. Ebenen und Skalierung

   Vier übereinanderliegende Ebenen. Die Trennung ist wesentlich: das
   Füllwerkzeug liest drawCanvas als Wand und schreibt nach fillCanvas.
   Dadurch liegen Linien immer über der Farbe und werden beim Füllen nie
   zerstört. labelCanvas liegt ganz oben, damit Zahlen lesbar bleiben.
   ------------------------------------------------------------------------- */

const LAYER_IDS = ['guide', 'fill', 'draw', 'label'];
const layers = {};

const state = {
  dpr:        1,
  motif:      null,
  fields:     null,   // Zähl-/Rechenfelder des aktuellen Motivs
  legend:     [],     // [{ value, hex, text }]
  axes:       12,
  mirror:     false,
  guides:     true,
  tool:       'pen',
  color:      PIGMENTS[0].hex,
  width:      4,
  drawing:    false,
  last:       null,
  guideAngle: 0
};

function setupLayers() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  LAYER_IDS.forEach(function (id) {
    const canvas = document.getElementById(id + 'Canvas');
    canvas.width  = Math.round(SIZE * state.dpr);
    canvas.height = Math.round(SIZE * state.dpr);
    const readOften = (id === 'draw' || id === 'fill');   // beide liest das Füllwerkzeug
    const ctx = canvas.getContext('2d', { willReadFrequently: readOften });
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    layers[id] = { canvas: canvas, ctx: ctx };
  });
}

function clearLayer(id) {
  layers[id].ctx.clearRect(0, 0, SIZE, SIZE);
}


/* ---------------------------------------------------------------------------
   5. Geometrie-Bausteine

   Alle Motive entstehen aus Koordinaten – es sind Canvas-Formen, keine
   handgezeichneten Illustrationen. Das ist eine echte Grenze der App.
   ------------------------------------------------------------------------- */

/* Polarkoordinate → Punkt auf der Fläche. */
function pol(r, a) {
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
}

function rotatePoints(points, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return points.map(function (p) {
    const dx = p[0] - CX, dy = p[1] - CY;
    return [CX + dx * c - dy * s, CY + dx * s + dy * c];
  });
}

/* Blütenblatt um die Achse „nach oben“.
   bias < 1 verlagert die größte Breite nach außen – daraus wird ein Tropfen. */
function petalPoints(rInner, rOuter, halfAngle, steps, bias) {
  steps = steps || 22;
  bias  = bias || 1;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const r  = rInner + (rOuter - rInner) * t;
    const da = halfAngle * Math.sin(Math.PI * Math.pow(t, bias));
    pts.push(pol(r, UP - da));
  }
  for (let i = steps; i >= 0; i--) {
    const t  = i / steps;
    const r  = rInner + (rOuter - rInner) * t;
    const da = halfAngle * Math.sin(Math.PI * Math.pow(t, bias));
    pts.push(pol(r, UP + da));
  }
  return pts;
}

/* Ringabschnitt innerhalb eines Segments – die Grundform aller Bänder. */
function wedgeBandPoints(rInner, rOuter, halfAngle, steps) {
  steps = steps || 14;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(pol(rInner, UP - halfAngle + 2 * halfAngle * (i / steps)));
  }
  for (let i = steps; i >= 0; i--) {
    pts.push(pol(rOuter, UP - halfAngle + 2 * halfAngle * (i / steps)));
  }
  return pts;
}

/* Raute: spitz innen und außen, breit in der Mitte. */
function diamondPoints(rInner, rOuter, halfAngle) {
  const rMid = (rInner + rOuter) / 2;
  return [
    pol(rInner, UP),
    pol(rMid, UP - halfAngle),
    pol(rOuter, UP),
    pol(rMid, UP + halfAngle)
  ];
}

/* Spiralarm von innen nach außen. */
function spiralPoints(rInner, rOuter, sweep, steps) {
  steps = steps || 48;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(pol(rInner + (rOuter - rInner) * t, UP + sweep * t));
  }
  return pts;
}

/* Geschlossener Ring mit weicher Welle – Grundform der Zen-Motive. */
function wavyRingPoints(base, amplitude, lobes, steps) {
  steps = steps || 360;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = TAU * (i / steps);
    pts.push(pol(base + amplitude * Math.cos(lobes * a), a));
  }
  return pts;
}

/* Der Stift: kapselt die n-fache Wiederholung um die Mitte. */
function makePen(ctx, axes) {
  const step = TAU / axes;
  return {
    ctx: ctx,
    axes: axes,
    step: step,
    repeat: function (fn) {
      for (let i = 0; i < axes; i++) {
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(i * step);
        ctx.translate(-CX, -CY);
        fn(i);
        ctx.restore();
      }
    }
  };
}

function tracePath(ctx, points, close) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  if (close) ctx.closePath();
  ctx.stroke();
}

function drawClosedLoop(pen, points, lineWidth) {
  pen.ctx.lineWidth = lineWidth || 2;
  pen.repeat(function () { tracePath(pen.ctx, points, true); });
}

function drawPolyline(pen, points, lineWidth) {
  pen.ctx.lineWidth = lineWidth || 2;
  pen.repeat(function () { tracePath(pen.ctx, points, false); });
}

/* Ein voller Kreis gilt für alle Segmente zugleich und wird nur einmal
   gezeichnet – sonst lägen n identische Linien übereinander. */
function drawRing(pen, r, lineWidth) {
  const ctx = pen.ctx;
  ctx.lineWidth = lineWidth || 2;
  ctx.beginPath();
  ctx.arc(CX, CY, r, 0, TAU);
  ctx.stroke();
}

function drawWavyRing(pen, base, amplitude, lobes, lineWidth) {
  pen.ctx.lineWidth = lineWidth || 2;
  tracePath(pen.ctx, wavyRingPoints(base, amplitude, lobes), true);
}

function drawDotAccent(pen, r, radius, lineWidth) {
  const ctx = pen.ctx;
  ctx.lineWidth = lineWidth || 1.6;
  pen.repeat(function () {
    const c = pol(r, UP);
    ctx.beginPath();
    ctx.arc(c[0], c[1], radius, 0, TAU);
    ctx.stroke();
  });
}

/* Ende eines Seitenastes – für die Schneeflocke. */
function branchTip(r, length, direction) {
  const base = pol(r, UP);
  const angle = UP + direction * 0.9;
  return [base[0] + Math.cos(angle) * length, base[1] + Math.sin(angle) * length];
}


/* ---------------------------------------------------------------------------
   6. Rahmen und Motivkatalog
   ------------------------------------------------------------------------- */

/* Ohne diesen Rahmen ist das Füllwerkzeug bei offenen Motiven unbrauchbar:
   ein Klick neben eine freistehende Blüte färbt sonst die gesamte Fläche.
   Außenring, Nabe und Speichen zerlegen auch den Hintergrund in geschlossene
   Felder. Nicht entfernen. */
function drawWedgeFrame(pen) {
  const ctx = pen.ctx;
  drawRing(pen, R_OUT, 2.6);
  drawRing(pen, R_IN, 2);
  ctx.lineWidth = 1.6;
  pen.repeat(function () {
    const a = UP + pen.step / 2;
    tracePath(ctx, [pol(R_IN, a), pol(R_OUT, a)], false);
  });
}

const WORLDS = [
  { id: 'geo',    title: 'Geometrisch-klassisch' },
  { id: 'natur',  title: 'Natur' },
  { id: 'zen',    title: 'Zen & Achtsamkeit' },
  { id: 'jahr',   title: 'Jahreszeiten' },
  { id: 'kids',   title: 'Kids-Corner' }
];

/* Ein Motiv ist ein Datensatz mit build(). Neue Motive kommen hier dazu.
   Zähl- und Rechenmandalas ergänzen bands, values und label(). */
const MOTIFS = [

  /* --- Geometrisch-klassisch ------------------------------------------- */
  {
    id: 'sternkranz', world: 'geo', axes: 12,
    name: 'Sternkranz', note: 'Zwölf Spitzen, ruhiger Grundriss',
    build: function (p) {
      drawRing(p, 352, 1.8);
      drawRing(p, 288, 1.8);
      drawRing(p, 158, 1.8);
      drawClosedLoop(p, petalPoints(288, 402, p.step * 0.30), 2.2);
      drawClosedLoop(p, diamondPoints(160, 286, p.step * 0.34), 1.8);
      drawClosedLoop(p, petalPoints(48, 156, p.step * 0.40), 2.2);
      drawDotAccent(p, 320, 6.5, 1.6);
    }
  },
  {
    id: 'rautenkranz', world: 'geo', axes: 10,
    name: 'Rautenkranz', note: 'Rauten in drei Größen',
    build: function (p) {
      drawRing(p, 330, 1.8);
      drawRing(p, 210, 1.8);
      drawClosedLoop(p, diamondPoints(332, 404, p.step * 0.30), 2.2);
      drawClosedLoop(p, diamondPoints(212, 328, p.step * 0.40), 2);
      drawClosedLoop(p, wedgeBandPoints(120, 208, p.step * 0.30), 1.8);
      drawClosedLoop(p, diamondPoints(48, 118, p.step * 0.34), 1.8);
      drawDotAccent(p, 270, 6, 1.6);
    }
  },
  {
    id: 'sternfein', world: 'geo', axes: 16,
    name: 'Sternmandala fein', note: 'Sechzehn Achsen, viele kleine Felder',
    build: function (p) {
      drawRing(p, 368, 1.4);
      drawRing(p, 300, 1.4);
      drawRing(p, 226, 1.4);
      drawRing(p, 132, 1.4);
      drawClosedLoop(p, petalPoints(302, 404, p.step * 0.34), 1.6);
      drawClosedLoop(p, petalPoints(228, 298, p.step * 0.42), 1.6);
      drawClosedLoop(p, diamondPoints(134, 224, p.step * 0.34), 1.4);
      drawClosedLoop(p, petalPoints(48, 130, p.step * 0.44), 1.6);
      drawDotAccent(p, 348, 5, 1.4);
    }
  },

  /* --- Natur ------------------------------------------------------------ */
  {
    id: 'bluete', world: 'natur', axes: 8,
    name: 'Blüte', note: 'Acht große Blätter, viel Fläche',
    build: function (p) {
      drawRing(p, 122, 2);
      drawClosedLoop(p, petalPoints(120, 402, p.step * 0.44, 30), 2.4);
      drawClosedLoop(p, petalPoints(124, 300, p.step * 0.26, 26), 1.8);
      drawClosedLoop(p, rotatePoints(petalPoints(126, 250, p.step * 0.24, 24), p.step / 2), 1.8);
      drawClosedLoop(p, petalPoints(48, 118, p.step * 0.44), 2);
      drawDotAccent(p, 348, 8, 1.8);
    }
  },
  {
    id: 'blaetterkranz', world: 'natur', axes: 12,
    name: 'Blätterkranz', note: 'Blätter mit Mittelrippe, versetzt',
    build: function (p) {
      drawRing(p, 300, 1.8);
      drawRing(p, 140, 1.8);
      drawClosedLoop(p, petalPoints(302, 400, p.step * 0.36, 24, 0.8), 2.2);
      drawPolyline(p, [pol(308, UP), pol(394, UP)], 1.2);
      drawClosedLoop(p, rotatePoints(petalPoints(142, 296, p.step * 0.34, 24), p.step / 2), 2);
      drawPolyline(p, rotatePoints([pol(148, UP), pol(290, UP)], p.step / 2), 1.2);
      drawClosedLoop(p, petalPoints(48, 138, p.step * 0.42), 1.8);
    }
  },
  {
    id: 'muschelspirale', world: 'natur', axes: 6,
    name: 'Muschelspirale', note: 'Sechs Arme, weite Bögen',
    build: function (p) {
      drawRing(p, 300, 1.6);
      drawRing(p, 200, 1.6);
      drawRing(p, 100, 1.6);
      [0, 0.33, 0.66].forEach(function (offset) {
        drawPolyline(p, rotatePoints(spiralPoints(50, 404, p.step * 1.85, 64), offset * p.step), 2);
      });
      drawDotAccent(p, 250, 7, 1.6);
    }
  },

  /* --- Zen & Achtsamkeit ------------------------------------------------ */
  {
    id: 'wellenkreis', world: 'zen', axes: 24,
    name: 'Wellenkreis', note: 'Fünf Wellenringe, gleichmäßiger Takt',
    build: function (p) {
      drawWavyRing(p, 380, 14, 24, 1.8);
      drawWavyRing(p, 318, 16, 24, 1.8);
      drawWavyRing(p, 250, 16, 12, 1.8);
      drawWavyRing(p, 178, 14, 12, 1.8);
      drawWavyRing(p, 108, 12, 8, 1.8);
      drawDotAccent(p, 76, 5, 1.4);
    }
  },
  {
    id: 'tropfenkranz', world: 'zen', axes: 12,
    name: 'Tropfenkranz', note: 'Tropfen in zwei Lagen, versetzt',
    build: function (p) {
      drawRing(p, 322, 1.8);
      drawRing(p, 168, 1.8);
      drawClosedLoop(p, petalPoints(324, 400, p.step * 0.34, 26, 0.6), 2.2);
      drawClosedLoop(p, rotatePoints(petalPoints(170, 318, p.step * 0.32, 26, 0.6), p.step / 2), 2);
      drawClosedLoop(p, petalPoints(48, 164, p.step * 0.36, 24, 0.6), 1.8);
      drawDotAccent(p, 352, 5.5, 1.4);
    }
  },
  {
    id: 'ruhefeld', world: 'zen', axes: 8,
    name: 'Ruhefeld', note: 'Wenige große Flächen, viel Raum',
    build: function (p) {
      drawRing(p, 356, 1.6);
      drawRing(p, 250, 1.6);
      drawRing(p, 150, 1.6);
      drawClosedLoop(p, wedgeBandPoints(254, 352, p.step * 0.36, 16), 2);
      drawClosedLoop(p, rotatePoints(wedgeBandPoints(154, 246, p.step * 0.30, 16), p.step / 2), 2);
      drawDotAccent(p, 382, 9, 1.6);
      drawDotAccent(p, 100, 7, 1.6);
    }
  },

  /* --- Jahreszeiten ----------------------------------------------------- */
  {
    id: 'winter', world: 'jahr', axes: 6,
    name: 'Winter', note: 'Schneekristall mit Seitenästen',
    build: function (p) {
      drawRing(p, 372, 1.4);
      drawRing(p, 96, 1.6);
      drawPolyline(p, [pol(50, UP), pol(398, UP)], 2.6);
      [[150, 62], [225, 72], [300, 62], [356, 44]].forEach(function (pair) {
        drawPolyline(p, [pol(pair[0], UP), branchTip(pair[0], pair[1], 1)], 2);
        drawPolyline(p, [pol(pair[0], UP), branchTip(pair[0], pair[1], -1)], 2);
      });
      drawClosedLoop(p, diamondPoints(98, 200, p.step * 0.20), 1.8);
    }
  },
  {
    id: 'fruehling', world: 'jahr', axes: 8,
    name: 'Frühling', note: 'Knospen in drei Lagen',
    build: function (p) {
      drawRing(p, 300, 1.6);
      drawRing(p, 150, 1.6);
      drawClosedLoop(p, petalPoints(302, 398, p.step * 0.26, 24, 0.7), 2.2);
      drawClosedLoop(p, rotatePoints(petalPoints(302, 362, p.step * 0.20, 24, 0.7), p.step / 2), 1.8);
      drawClosedLoop(p, petalPoints(152, 296, p.step * 0.34, 26), 2);
      drawClosedLoop(p, petalPoints(48, 148, p.step * 0.44), 1.8);
      drawDotAccent(p, 200, 7, 1.6);
    }
  },
  {
    id: 'sommer', world: 'jahr', axes: 12,
    name: 'Sommer', note: 'Strahlenkranz um eine offene Mitte',
    build: function (p) {
      drawRing(p, 340, 1.8);
      drawRing(p, 196, 2);
      drawRing(p, 110, 2);
      drawClosedLoop(p, diamondPoints(342, 404, p.step * 0.24), 2.2);
      drawClosedLoop(p, rotatePoints(diamondPoints(342, 384, p.step * 0.16), p.step / 2), 1.6);
      drawClosedLoop(p, petalPoints(198, 336, p.step * 0.40, 26), 2);
      drawClosedLoop(p, petalPoints(48, 108, p.step * 0.44), 1.8);
      drawDotAccent(p, 152, 8, 1.6);
    }
  },
  {
    id: 'herbst', world: 'jahr', axes: 10,
    name: 'Herbst', note: 'Geneigte Blätter, Eicheln als Punkte',
    build: function (p) {
      drawRing(p, 318, 1.8);
      drawRing(p, 176, 1.8);
      drawClosedLoop(p, rotatePoints(petalPoints(320, 400, p.step * 0.32, 26, 0.85), p.step * 0.10), 2.2);
      drawClosedLoop(p, rotatePoints(petalPoints(178, 314, p.step * 0.34, 26, 0.85), -p.step * 0.10), 2);
      drawPolyline(p, rotatePoints([pol(184, UP), pol(308, UP)], -p.step * 0.10), 1.2);
      drawClosedLoop(p, petalPoints(48, 120, p.step * 0.40), 1.8);
      drawDotAccent(p, 148, 9, 1.8);
    }
  },

  /* --- Kids-Corner ------------------------------------------------------
     Eine Motivwelt innerhalb der ruhigen Erwachsenen-Oberfläche. Bedient
     wird sie von Eltern und Lehrkräften – deshalb kein Kinder-Look. */
  {
    id: 'ersteformen', world: 'kids', axes: 6,
    name: 'Erste Formen', note: 'Kindergarten – sehr große Felder',
    build: function (p) {
      drawRing(p, 300, 3);
      drawRing(p, 150, 3);
      drawClosedLoop(p, petalPoints(302, 398, p.step * 0.40, 26), 3.4);
      drawClosedLoop(p, diamondPoints(154, 296, p.step * 0.42), 3.4);
      drawDotAccent(p, 100, 26, 3.4);
    }
  },
  {
    id: 'mustertanz', world: 'kids', axes: 12,
    name: 'Mustertanz', note: 'Grundschule – Bänder im Wechsel',
    build: function (p) {
      drawRing(p, 330, 2);
      drawRing(p, 190, 2);
      drawClosedLoop(p, wedgeBandPoints(334, 400, p.step * 0.40, 14), 2.4);
      drawClosedLoop(p, rotatePoints(wedgeBandPoints(196, 326, p.step * 0.40, 14), p.step / 2), 2.4);
      drawClosedLoop(p, petalPoints(48, 186, p.step * 0.44), 2.2);
    }
  },
  {
    id: 'zaehlen6', world: 'kids', axes: 6,
    name: 'Zähl bis 6', note: 'Punkte zählen, nach Anzahl färben',
    kind: 'count',
    bands: [[R_IN, 250], [250, R_OUT]],
    values: [1, 2, 3, 4, 5, 6],
    build: gridBuild
  },
  {
    id: 'zaehlen10', world: 'kids', axes: 10,
    name: 'Zähl bis 10', note: 'Punkte zählen bis zehn',
    kind: 'count',
    bands: [[R_IN, 250], [250, R_OUT]],
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    build: gridBuild
  },
  {
    id: 'rechnen10', world: 'kids', axes: 8,
    name: 'Rechenmandala ZR 10', note: 'Plus und Minus im Zahlenraum 10',
    kind: 'math',
    bands: [[R_IN, 250], [250, R_OUT]],
    values: [3, 5, 6, 8, 10],
    range: 10,
    build: gridBuild,
    label: mathTask
  },
  {
    id: 'rechnen20', world: 'kids', axes: 10,
    name: 'Rechenmandala ZR 20', note: 'Plus und Minus im Zahlenraum 20',
    kind: 'math',
    bands: [[R_IN, 250], [250, R_OUT]],
    values: [7, 9, 12, 15, 18],
    range: 20,
    build: gridBuild,
    label: mathTask
  }
];

/* Gitter für Zähl- und Rechenmandalas: der Rahmen liefert Nabe, Außenring
   und Speichen, hier kommen nur die Bandgrenzen dazu. */
function gridBuild(pen) {
  const motif = this;
  motif.bands.forEach(function (band) {
    if (band[1] < R_OUT) drawRing(pen, band[1], 2);
  });
}

/* Aufgabe zu einem vorgegebenen Ergebnis bauen – so bleibt die Legende
   überschaubar und jede Farbe kommt sicher vor. */
function mathTask(value, rng, motif) {
  const room = motif.range - value;
  if (rng() < 0.55 && value >= 2) {
    const a = 1 + Math.floor(rng() * (value - 1));
    return a + ' + ' + (value - a);
  }
  if (room >= 1) {
    const b = 1 + Math.floor(rng() * Math.min(room, 9));
    return (value + b) + ' − ' + b;
  }
  const a = 1 + Math.floor(rng() * (value - 1));
  return a + ' + ' + (value - a);
}


/* ---------------------------------------------------------------------------
   7. Zahlen-, Zähl- und Rechenfelder
   ------------------------------------------------------------------------- */

function makeFields(motif) {
  const rng = mulberry32(seedFrom(motif.id));
  const step = TAU / motif.axes;
  const cells = [];

  motif.bands.forEach(function (band, bandIndex) {
    const rMid = (band[0] + band[1]) / 2;
    for (let i = 0; i < motif.axes; i++) {
      cells.push({ r: rMid, a: UP + i * step, band: bandIndex });
    }
  });

  const values = shuffledFill(motif.values, cells.length, rng);
  cells.forEach(function (cell, index) {
    cell.value = values[index];
    cell.text  = motif.label ? motif.label(cell.value, rng, motif) : null;
  });
  return cells;
}

function makeLegend(motif, fields) {
  /* Array.from, nicht Array.prototype.slice.call(new Set(...)) – letzteres
     liefert ein leeres Array und ließ die Legende still leer bleiben. */
  const values = Array.from(new Set(fields.map(function (f) { return f.value; })));
  values.sort(function (a, b) { return a - b; });
  return values.map(function (value, index) {
    return {
      value: value,
      hex: PIGMENTS[index % PIGMENTS.length].hex,
      text: motif.kind === 'math'
        ? 'Ergebnis ' + value
        : value + (value === 1 ? ' Punkt' : ' Punkte')
    };
  });
}

function renderLabels() {
  const ctx = layers.label.ctx;
  clearLayer('label');
  if (!state.fields) return;

  ctx.save();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const motif = state.motif;

  state.fields.forEach(function (cell) {
    const c = pol(cell.r, cell.a);
    const band = motif.bands[cell.band];
    /* Nutzbare Breite ist die Sehne des Feldes auf Höhe der Feldmitte. */
    const room = 2 * cell.r * Math.sin(Math.PI / motif.axes) * 0.82;
    const height = (band[1] - band[0]) * 0.5;

    if (cell.text) {
      let size = Math.min(28, height);
      ctx.font = labelFont(size);
      while (size > 12 && ctx.measureText(cell.text).width > room) {
        size -= 1;
        ctx.font = labelFont(size);
      }
      ctx.fillText(cell.text, c[0], c[1]);
    } else {
      drawCountDots(ctx, c[0], c[1], cell.value, room, height);
    }
  });

  ctx.restore();
}

function labelFont(size) {
  return '500 ' + size + 'px "IBM Plex Mono", ui-monospace, monospace';
}

/* Punkte in Fünferreihen – so bleibt die Menge auf einen Blick erfassbar. */
function drawCountDots(ctx, x, y, count, room, height) {
  const perRow = Math.min(count, 5);
  const rows   = Math.ceil(count / 5);
  const gap    = Math.min(15, room / Math.max(perRow, 1), height / rows);
  const radius = Math.max(2.5, gap * 0.33);

  let drawn = 0;
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(perRow, count - drawn);
    const y0 = y + (row - (rows - 1) / 2) * gap;
    for (let i = 0; i < inRow; i++) {
      const x0 = x + (i - (inRow - 1) / 2) * gap;
      ctx.beginPath();
      ctx.arc(x0, y0, radius, 0, TAU);
      ctx.fill();
      drawn++;
    }
  }
}


/* ---------------------------------------------------------------------------
   8. Zeichnen mit Symmetrie

   segmentLine() zeichnet jede Linie n-mal um die Mitte rotiert; bei
   aktivierter Spiegelung zusätzlich an der Waagerechten gespiegelt.
   Bei 24 Achsen mit Spiegelung sind das 48 Linien je Zug.
   ------------------------------------------------------------------------- */

function symmetryPoints(x, y) {
  const out  = [];
  const step = TAU / state.axes;
  const dx = x - CX, dy = y - CY;
  const bases = state.mirror ? [[dx, dy], [dx, -dy]] : [[dx, dy]];

  for (let i = 0; i < state.axes; i++) {
    const c = Math.cos(i * step), s = Math.sin(i * step);
    for (let b = 0; b < bases.length; b++) {
      const px = bases[b][0], py = bases[b][1];
      out.push([CX + px * c - py * s, CY + px * s + py * c]);
    }
  }
  return out;
}

function segmentLine(p0, p1) {
  const a = symmetryPoints(p0[0], p0[1]);
  const b = symmetryPoints(p1[0], p1[1]);
  const erasing = state.tool === 'eraser';

  strokeOn(layers.draw.ctx, a, b, erasing);
  if (erasing) strokeOn(layers.fill.ctx, a, b, true);
}

function strokeOn(ctx, a, b, erasing) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (erasing) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = state.width * 3.5;
  } else {
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.width;
  }
  ctx.beginPath();
  for (let i = 0; i < a.length; i++) {
    ctx.moveTo(a[i][0], a[i][1]);
    ctx.lineTo(b[i][0], b[i][1]);
  }
  ctx.stroke();
  ctx.restore();
}


/* ---------------------------------------------------------------------------
   9. Füllen

   Scanline-Flood-Fill mit Span-Verfolgung. Pro Symmetrie-Position wird ein
   eigener Startpunkt gesetzt: ein Tipp färbt alle gleichwertigen Felder
   zugleich. Das ist der eigentliche Komfortgewinn gegenüber Papier.
   ------------------------------------------------------------------------- */

const LITTLE_ENDIAN = (function () {
  const buffer = new ArrayBuffer(4);
  new Uint32Array(buffer)[0] = 0x01020304;
  return new Uint8Array(buffer)[0] === 0x04;
})();

function packColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (LITTLE_ENDIAN
    ? ((255 << 24) | (b << 16) | (g << 8) | r)
    : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
}

/* Bei Zähl- und Rechenmandalas trägt jedes Feld einen eigenen Wert. Dort
   färbt ein Tipp nur das angetippte Feld – sonst bekämen alle gleichwertigen
   Positionen dieselbe Farbe und die Aufgabe wäre hinfällig. */
function fillsSymmetrically(motif) {
  return !motif || (motif.kind !== 'count' && motif.kind !== 'math');
}

function floodFill(x, y, hex) {
  const w = layers.fill.canvas.width;
  const h = layers.fill.canvas.height;

  const wall  = layers.draw.ctx.getImageData(0, 0, w, h).data;
  const image = layers.fill.ctx.getImageData(0, 0, w, h);
  const buf   = new Uint32Array(image.data.buffer);
  const target = packColor(hex);

  const seeds = fillsSymmetrically(state.motif)
    ? symmetryPoints(x, y)
    : [[x, y]];

  let painted = false;

  seeds.forEach(function (p) {
    const sx = Math.round(p[0] * state.dpr);
    const sy = Math.round(p[1] * state.dpr);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

    const index = sy * w + sx;
    if (wall[index * 4 + 3] > WALL_ALPHA) return;   // direkt auf einer Linie
    const start = buf[index];
    if (start === target) return;                   // Feld hat die Farbe schon

    scanFill(buf, wall, w, h, sx, sy, start, target);
    painted = true;
  });

  if (painted) layers.fill.ctx.putImageData(image, 0, 0);
  return painted;
}

function scanFill(buf, wall, w, h, x, y, start, target) {
  const stack = [x, y];

  function open(index) {
    return buf[index] === start && wall[index * 4 + 3] <= WALL_ALPHA;
  }

  while (stack.length) {
    const py = stack.pop();
    const px = stack.pop();
    let index = py * w + px;
    if (!open(index)) continue;

    /* Span nach links und rechts ausdehnen. */
    let left = px;
    while (left > 0 && open(index - 1)) { left--; index--; }
    let right = px;
    let scan = py * w + px;
    while (right < w - 1 && open(scan + 1)) { right++; scan++; }

    const rowStart = py * w;
    for (let i = left; i <= right; i++) buf[rowStart + i] = target;

    /* Nachbarzeilen: je zusammenhängendem Abschnitt nur einen Startpunkt. */
    if (py > 0) pushRow(stack, buf, wall, start, (py - 1) * w, left, right, py - 1);
    if (py < h - 1) pushRow(stack, buf, wall, start, (py + 1) * w, left, right, py + 1);
  }
}

function pushRow(stack, buf, wall, start, rowStart, left, right, row) {
  let inside = false;
  for (let i = left; i <= right; i++) {
    const index = rowStart + i;
    const open = buf[index] === start && wall[index * 4 + 3] <= WALL_ALPHA;
    if (open && !inside) {
      stack.push(i, row);
      inside = true;
    } else if (!open) {
      inside = false;
    }
  }
}


/* ---------------------------------------------------------------------------
   10. Hilfsraster

   Achsen und Ringe, sehr blass. Es dreht sich extrem langsam – gerade so,
   dass die Fläche lebt, ohne abzulenken.
   ------------------------------------------------------------------------- */

function renderGuides() {
  const ctx = layers.guide.ctx;
  clearLayer('guide');
  if (!state.guides) return;

  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(state.guideAngle);
  ctx.translate(-CX, -CY);
  ctx.strokeStyle = 'rgba(60, 52, 40, 0.16)';
  ctx.lineWidth = 1;

  [90, 170, 250, 330, 405].forEach(function (r) {
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, TAU);
    ctx.stroke();
  });

  const step = TAU / state.axes;
  ctx.beginPath();
  for (let i = 0; i < state.axes; i++) {
    const a = UP + i * step;
    ctx.moveTo(CX, CY);
    const end = pol(R_OUT, a);
    ctx.lineTo(end[0], end[1]);
  }
  ctx.stroke();
  ctx.restore();
}

let guideLastFrame = 0;

function guideTick(time) {
  requestAnimationFrame(guideTick);
  if (!state.guides || document.hidden) return;
  if (time - guideLastFrame < 90) return;
  guideLastFrame = time;
  state.guideAngle += 0.0006;         // etwa eine Umdrehung in einer Viertelstunde
  renderGuides();
}


/* ---------------------------------------------------------------------------
   11. Verlauf

   Schnappschüsse der betroffenen Ebenen. Es wird nur gesichert, was der
   nächste Zug tatsächlich verändert – das spart deutlich Speicher.
   ------------------------------------------------------------------------- */

const history = [];

function pushHistory(names) {
  const entry = { layers: {}, bytes: 0 };
  names.forEach(function (name) {
    const source = layers[name].canvas;
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext('2d').drawImage(source, 0, 0);
    entry.layers[name] = copy;
    entry.bytes += source.width * source.height * 4;
  });
  history.push(entry);

  let total = history.reduce(function (sum, e) { return sum + e.bytes; }, 0);
  while (history.length > HISTORY_MAX || (history.length > 1 && total > HISTORY_BYTES)) {
    total -= history.shift().bytes;
  }
  syncUI();
}

function undo() {
  const entry = history.pop();
  if (!entry) return;
  Object.keys(entry.layers).forEach(function (name) {
    const ctx = layers[name].ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layers[name].canvas.width, layers[name].canvas.height);
    ctx.drawImage(entry.layers[name], 0, 0);
    ctx.restore();
  });
  syncUI();
}


/* ---------------------------------------------------------------------------
   12. Oberfläche
   ------------------------------------------------------------------------- */

const ui = {};

function cacheUi() {
  ui.worlds     = document.getElementById('worlds');
  ui.library    = document.getElementById('library');
  ui.libToggle  = document.getElementById('btn-library-toggle');
  ui.palette    = document.getElementById('palette');
  ui.axes       = document.getElementById('axes');
  ui.legend     = document.getElementById('legend');
  ui.legendBox  = document.getElementById('legend-panel');
  ui.legendHead = document.getElementById('legend-title');
  ui.mirror     = document.getElementById('mirror');
  ui.guides     = document.getElementById('guides');
  ui.width      = document.getElementById('width');
  ui.undo       = document.getElementById('btn-undo');
  ui.clear      = document.getElementById('btn-clear');
  ui.save       = document.getElementById('btn-save');
  ui.theme      = document.getElementById('btn-theme');
  ui.hint       = document.getElementById('stage-hint');
  ui.tools      = Array.prototype.slice.call(document.querySelectorAll('.tool'));
}

function buildLibrary() {
  WORLDS.forEach(function (world) {
    const section = document.createElement('section');
    section.className = 'world';
    const heading = document.createElement('h2');
    heading.textContent = world.title;
    section.appendChild(heading);

    MOTIFS.filter(function (m) { return m.world === world.id; }).forEach(function (motif) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'motif';
      button.dataset.motif = motif.id;
      button.innerHTML =
        '<span class="motif-name"></span><span class="motif-note"></span>';
      button.querySelector('.motif-name').textContent = motif.name;
      button.querySelector('.motif-note').textContent = motif.note;
      section.appendChild(button);
    });

    ui.worlds.appendChild(section);
  });
}

function buildPalette() {
  PIGMENTS.forEach(function (pigment) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pigment';
    button.style.background = pigment.hex;
    button.dataset.hex = pigment.hex;
    button.title = pigment.name;
    button.setAttribute('aria-label', pigment.name);
    ui.palette.appendChild(button);
  });
}

function buildAxes() {
  AXES_CHOICES.forEach(function (n) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'axis';
    button.dataset.axes = String(n);
    button.textContent = n + '×';
    ui.axes.appendChild(button);
  });
}

function renderLegend() {
  ui.legend.textContent = '';
  if (!state.legend.length) {
    ui.legendBox.hidden = true;
    return;
  }
  ui.legendBox.hidden = false;
  ui.legendHead.textContent = state.motif && state.motif.kind === 'math'
    ? 'Farblegende – Ergebnis'
    : 'Farblegende – Anzahl';

  state.legend.forEach(function (item) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.hex = item.hex;
    button.innerHTML = '<span class="dot"></span><span class="val"></span>';
    button.querySelector('.dot').style.background = item.hex;
    button.querySelector('.val').textContent = item.text;
    li.appendChild(button);
    ui.legend.appendChild(li);
  });
}

function loadMotif(id) {
  const motif = MOTIFS.filter(function (m) { return m.id === id; })[0] || null;

  state.motif = motif;
  history.length = 0;
  clearLayer('fill');
  clearLayer('draw');
  clearLayer('label');

  if (motif) {
    state.axes = motif.axes;
    const ctx = layers.draw.ctx;
    const pen = makePen(ctx, motif.axes);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawWedgeFrame(pen);
    motif.build(pen);
    ctx.restore();

    state.fields = motif.values ? makeFields(motif) : null;
    state.legend = state.fields ? makeLegend(motif, state.fields) : [];
  } else {
    state.fields = null;
    state.legend = [];
  }

  Store.set('motif', motif ? motif.id : '');
  renderLabels();
  renderLegend();
  renderGuides();
  syncUI();
}

function clearSheet() {
  if (state.motif) {
    loadMotif(state.motif.id);
  } else {
    history.length = 0;
    clearLayer('fill');
    clearLayer('draw');
    clearLayer('label');
    syncUI();
  }
}

function exportImage() {
  const scale = 2;
  const out = document.createElement('canvas');
  out.width = SIZE * scale;
  out.height = SIZE * scale;
  const ctx = out.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ['fill', 'draw', 'label'].forEach(function (name) {
    ctx.drawImage(layers[name].canvas, 0, 0, SIZE, SIZE);
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const name = state.motif ? state.motif.id : 'freies-blatt';
  const link = document.createElement('a');
  link.download = 'mandala-' + name + '-' + stamp + '.png';
  link.href = out.toDataURL('image/png');
  link.click();
}

/* Beim allerersten Start: einer bereits gesetzten Vorgabe folgen, sonst der
   Einstellung des Geräts. Danach zählt nur noch die eigene Wahl. */
function preferredTheme() {
  const preset = document.documentElement.dataset.theme;
  if (preset === 'dunkel' || preset === 'dark') return 'dunkel';
  if (preset === 'hell' || preset === 'light') return 'hell';
  const dark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'dunkel' : 'hell';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  ui.theme.textContent = theme === 'dunkel' ? 'Hell' : 'Dunkel';
  Store.set('theme', theme);
}

function syncUI() {
  ui.tools.forEach(function (button) {
    button.classList.toggle('is-active', button.dataset.tool === state.tool);
  });
  Array.prototype.forEach.call(ui.palette.children, function (button) {
    button.classList.toggle('is-active', button.dataset.hex === state.color);
  });
  Array.prototype.forEach.call(ui.axes.children, function (button) {
    button.classList.toggle('is-active', Number(button.dataset.axes) === state.axes);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.motif'), function (button) {
    const id = button.dataset.motif;
    button.classList.toggle('is-active',
      state.motif ? id === state.motif.id : id === '');
  });

  ui.mirror.checked = state.mirror;
  ui.guides.checked = state.guides;
  ui.width.value = state.width;
  ui.undo.disabled = history.length === 0;

  if (!state.motif) {
    ui.hint.textContent = 'Leeres Blatt · zeichne ein Segment, der Rest entsteht von selbst';
  } else {
    ui.hint.textContent = state.motif.name + ' · ' + state.motif.note +
      (fillsSymmetrically(state.motif)
        ? ' · ein Tipp färbt alle gleichwertigen Felder'
        : ' · ein Tipp färbt nur das angetippte Feld');
  }
}

function toLocal(event) {
  const rect = layers.draw.canvas.getBoundingClientRect();
  return [
    ((event.clientX - rect.left) / rect.width) * SIZE,
    ((event.clientY - rect.top) / rect.height) * SIZE
  ];
}

function bindEvents() {
  const canvas = layers.draw.canvas;

  canvas.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    const point = toLocal(event);

    if (state.tool === 'fill') {
      pushHistory(['fill']);
      if (!floodFill(point[0], point[1], state.color)) history.pop();
      syncUI();
      return;
    }

    pushHistory(state.tool === 'eraser' ? ['draw', 'fill'] : ['draw']);
    canvas.setPointerCapture(event.pointerId);
    state.drawing = true;
    state.last = point;
    segmentLine(point, point);
  });

  canvas.addEventListener('pointermove', function (event) {
    if (!state.drawing) return;
    event.preventDefault();
    const point = toLocal(event);
    segmentLine(state.last, point);
    state.last = point;
  });

  ['pointerup', 'pointercancel'].forEach(function (type) {
    canvas.addEventListener(type, function () { state.drawing = false; });
  });

  document.addEventListener('click', function (event) {
    const motifButton = event.target.closest('.motif');
    if (motifButton) {
      loadMotif(motifButton.dataset.motif);
      ui.library.classList.remove('is-open');
      ui.libToggle.setAttribute('aria-expanded', 'false');
      return;
    }

    const tool = event.target.closest('.tool');
    if (tool) { state.tool = tool.dataset.tool; syncUI(); return; }

    const pigment = event.target.closest('.pigment, .legend button');
    if (pigment) {
      state.color = pigment.dataset.hex;
      Store.set('color', state.color);
      syncUI();
      return;
    }

    const axis = event.target.closest('.axis');
    if (axis) { state.axes = Number(axis.dataset.axes); renderGuides(); syncUI(); }
  });

  ui.libToggle.addEventListener('click', function () {
    const open = ui.library.classList.toggle('is-open');
    ui.libToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  ui.mirror.addEventListener('change', function () {
    state.mirror = ui.mirror.checked;
    Store.set('mirror', state.mirror);
  });

  ui.guides.addEventListener('change', function () {
    state.guides = ui.guides.checked;
    Store.set('guides', state.guides);
    renderGuides();
  });

  ui.width.addEventListener('input', function () {
    state.width = Number(ui.width.value);
    Store.set('width', state.width);
  });

  ui.undo.addEventListener('click', undo);
  ui.clear.addEventListener('click', clearSheet);
  ui.save.addEventListener('click', exportImage);
  ui.theme.addEventListener('click', function () {
    setTheme(document.documentElement.dataset.theme === 'dunkel' ? 'hell' : 'dunkel');
  });

  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });
}


/* ---------------------------------------------------------------------------
   13. Start
   ------------------------------------------------------------------------- */

function start() {
  cacheUi();
  setupLayers();
  buildLibrary();
  buildPalette();
  buildAxes();
  bindEvents();

  state.color  = Store.get('color', state.color);
  state.width  = Store.get('width', state.width);
  state.mirror = Store.get('mirror', state.mirror);
  state.guides = Store.get('guides', state.guides);
  setTheme(Store.get('theme', preferredTheme()));

  loadMotif(Store.get('motif', 'sternkranz'));
  requestAnimationFrame(guideTick);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {
      /* Ohne Service Worker läuft die App weiterhin, nur nicht offline. */
    });
  }
}

/* Zugriff für die Testskripte in tools/ – die App selbst braucht ihn nicht. */
window.MandalaAtelier = {
  MOTIFS: MOTIFS,
  WORLDS: WORLDS,
  PIGMENTS: PIGMENTS,
  state: state,
  layers: layers,
  loadMotif: loadMotif,
  floodFill: floodFill,
  makeFields: makeFields,
  makeLegend: makeLegend,
  pol: pol,
  SIZE: SIZE,
  R_OUT: R_OUT
};

document.addEventListener('DOMContentLoaded', start);
