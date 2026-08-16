'use strict';

/* Im Regal ohne Service Worker – siehe tools/einfrieren.js.
   Eine eingefrorene Fassung darf keinen anmelden: Ihr `activate` löschte
   den Offline-Vorrat der laufenden App. */
if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  navigator.serviceWorker.register = function () { return new Promise(function () {}); };
}

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
     12. Galerie
     13. Oberfläche
     14. Start

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

/* Papier, Linien und Hilfsraster wechseln mit dem Modus. Dieselben Werte
   stehen als CSS-Variablen in style.css – die Vorlage entsteht auf Canvas
   und kann keine Variable lesen. Beide Stellen zusammen ändern. */
const THEMES = {
  hell:   { paper: '#f6f1e7', ink: '#242424', guide: 'rgba(60, 52, 40, 0.16)' },
  dunkel: { paper: '#1c1d20', ink: '#d8d2c6', guide: 'rgba(216, 210, 198, 0.13)' }
};

function palette() {
  return THEMES[state.theme] || THEMES.hell;
}

/* Vier Farbwelten zu je 14 Pigmenten. Alle gedeckt – keine Buntstift-
   Knallfarben; das trägt die erwachsene Anmutung wesentlich. Die Reihenfolge
   ist nicht beliebig: die ersten zehn Einträge jeder Welt sind bewusst gut
   unterscheidbar, weil die Farblegende der Zählmandalas sie der Reihe nach
   vergibt. */
const PALETTES = [
  {
    id: 'erde', name: 'Erdpigmente',
    colors: [
      { name: 'Terrakotta', hex: '#b5654a' },
      { name: 'Ocker',      hex: '#c89b3c' },
      { name: 'Petrol',     hex: '#2e6b6b' },
      { name: 'Indigo',     hex: '#3b4b7c' },
      { name: 'Moos',       hex: '#3f5b3a' },
      { name: 'Mohn',       hex: '#a8342f' },
      { name: 'Nebelblau',  hex: '#7c93a8' },
      { name: 'Pflaume',    hex: '#6b3c5b' },
      { name: 'Olive',      hex: '#6e7233' },
      { name: 'Sand',       hex: '#d9c4a3' },
      { name: 'Rost',       hex: '#8c4a2f' },
      { name: 'Salbei',     hex: '#7c8c6b' },
      { name: 'Anthrazit',  hex: '#333a3f' },
      { name: 'Elfenbein',  hex: '#efe7d8' }
    ]
  },
  {
    id: 'nord', name: 'Nordlicht',
    colors: [
      { name: 'Eisblau',     hex: '#6f9fb5' },
      { name: 'Tanne',       hex: '#2f4a3c' },
      { name: 'Amethyst',    hex: '#5b5580' },
      { name: 'Tiefsee',     hex: '#1f4a5c' },
      { name: 'Flechte',     hex: '#8aa38c' },
      { name: 'Beere',       hex: '#7a3f52' },
      { name: 'Gletscher',   hex: '#a9c6cd' },
      { name: 'Fjord',       hex: '#4a7a78' },
      { name: 'Heidekraut',  hex: '#8d7fa0' },
      { name: 'Stahl',       hex: '#5d6a72' },
      { name: 'Polarnacht',  hex: '#23304a' },
      { name: 'Schiefer',    hex: '#3a4249' },
      { name: 'Raureif',     hex: '#d3e0e2' },
      { name: 'Möwe',        hex: '#eef1f2' }
    ]
  },
  {
    id: 'faerber', name: 'Färbergarten',
    colors: [
      { name: 'Krapp',          hex: '#a4423a' },
      { name: 'Safran',         hex: '#d59b3a' },
      { name: 'Waid',           hex: '#34527a' },
      { name: 'Färberginster',  hex: '#9a9d4a' },
      { name: 'Cochenille',     hex: '#8e3550' },
      { name: 'Walnuss',        hex: '#6b4a33' },
      { name: 'Reseda',         hex: '#b9a94a' },
      { name: 'Malve',          hex: '#7d5570' },
      { name: 'Indigo tief',    hex: '#26365e' },
      { name: 'Birke',          hex: '#cfc48a' },
      { name: 'Katechu',        hex: '#8a6a4a' },
      { name: 'Rinde',          hex: '#4a3527' },
      { name: 'Ruß',            hex: '#2e2c2a' },
      { name: 'Leinen',         hex: '#e6ddc9' }
    ]
  },
  {
    id: 'rauch', name: 'Rauchglas',
    colors: [
      { name: 'Taubenblau', hex: '#78838c' },
      { name: 'Altrosa',    hex: '#a3807c' },
      { name: 'Farn',       hex: '#61694f' },
      { name: 'Kastanie',   hex: '#55403a' },
      { name: 'Mauve',      hex: '#8b7480' },
      { name: 'Schilf',     hex: '#8b8f7c' },
      { name: 'Zinn',       hex: '#575c60' },
      { name: 'Trüffel',    hex: '#6a5b52' },
      { name: 'Nebel',      hex: '#b6b2ab' },
      { name: 'Basalt',     hex: '#3b3b3d' },
      { name: 'Rauch',      hex: '#6e6a66' },
      { name: 'Asche',      hex: '#8f8b85' },
      { name: 'Perle',      hex: '#d7d3cb' },
      { name: 'Kalk',       hex: '#ece8e0' }
    ]
  }
];

/* Die fünfte Farbwelt gehört dem Haushalt und wird selbst gemischt.
   Sie ist Material wie der Motivkatalog – deshalb gilt sie für alle
   Personen, nicht nur für eine. */
const OWN_DEFAULT = PALETTES[0].colors.map(function (c) {
  return { name: c.name, hex: c.hex };
});

PALETTES.push({ id: 'eigen', name: 'Eigene', custom: true, colors: OWN_DEFAULT.slice() });

/* Die Pigmente der gerade gewählten Farbwelt. */
function pigments() {
  const set = PALETTES.filter(function (p) { return p.id === state.palette; })[0];
  return (set || PALETTES[0]).colors;
}

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
  prefix: 'mandala-atelier-regal2-12.',
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

   Fünf übereinanderliegende Ebenen. Die Trennung ist wesentlich: das
   Füllwerkzeug liest motifCanvas und drawCanvas als Wand und schreibt nach
   fillCanvas. Dadurch liegen Linien immer über der Farbe und werden beim
   Füllen nie zerstört. labelCanvas liegt ganz oben, damit Zahlen lesbar
   bleiben.

   Vorlage und eigene Striche liegen getrennt, damit beim Wechsel zwischen
   Hell und Dunkel die Linienfarbe der Vorlage neu gezeichnet werden kann,
   ohne begonnene Arbeit zu zerstören. Nebeneffekt: der Radierer nimmt nur
   die eigenen Striche weg, nie die Vorlage.
   ------------------------------------------------------------------------- */

const LAYER_IDS = ['guide', 'fill', 'motif', 'draw', 'label'];
const layers = {};

const state = {
  dpr:        1,
  theme:      'hell',
  motif:      null,
  fields:     null,   // Zähl-/Rechenfelder des aktuellen Motivs
  legend:     [],     // [{ value, hex, text }]
  axes:       12,
  mirror:     false,
  guides:     true,
  fillAll:    true,   // ein Tipp färbt alle gleichwertigen Felder
  graded:     true,   // bei Anlagen: die Achsenzahl folgt dem Bereich
  strokeSym:  null,   // Symmetrie des laufenden Zuges, am Aufsetzpunkt bestimmt
  tool:       'pen',
  shape:      'ring',   // Grundform des Form-Werkzeugs
  shapeFrom:  null,     // Anfasspunkt, solange gezogen wird
  palette:    'erde',
  color:      PALETTES[0].colors[0].hex,
  width:      4,
  people:     [],
  person:     'p1',
  works:      [],
  viewing:    null,
  zoom:       1,
  panX:       0,
  panY:       0,
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
    /* Diese drei liest das Füllwerkzeug bei jedem Tipp. */
    const readOften = (id === 'motif' || id === 'draw' || id === 'fill');
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

/* Ein Quadrat ist vierfach drehsymmetrisch. Es darf deshalb so wenig durch
   pen.repeat() wie der volle Kreis: bei 24 Achsen lägen sonst 24 gegeneinander
   verdrehte Quadrate übereinander. Einmal zeichnen genügt. */
function squarePoints(half) {
  return [[CX - half, CY - half], [CX + half, CY - half],
          [CX + half, CY + half], [CX - half, CY + half]];
}

function drawSquare(pen, half, lineWidth) {
  pen.ctx.lineWidth = lineWidth || 2;
  tracePath(pen.ctx, squarePoints(half), true);
}

/* Ein Ringband ohne Querwände ist ein einziges, riesiges Feld – ein Tipp
   färbt dann den halben Rand. Jedes Band bekommt deshalb Wände; phase
   verschiebt sie gegen das Nachbarband, das ergibt den Mauerverband. */
function drawRingWalls(ctx, rInner, rOuter, count, phase, lineWidth) {
  const step = TAU / count;
  ctx.lineWidth = lineWidth || 1.6;
  for (let i = 0; i < count; i++) {
    const a = UP + (i + (phase || 0)) * step;
    tracePath(ctx, [pol(rInner, a), pol(rOuter, a)], false);
  }
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
   Felder. Nicht entfernen.

   Ausnahme: Motive mit frame === false. Eine Anlage bringt ihren eigenen,
   geschlossenen Rahmen mit – Speichen von der Nabe bis zum Rand würden ihr
   quer durch den Palast laufen. Dass dabei nichts ausläuft, prüft der
   Testlauf für jedes Motiv gleich mit. */
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
  { id: 'anlage', title: 'Anlagen' },
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

  {
    id: 'achteckstern', world: 'geo', axes: 8,
    name: 'Achteckstern', note: 'Acht Achsen, klare Kanten',
    build: function (p) {
      drawRing(p, 366, 1.6);
      drawRing(p, 296, 1.8);
      drawRing(p, 226, 1.6);
      drawRing(p, 148, 1.8);
      drawClosedLoop(p, diamondPoints(298, 404, p.step * 0.30), 2.2);
      drawClosedLoop(p, rotatePoints(diamondPoints(298, 364, p.step * 0.18), p.step / 2), 1.6);
      drawClosedLoop(p, wedgeBandPoints(228, 294, p.step * 0.36, 16), 1.8);
      drawClosedLoop(p, diamondPoints(150, 224, p.step * 0.34), 1.8);
      drawClosedLoop(p, petalPoints(48, 146, p.step * 0.40), 2);
      drawDotAccent(p, 340, 6, 1.4);
    }
  },
  {
    id: 'gitterrose', world: 'geo', axes: 12,
    name: 'Gitterrose', note: 'Verschränkte Rauten, dichtes Netz',
    build: function (p) {
      drawRing(p, 372, 1.4);
      drawRing(p, 308, 1.6);
      drawRing(p, 244, 1.6);
      drawRing(p, 180, 1.6);
      drawRing(p, 112, 1.6);
      drawClosedLoop(p, diamondPoints(310, 402, p.step * 0.42), 1.8);
      drawClosedLoop(p, rotatePoints(diamondPoints(246, 306, p.step * 0.46), p.step / 2), 1.8);
      drawClosedLoop(p, diamondPoints(182, 242, p.step * 0.46), 1.8);
      drawClosedLoop(p, rotatePoints(petalPoints(114, 178, p.step * 0.44), p.step / 2), 1.8);
      drawClosedLoop(p, petalPoints(48, 110, p.step * 0.42), 1.8);
    }
  },
  /* --- Natur ------------------------------------------------------------ */
  {
    id: 'bluete', world: 'natur', axes: 8,
    name: 'Blüte', note: 'Acht große Blätter, viel Fläche',
    build: function (p) {
      drawRing(p, 122, 2);
      drawRing(p, 214, 1.4);
      drawRing(p, 306, 1.4);
      drawRing(p, 368, 1.4);
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
      drawRing(p, 360, 1.6);
      drawRing(p, 290, 1.6);
      drawRing(p, 220, 1.6);
      drawRing(p, 150, 1.6);
      drawRing(p, 90, 1.6);
      /* Die Arme müssen Nabe und Außenring wirklich berühren. */
      [0, 0.33, 0.66].forEach(function (offset) {
        drawPolyline(p, rotatePoints(spiralPoints(R_IN, R_OUT, p.step * 1.85, 72), offset * p.step), 2);
      });
      drawDotAccent(p, 250, 7, 1.6);
    }
  },

  {
    id: 'farnkreis', world: 'natur', axes: 10,
    name: 'Farnkreis', note: 'Wedel mit feinen Fiedern',
    build: function (p) {
      drawRing(p, 360, 1.4);
      drawRing(p, 292, 1.6);
      drawRing(p, 220, 1.6);
      drawRing(p, 146, 1.6);
      drawRing(p, 92, 1.6);
      drawClosedLoop(p, petalPoints(294, 400, p.step * 0.30, 26, 0.85), 2.2);
      drawPolyline(p, [pol(298, UP), pol(396, UP)], 1.1);
      [316, 344, 372].forEach(function (r) {
        drawPolyline(p, [pol(r, UP), branchTip(r, 24, 1)], 1.1);
        drawPolyline(p, [pol(r, UP), branchTip(r, 24, -1)], 1.1);
      });
      drawClosedLoop(p, rotatePoints(petalPoints(222, 290, p.step * 0.34, 24), p.step / 2), 1.8);
      drawClosedLoop(p, petalPoints(148, 218, p.step * 0.36, 24), 1.8);
      drawClosedLoop(p, petalPoints(48, 90, p.step * 0.42), 1.8);
    }
  },
  {
    id: 'samenkranz', world: 'natur', axes: 16,
    name: 'Samenkranz', note: 'Sechzehn Samen, feine Teilung',
    build: function (p) {
      drawRing(p, 374, 1.3);
      drawRing(p, 312, 1.4);
      drawRing(p, 252, 1.4);
      drawRing(p, 192, 1.4);
      drawRing(p, 130, 1.4);
      drawClosedLoop(p, petalPoints(314, 402, p.step * 0.38, 24, 0.62), 1.6);
      drawClosedLoop(p, rotatePoints(petalPoints(254, 310, p.step * 0.40, 22, 0.62), p.step / 2), 1.5);
      drawClosedLoop(p, petalPoints(194, 250, p.step * 0.40, 22, 0.62), 1.5);
      drawClosedLoop(p, diamondPoints(132, 190, p.step * 0.36), 1.4);
      drawClosedLoop(p, petalPoints(48, 128, p.step * 0.44), 1.6);
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
      drawRing(p, 388, 1.6);
      drawRing(p, 356, 1.6);
      drawRing(p, 250, 1.6);
      drawRing(p, 150, 1.6);
      drawRing(p, 92, 1.6);
      drawClosedLoop(p, wedgeBandPoints(254, 352, p.step * 0.36, 16), 2);
      drawClosedLoop(p, rotatePoints(wedgeBandPoints(154, 246, p.step * 0.30, 16), p.step / 2), 2);
      drawDotAccent(p, 382, 9, 1.6);
      drawDotAccent(p, 100, 7, 1.6);
    }
  },

  {
    id: 'atemringe', world: 'zen', axes: 16,
    name: 'Atemringe', note: 'Ruhiger Takt, gleichmäßige Weite',
    build: function (p) {
      [388, 340, 292, 244, 196, 148, 100].forEach(function (r) {
        drawRing(p, r, 1.5);
      });
      drawDotAccent(p, 364, 5, 1.3);
      drawDotAccent(p, 124, 5, 1.3);
    }
  },
  {
    id: 'steingarten', world: 'zen', axes: 10,
    name: 'Steingarten', note: 'Wenige Formen, geharkte Bahnen',
    build: function (p) {
      [386, 348, 310, 272, 234, 196, 158, 120, 84].forEach(function (r) {
        drawRing(p, r, 1.3);
      });
      drawClosedLoop(p, petalPoints(200, 306, p.step * 0.34, 26, 0.7), 2.4);
      drawDotAccent(p, 356, 12, 2);
      drawDotAccent(p, 140, 9, 2);
    }
  },
  /* --- Jahreszeiten ----------------------------------------------------- */
  {
    id: 'winter', world: 'jahr', axes: 6,
    name: 'Winter', note: 'Schneekristall mit Seitenästen',
    build: function (p) {
      drawRing(p, 372, 1.4);
      drawRing(p, 300, 1.4);
      drawRing(p, 224, 1.4);
      drawRing(p, 150, 1.4);
      drawRing(p, 96, 1.6);
      /* Von Nabe bis Außenring durchgezogen – ein offenes Ende würde
         benachbarte Felder verbinden. */
      drawPolyline(p, [pol(R_IN, UP), pol(R_OUT, UP)], 2.6);
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
      drawRing(p, 356, 1.4);
      drawRing(p, 300, 1.6);
      drawRing(p, 226, 1.4);
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

  /* --- Anlagen ----------------------------------------------------------
     Kein komplizierteres Muster, sondern ein Grundriss. Von außen nach
     innen: Schutzbereich, Vorhöfe, vier Tore, Palastmauer, Innenhof,
     Kammer, Mitte. Die Vorlage bringt ihren eigenen Rahmen mit (frame:
     false) – Speichen von der Nabe bis zum Rand liefen ihr quer durch den
     Palast.

     zones ist das Eigentliche daran: die Achsenzahl hängt hier nicht an der
     Einstellung, sondern am Ort. Außen nimmt die Maschine fast alles ab, im
     Palast noch die vier Himmelsrichtungen, in der Mitte nichts mehr.

     Zwei Regeln, die beim Bauen sofort zuschnappen: Kein Ringband und kein
     Mauerband ohne Querwände – sonst ist es ein einziges Feld. Und ein Tor
     muss eine Schwelle haben, sonst sind Vorhof und Innenhof ein einziger
     Raum, und ein Tipp färbt den halben Palast. */
  {
    id: 'anlage', world: 'anlage', axes: 4, frame: false,
    name: 'Anlage', note: 'Vier Tore, drei Bereiche',
    zones: [
      { r: 74,    axes: 1,  name: 'Mitte' },
      { r: 316,   axes: 4,  name: 'Palast' },
      { r: R_OUT, axes: 24, name: 'Schutzbereich' }
    ],
    build: function (p) {
      const ctx   = p.ctx;
      const ARC   = 316;   // Grenze zwischen Schutzbereich und Palastbezirk
      const WALL  = 225;   // äußere Flucht der Palastmauer
      const WIN   = 205;   // innere Flucht
      const COURT = 130;   // Innenhof zur Kammer
      const HEART = 74;    // die Mitte, zugleich der freie Bereich
      const GATE  = 38;    // halbe Breite der Torkammer
      const four  = makePen(ctx, 4);

      /* Schutzbereich: drei Ringbänder, gegeneinander versetzt gemauert. */
      drawRing(p, R_OUT, 2.6);
      drawRing(p, 380, 1.8);
      drawRing(p, 348, 1.8);
      drawRing(p, ARC, 2.4);
      drawRingWalls(ctx, ARC, 348, 24, 0, 1.6);
      drawRingWalls(ctx, 348, 380, 24, 0.5, 1.6);
      drawRingWalls(ctx, 380, R_OUT, 24, 0, 1.6);

      /* Die Palastmauer. Ihre Ecken treten durch den inneren Ring – das
         trennt die vier Vorhöfe voneinander, sie berühren sich nur noch in
         einem Punkt. */
      drawSquare(p, WALL, 2.4);
      drawSquare(p, WIN, 2.4);
      drawSquare(p, COURT, 2.2);
      drawRing(p, HEART, 2.2);

      /* Alles Weitere wird einmal nach Norden gezeichnet und vierfach
         gedreht – die vier Himmelsrichtungen sind hier keine Zierde,
         sondern der Grundriss. */
      four.repeat(function () {
        /* Binder in der Mauer: aus dem Band wird Mauerwerk. */
        [-190, -114, 114, 190].forEach(function (x) {
          tracePath(ctx, [[CX + x, CY - WALL], [CX + x, CY - WIN]], false);
        });

        /* Das Tor. Der Durchgang ist eine Kammer *in* der Mauer: unten und
           oben schließen ihn die beiden Mauerfluchten, links und rechts die
           Wangen. Genau deshalb bleibt Farbe drin. Ein wirklich offener
           Durchgang machte Vorhof und Innenhof zu einem einzigen Raum, und
           ein Tipp färbte den halben Palast. Ein Tor ist hier also kein Loch,
           sondern ein Bauwerk mit Schwelle.

           Darüber, auf der äußeren Flucht, ein nach außen abnehmender
           Aufbau. Eine einzelne Spitze läse sich, nach außen gedreht, als
           Pfeil; die Stufen machen daraus ein Torhaus. Jede Stufe steht auf
           der Deckplatte der darunterliegenden und ist dadurch geschlossen. */
        ctx.lineWidth = 2.2;
        tracePath(ctx, [[CX - GATE, CY - WIN], [CX - GATE, CY - WALL]], false);
        tracePath(ctx, [[CX + GATE, CY - WIN], [CX + GATE, CY - WALL]], false);
        [[62, WALL, 246], [44, 246, 264], [26, 264, 280]].forEach(function (tier) {
          const half = tier[0], near = tier[1], far = tier[2];
          tracePath(ctx, [[CX - half, CY - near], [CX - half, CY - far],
                          [CX + half, CY - far], [CX + half, CY - near]], false);
        });

        /* Vorhof: Quermauern von der Palastmauer bis an den Ring. */
        ctx.lineWidth = 1.6;
        [-152, -78, 78, 152].forEach(function (x) {
          const y = Math.sqrt(ARC * ARC - x * x);
          tracePath(ctx, [[CX + x, CY - WALL], [CX + x, CY - y]], false);
        });

        /* Innenhof: drei Felder je Seite, das mittlere vor dem Tor. */
        [-130, -68, 68, 130].forEach(function (x) {
          tracePath(ctx, [[CX + x, CY - WIN], [CX + x, CY - COURT]], false);
        });

        /* Kammer: acht Felder um die Mitte. */
        tracePath(ctx, [[CX, CY - COURT], [CX, CY - HEART]], false);
        tracePath(ctx, [pol(HEART, UP + Math.PI / 4), [CX + COURT, CY - COURT]], false);
      });

      /* Die Mitte bleibt leer. Sie ist ein Ort in der Anlage, kein Ziel:
         wer will, gestaltet sie; wer will, lässt sie. */
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
    id: 'formenreigen', world: 'kids', axes: 8,
    name: 'Formenreigen', note: 'Kindergarten – runde und eckige Felder',
    build: function (p) {
      drawRing(p, 320, 2.6);
      drawRing(p, 220, 2.6);
      drawRing(p, 130, 2.6);
      drawClosedLoop(p, petalPoints(322, 400, p.step * 0.42, 24), 3);
      drawClosedLoop(p, rotatePoints(diamondPoints(224, 316, p.step * 0.44), p.step / 2), 3);
      drawClosedLoop(p, wedgeBandPoints(134, 216, p.step * 0.34, 14), 3);
      drawDotAccent(p, 88, 18, 3);
    }
  },
  {
    id: 'zaehlen6', world: 'kids', axes: 6,
    name: 'Zähl bis 6', note: 'Punkte zählen, nach Anzahl färben',
    task: 'Zähl die Punkte in einem Feld. Unten in der Leiste steht bei jeder '
      + 'Farbe eine Zahl – nimm die Farbe mit deiner Anzahl und tippe ins Feld.',
    kind: 'count',
    bands: [[R_IN, 250], [250, R_OUT]],
    values: [1, 2, 3, 4, 5, 6],
    build: gridBuild
  },
  {
    id: 'zaehlen10', world: 'kids', axes: 10,
    name: 'Zähl bis 10', note: 'Punkte zählen bis zehn',
    task: 'Zähl die Punkte in einem Feld. Unten in der Leiste steht bei jeder '
      + 'Farbe eine Zahl – nimm die Farbe mit deiner Anzahl und tippe ins Feld.',
    kind: 'count',
    bands: [[R_IN, 250], [250, R_OUT]],
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    build: gridBuild
  },
  {
    id: 'rechnen10', world: 'kids', axes: 8,
    name: 'Rechenmandala ZR 10', note: 'Plus und Minus im Zahlenraum 10',
    task: 'Rechne die Aufgabe in einem Feld aus. Unten in der Leiste steht bei '
      + 'jeder Farbe eine Zahl – nimm die Farbe mit deinem Ergebnis und tippe '
      + 'ins Feld.',
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
    task: 'Rechne die Aufgabe in einem Feld aus. Unten in der Leiste steht bei '
      + 'jeder Farbe eine Zahl – nimm die Farbe mit deinem Ergebnis und tippe '
      + 'ins Feld.',
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
      hex: pigments()[index % pigments().length].hex,
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
  ctx.fillStyle = palette().ink;
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

   Gestaffelte Symmetrie (Motive mit zones): Dort hängt die Achsenzahl nicht
   an der Einstellung, sondern daran, wo die Hand aufsetzt. Außen nimmt die
   Maschine fast alles ab, im Palast noch die vier Himmelsrichtungen, in der
   Mitte nichts mehr. Das ist der Kern der Anlagen – ohne diese Staffelung
   wäre eine Architektur nur ein Ornament mit Grundriss.
   ------------------------------------------------------------------------- */

/* Welcher Bereich liegt unter diesem Punkt? Ohne Anlage: keiner. */
function zoneAt(x, y) {
  const motif = state.motif;
  if (!motif || !motif.zones || !state.graded) return null;
  const r = Math.hypot(x - CX, y - CY);
  const zones = motif.zones;
  for (let i = 0; i < zones.length; i++) {
    if (r <= zones[i].r) return zones[i];
  }
  return zones[zones.length - 1];
}

/* Die Symmetrie, die an dieser Stelle gilt: entweder die eingestellte oder
   die des Bereichs. In der Mitte fällt auch die Spiegelung weg – dort soll
   wirklich jeder Strich einzeln zählen. */
function symmetryAt(point) {
  const zone = point ? zoneAt(point[0], point[1]) : null;
  if (!zone) return { axes: state.axes, mirror: state.mirror };
  return { axes: zone.axes, mirror: zone.axes > 1 && state.mirror };
}

function symmetryPoints(x, y, sym) {
  const use  = sym || { axes: state.axes, mirror: state.mirror };
  const out  = [];
  const step = TAU / use.axes;
  const dx = x - CX, dy = y - CY;
  const bases = use.mirror ? [[dx, dy], [dx, -dy]] : [[dx, dy]];

  for (let i = 0; i < use.axes; i++) {
    const c = Math.cos(i * step), s = Math.sin(i * step);
    for (let b = 0; b < bases.length; b++) {
      const px = bases[b][0], py = bases[b][1];
      out.push([CX + px * c - py * s, CY + px * s + py * c]);
    }
  }
  return out;
}

/* Der ganze Zug gehört dem Bereich, in dem er begonnen hat. Sonst änderte
   sich die Achsenzahl mitten im Strich, und die beiden Punktlisten hätten
   verschiedene Längen. */
function segmentLine(p0, p1) {
  const sym = state.strokeSym || symmetryAt(p0);
  const a = symmetryPoints(p0[0], p0[1], sym);
  const b = symmetryPoints(p1[0], p1[1], sym);
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
   8b. Grundformen

   Freihand gezogene Kreise werden krumm – das liegt nicht am Können, sondern
   an der Sache. Die 26 Vorlagen bestehen aus fünf Bausteinen, und genau die
   gibt es hier als Werkzeug: Ring, Speiche, Blatt, Raute, Band. Sie entstehen
   aus denselben Funktionen wie die Vorlagen, sind also exakt.

   Bedienung: Aufsetzen legt Anfang und Achse fest, Ziehen nach außen die
   Länge, seitliches Ziehen die Breite. Losgelassen wird die Form auf allen
   Achsen zugleich gesetzt.
   ------------------------------------------------------------------------- */

const SHAPE_NAMES = {
  ring:    'Ring',
  spoke:   'Speiche',
  petal:   'Blatt',
  diamond: 'Raute',
  band:    'Band'
};

function polarOf(point) {
  const dx = point[0] - CX, dy = point[1] - CY;
  return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) };
}

/* Kürzester Winkelabstand, damit der Sprung bei ±180° nicht stört. */
function angleGap(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/* Aus Anfasspunkt und aktuellem Punkt die Form beschreiben. */
function shapeFigure(from, to) {
  const start = polarOf(from);
  const now = polarOf(to);
  const sym = state.strokeSym || symmetryAt(from);
  const step = TAU / sym.axes;
  const rInner = Math.max(R_IN * 0.5, Math.min(start.r, now.r));
  const rOuter = Math.max(rInner + 6, Math.max(start.r, now.r));
  const spread = Math.abs(angleGap(now.a, start.a));
  const half = Math.max(step * 0.12, Math.min(step * 0.46, spread || step * 0.3));

  return {
    kind: state.shape,
    angle: start.a,
    rInner: rInner,
    rOuter: rOuter,
    half: half,
    radius: now.r,
    sym: sym
  };
}

/* Die Form auf einen Kontext zeichnen – für Vorschau wie fürs Festlegen. */
function strokeFigure(ctx, figure, color, width) {
  const pen = makePen(ctx, figure.sym ? figure.sym.axes : state.axes);
  /* Die Bausteine liegen um UP; hierher gedreht, wo der Finger aufsetzte. */
  const turn = figure.angle - UP;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (figure.kind === 'ring') {
    drawRing(pen, Math.max(8, figure.radius), width);
  } else if (figure.kind === 'spoke') {
    drawPolyline(pen, rotatePoints(
      [pol(figure.rInner, UP), pol(figure.rOuter, UP)], turn), width);
  } else if (figure.kind === 'petal') {
    drawClosedLoop(pen, rotatePoints(
      petalPoints(figure.rInner, figure.rOuter, figure.half, 26), turn), width);
  } else if (figure.kind === 'diamond') {
    drawClosedLoop(pen, rotatePoints(
      diamondPoints(figure.rInner, figure.rOuter, figure.half), turn), width);
  } else if (figure.kind === 'band') {
    drawClosedLoop(pen, rotatePoints(
      wedgeBandPoints(figure.rInner, figure.rOuter, figure.half, 16), turn), width);
  }

  ctx.restore();
}

/* Vorschau liegt auf der Rasterebene – die wird ohnehin dauernd neu gemalt. */
function previewFigure(figure) {
  renderGuides();
  const ctx = layers.guide.ctx;
  ctx.save();
  ctx.globalAlpha = 0.55;
  strokeFigure(ctx, figure, state.color, state.width);
  ctx.restore();
}

function commitFigure(figure) {
  strokeFigure(layers.draw.ctx, figure, state.color, state.width);
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

/* Zwei Fragen, eine Antwort:

   Bei Zähl- und Rechenmandalas trägt jedes Feld einen eigenen Wert. Dort färbt
   ein Tipp immer nur das angetippte Feld – sonst bekämen Felder mit
   verschiedenen Ergebnissen dieselbe Farbe und die Aufgabe wäre hinfällig.
   Das ist keine Einstellung, sondern eine Bedingung.

   Sonst entscheidet der Schalter „Füllen wirkt auf alle Achsen“. An ist das
   Voreingestellte – der Komfortgewinn gegenüber Papier. Aus, wer jedes Feld
   einzeln setzen und dabei eigene Muster legen will. */
function isExercise(motif) {
  return !!motif && (motif.kind === 'count' || motif.kind === 'math');
}

function fillsSymmetrically(motif) {
  return !isExercise(motif) && state.fillAll;
}

/* Eine Anlage mit eingeschalteter Staffelung. Ist der Schalter aus, verhält
   sie sich wie jede andere Vorlage – dann gilt wieder die eingestellte
   Achsenzahl, überall gleich. */
function zonedMotif() {
  return !!(state.motif && state.motif.zones && state.graded);
}

function floodFill(x, y, hex) {
  const w = layers.fill.canvas.width;
  const h = layers.fill.canvas.height;

  /* Wand ist alles, was auf der Vorlage oder unter eigenen Strichen liegt. */
  const wall = blockedMask(w, h);

  const image = layers.fill.ctx.getImageData(0, 0, w, h);
  const buf   = new Uint32Array(image.data.buffer);
  const target = packColor(hex);

  const seeds = fillsSymmetrically(state.motif)
    ? symmetryPoints(x, y, symmetryAt([x, y]))
    : [[x, y]];

  let painted = false;

  seeds.forEach(function (p) {
    const sx = Math.round(p[0] * state.dpr);
    const sy = Math.round(p[1] * state.dpr);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

    const index = sy * w + sx;
    if (wall[index]) return;                        // direkt auf einer Linie
    const start = buf[index];
    if (start === target) return;                   // Feld hat die Farbe schon

    scanFill(buf, wall, w, h, sx, sy, start, target);
    painted = true;
  });

  if (painted) layers.fill.ctx.putImageData(image, 0, 0);
  return painted;
}

/* Beide Linienebenen zu einer Maske verrechnen: ein Byte je Bildpunkt
   statt zweier Alphawerte, das hält die Suche danach knapp. */
function blockedMask(w, h) {
  const a = layers.motif.ctx.getImageData(0, 0, w, h).data;
  const b = layers.draw.ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
    if (a[p] > WALL_ALPHA || b[p] > WALL_ALPHA) mask[i] = 1;
  }
  return mask;
}

function scanFill(buf, wall, w, h, x, y, start, target) {
  const stack = [x, y];

  function open(index) {
    return buf[index] === start && !wall[index];
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
    const open = buf[index] === start && !wall[index];
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

  const zones = zonedMotif() ? state.motif.zones : null;

  ctx.save();
  /* Eine Anlage hat ein Oben – vier Tore in vier Richtungen. Ein Raster,
     das sich darüber wegdreht, widerspräche dem, also steht es still. */
  if (!zones) {
    ctx.translate(CX, CY);
    ctx.rotate(state.guideAngle);
    ctx.translate(-CX, -CY);
  }
  ctx.strokeStyle = palette().guide;
  ctx.lineWidth = 1;

  /* Bei einer Anlage zeigt das Raster die Bereiche: jeder Ring ist eine
     Grenze, und innerhalb eines Bereichs stehen so viele Achsen, wie dort
     tatsächlich gelten. Man sieht der Fläche an, was die Hand dort tut. */
  if (zones) {
    let inner = 0;
    zones.forEach(function (zone) {
      ctx.beginPath();
      ctx.arc(CX, CY, zone.r, 0, TAU);
      ctx.stroke();

      if (zone.axes > 1) {
        const step = TAU / zone.axes;
        ctx.beginPath();
        for (let i = 0; i < zone.axes; i++) {
          const a = UP + i * step;
          const from = pol(inner, a), to = pol(zone.r, a);
          ctx.moveTo(from[0], from[1]);
          ctx.lineTo(to[0], to[1]);
        }
        ctx.stroke();
      }
      inner = zone.r;
    });
    ctx.restore();
    return;
  }

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
const future = [];          // Wiederherstellen

function pushHistory(names) {
  future.length = 0;        // ein neuer Zug verwirft den Wiederherstellen-Weg
  history.push(snapshot(names));
  trimHistory();
  syncUI();
}

/* Das Speicherlimit gilt für beide Stapel zusammen – sonst verdoppelt
   Wiederherstellen den Verbrauch auf dem iPad. */
function trimHistory() {
  const weigh = function (sum, e) { return sum + e.bytes; };
  let total = history.reduce(weigh, 0) + future.reduce(weigh, 0);
  while (history.length > HISTORY_MAX) total -= history.shift().bytes;
  while (future.length > HISTORY_MAX) total -= future.pop().bytes;
  while (total > HISTORY_BYTES && (history.length > 1 || future.length)) {
    total -= (future.length ? future.pop() : history.shift()).bytes;
  }
}

function snapshot(names) {
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
  return entry;
}

function applyEntry(entry) {
  Object.keys(entry.layers).forEach(function (name) {
    const ctx = layers[name].ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layers[name].canvas.width, layers[name].canvas.height);
    ctx.drawImage(entry.layers[name], 0, 0);
    ctx.restore();
  });
}

function undo() {
  const entry = history.pop();
  if (!entry) return;
  future.push(snapshot(Object.keys(entry.layers)));
  applyEntry(entry);
  trimHistory();
  syncUI();
}

function redo() {
  const entry = future.pop();
  if (!entry) return;
  history.push(snapshot(Object.keys(entry.layers)));
  applyEntry(entry);
  trimHistory();
  syncUI();
}



/* ---------------------------------------------------------------------------
   12. Galerie

   Fertige Bilder bleiben auf dem Gerät. localStorage wäre zu klein – ein Werk
   wiegt ein paar hundert Kilobyte –, deshalb IndexedDB. Ist sie nicht
   verfügbar (Safari im privaten Modus), hält die App die Werke nur für die
   laufende Sitzung; das wird dann auch gesagt statt stillschweigend zu
   schlucken.
   ------------------------------------------------------------------------- */

const Gallery = {
  db: null,
  volatile: [],          // Notlager, wenn IndexedDB nicht mitspielt
  persistent: false,

  open: function () {
    const self = this;
    return new Promise(function (resolve) {
      if (!window.indexedDB) return resolve();
      let request;
      try {
        request = indexedDB.open('mandala-atelier-regal2-12', 1);
      } catch (err) {
        return resolve();
      }
      request.onupgradeneeded = function () {
        request.result.createObjectStore('werke', { keyPath: 'id' });
      };
      request.onsuccess = function () {
        self.db = request.result;
        self.persistent = true;
        resolve();
      };
      request.onerror = function () { resolve(); };
      request.onblocked = function () { resolve(); };
    });
  },

  store: function (mode) {
    return this.db.transaction('werke', mode).objectStore('werke');
  },

  put: function (work) {
    if (!this.db) {
      this.volatile = this.volatile.filter(function (w) { return w.id !== work.id; });
      this.volatile.push(work);
      return Promise.resolve();
    }
    return wrap(this.store('readwrite').put(work));
  },

  all: function () {
    if (!this.db) return Promise.resolve(this.volatile.slice());
    return wrap(this.store('readonly').getAll());
  },

  remove: function (id) {
    if (!this.db) {
      this.volatile = this.volatile.filter(function (w) { return w.id !== id; });
      return Promise.resolve();
    }
    return wrap(this.store('readwrite').delete(id));
  }
};

function wrap(request) {
  return new Promise(function (resolve, reject) {
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error); };
  });
}

/* Alle bemalbaren Ebenen auf Papier zusammenlegen. Dieselbe Funktion für
   Download, Kachel und vergrößerte Ansicht – so sehen alle drei gleich aus. */
function composeImage(size) {
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.fillStyle = palette().paper;
  ctx.fillRect(0, 0, size, size);
  ['fill', 'motif', 'draw', 'label'].forEach(function (name) {
    ctx.drawImage(layers[name].canvas, 0, 0, size, size);
  });
  return out;
}

function newId() {
  return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDate(stamp) {
  const date = new Date(stamp);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function keepWork() {
  const work = {
    id: newId(),
    title: state.motif ? state.motif.name : 'Freies Blatt',
    motif: state.motif ? state.motif.name : 'Leeres Blatt',
    created: Date.now(),
    person: currentPerson().id,
    thumb: composeImage(280).toDataURL('image/png'),
    full: composeImage(1200).toDataURL('image/png')
  };

  return Gallery.put(work).then(function () {
    say(Gallery.persistent
      ? 'In die Galerie gelegt.'
      : 'In die Galerie gelegt – bleibt aber nur, solange die Seite offen ist.');
    refreshGallery();
  }).catch(function () {
    say('Das Werk ließ sich nicht ablegen – der Speicher des Geräts ist voll.');
  });
}

function refreshGallery() {
  return Gallery.all().then(function (works) {
    /* Werke aus der Zeit vor den Personen gehören der ersten Person. */
    const own = works.filter(function (w) {
      return (w.person || people()[0].id) === currentPerson().id;
    });
    own.sort(function (a, b) { return b.created - a.created; });
    state.works = own;
    renderWorks();
  });
}

function renderWorks() {
  const works = state.works || [];
  ui.works.textContent = '';
  ui.galleryEmpty.hidden = works.length > 0;
  ui.galleryCount.textContent = works.length
    ? works.length + (works.length === 1 ? ' Werk' : ' Werke')
    : '';

  works.forEach(function (work) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'work';
    button.dataset.work = work.id;
    button.innerHTML = '<img alt=""><span class="work-title"></span><span class="work-meta"></span>';
    button.querySelector('img').src = work.thumb;
    button.querySelector('img').alt = work.title;
    button.querySelector('.work-title').textContent = work.title;
    button.querySelector('.work-meta').textContent = formatDate(work.created);
    ui.works.appendChild(button);
  });
}

function openViewer(id) {
  const work = (state.works || []).filter(function (w) { return w.id === id; })[0];
  if (!work) return;
  state.viewing = work;
  ui.viewerImage.src = work.full;
  ui.viewerImage.alt = work.title;
  ui.viewerTitle.value = work.title;
  ui.viewerMeta.textContent = work.motif + ' · ' + formatDate(work.created);
  ui.viewer.hidden = false;
  ui.viewerTitle.focus();
}

function closeViewer() {
  ui.viewer.hidden = true;
  state.viewing = null;
}

function renameWork() {
  const work = state.viewing;
  if (!work) return;
  const title = ui.viewerTitle.value.trim() || work.motif;
  if (title === work.title) return;
  work.title = title;
  Gallery.put(work).then(renderWorks);
}

function deleteWork() {
  const work = state.viewing;
  if (!work) return;
  Gallery.remove(work.id).then(function () {
    closeViewer();
    refreshGallery();
  });
}

function downloadWork() {
  const work = state.viewing;
  if (!work) return;
  const link = document.createElement('a');
  link.download = fileName(work.title, work.created);
  link.href = work.full;
  link.click();
}

function fileName(title, stamp) {
  const name = currentPerson().name;
  const slug = ((name ? name + ' ' : '') + title).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mandala';
  return 'mandala-' + slug + '-' + new Date(stamp).toISOString().slice(0, 10) + '.png';
}

/* Personen: eine dünne Ebene über der Galerie. Kein Konto, kein Bild, keine
   Punkte – nur ein Name, damit sich mehrere Leute auf einem iPad nicht in die
   Bilder malen. Alles bleibt auf dem Gerät. */
function people() {
  if (!state.people.length) state.people = [{ id: 'p1', name: '' }];
  return state.people;
}

function currentPerson() {
  return people().filter(function (p) { return p.id === state.person; })[0] || people()[0];
}

function savePeople() {
  Store.set('people', state.people);
  Store.set('person', currentPerson().id);
}

function addPerson() {
  const person = { id: 'p' + Date.now().toString(36), name: '' };
  state.people.push(person);
  state.person = person.id;
  savePeople();
  renderPeople();
  refreshGallery();
  ui.owner.focus();
}

function renamePerson(name) {
  currentPerson().name = (name || '').trim().slice(0, 28);
  savePeople();
  renderPeople();
}

function selectPerson(id) {
  if (id === '+') { addPerson(); return; }
  state.person = id;
  savePeople();
  renderPeople();
  refreshGallery();
}

function renderPeople() {
  const person = currentPerson();
  state.person = person.id;
  ui.galleryHead.textContent = person.name ? 'Galerie von ' + person.name : 'Galerie';
  if (ui.owner.value !== person.name) ui.owner.value = person.name;

  ui.personSelect.textContent = '';
  people().forEach(function (p, i) {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name || 'Ohne Namen ' + (i + 1);
    if (p.id === person.id) option.selected = true;
    ui.personSelect.appendChild(option);
  });
  const add = document.createElement('option');
  add.value = '+';
  add.textContent = '＋ Neue Person';
  ui.personSelect.appendChild(add);
}

/* Sicherung: eine Datei, die das Atelier enthält. Zugleich der Weg auf ein
   zweites Gerät – ohne sie ist alles weg, sobald jemand die Browserdaten
   löscht. */
function saveBackup() {
  Gallery.all().then(function (works) {
    const backup = {
      app: 'mandala-atelier',
      version: 1,
      exported: new Date().toISOString(),
      people: state.people,
      ownPalette: ownPalette().colors,
      works: works
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'mandala-atelier-sicherung-' +
      new Date().toISOString().slice(0, 10) + '.json';
    link.href = url;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    say(works.length + (works.length === 1 ? ' Werk gesichert.' : ' Werke gesichert.'));
  });
}

function loadBackup(file) {
  const reader = new FileReader();
  reader.onload = function () {
    let backup;
    try {
      backup = JSON.parse(reader.result);
    } catch (err) {
      say('Die Datei ließ sich nicht lesen.');
      return;
    }
    if (!backup || backup.app !== 'mandala-atelier' || !Array.isArray(backup.works)) {
      say('Das ist keine Sicherung des Mandala Ateliers.');
      return;
    }

    /* Zusammenführen statt ersetzen – vorhandene Werke bleiben. */
    (backup.people || []).forEach(function (person) {
      if (!state.people.some(function (p) { return p.id === person.id; })) {
        state.people.push(person);
      }
    });
    savePeople();

    if (Array.isArray(backup.ownPalette) && backup.ownPalette.length === OWN_DEFAULT.length) {
      ownPalette().colors = backup.ownPalette;
      Store.set('ownPalette', backup.ownPalette);
      buildPalette();
    }

    Gallery.all().then(function (existing) {
      const known = {};
      existing.forEach(function (w) { known[w.id] = true; });
      const fresh = backup.works.filter(function (w) { return !known[w.id]; });
      return fresh.reduce(function (chain, work) {
        return chain.then(function () { return Gallery.put(work); });
      }, Promise.resolve()).then(function () {
        renderPeople();
        return refreshGallery().then(function () {
          say(fresh.length
            ? fresh.length + (fresh.length === 1 ? ' Werk eingelesen.' : ' Werke eingelesen.')
            : 'Alles aus der Sicherung war schon vorhanden.');
        });
      });
    });
  };
  reader.readAsText(file);
}

function setGallery(open) {
  ui.gallery.hidden = !open;
  ui.galleryButton.classList.toggle('is-active', open);
  if (open) {
    setDrawer('library', false);
    setDrawer('controls', false);
    refreshGallery();
  } else {
    closeViewer();
  }
}


/* ---------------------------------------------------------------------------
   13. Oberfläche
   ------------------------------------------------------------------------- */

const ui = {};

function cacheUi() {
  ui.task       = document.getElementById('task');
  ui.stage      = document.querySelector('.stage');
  ui.stack      = document.getElementById('stack');
  ui.worlds     = document.getElementById('worlds');
  ui.library    = document.getElementById('library');
  ui.controls   = document.getElementById('controls');
  ui.floatbar   = document.getElementById('floatbar');
  ui.palette    = document.getElementById('palette');
  ui.quickPalette = document.getElementById('quick-palette');
  ui.quickShapes  = document.getElementById('quick-shapes');
  ui.psets      = document.getElementById('palette-sets');
  ui.axes       = document.getElementById('axes');
  ui.legend     = document.getElementById('legend');
  ui.legendBox  = document.getElementById('legend-panel');
  ui.legendHead = document.getElementById('legend-title');
  ui.mirror     = document.getElementById('mirror');
  ui.guides     = document.getElementById('guides');
  ui.fillAll    = document.getElementById('fill-all');
  ui.fillAllNote= document.getElementById('fill-all-note');
  ui.graded     = document.getElementById('graded');
  ui.gradedBox  = document.getElementById('graded-switch');
  ui.gradedNote = document.getElementById('graded-note');
  ui.width      = document.getElementById('width');
  ui.zoomIn     = document.getElementById('btn-zoom-in');
  ui.zoomOut    = document.getElementById('btn-zoom-out');
  ui.zoomLevel  = document.getElementById('zoom-level');
  ui.undo       = document.getElementById('btn-undo');
  ui.redo       = document.getElementById('btn-redo');
  ui.quickCollapse = document.getElementById('btn-quick-collapse');
  ui.clear      = document.getElementById('btn-clear');
  ui.save       = document.getElementById('btn-save');
  ui.theme      = document.getElementById('btn-theme');
  ui.full       = document.getElementById('btn-fullscreen');
  ui.keep       = document.getElementById('btn-keep');
  ui.gallery      = document.getElementById('gallery');
  ui.galleryButton= document.getElementById('btn-gallery');
  ui.galleryClose = document.getElementById('btn-gallery-close');
  ui.galleryEmpty = document.getElementById('gallery-empty');
  ui.galleryCount = document.getElementById('gallery-count');
  ui.works        = document.getElementById('works');
  ui.galleryHead  = document.getElementById('gallery-title');
  ui.owner        = document.getElementById('gallery-owner');
  ui.personSelect = document.getElementById('person-select');
  ui.mixer        = document.getElementById('mixer');
  ui.mixColor     = document.getElementById('mix-color');
  ui.print        = document.getElementById('btn-print');
  ui.backupSave   = document.getElementById('btn-backup-save');
  ui.backupLoad   = document.getElementById('btn-backup-load');
  ui.backupFile   = document.getElementById('backup-file');
  ui.viewer       = document.getElementById('viewer');
  ui.viewerImage  = document.getElementById('viewer-image');
  ui.viewerTitle  = document.getElementById('viewer-title');
  ui.viewerMeta   = document.getElementById('viewer-meta');
  ui.fullExit   = document.getElementById('btn-fullscreen-exit');
  ui.hint       = document.getElementById('stage-hint');
  ui.tools      = Array.prototype.slice.call(document.querySelectorAll('.tool'));
}

function buildLibrary() {
  WORLDS.forEach(function (world) {
    const section = document.createElement('section');
    section.className = 'world';
    const heading = document.createElement('h3');
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

function buildPaletteSets() {
  PALETTES.forEach(function (set) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pset';
    button.dataset.palette = set.id;
    button.textContent = set.name;
    ui.psets.appendChild(button);
  });
}

/* Die Pigmente stehen zweimal: in der Schublade und im Schnellzugriff. */
function buildPalette() {
  [ui.palette, ui.quickPalette].forEach(function (host) {
    host.textContent = '';
    pigments().forEach(function (pigment) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pigment';
      button.style.background = pigment.hex;
      button.dataset.hex = pigment.hex;
      button.title = pigment.name;
      button.setAttribute('aria-label', pigment.name);
      host.appendChild(button);
    });
  });
  if (state.legend.length) buildQuickLegend();
}

/* Bei Zähl- und Rechenmandalas hilft die volle Palette nicht weiter – dort
   zählen genau die Farben der Legende, und zwar mit ihrer Zahl daneben.
   Die Aufgabe verweist darauf; sie darf nicht in einer Schublade liegen. */
function buildQuickLegend() {
  ui.quickPalette.textContent = '';
  state.legend.forEach(function (item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quick-legend';
    button.dataset.hex = item.hex;
    button.title = item.text;
    button.setAttribute('aria-label', item.text);
    button.innerHTML = '<span class="dot"></span><span class="val"></span>';
    button.querySelector('.dot').style.background = item.hex;
    button.querySelector('.val').textContent = item.value;
    ui.quickPalette.appendChild(button);
  });
}

/* Farbwelt wechseln. Bereits gefärbte Flächen behalten ihre Farbe – der
   Wechsel betrifft nur, womit ab jetzt gemalt wird. Die Farblegende der
   Zählmandalas wird neu vergeben. */
function ownPalette() {
  return PALETTES.filter(function (p) { return p.custom; })[0];
}

function loadOwnPalette() {
  const stored = Store.get('ownPalette', null);
  if (Array.isArray(stored) && stored.length === OWN_DEFAULT.length) {
    ownPalette().colors = stored.map(function (c, i) {
      return { name: c.name || OWN_DEFAULT[i].name, hex: c.hex || OWN_DEFAULT[i].hex };
    });
  }
}

/* Ein Pigment der eigenen Farbwelt umfärben. */
function mixPigment(hex) {
  ui.quickShapes.hidden = state.tool !== 'shape';
  Array.prototype.forEach.call(ui.quickShapes.children, function (button) {
    button.classList.toggle('is-active', button.dataset.shape === state.shape);
  });

  const own = ownPalette();
  const index = own.colors.reduce(function (found, c, i) {
    return c.hex === state.color ? i : found;
  }, -1);
  if (index < 0) return;
  own.colors[index] = { name: 'Eigen ' + (index + 1), hex: hex };
  Store.set('ownPalette', own.colors);
  state.color = hex;
  buildPalette();
  if (state.fields) state.legend = makeLegend(state.motif, state.fields);
  renderLegend();
  syncUI();
}

function setPalette(id) {
  const before = pigments();
  const index = before.reduce(function (found, p, i) {
    return p.hex === state.color ? i : found;
  }, 0);

  state.palette = id;
  Store.set('palette', id);
  state.color = pigments()[index].hex;

  buildPalette();
  if (state.fields) state.legend = makeLegend(state.motif, state.fields);
  renderLegend();
  syncUI();
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
  future.length = 0;
  clearLayer('fill');
  clearLayer('draw');

  if (motif) {
    state.axes = motif.axes;
    state.fields = motif.values ? makeFields(motif) : null;
    state.legend = state.fields ? makeLegend(motif, state.fields) : [];
  } else {
    state.fields = null;
    state.legend = [];
  }

  renderMotif();
  Store.set('motif', motif ? motif.id : '');
  renderLegend();
  buildPalette();
  syncUI();
}

/* Vorlage und Beschriftung neu zeichnen – beim Motivwechsel und bei jedem
   Wechsel zwischen Hell und Dunkel. Farbflächen und eigene Striche liegen
   auf anderen Ebenen und bleiben dabei unberührt. */
function renderMotif() {
  clearLayer('motif');
  const motif = state.motif;

  if (motif) {
    const ctx = layers.motif.ctx;
    const pen = makePen(ctx, motif.axes);
    ctx.save();
    ctx.strokeStyle = palette().ink;
    ctx.fillStyle = palette().ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (motif.frame !== false) drawWedgeFrame(pen);
    motif.build(pen);
    ctx.restore();
  }

  renderLabels();
  renderGuides();
}

function clearSheet() {
  if (state.motif) {
    loadMotif(state.motif.id);
  } else {
    history.length = 0;
    future.length = 0;
    clearLayer('fill');
    clearLayer('draw');
    syncUI();
  }
}

function exportImage() {
  const link = document.createElement('a');
  link.download = fileName(state.motif ? state.motif.name : 'freies Blatt', Date.now());
  link.href = composeImage(SIZE * 2).toDataURL('image/png');
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

/* Druckbogen: die App gibt Arbeit an Papier zurück. Ohne Hilfsraster, auf
   A4, wahlweise nur die Linien (zum Ausmalen mit echten Stiften) oder das
   fertige Werk. Gedruckt wird immer auf hellem Grund, auch im Dunkelmodus. */
function printSheet() {
  const withColour = window.confirm(
    'Druckbogen erstellen.\n\n' +
    'OK: mit den gesetzten Farben\n' +
    'Abbrechen: nur die Linien zum Ausmalen'
  );

  const size = 1600;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.fillStyle = THEMES.hell.paper;
  ctx.fillRect(0, 0, size, size);
  if (withColour) ctx.drawImage(layers.fill.canvas, 0, 0, size, size);

  /* Im Dunkelmodus sind die Linien hell – fürs Papier umgefärbt. */
  const lines = document.createElement('canvas');
  lines.width = size;
  lines.height = size;
  const lineCtx = lines.getContext('2d');
  ['motif', 'draw', 'label'].forEach(function (name) {
    lineCtx.drawImage(layers[name].canvas, 0, 0, size, size);
  });
  if (state.theme === 'dunkel') {
    lineCtx.globalCompositeOperation = 'source-in';
    lineCtx.fillStyle = THEMES.hell.ink;
    lineCtx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(lines, 0, 0);

  const person = currentPerson().name;
  const title = state.motif ? state.motif.name : 'Freies Blatt';
  const frame = window.open('', '_blank');
  if (!frame) {
    say('Der Browser hat das Druckfenster blockiert.');
    return;
  }
  frame.document.write(
    '<!doctype html><html lang="de"><head><meta charset="utf-8">' +
    '<title>' + title + '</title><style>' +
    '@page { size: A4 portrait; margin: 14mm; }' +
    'body { margin:0; font-family: system-ui, sans-serif; color:#242424;' +
    ' display:flex; flex-direction:column; align-items:center; }' +
    'h1 { font-size: 13pt; font-weight: 600; margin: 0 0 4mm; }' +
    'p { font-size: 9pt; color:#6d6559; margin: 3mm 0 0; }' +
    'p.task { font-size: 10.5pt; color:#242424; margin: 0 0 5mm;' +
    ' max-width: 150mm; text-align: center; }' +
    'img { width: 100%; max-width: 170mm; height: auto; }' +
    '</style></head><body>' +
    '<h1>' + escapeText(title) + (person ? ' – ' + escapeText(person) : '') + '</h1>' +
    (state.motif && state.motif.task
      ? '<p class="task">' + escapeText(state.motif.task) + '</p>' : '') +
    '<img src="' + out.toDataURL('image/png') + '" alt="">' +
    '<p>Mandala Atelier</p>' +
    '</body></html>'
  );
  frame.document.close();
  frame.focus();
  setTimeout(function () { frame.print(); }, 400);
}

function escapeText(text) {
  return String(text).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function setTheme(theme) {
  state.theme = THEMES[theme] ? theme : 'hell';
  document.documentElement.dataset.theme = state.theme;
  /* Die Farbe der Systemleiste mitziehen, wo es die Angabe gibt. */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', palette().paper);
  ui.theme.textContent = state.theme === 'dunkel' ? 'Hell' : 'Dunkel';
  Store.set('theme', state.theme);

  /* Papier und Linien der Vorlage wechseln mit. Eigene Striche behalten ihr
     Pigment – sie sollen beim Umschalten nicht die Farbe wechseln. */
  renderMotif();
}

/* Kurze Rückmeldung in der Fußzeile der Werkzeuge. Kein Pokal, kein Konfetti –
   ein Satz, der nach ein paar Sekunden wieder dem Motivhinweis weicht. */
let sayTimer = 0;

function say(text) {
  ui.hint.textContent = text;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(syncUI, 4000);
}

function syncUI() {
  ui.tools.forEach(function (button) {
    button.classList.toggle('is-active', button.dataset.tool === state.tool);
  });
  Array.prototype.forEach.call(
    document.querySelectorAll('.pigment, .quick-legend'), function (button) {
      button.classList.toggle('is-active', button.dataset.hex === state.color);
    });
  Array.prototype.forEach.call(ui.psets.children, function (button) {
    button.classList.toggle('is-active', button.dataset.palette === state.palette);
  });
  /* Bei einer Anlage bestimmt der Ort die Achsenzahl. Dann sind die Knöpfe
     wirkungslos – also gesperrt, mit einem Satz dazu, statt stumm. */
  const zoned = zonedMotif();
  Array.prototype.forEach.call(ui.axes.children, function (button) {
    button.classList.toggle('is-active',
      !zoned && Number(button.dataset.axes) === state.axes);
    button.disabled = zoned;
  });
  Array.prototype.forEach.call(document.querySelectorAll('.motif'), function (button) {
    const id = button.dataset.motif;
    button.classList.toggle('is-active',
      state.motif ? id === state.motif.id : id === '');
  });

  /* Aufgabenstellung über dem Blatt – nur wo es eine gibt. */
  const task = state.motif && state.motif.task;
  if (task) {
    ui.task.innerHTML = '<strong></strong> ';
    ui.task.firstChild.textContent = state.motif.name + ':';
    ui.task.appendChild(document.createTextNode(task));
  }
  if (ui.task.hidden === !!task) {
    ui.task.hidden = !task;
    fitStage();
  }

  ui.mirror.checked = state.mirror;
  ui.guides.checked = state.guides;
  ui.fillAll.checked = state.fillAll;
  ui.fillAll.disabled = isExercise(state.motif);
  ui.fillAllNote.textContent = isExercise(state.motif)
    ? 'Bei Zähl- und Rechenmandalas wird immer einzeln gefüllt – sonst bekämen '
      + 'Felder mit verschiedenen Ergebnissen dieselbe Farbe.'
    : (state.fillAll
        ? 'Ein Tipp färbt alle gleichwertigen Felder zugleich.'
        : 'Ein Tipp färbt nur das angetippte Feld.');
  const anlage = !!(state.motif && state.motif.zones);
  ui.gradedBox.hidden = !anlage;
  ui.gradedNote.hidden = !anlage;
  ui.graded.checked = state.graded;
  if (anlage) {
    ui.gradedNote.textContent = state.graded
      ? state.motif.zones.map(function (zone) {
          return zone.name + ': ' + (zone.axes > 1 ? zone.axes + '-fach' : 'frei');
        }).reverse().join(' · ')
      : 'Aus: überall dieselbe Achsenzahl, wie bei den anderen Vorlagen.';
  }

  ui.width.value = state.width;
  ui.quickShapes.hidden = state.tool !== 'shape';
  Array.prototype.forEach.call(ui.quickShapes.children, function (button) {
    button.classList.toggle('is-active', button.dataset.shape === state.shape);
  });

  const own = ownPalette();
  ui.mixer.hidden = state.palette !== own.id;
  if (!ui.mixer.hidden) ui.mixColor.value = state.color;

  ui.undo.disabled = history.length === 0;
  ui.redo.disabled = future.length === 0;

  if (!state.motif) {
    ui.hint.textContent = 'Leeres Blatt · zeichne ein Segment, der Rest entsteht von selbst';
  } else {
    ui.hint.textContent = state.motif.name + ' · ' + state.motif.note +
      (zoned
        ? ' · die Symmetrie folgt dem Bereich, in dem die Hand aufsetzt'
        : fillsSymmetrically(state.motif)
          ? ' · ein Tipp färbt alle gleichwertigen Felder'
          : ' · ein Tipp färbt nur das angetippte Feld');
  }
}

/* ---- Größe der Zeichenfläche -------------------------------------------
   Das größte Quadrat, das in die Bühne passt. In CSS lässt sich das nicht
   verlässlich ausdrücken: sobald Breite und Höhe beide feststehen, greift
   aspect-ratio nicht mehr und aus dem Mandala wird eine Ellipse.
   --------------------------------------------------------------------- */

function fitStage() {
  const stage = ui.stage;
  const style = getComputedStyle(stage);
  const width  = stage.clientWidth -
    parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = stage.clientHeight -
    parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const size = Math.max(120, Math.floor(Math.min(width, height)));
  ui.stack.style.width = size + 'px';
  ui.stack.style.height = size + 'px';
  if (ui.zoomLevel) applyZoom();
}


/* ---- Vergrößern --------------------------------------------------------
   Auf dem iPad landet der Versuch, mit zwei Fingern zu zoomen, sonst im
   Zeichnen. Deshalb zwei Dinge: ausdrückliche Knöpfe, und Gesten mit zwei
   Fingern zeichnen grundsätzlich nicht – sie schieben und zoomen.
   --------------------------------------------------------------------- */

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

function applyZoom() {
  clampPan();
  ui.stack.style.transform =
    'translate(' + state.panX.toFixed(1) + 'px, ' + state.panY.toFixed(1) + 'px) ' +
    'scale(' + state.zoom.toFixed(3) + ')';
  ui.zoomLevel.textContent = Math.round(state.zoom * 100) + ' %';
  ui.zoomOut.disabled = state.zoom <= ZOOM_MIN + 0.001;
  ui.zoomIn.disabled = state.zoom >= ZOOM_MAX - 0.001;
}

/* Das Blatt darf nicht aus der Bühne geschoben werden. */
function clampPan() {
  if (state.zoom <= 1) { state.panX = 0; state.panY = 0; return; }
  const size = ui.stack.offsetWidth || 1;
  const room = (size * state.zoom - size) / 2;
  state.panX = Math.max(-room, Math.min(room, state.panX));
  state.panY = Math.max(-room, Math.min(room, state.panY));
}

function setZoom(value, focus) {
  const before = state.zoom;
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
  if (Math.abs(next - before) < 0.0005) return;

  /* Um den Punkt zwischen den Fingern vergrößern, nicht um die Mitte. */
  if (focus) {
    const rect = ui.stack.getBoundingClientRect();
    const dx = focus[0] - (rect.left + rect.width / 2);
    const dy = focus[1] - (rect.top + rect.height / 2);
    const ratio = next / before;
    state.panX -= dx * (ratio - 1);
    state.panY -= dy * (ratio - 1);
  }

  state.zoom = next;
  applyZoom();
}

function zoomBy(factor) {
  setZoom(state.zoom * factor, null);
}

function resetZoom() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyZoom();
}


/* ---- Schubladen -------------------------------------------------------- */

function drawerOf(name) {
  return name === 'library' ? ui.library : ui.controls;
}

function setDrawer(name, open) {
  const drawer = drawerOf(name);
  drawer.classList.toggle('is-open', open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  Array.prototype.forEach.call(
    document.querySelectorAll('[data-drawer="' + name + '"]'),
    function (button) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.classList.toggle('is-active', open);
    }
  );
}

function toggleDrawer(name) {
  const open = !drawerOf(name).classList.contains('is-open');
  /* Beide zugleich verdecken zu viel – die andere geht zu. */
  if (open) setDrawer(name === 'library' ? 'controls' : 'library', false);
  setDrawer(name, open);
}


/* ---- Vollbild ----------------------------------------------------------
   Zwei Dinge zugleich: die eigene Bedienung tritt zurück, und wo der
   Browser es zulässt, wird echtes Vollbild angefordert. Auf dem iPad kennt
   Safari die Vollbild-Schnittstelle nicht überall – dann bleibt es beim
   ruhigen Modus, und der bringt schon fast den ganzen Gewinn.
   --------------------------------------------------------------------- */

function setQuiet(on) {
  document.body.classList.toggle('is-quiet', on);
  ui.floatbar.hidden = !on;
  if (on) { setDrawer('library', false); setDrawer('controls', false); }
  ui.full.classList.toggle('is-active', on);
}

function enterFullscreen() {
  setQuiet(true);
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (request) {
    const result = request.call(root);
    if (result && result.catch) result.catch(function () { /* bleibt ruhiger Modus */ });
  }
}

function leaveFullscreen() {
  setQuiet(false);
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
    const result = exit.call(document);
    if (result && result.catch) result.catch(function () {});
  }
}


/* ---- Ereignisse --------------------------------------------------------- */

function toLocal(event) {
  const rect = layers.draw.canvas.getBoundingClientRect();
  return [
    ((event.clientX - rect.left) / rect.width) * SIZE,
    ((event.clientY - rect.top) / rect.height) * SIZE
  ];
}

function bindEvents() {
  const canvas = layers.draw.canvas;

  /* Alle liegenden Finger. Sobald zwei darauf sind, wird nicht gezeichnet,
     sondern geschoben und gezoomt. */
  const touches = new Map();
  let gesture = null;

  function gestureState() {
    const points = Array.from(touches.values());
    const dx = points[0].x - points[1].x;
    const dy = points[0].y - points[1].y;
    return {
      distance: Math.hypot(dx, dy),
      center: [(points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2]
    };
  }

  /* Beginnt eine Geste, wird der eben angefangene Strich zurückgenommen –
     sonst bliebe von jedem Zoomversuch ein Kringel stehen. */
  function abandonStroke() {
    state.strokeSym = null;
    if (state.shapeFrom) { state.shapeFrom = null; renderGuides(); }
    if (!state.drawing) return;
    state.drawing = false;
    const entry = history.pop();
    if (entry) applyEntry(entry);
    syncUI();
  }

  canvas.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (touches.size >= 2) {
      abandonStroke();
      gesture = gestureState();
      gesture.zoom = state.zoom;
      gesture.panX = state.panX;
      gesture.panY = state.panY;
      return;
    }

    const point = toLocal(event);

    /* Bei einer Anlage entscheidet der Aufsetzpunkt über die Achsenzahl,
       und sie bleibt für den ganzen Zug gültig. */
    state.strokeSym = symmetryAt(point);

    if (state.tool === 'shape') {
      canvas.setPointerCapture(event.pointerId);
      state.shapeFrom = point;
      previewFigure(shapeFigure(point, point));
      return;
    }

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
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (gesture && touches.size >= 2) {
      event.preventDefault();
      const now = gestureState();
      state.panX = gesture.panX + (now.center[0] - gesture.center[0]);
      state.panY = gesture.panY + (now.center[1] - gesture.center[1]);
      state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
        gesture.zoom * (now.distance / (gesture.distance || 1))));
      applyZoom();
      return;
    }

    if (state.shapeFrom) {
      event.preventDefault();
      previewFigure(shapeFigure(state.shapeFrom, toLocal(event)));
      return;
    }

    if (!state.drawing) return;
    event.preventDefault();
    const point = toLocal(event);
    segmentLine(state.last, point);
    state.last = point;
  });

  canvas.addEventListener('pointerup', function (event) {
    if (!state.shapeFrom) return;
    const figure = shapeFigure(state.shapeFrom, toLocal(event));
    state.shapeFrom = null;
    renderGuides();
    pushHistory(['draw']);
    commitFigure(figure);
    say(SHAPE_NAMES[figure.kind] + ' gesetzt.');
  });

  ['pointerup', 'pointercancel'].forEach(function (type) {
    canvas.addEventListener(type, function (event) {
      touches.delete(event.pointerId);
      if (touches.size < 2) gesture = null;
      /* Nach einer Geste nicht mit dem verbliebenen Finger weiterzeichnen. */
      if (touches.size === 0) state.drawing = false;
      else if (touches.size === 1) state.drawing = false;
      if (!state.drawing && !state.shapeFrom) state.strokeSym = null;
    });
  });

  document.addEventListener('click', function (event) {
    const target = event.target;

    const drawerButton = target.closest('[data-drawer]');
    if (drawerButton) { toggleDrawer(drawerButton.dataset.drawer); return; }

    const closeButton = target.closest('[data-close]');
    if (closeButton) { setDrawer(closeButton.dataset.close, false); return; }

    const motifButton = target.closest('.motif');
    if (motifButton) {
      loadMotif(motifButton.dataset.motif);
      setDrawer('library', false);
      return;
    }

    const tool = target.closest('.tool');
    if (tool) { state.tool = tool.dataset.tool; syncUI(); return; }

    const shape = target.closest('.shape');
    if (shape) {
      state.shape = shape.dataset.shape;
      state.tool = 'shape';
      Store.set('shape', state.shape);
      syncUI();
      return;
    }

    const set = target.closest('.pset');
    if (set) { setPalette(set.dataset.palette); return; }

    const pigment = target.closest('.pigment, .legend button, .quick-legend');
    if (pigment) {
      state.color = pigment.dataset.hex;
      Store.set('color', state.color);
      syncUI();
      return;
    }

    const axis = target.closest('.axis');
    if (axis) { state.axes = Number(axis.dataset.axes); renderGuides(); syncUI(); }
  });

  ui.mirror.addEventListener('change', function () {
    state.mirror = ui.mirror.checked;
    Store.set('mirror', state.mirror);
  });

  ui.graded.addEventListener('change', function () {
    state.graded = ui.graded.checked;
    Store.set('graded', state.graded);
    renderGuides();
    syncUI();
  });

  ui.fillAll.addEventListener('change', function () {
    state.fillAll = ui.fillAll.checked;
    Store.set('fillAll', state.fillAll);
    syncUI();
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

  if (window.ResizeObserver) {
    new ResizeObserver(fitStage).observe(ui.stage);
  } else {
    window.addEventListener('resize', fitStage);
    window.addEventListener('orientationchange', fitStage);
  }

  ui.zoomIn.addEventListener('click', function () { zoomBy(1.25); });
  ui.zoomOut.addEventListener('click', function () { zoomBy(1 / 1.25); });
  ui.zoomLevel.addEventListener('click', resetZoom);
  ui.undo.addEventListener('click', undo);
  ui.redo.addEventListener('click', redo);
  ui.quickCollapse.addEventListener('click', function () {
    const collapsed = document.body.classList.toggle('quick-collapsed');
    ui.quickCollapse.title = collapsed ? 'Leiste ausklappen' : 'Leiste einklappen';
    Store.set('quickCollapsed', collapsed);
    fitStage();
  });
  ui.clear.addEventListener('click', clearSheet);
  ui.save.addEventListener('click', exportImage);
  ui.keep.addEventListener('click', keepWork);
  ui.galleryButton.addEventListener('click', function () {
    setGallery(ui.gallery.hidden);
  });
  ui.galleryClose.addEventListener('click', function () { setGallery(false); });
  ui.owner.addEventListener('input', function () { renamePerson(ui.owner.value); });
  ui.personSelect.addEventListener('change', function () { selectPerson(ui.personSelect.value); });
  ui.backupSave.addEventListener('click', saveBackup);
  ui.backupLoad.addEventListener('click', function () { ui.backupFile.click(); });
  ui.backupFile.addEventListener('change', function () {
    if (ui.backupFile.files[0]) loadBackup(ui.backupFile.files[0]);
    ui.backupFile.value = '';
  });
  ui.print.addEventListener('click', printSheet);
  ui.mixColor.addEventListener('input', function () { mixPigment(ui.mixColor.value); });

  ui.works.addEventListener('click', function (event) {
    const tile = event.target.closest('.work');
    if (tile) openViewer(tile.dataset.work);
  });

  document.getElementById('viewer-close').addEventListener('click', closeViewer);
  document.getElementById('viewer-delete').addEventListener('click', deleteWork);
  document.getElementById('viewer-download').addEventListener('click', downloadWork);
  ui.viewerTitle.addEventListener('change', renameWork);
  ui.viewerTitle.addEventListener('blur', renameWork);
  ui.viewer.addEventListener('click', function (event) {
    if (event.target === ui.viewer) closeViewer();
  });
  ui.full.addEventListener('click', function () {
    document.body.classList.contains('is-quiet') ? leaveFullscreen() : enterFullscreen();
  });
  ui.fullExit.addEventListener('click', leaveFullscreen);
  ui.theme.addEventListener('click', function () {
    setTheme(state.theme === 'dunkel' ? 'hell' : 'dunkel');
  });

  /* Verlässt der Browser das Vollbild von sich aus (Escape, Wischgeste),
     soll die Bedienung wieder auftauchen. */
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (type) {
    document.addEventListener(type, function () {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      if (!active && document.body.classList.contains('is-quiet')) setQuiet(false);
    });
  });

  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;

    if (event.key === '+') { zoomBy(1.25); return; }
    if (event.key === '-') { zoomBy(1 / 1.25); return; }
    if (event.key === '0') { resetZoom(); return; }

    const keys = { '1': 'pen', '2': 'fill', '3': 'shape', '4': 'eraser' };
    if (keys[event.key]) { state.tool = keys[event.key]; syncUI(); return; }
    if (event.key === 'm') toggleDrawer('library');
    if (event.key === 'w') toggleDrawer('controls');
    if (event.key === 'f') {
      document.body.classList.contains('is-quiet') ? leaveFullscreen() : enterFullscreen();
    }
    if (event.key === 'Escape') {
      if (!ui.viewer.hidden) { closeViewer(); return; }
      if (!ui.gallery.hidden) { setGallery(false); return; }
      setDrawer('library', false);
      setDrawer('controls', false);
    }
    if (event.key === 'g') setGallery(ui.gallery.hidden);
  });
}


/* ---------------------------------------------------------------------------
   14. Start
   ------------------------------------------------------------------------- */

function start() {
  cacheUi();
  setupLayers();
  buildLibrary();
  buildPaletteSets();
  buildAxes();
  bindEvents();

  state.palette = Store.get('palette', state.palette);
  buildPalette();
  state.color  = Store.get('color', pigments()[0].hex);
  state.width  = Store.get('width', state.width);
  state.mirror = Store.get('mirror', state.mirror);
  state.guides = Store.get('guides', state.guides);
  state.fillAll = Store.get('fillAll', state.fillAll);
  state.graded = Store.get('graded', state.graded);
  state.shape = Store.get('shape', state.shape);
  setTheme(Store.get('theme', preferredTheme()));
  state.people = Store.get('people', [{ id: 'p1', name: Store.get('owner', '') }]);
  state.person = Store.get('person', state.people[0].id);
  loadOwnPalette();
  buildPalette();
  renderPeople();
  if (Store.get('quickCollapsed', false)) {
    document.body.classList.add('quick-collapsed');
    ui.quickCollapse.title = 'Leiste ausklappen';
  }

  applyZoom();
  fitStage();
  loadMotif(Store.get('motif', 'sternkranz'));
  Gallery.open().then(refreshGallery);
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
  PALETTES: PALETTES,
  ownPalette: ownPalette,
  pigments: pigments,
  state: state,
  layers: layers,
  loadMotif: loadMotif,
  setZoom: setZoom,
  zoomBy: zoomBy,
  resetZoom: resetZoom,
  shapeFigure: shapeFigure,
  commitFigure: commitFigure,
  SHAPE_NAMES: SHAPE_NAMES,
  Gallery: Gallery,
  keepWork: keepWork,
  setPalette: setPalette,
  mixPigment: mixPigment,
  addPerson: addPerson,
  renamePerson: renamePerson,
  selectPerson: selectPerson,
  refreshGallery: refreshGallery,
  saveBackup: saveBackup,
  loadBackup: loadBackup,
  composeImage: composeImage,
  floodFill: floodFill,
  makeFields: makeFields,
  makeLegend: makeLegend,
  segmentLine: segmentLine,
  symmetryAt: symmetryAt,
  zoneAt: zoneAt,
  pol: pol,
  SIZE: SIZE,
  R_OUT: R_OUT
};

document.addEventListener('DOMContentLoaded', start);
