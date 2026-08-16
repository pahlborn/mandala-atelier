'use strict';

/* Im Regal ohne Service Worker – siehe tools/einfrieren.js.
   Eine eingefrorene Fassung darf keinen anmelden: Ihr `activate` löschte
   den Offline-Vorrat der laufenden App. */
if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
  navigator.serviceWorker.register = function () { return new Promise(function () {}); };
}

/* ============================================================================
   Atelier 3.0 – „Blatt“

   Eine eigenständige App neben dem Mandala Atelier, gebaut auf die
   Gegenwette: Die Maschine vervielfältigt keine Geste. Unter dem Papier
   liegt ein unsichtbares, symmetrisches Relief, und die Hand reibt es
   hervor. Wer herumkommen will, muss herumgehen.

   Es gibt genau eine Geste. Kein Werkzeug, kein Radierer, kein Rückgängig,
   keinen Speichern-Knopf, keine Zahl.

   Aufbau dieser Datei:
      1. Maße und Stellschrauben
      2. Papier und Pigmente
      3. Zufall
      4. Das Relief – Bauplan
      5. Das Relief – Feldfunktion
      6. Das Relief – Rasterung
      7. Das Papier
      8. Der Auftrag – Durchreiben
      9. Klang
     10. Die Hand
     11. Speicher
     12. Oberfläche
     13. Der Stapel
     14. Die Stille
     15. Start
   ========================================================================== */


/* ---------------------------------------------------------------------------
   1. Maße und Stellschrauben

   SIZE ist die innere Auflösung des Blattes und bleibt fest – sie darf sich
   nie ändern, sonst wäre das begonnene Bild verloren. Die Anzeige skaliert
   per CSS.

   Die Konstanten unter „Stellschrauben“ sind das, was nach einem echten
   Handtest am iPad nachgezogen werden will. Sie stehen bewusst zusammen.
   ------------------------------------------------------------------------- */

const SIZE   = 1280;                 // innere Kantenlänge des Blattes
const HALF   = SIZE / 2;
const R_DISC = HALF * 0.92;          // Außenrand des Mandalas in Pixeln
const TAU    = Math.PI * 2;

/* Stellschrauben des Auftrags. */
const RATE        = 0.20;   // Pigment je Millisekunde Verweildauer je Pixel
const DWELL_CAP   = 3.0;    // ms/px – deckelt das Stehenbleiben an einer Stelle
/* Der Kontakt wird in Bildschirmpunkten gemessen, nicht in Blatt-Koordinaten.
   Eine Fingerkuppe klebt am Glas, nicht am Bild: Sie ist rund zwölf Millimeter
   breit, und daran ändert sich nichts, wenn man näher herangeht. Erst dadurch
   hilft das Heranholen überhaupt beim Ausmalen kleiner Flächen – sonst wüchse
   der Finger mit dem Papier mit.

   Bei bildfüllender Ansicht ergeben diese Werte genau das, was vorher fest in
   Blatt-Koordinaten stand; sie ändern also nichts am gewohnten Gefühl. */
const R_FINGER_CSS = 29;    // Kontaktradius Fingerkuppe, Bildschirmpunkte
const R_PEN_CSS    = 17;    // Kontaktradius Stiftspitze
const GAMMA_LIGHT = 3.6;    // leichter/schneller Kontakt: fast nur die Höhen
const GAMMA_FIRM  = 0.7;    // fester/langsamer Kontakt: greift bis in die Tiefen
const MIX_SUB     = 0.5;    // wie subtraktiv Pigment über Pigment mischt
const SAT_LIMIT   = 0.985;  // Dichte läuft asymptotisch, kippt nie

/* Wie deutlich das Relief im unberührten Papier durchscheint. Das ist die
   heikelste Zahl des ganzen Entwurfs: zu wenig und man fühlt sich verloren,
   zu viel und es ist ein geprägtes Ausmalbuch – dann hätten wir die
   Schwester-App nachgebaut, nur umständlicher.

   Der Wert wird auf die Steigung des Reliefs in Byte-Einheiten angewandt
   (0…255). An der schärfsten Ornamentkante liegt die Steigung bei etwa 200,
   0,03 ergibt dort also rund 6 Helligkeitsstufen auf 246 – gerade so viel,
   dass die Hand ahnt, wo etwas liegt, und zu wenig, um es zu lesen.

   Für den Vergleich lässt sich das über ?relief=0…2 verstellen, ohne dass
   die Oberfläche davon etwas zeigt. */
const HINT_BASE = 0.030;

const STILL_MS  = 40000;    // nach so langer Ruhe tritt die Bedienung ab
const SAVE_MS      = 700;   // Verzögerung, bis das Blatt still gesichert wird
const LONG_SAVE_MS = 25000; // Sicherung auch mitten in einem langen Zug
const GRAIN_DEADBAND = 0.05;   // Totgang beim Zurückrechnen der Dichte

/* Das Blatt bewegen. Der Anschlag oben ist nicht willkürlich: Das Blatt hat
   1280 Punkte Kantenlänge, und jenseits von etwa dem Doppelten sieht man
   nicht mehr Mandala, sondern das Raster. Bis dahin liest es sich als
   Papierstruktur – so, wie man beim Naherangehen an echtes Papier Fasern
   sieht und keine feineren Blüten. */
const VIEW_MAX      = 2.2;
const VIEW_RUBBER   = 0.35;   // wie weich es sich über die Grenzen ziehen lässt
const VIEW_SNAP_MS  = 380;    // Zurückfedern nach dem Loslassen
const VIEW_HOME_MS  = 1800;   // Zurücksinken in die Vollansicht bei Ruhe

/* In den ersten Augenblicken gilt ein ruhender Finger als möglicher Beginn
   einer Zwei-Finger-Geste und trägt noch kein Pigment auf. Man beginnt ein
   Reiben mit einer Bewegung, nicht mit Warten – und ohne diese Frist bliebe
   bei jedem Heranholen ein dunkler Punkt zurück. */
const GESTURE_GRACE = 260;
const MOVE_WAKE     = 3;      // ab so vielen Blatt-Einheiten reibt die Hand wirklich


/* ---------------------------------------------------------------------------
   2. Papier und Pigmente

   Zwei Zustände, nicht zwei Themen: Ein Blatt bei Tag ist helles Papier, auf
   dem Pigment subtraktiv liegt (Farbe über Farbe wird dunkler, wie beim
   Buntstift). Ein Blatt bei Nacht ist getöntes Papier, auf dem helle Kreide
   liegt. Beides gibt es analog, beides rechnet sich fast gleich.

   Welchen Zustand ein Blatt hat, entscheidet sich bei seiner Entstehung und
   bleibt dann. Ein Blatt wechselt nicht die Farbe, nur weil es Abend wird.
   ------------------------------------------------------------------------- */

const SHEETS = {
  tag:   { paper: [246, 241, 231], grain: 5.5, blend: 'multiply', chalk: false },
  nacht: { paper: [ 39,  36,  32], grain: 4.5, blend: 'screen',   chalk: true  }
};

/* Die vier Farbwelten des Mandala Ateliers, unverändert übernommen – ihre
   Stimmung ist das eigentliche Kapital. Neun je Welt statt vierzehn: Der
   Griff soll aus dem Handgelenk kommen, nicht aus einer Abwägung.

   Gewählt wird die Welt nicht. Sie gehört zum Blatt, so wie das Relief:
   Man setzt sich an einen Tisch, auf dem heute die Erdpigmente liegen, und
   morgen liegt Nordlicht da. Eine Auswahl wäre eine Entscheidung vor dem
   ersten Strich; ein gedeckter Tisch ist keine. Wer eine andere Stimmung
   will, nimmt ein neues Blatt. */
const WORLDS = [
  {
    id: 'erde', name: 'Erdpigmente',
    colors: [
      { name: 'Terrakotta', hex: '#b5654a' },
      { name: 'Ocker',      hex: '#c89b3c' },
      { name: 'Olive',      hex: '#6e7233' },
      { name: 'Moos',       hex: '#3f5b3a' },
      { name: 'Petrol',     hex: '#2e6b6b' },
      { name: 'Indigo',     hex: '#3b4b7c' },
      { name: 'Pflaume',    hex: '#6b3c5b' },
      { name: 'Rost',       hex: '#8c4a2f' },
      { name: 'Anthrazit',  hex: '#333a3f' }
    ]
  },
  {
    id: 'nord', name: 'Nordlicht',
    colors: [
      { name: 'Eisblau',    hex: '#6f9fb5' },
      { name: 'Fjord',      hex: '#4a7a78' },
      { name: 'Tanne',      hex: '#2f4a3c' },
      { name: 'Flechte',    hex: '#8aa38c' },
      { name: 'Amethyst',   hex: '#5b5580' },
      { name: 'Heidekraut', hex: '#8d7fa0' },
      { name: 'Beere',      hex: '#7a3f52' },
      { name: 'Tiefsee',    hex: '#1f4a5c' },
      { name: 'Polarnacht', hex: '#23304a' }
    ]
  },
  {
    id: 'faerber', name: 'Färbergarten',
    colors: [
      { name: 'Krapp',         hex: '#a4423a' },
      { name: 'Safran',        hex: '#d59b3a' },
      { name: 'Färberginster', hex: '#9a9d4a' },
      { name: 'Waid',          hex: '#34527a' },
      { name: 'Indigo tief',   hex: '#26365e' },
      { name: 'Cochenille',    hex: '#8e3550' },
      { name: 'Malve',         hex: '#7d5570' },
      { name: 'Walnuss',       hex: '#6b4a33' },
      { name: 'Rinde',         hex: '#4a3527' }
    ]
  },
  {
    id: 'rauch', name: 'Rauchglas',
    colors: [
      { name: 'Altrosa',    hex: '#a3807c' },
      { name: 'Schilf',     hex: '#8b8f7c' },
      { name: 'Farn',       hex: '#61694f' },
      { name: 'Taubenblau', hex: '#78838c' },
      { name: 'Mauve',      hex: '#8b7480' },
      { name: 'Trüffel',    hex: '#6a5b52' },
      { name: 'Kastanie',   hex: '#55403a' },
      { name: 'Zinn',       hex: '#575c60' },
      { name: 'Basalt',     hex: '#3b3b3d' }
    ]
  }
];

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Dieselbe Welt als Kreide auf getöntem Papier. Nicht von Hand ein zweites
   Mal ausgesucht, sondern abgeleitet: Farbton bleibt, Helligkeit steigt,
   Buntheit wird leicht zurückgenommen. So bleibt die Stimmung einer Welt
   bei Tag und bei Nacht dieselbe, und der dunkelste Pigmentstift wird
   ganz von selbst zum hellsten – die Kreide. */
function asChalk(rgb) {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0, sat = 0;
  if (d > 0) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }

  const L = 0.74;
  const S = Math.min(0.46, sat * 0.92);
  if (S === 0) return [Math.round(L * 255), Math.round(L * 255), Math.round(L * 255)];

  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const pp = 2 * L - q;
  const chan = function (t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return pp + (q - pp) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
    return pp;
  };
  return [
    Math.round(chan(h + 1 / 3) * 255),
    Math.round(chan(h) * 255),
    Math.round(chan(h - 1 / 3) * 255)
  ];
}

/* Welche Welt auf einem Blatt liegt, steckt im Seed – aber in einem eigenen
   Zweig davon, damit sie nicht mit der Zähligkeit des Reliefs mitwandert. */
function worldFor(seed) {
  return WORLDS[Math.floor(mulberry32((seed ^ 0x9e3779b9) >>> 0)() * WORLDS.length)];
}

function pigmentsOf(world, mode) {
  const chalk = SHEETS[mode].chalk;
  return world.colors.map(function (c) {
    const rgb = hexRgb(c.hex);
    return { name: c.name, rgb: chalk ? asChalk(rgb) : rgb };
  });
}


/* ---------------------------------------------------------------------------
   3. Zufall

   Fester Seed je Blatt: Dasselbe Blatt hat auf jedem Gerät dasselbe Relief,
   und ein gesichertes Blatt lässt sich wiederherstellen, ohne das Relief
   mitzuspeichern.
   ------------------------------------------------------------------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Ortsfestes Rauschen für die Papierzahnung. Bewusst aus den Koordinaten
   gerechnet statt gespeichert: derselbe Pixel hat immer denselben Zahn,
   deshalb baut wiederholtes Reiben eine Struktur auf, statt sie glattzumitteln. */
function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tooth(x, y) {
  return 0.52 * hash2(x, y) + 0.34 * hash2(x >> 1, y >> 1) + 0.14 * hash2(x >> 2, y >> 2);
}

/* Weiches Rauschen über größere Zellen, für die Wolkigkeit des Papiers.
   Ein bloßes hash2(x >> 4, y >> 4) ergäbe ein sichtbares Schachbrett –
   Papier hat aber keine Kacheln. Also zwischen den Gitterpunkten weich
   überblenden.

   Gitter und Überblendungsgewichte werden vorgerechnet: Das Papier entsteht
   über 1,6 Millionen Pixel, und dort gehört keine Division in die innere
   Schleife. */
function cloudLayer(shift, salt) {
  const w = (SIZE >> shift) + 2;
  const grid = new Float32Array(w * w);
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) grid[j * w + i] = hash2(i + salt, j - salt);
  }

  const cell = new Int32Array(SIZE);
  const blend = new Float32Array(SIZE);
  const s = 1 << shift;
  for (let i = 0; i < SIZE; i++) {
    cell[i] = i >> shift;
    const t = (i % s) / s;
    blend[i] = t * t * (3 - 2 * t);
  }

  return { grid: grid, w: w, cell: cell, blend: blend };
}


/* ---------------------------------------------------------------------------
   4. Das Relief – Bauplan

   Ein Mandala ist eine Folge konzentrischer Bänder, jedes mit eigenem
   Ornament, getrennt durch Linien. Der Bauplan legt fest, welche Bänder es
   gibt; die Feldfunktion weiter unten rechnet daraus Höhen.

   Alle Ornamente sind n-zählig oder 2n-zählig – nie etwas dazwischen. Nur
   so bleibt das ganze Feld exakt um 2π/n drehsymmetrisch, und nur deshalb
   genügt später eine Nachschlagetabelle über einen einzigen Keil.
   ------------------------------------------------------------------------- */

const WIDE   = ['petals', 'lattice', 'scallops', 'petals', 'waves', 'petals'];
const NARROW = ['beads', 'rays', 'waves', 'plain', 'beads', 'plain'];

function buildPlan(seed) {
  const rng = mulberry32(seed);
  const pick = function (list) { return list[(rng() * list.length) | 0]; };
  const span = function (a, b) { return a + rng() * (b - a); };

  const n  = pick([8, 10, 12, 12, 12, 14, 16, 6, 18]);
  const lw = span(0.0052, 0.0082);

  const bands = [];

  /* Die Rosette in der Mitte. */
  const hub  = span(0.030, 0.055);
  const rose = hub + span(0.075, 0.125);
  bands.push({
    kind: 'hub', r1: 0, r2: hub,
    ring: rng() < 0.7
  });
  bands.push({
    kind: 'petals', r1: hub, r2: rose, m: n,
    fill: span(0.70, 0.92), bias: span(0.85, 1.15),
    vein: rng() < 0.45, inner: rng() < 0.35,
    plateau: rng() < 0.55 ? span(0.54, 0.70) : 0,
    off: 0
  });

  /* Die Ringbänder nach außen. */
  let r = rose;
  const count = 4 + ((rng() * 3) | 0);
  const weights = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const w = 0.4 + rng() * rng() * 1.6;
    weights.push(w);
    total += w;
  }

  let last = '';
  for (let i = 0; i < count; i++) {
    const width = (1 - rose) * (weights[i] / total);
    let kind = '';
    for (let guard = 0; guard < 10; guard++) {
      kind = pick(width > 0.115 ? WIDE : NARROW);
      if (kind !== last) break;
    }
    last = kind;
    bands.push(bandParams(kind, r, r + width, n, rng, span, pick));
    r += width;
  }

  /* Randlinien zwischen den Bändern. Sie sind es, die ein Mandala als
     Mandala lesbar machen – ohne sie zerfällt es in Ornament ohne Ordnung. */
  const rules = [];
  for (let i = 1; i < bands.length; i++) {
    const style = rng() < 0.22 ? 'none' : (rng() < 0.3 ? 'double' : 'single');
    if (style !== 'none') rules.push({ r: bands[i].r1, style: style });
  }
  rules.push({ r: 1.0, style: 'double' });

  return { n: n, lw: lw, bands: bands, rules: rules, seed: seed };
}

function bandParams(kind, r1, r2, n, rng, span, pick) {
  const b = { kind: kind, r1: r1, r2: r2, m: rng() < 0.32 ? n * 2 : n };

  if (kind === 'petals') {
    b.fill    = span(0.62, 0.90);
    b.bias    = span(0.75, 1.30);
    b.vein    = rng() < 0.5;
    b.inner   = rng() < 0.42;
    b.plateau = rng() < 0.45 ? span(0.52, 0.70) : 0;
    b.off     = rng() < 0.35 ? Math.PI / b.m : 0;
  } else if (kind === 'lattice') {
    b.k       = pick([1, 1, 2]);
    b.plateau = 0;
    b.off     = 0;
  } else if (kind === 'beads') {
    b.rho     = span(0.26, 0.42);
    b.filled  = rng() < 0.4;
    b.off     = rng() < 0.4 ? Math.PI / b.m : 0;
  } else if (kind === 'waves') {
    b.count   = 1 + ((rng() * 3) | 0);
    b.amp     = span(0.18, 0.42);
    b.phase   = rng() < 0.5 ? 0 : Math.PI;
  } else if (kind === 'rays') {
    b.off     = rng() < 0.5 ? Math.PI / b.m : 0;
    b.taper   = rng() < 0.4;
  } else if (kind === 'scallops') {
    b.rho     = span(0.66, 0.95);
    b.off     = rng() < 0.4 ? Math.PI / b.m : 0;
  }
  return b;
}


/* ---------------------------------------------------------------------------
   5. Das Relief – Feldfunktion

   fieldAt() liefert die Höhe des Reliefs an einem Punkt in Polarkoordinaten.
   rr ist auf R_DISC normiert: rr = 1 ist der Außenrand des Mandalas.

   Hoch heißt: fängt das Pigment zuerst. Deshalb sind die Ornamentlinien die
   Erhebungen – sie kommen beim leichten Reiben zuerst hervor, genau wie bei
   einer Frottage über einer geprägten Platte.
   ------------------------------------------------------------------------- */

/* Die Höhenstufen des Reliefs. Ihr Abstand zueinander ist die eigentliche
   Gestaltungsentscheidung: Er bestimmt, wie weit die Fläche hinter der Linie
   zurückbleibt. Zu weit, und man bekommt nie mehr als eine Zeichnung; zu eng,
   und alles kommt gleichzeitig hoch. Zusammen mit GAMMA_LIGHT/GAMMA_FIRM
   ergibt sich daraus die ganze Spannweite von Hauch bis Fläche. */
const OUTER = 0.16;   // außerhalb des Mandalas – nimmt nur widerwillig an
const BASE  = 0.38;   // ungeschmückte Fläche im Mandala
const FADE  = 0.06;   // wie weich der Rand der Scheibe ausläuft

/* Die Gaußglocke wird beim Bau eines Blattes einige Millionen Mal gebraucht;
   Math.exp ist dafür zu teuer. Jenseits von t = 3 liegt sie ohnehin unter
   0,0002 und damit unter der Auflösung des Reliefs (1/255), also genügt eine
   Tabelle über [0, 3) und davor ein früher Ausstieg. */
const GAUSS_N = 1024;
const GAUSS_SCALE = GAUSS_N / 3;
const GAUSS = new Float32Array(GAUSS_N);
for (let i = 0; i < GAUSS_N; i++) {
  const t = i / GAUSS_SCALE;
  GAUSS[i] = Math.exp(-t * t);
}

function gauss(d, w) {
  const t = (d < 0 ? -d : d) / w;
  if (t >= 3) return 0;
  return GAUSS[(t * GAUSS_SCALE) | 0];
}

/* Vorzeichenbehafteter Winkelabstand zur nächsten von m Achsen. */
function angTo(th, m, off) {
  const step = TAU / m;
  let a = (th - (off || 0)) % step;
  if (a > step * 0.5) a -= step;
  if (a < -step * 0.5) a += step;
  return a;
}

function frac(x) { return x - Math.floor(x); }
function distInt(x) { const f = frac(x); return f < 0.5 ? f : 1 - f; }

function fieldAt(plan, rr, th) {
  const lw = plan.lw;
  const bands = plan.bands;
  let ridge = 0;
  let plate = 0;

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (rr < b.r1 - 3 * lw || rr > b.r2 + 3 * lw) continue;

    const h = b.r2 - b.r1;
    const u = h > 0 ? (rr - b.r1) / h : 0;

    switch (b.kind) {

      case 'hub': {
        if (rr < b.r2) plate = Math.max(plate, 0.64);
        if (b.ring) ridge = Math.max(ridge, gauss(rr - b.r2 * 0.55, lw));
        break;
      }

      case 'petals': {
        if (u < 0 || u > 1) break;
        const a = angTo(th, b.m, b.off);
        const shape = Math.pow(Math.sin(Math.PI * Math.pow(u, b.bias)), 0.72);
        const half  = (Math.PI / b.m) * b.fill * shape;
        ridge = Math.max(ridge, gauss((Math.abs(a) - half) * rr, lw));
        if (b.inner) {
          ridge = Math.max(ridge, gauss((Math.abs(a) - half * 0.52) * rr, lw * 0.85));
        }
        if (b.vein) {
          const fade = Math.min(1, Math.min(u, 1 - u) * 8);
          ridge = Math.max(ridge, gauss(a * rr, lw) * fade);
        }
        if (b.plateau && Math.abs(a) < half) plate = Math.max(plate, b.plateau);
        break;
      }

      case 'lattice': {
        if (u < 0 || u > 1) break;
        const t   = (th * b.m) / TAU;
        const arc = (TAU * rr) / b.m;
        const d1  = distInt(t + u * b.k) * arc;
        const d2  = distInt(t - u * b.k) * arc;
        ridge = Math.max(ridge, gauss(Math.min(d1, d2), lw * 1.15));
        break;
      }

      case 'beads': {
        const rm  = (b.r1 + b.r2) * 0.5;
        const rho = Math.min(h * 0.5, (TAU * rm) / b.m * 0.5) * b.rho * 2;
        const a   = angTo(th, b.m, b.off);
        const d   = Math.sqrt(Math.max(0, rr * rr + rm * rm - 2 * rr * rm * Math.cos(a)));
        ridge = Math.max(ridge, gauss(d - rho, lw));
        if (b.filled && d < rho) plate = Math.max(plate, 0.60);
        break;
      }

      case 'waves': {
        for (let k = 0; k < b.count; k++) {
          const rc  = b.r1 + ((k + 0.5) / b.count) * h;
          const amp = (h / b.count) * b.amp;
          const ph  = b.phase * k;
          const target = rc + amp * Math.cos(b.m * th + ph);
          ridge = Math.max(ridge, gauss(rr - target, lw));
        }
        break;
      }

      case 'rays': {
        if (u < 0 || u > 1) break;
        const a = angTo(th, b.m, b.off);
        const fade = Math.min(1, Math.min(u, 1 - u) * 10);
        const w = b.taper ? lw * (0.5 + u) : lw;
        ridge = Math.max(ridge, gauss(a * rr, w) * fade);
        break;
      }

      case 'scallops': {
        const rm  = b.r1 + h * 0.10;
        const rho = h * b.rho;
        const a   = angTo(th, b.m, b.off);
        const d   = Math.sqrt(Math.max(0, rr * rr + rm * rm - 2 * rr * rm * Math.cos(a)));
        const outer = Math.min(1, Math.max(0, (rr - rm) / (h * 0.18)));
        ridge = Math.max(ridge, gauss(d - rho, lw) * outer);
        break;
      }
    }
  }

  /* Randlinien. Der Abstandstest davor spart die teure Exponentialfunktion
     für die weit entfernten – das ist der größte Einzelposten beim Bau
     eines Blattes. */
  const reach = lw * 4;
  for (let i = 0; i < plan.rules.length; i++) {
    const rule = plan.rules[i];
    const d = rr - rule.r;
    if (d > reach) continue;
    if (d < -reach - lw * 3.2) continue;
    if (d > -reach) ridge = Math.max(ridge, gauss(d, lw * 1.1));
    if (rule.style === 'double') {
      ridge = Math.max(ridge, gauss(d + lw * 3.2, lw * 0.8));
    }
  }

  /* Der Rand der Scheibe läuft weich aus, damit die Prägung dort keine
     harte Kante ins unberührte Papier zeichnet. */
  let floor = BASE;
  if (rr > 1) {
    let t = (rr - 1) / FADE;
    if (t > 1) t = 1;
    floor = BASE + (OUTER - BASE) * (t * t * (3 - 2 * t));
  }

  return Math.min(1, Math.max(floor, plate, ridge));
}


/* ---------------------------------------------------------------------------
   6. Das Relief – Rasterung

   Das Feld ist exakt um 2π/n drehsymmetrisch. Deshalb wird es einmal über
   einen einzigen Keil in eine Polartabelle gerechnet und danach nur noch
   bilinear abgetastet. Das spart den Faktor n an teuren Auswertungen: statt
   1,6 Millionen Punkten sind es ein paar hunderttausend.

   Am Ende kommt ein winziges kartesisches Rauschen dazu, das die perfekte
   Symmetrie ganz leicht bricht. Digital erzeugte Imperfektion – nicht
   schlecht gezeichnet, nur nicht mathematisch steril.
   ------------------------------------------------------------------------- */

const LUT_R_MAX = 1.10;

/* Winkel für 1,6 Millionen Pixel. Math.atan2 ist hier der teuerste Posten
   beim Bau eines Blattes; diese Näherung liegt unter 0,0002 rad daneben,
   am Außenrand also unter einem Zehntel Pixel – für eine Nachschlagetabelle
   mit weichen Gauß-Linien weit mehr als genug. */
function fastAtan2(y, x) {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  const d = ax > ay ? ax : ay;
  if (d === 0) return 0;
  const z = (ax < ay ? ax : ay) / d;
  const z2 = z * z;
  let a = ((-0.0464964749 * z2 + 0.15931422) * z2 - 0.327622764) * z2 * z + z;
  if (ay > ax) a = 1.57079633 - a;
  if (x < 0)   a = 3.14159265 - a;
  if (y < 0)   a = -a;
  return a;
}

function rasterRelief(plan) {
  const n     = plan.n;
  const wedge = TAU / n;

  const NR = 700;
  const NA = Math.max(320, Math.min(1400, Math.round(wedge * R_DISC * 1.4)));

  const lut = new Float32Array(NR * NA);
  for (let i = 0; i < NR; i++) {
    const rr = (i / (NR - 1)) * LUT_R_MAX;
    const row = i * NA;
    for (let j = 0; j < NA; j++) {
      lut[row + j] = fieldAt(plan, rr, (j / NA) * wedge);
    }
  }

  const out = new Uint8Array(SIZE * SIZE);
  const rScale = (NR - 1) / LUT_R_MAX;
  const aScale = NA / wedge;

  for (let y = 0; y < SIZE; y++) {
    const dy = y + 0.5 - HALF;
    let o = y * SIZE;
    for (let x = 0; x < SIZE; x++, o++) {
      const dx = x + 0.5 - HALF;
      const rr = Math.sqrt(dx * dx + dy * dy) / R_DISC;

      let v;
      if (rr >= LUT_R_MAX) {
        v = OUTER;
      } else {
        let th = fastAtan2(dy, dx);
        if (th < 0) th += TAU;
        let tl = th % wedge;
        if (tl < 0) tl = 0;

        const fr = rr * rScale;
        const fa = tl * aScale;
        const i0 = fr | 0, j0 = fa | 0;
        const tr = fr - i0, ta = fa - j0;
        const i1 = i0 + 1 < NR ? i0 + 1 : i0;
        const j1 = j0 + 1 < NA ? j0 + 1 : 0;

        const a0 = lut[i0 * NA + j0], a1 = lut[i0 * NA + j1];
        const b0 = lut[i1 * NA + j0], b1 = lut[i1 * NA + j1];
        v = (a0 + (a1 - a0) * ta) * (1 - tr) + (b0 + (b1 - b0) * ta) * tr;
      }

      v *= 0.965 + 0.07 * hash2(x, y);
      out[o] = v > 1 ? 255 : (v * 255) | 0;
    }
  }

  return out;
}


/* ---------------------------------------------------------------------------
   7. Das Papier

   Papierfarbe, Korn, eine sehr flache Prägung des Reliefs und ein Hauch
   Randabschattung. Die Prägung ist die einzige Stelle, an der das Relief
   sichtbar wird, bevor jemand es hervorholt: nicht als Linie, sondern als
   Licht, das sich in einer Vertiefung bricht.
   ------------------------------------------------------------------------- */

function renderPaper(pix, relief, look, hint) {
  const p = look.paper;
  const grain = look.grain;

  const near = cloudLayer(4, 17);
  const far  = cloudLayer(6, 251);
  const ampNear = grain * 0.95;
  const ampFar  = grain * 1.25;

  for (let y = 0; y < SIZE; y++) {
    const up = y > 0 ? -SIZE : 0;
    const dn = y < SIZE - 1 ? SIZE : 0;
    let o = y * SIZE;
    const dy = (y + 0.5 - HALF) / HALF;

    /* Die Zeilenanteile der beiden Wolkenschichten hängen nur an y. */
    const nRow0 = near.cell[y] * near.w, nRow1 = nRow0 + near.w, nSy = near.blend[y];
    const fRow0 = far.cell[y]  * far.w,  fRow1 = fRow0 + far.w,  fSy = far.blend[y];

    for (let x = 0; x < SIZE; x++, o++) {
      /* Prägung: Steigung des Reliefs, Licht von links oben. */
      const lf = x > 0 ? -1 : 0;
      const rg = x < SIZE - 1 ? 1 : 0;
      const gx = relief[o + rg] - relief[o + lf];
      const gy = relief[o + dn] - relief[o + up];
      const emboss = (gx + gy) * hint;

      /* Korn und eine weiche Wolkigkeit über das ganze Blatt. */
      const n1 = (hash2(x, y) - 0.5) * grain;

      const nc = near.cell[x], nSx = near.blend[x], ng = near.grid;
      const na = ng[nRow0 + nc], nb = ng[nRow0 + nc + 1];
      const ncc = ng[nRow1 + nc], nd = ng[nRow1 + nc + 1];
      const nv = (na + (nb - na) * nSx) * (1 - nSy) + (ncc + (nd - ncc) * nSx) * nSy;

      const fc = far.cell[x], fSx = far.blend[x], fg = far.grid;
      const fa = fg[fRow0 + fc], fb = fg[fRow0 + fc + 1];
      const fcc = fg[fRow1 + fc], fd = fg[fRow1 + fc + 1];
      const fv = (fa + (fb - fa) * fSx) * (1 - fSy) + (fcc + (fd - fcc) * fSx) * fSy;

      const n2 = (nv - 0.5) * ampNear + (fv - 0.5) * ampFar;

      /* Randabschattung – ein Blatt liegt nie ganz flach im Licht. */
      const dx = (x + 0.5 - HALF) / HALF;
      const vig = 1 - 0.035 * (dx * dx + dy * dy);

      const k = o * 4;
      pix[k]     = clamp255((p[0] + n1 + n2 + emboss) * vig);
      pix[k + 1] = clamp255((p[1] + n1 + n2 + emboss) * vig);
      pix[k + 2] = clamp255((p[2] + n1 + n2 + emboss) * vig);
      pix[k + 3] = 255;
    }
  }
}

function clamp255(v) {
  return v < 0 ? 0 : (v > 255 ? 255 : v);
}


/* ---------------------------------------------------------------------------
   8. Der Auftrag – Durchreiben

   Das Herz der App. Für jeden Pixel unter der Hand:

     Verweildauer × Kontaktstärke × Papierzahn × Reliefgriff  →  Pigment

   Vier Eigenschaften sind dabei Absicht, nicht Zufall:

   * Langsam wird dunkel. Nicht die zurückgelegte Strecke zählt, sondern die
     Zeit je Pixel. Wer hetzt, bekommt einen Hauch.
   * Der Griff ist weich, nicht geschaltet. Es gibt keine Schwelle, unter der
     gar nichts passiert – nur eine Kurve (bite = relief^gamma). Leichter
     Kontakt küsst fast nur die Höhen und das Ornament tritt scharf hervor;
     fester, langsamer Kontakt greift bis in die Fläche. Wer lange genug an
     einer Stelle bleibt, füllt sie – auch mit leichter Hand. Das ist
     wichtig, denn die meisten Geräte melden überhaupt keinen Druck; dort
     trägt die Langsamkeit die ganze Ausdruckskraft.
   * Pigment über Pigment gibt eine dritte Farbe. Nicht reine Multiplikation
     (die liefe unweigerlich ins Schwarze), sondern ein Ziel zwischen der
     reinen Pigmentfarbe und ihrer Multiplikation mit dem Untergrund. Das
     läuft in einen Fixpunkt: satt gebaut, aber nie tot.
   * Die Dichte läuft asymptotisch. Man kann eine Stelle nicht zumatschen.
     Es gibt keinen Zustand, aus dem man gerettet werden müsste – deshalb
     braucht es kein Rückgängig.
   ------------------------------------------------------------------------- */

const sheet = {
  plan: null,
  world: null,
  pigments: null,
  relief: null,
  dens: null,
  pix: null,
  image: null,
  look: null,
  mode: 'tag',
  seed: 0,
  touched: false
};

const dirty = { x0: 0, y0: 0, x1: 0, y1: 0, any: false };

function markDirty(x0, y0, x1, y1) {
  if (!dirty.any) {
    dirty.x0 = x0; dirty.y0 = y0; dirty.x1 = x1; dirty.y1 = y1;
    dirty.any = true;
    return;
  }
  if (x0 < dirty.x0) dirty.x0 = x0;
  if (y0 < dirty.y0) dirty.y0 = y0;
  if (x1 > dirty.x1) dirty.x1 = x1;
  if (y1 > dirty.y1) dirty.y1 = y1;
}

/* Die Griffkurve als Tabelle: bite = (relief/255)^gamma. Das Relief liegt
   ohnehin als Byte vor, und gamma ändert sich nur einmal je Bild – also 256
   Potenzen statt einer je Pixel. */
const biteLut = new Float32Array(256);
let biteGamma = -1;

function setBite(press) {
  const gamma = GAMMA_LIGHT + (GAMMA_FIRM - GAMMA_LIGHT) * press;
  if (gamma === biteGamma) return;
  biteGamma = gamma;
  for (let i = 0; i < 256; i++) biteLut[i] = Math.pow(i / 255, gamma);
}

/* Trägt entlang einer Strecke auf. dwell ist die Verweildauer in
   Millisekunden je Pixel Weg – daraus kommt die Dunkelheit. */
function rub(ax, ay, bx, by, dwell, radius, rgb) {
  const relief = sheet.relief;
  const dens   = sheet.dens;
  const pix    = sheet.pix;
  const screen = sheet.look.blend === 'screen';

  const pr = rgb[0], pg = rgb[1], pb = rgb[2];

  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;

  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - radius));
  const x1 = Math.min(SIZE - 1, Math.ceil(Math.max(ax, bx) + radius));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - radius));
  const y1 = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by) + radius));
  if (x1 < x0 || y1 < y0) return;

  const r2 = radius * radius;
  const amount = RATE * dwell;

  for (let y = y0; y <= y1; y++) {
    const row = y * SIZE;
    for (let x = x0; x <= x1; x++) {
      /* Abstand zur Strecke. */
      let cx, cy;
      if (len2 > 0.0001) {
        let t = ((x - ax) * vx + (y - ay) * vy) / len2;
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        cx = ax + vx * t;
        cy = ay + vy * t;
      } else {
        cx = ax; cy = ay;
      }
      const ddx = x - cx, ddy = y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 >= r2) continue;

      const o = row + x;
      const cur = dens[o];
      if (cur >= SAT_LIMIT) continue;

      /* Weiche Kontaktkurve, keine harte Scheibe. */
      const q = 1 - d2 / r2;
      const dep = amount * q * q * biteLut[relief[o]] * tooth(x, y);
      if (dep < 0.00025) continue;

      const add = dep * (1 - cur);
      if (add < 0.00025) continue;
      dens[o] = cur + add;

      const k = o * 4;
      if (screen) {
        /* Kreide auf getöntem Papier: deckt hell auf. */
        pix[k]     += (pr - pix[k])     * add;
        pix[k + 1] += (pg - pix[k + 1]) * add;
        pix[k + 2] += (pb - pix[k + 2]) * add;
      } else {
        /* Buntstift: zwischen reiner Pigmentfarbe und voller Subtraktion.
           Läuft in einen Fixpunkt statt ins Schwarze. */
        const c0 = pix[k], c1 = pix[k + 1], c2 = pix[k + 2];
        pix[k]     = c0 + (pr + (c0 * pr * (1 / 255) - pr) * MIX_SUB - c0) * add;
        pix[k + 1] = c1 + (pg + (c1 * pg * (1 / 255) - pg) * MIX_SUB - c1) * add;
        pix[k + 2] = c2 + (pb + (c2 * pb * (1 / 255) - pb) * MIX_SUB - c2) * add;
      }
    }
  }

  markDirty(x0, y0, x1, y1);
  sheet.touched = true;
}


/* ---------------------------------------------------------------------------
   9. Klang

   Reiben klingt, und das ist der halbe Reiz der Sache. Kein Sample – die App
   lädt nichts nach. Also synthetisch: gefiltertes Rauschen, dessen Helligkeit
   und Lautstärke an der Geschwindigkeit der Hand hängen. Genau das ist der
   Klang von Graphit auf Papier, physikalisch wie technisch.

   Es gibt keinen vorgegebenen Takt. Wer im Kreis geht, erzeugt eine Periode,
   und die wird hörbar. Die App gibt keinen Rhythmus – sie lässt einen sich
   selbst hören.
   ------------------------------------------------------------------------- */

const Klang = {
  ctx: null, band: null, body: null, gBand: null, gBody: null, master: null,
  muted: false,
  ready: false,

  wake: function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    try {
      const ctx = new AC();

      /* Rosa Rauschen klingt nach Papier; weißes klingt nach Fernseher. */
      const len = Math.floor(ctx.sampleRate * 3);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      this.band  = ctx.createBiquadFilter();
      this.band.type = 'bandpass';
      this.band.frequency.value = 900;
      this.band.Q.value = 0.7;

      this.body = ctx.createBiquadFilter();
      this.body.type = 'lowpass';
      this.body.frequency.value = 300;

      this.gBand = ctx.createGain(); this.gBand.gain.value = 0;
      this.gBody = ctx.createGain(); this.gBody.gain.value = 0;
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1;

      src.connect(this.band).connect(this.gBand).connect(this.master);
      src.connect(this.body).connect(this.gBody).connect(this.master);
      this.master.connect(ctx.destination);
      src.start();

      this.ctx = ctx;
      this.ready = true;
    } catch (err) {
      this.ready = false;
    }
  },

  /* speed in inneren Pixeln je Millisekunde. */
  move: function (speed) {
    if (!this.ready) return;
    const s = Math.min(1, speed / 1.6);
    const t = this.ctx.currentTime;
    this.band.frequency.setTargetAtTime(700 + 3400 * s, t, 0.05);
    this.gBand.gain.setTargetAtTime(0.055 * (0.22 + 0.78 * s), t, 0.04);
    this.gBody.gain.setTargetAtTime(0.030 * s, t, 0.05);
  },

  rest: function () {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.gBand.gain.setTargetAtTime(0, t, 0.07);
    this.gBody.gain.setTargetAtTime(0, t, 0.07);
  },

  setMuted: function (on) {
    this.muted = on;
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }
};


/* ---------------------------------------------------------------------------
   10. Die zweite Hand – das Blatt bewegen

   Beim Ausmalen auf Papier malt eine Hand und die andere schiebt das Blatt
   zurecht. Genau so hier: Ein Finger reibt, zwei Finger bewegen das Papier.
   Das ist kein Bedienelement, keine Einstellung und kein Modus – es ist die
   zweite Hand, und sie muss niemandem erklärt werden.

   Der Unterschied zum Zoom des Browsers ist wesentlich: Der vergrößert die
   ganze Stube, samt Pigmenten, die dann aus dem Bild wandern. Hier bewegt
   sich nur das Blatt. Die Stifte bleiben auf dem Tisch liegen.

   Verrechnet wird ohne einen einzigen Blick ins Layout: Die Lage des Blattes
   folgt allein aus Grundgröße, Maßstab und Verschiebung. Das hält toLocal()
   frei von getBoundingClientRect, das sonst bei jedem Zeigerereignis ein
   Neuberechnen der Seite erzwingen würde.
   ------------------------------------------------------------------------- */

const view = {
  scale: 1, tx: 0, ty: 0,
  base: 0,                    // Kantenlänge bei bildfüllender Ansicht
  cx: 0, cy: 0,               // Mitte des Blattes im Fenster, ohne Verschiebung
  left: 0, top: 0, size: 0,   // daraus abgeleitet: wo das Blatt gerade liegt
  perCss: 1,                  // Blatt-Einheiten je Bildschirmpunkt
  anim: null
};

function viewLimit(scale) {
  /* Das Blatt darf nie so weit wandern, dass daneben Leere entsteht. */
  return Math.max(0, (scale - 1) * view.base * 0.5);
}

function applyView() {
  view.size = view.base * view.scale;
  view.left = view.cx + view.tx - view.size * 0.5;
  view.top  = view.cy + view.ty - view.size * 0.5;
  view.perCss = view.size > 0 ? SIZE / view.size : 1;
  canvas.style.transform =
    'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
}

function setView(scale, tx, ty) {
  view.scale = scale;
  view.tx = tx;
  view.ty = ty;
  applyView();
}

/* Weich über die Grenze hinaus, damit nichts hart anschlägt. */
function rubber(value, min, max) {
  if (value < min) return min - (min - value) * VIEW_RUBBER;
  if (value > max) return max + (value - max) * VIEW_RUBBER;
  return value;
}

function clampedView() {
  const scale = Math.max(1, Math.min(VIEW_MAX, view.scale));
  const lim = viewLimit(scale);
  return {
    scale: scale,
    tx: Math.max(-lim, Math.min(lim, view.tx)),
    ty: Math.max(-lim, Math.min(lim, view.ty))
  };
}

function stopViewAnim() {
  if (view.anim) { cancelAnimationFrame(view.anim.id); view.anim = null; }
}

function animateView(target, duration) {
  stopViewAnim();
  const from = { scale: view.scale, tx: view.tx, ty: view.ty };
  if (Math.abs(from.scale - target.scale) < 0.0005 &&
      Math.abs(from.tx - target.tx) < 0.5 &&
      Math.abs(from.ty - target.ty) < 0.5) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setView(target.scale, target.tx, target.ty);
    return;
  }

  const start = performance.now();
  const step = function (now) {
    const t = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - t, 3);
    setView(
      from.scale + (target.scale - from.scale) * e,
      from.tx + (target.tx - from.tx) * e,
      from.ty + (target.ty - from.ty) * e
    );
    if (t < 1) view.anim.id = requestAnimationFrame(step);
    else view.anim = null;
  };
  view.anim = { id: requestAnimationFrame(step) };
}

function settleView() { animateView(clampedView(), VIEW_SNAP_MS); }

/* Der Weg zurück ist kein Knopf, sondern dieselbe Ruhe, die auch die
   Pigmente abtreten lässt: Wer die Hand hebt und einen Augenblick nichts
   tut, bekommt sein ganzes Mandala zu sehen. */
function viewHome() { animateView({ scale: 1, tx: 0, ty: 0 }, VIEW_HOME_MS); }

/* Die laufende Zwei-Finger-Geste. */
const grip = {
  active: false,
  a: 0, b: 0,                 // die beiden beteiligten Zeiger
  dist: 0, mx: 0, my: 0,      // Ausgangsabstand und -mitte
  scale: 1, tx: 0, ty: 0      // Ansicht beim Beginn der Geste
};

function gripBegin(p1, p2) {
  stopViewAnim();
  grip.active = true;
  grip.a = p1.id; grip.b = p2.id;
  grip.dist = Math.max(1, Math.hypot(p1.x - p2.x, p1.y - p2.y));
  grip.mx = (p1.x + p2.x) * 0.5;
  grip.my = (p1.y + p2.y) * 0.5;
  grip.scale = view.scale;
  grip.tx = view.tx;
  grip.ty = view.ty;
}

function gripMove(p1, p2) {
  const dist = Math.max(1, Math.hypot(p1.x - p2.x, p1.y - p2.y));
  const mx = (p1.x + p2.x) * 0.5;
  const my = (p1.y + p2.y) * 0.5;

  const wanted = grip.scale * (dist / grip.dist);
  const scale = rubber(wanted, 1, VIEW_MAX);

  /* Der Punkt unter der Mitte der beiden Finger soll dort bleiben, wo er ist. */
  const ox = grip.mx - view.cx, oy = grip.my - view.cy;
  const ux = (ox - grip.tx) / grip.scale;
  const uy = (oy - grip.ty) / grip.scale;

  const lim = viewLimit(scale);
  setView(
    scale,
    rubber((mx - view.cx) - scale * ux, -lim, lim),
    rubber((my - view.cy) - scale * uy, -lim, lim)
  );
}

function gripEnd() {
  grip.active = false;
  settleView();
}


/* ---------------------------------------------------------------------------
   11. Die Hand

   Zeigerereignisse werden nur eingesammelt; aufgetragen wird einmal je Bild.
   Das entkoppelt die Eingaberate von der Darstellung, ergibt genau eine
   Übertragung ans Bild je Bild und macht die Verweildauer sauber messbar.

   Werkzeug wird nicht gewählt, sondern erkannt: Finger und Stift kommen als
   verschiedene Zeigerarten herein und bekommen ihre eigene Kontaktbreite und
   ihren eigenen Umgang mit Druck. Man kann mitten in einem Blatt wechseln,
   ohne irgendwo etwas umzustellen.

   Handballen: Es malt immer nur ein Kontakt. Wer minutenlang über ein Blatt
   reibt, legt die Hand auf – ohne diese Regel wäre jede Sitzung nach zwei
   Minuten ruiniert. Solange ein Stift arbeitet, werden Berührungen deshalb
   vollständig verworfen; mit dem Finger entscheidet die Zeit darüber, ob ein
   zweiter Kontakt die zweite Hand ist oder der Ballen.
   ------------------------------------------------------------------------- */

const hand = {
  id: null,
  down: false,
  x: 0, y: 0,
  press: 0.5,
  radius: 0,
  pen: false,
  queue: [],
  moved: false,
  downAt: 0,
  lastFrame: 0,
  lastMove: 0
};

/* Alle aufliegenden Zeiger, damit die zweite Hand erkannt werden kann. */
const touching = new Map();

let canvas, ctx, imageData;

function toLocal(event) {
  return [
    ((event.clientX - view.left) / view.size) * SIZE,
    ((event.clientY - view.top) / view.size) * SIZE
  ];
}

/* Kontaktbreite: physisch gedacht, in Blatt-Einheiten umgerechnet. Holt man
   das Blatt näher, deckt dieselbe Fingerkuppe weniger Bildfläche ab – genau
   wie in Wirklichkeit. */
function contactRadius(pen) {
  return (pen ? R_PEN_CSS : R_FINGER_CSS) * view.perCss;
}

function pressureOf(event) {
  /* Manche Geräte melden gar keinen Druck und schicken konstant 0 oder 0,5.
     Dann trägt die Geschwindigkeit die ganze Ausdruckskraft, und wir bleiben
     in der Mitte. */
  const p = event.pressure;
  if (event.pointerType === 'pen' && p > 0) return Math.min(1, p * 1.15);
  if (p > 0 && p !== 0.5) return Math.min(1, p * 1.4);
  return 0.5;
}

function startStroke(event) {
  hand.id = event.pointerId;
  hand.down = true;
  hand.pen = event.pointerType === 'pen';
  hand.radius = contactRadius(hand.pen);
  hand.press = pressureOf(event);
  const p = toLocal(event);
  hand.x = p[0]; hand.y = p[1];
  hand.queue.length = 0;
  hand.moved = false;
  hand.downAt = performance.now();
  hand.lastFrame = hand.downAt;
  hand.lastMove = hand.downAt;
  Klang.wake();
}

function endStroke() {
  if (!hand.down) return;
  hand.id = null;
  hand.down = false;
  hand.queue.length = 0;
  Klang.rest();
  scheduleSave();
}

function bindHand() {
  canvas.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    touching.set(event.pointerId, {
      id: event.pointerId, x: event.clientX, y: event.clientY, pen: event.pointerType === 'pen'
    });
    /* Das Einfangen des Zeigers darf nie den Rest dieses Handlers
       verhindern. Safari wirft hier gelegentlich, und eine Ausnahme an
       dieser Stelle hieße: Der Strich beginnt gar nicht erst. */
    try { canvas.setPointerCapture(event.pointerId); } catch (err) {}
    awaken();

    /* Der Stift hat immer Vorrang. Liegt er auf, ist jede Berührung der
       Handballen – und niemals die zweite Hand. */
    if (event.pointerType === 'pen') {
      if (hand.down && !hand.pen) endStroke();
      if (!hand.down) startStroke(event);
      return;
    }
    if (hand.down && hand.pen) return;

    if (!hand.down) { startStroke(event); return; }

    /* Ein zweiter Finger kurz nach dem ersten: die zweite Hand. Kommt er
       später, hat die erste Hand längst zu reiben begonnen – dann ist es
       der Ballen und wird verworfen. */
    if (!grip.active && performance.now() - hand.downAt < GESTURE_GRACE) {
      /* Ausdrücklich der reibende und der neu hinzugekommene Zeiger – nicht
         irgendwelche zwei aus der Liste. Ein Kontakt, dessen Loslassen der
         Browser verschluckt hat, bliebe sonst darin liegen und würde die
         Geste an einem Punkt aufhängen, an dem längst kein Finger mehr ist. */
      const erste = touching.get(hand.id);
      const zweite = touching.get(event.pointerId);
      if (erste && zweite && erste !== zweite) {
        endStroke();
        gripBegin(erste, zweite);
      }
    }
  });

  canvas.addEventListener('pointermove', function (event) {
    event.preventDefault();
    const known = touching.get(event.pointerId);
    if (known) { known.x = event.clientX; known.y = event.clientY; }

    if (grip.active) {
      const a = touching.get(grip.a), b = touching.get(grip.b);
      if (a && b) gripMove(a, b);
      return;
    }

    if (event.pointerId !== hand.id) return;

    const list = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    for (let i = 0; i < list.length; i++) {
      const p = toLocal(list[i]);
      if (!hand.moved &&
          (Math.abs(p[0] - hand.x) > MOVE_WAKE || Math.abs(p[1] - hand.y) > MOVE_WAKE)) {
        hand.moved = true;
      }
      hand.queue.push(p[0], p[1]);
    }
    hand.press = pressureOf(event);
  });

  const lift = function (event) {
    touching.delete(event.pointerId);
    if (grip.active) {
      if (event.pointerId === grip.a || event.pointerId === grip.b) gripEnd();
      return;
    }
    if (event.pointerId === hand.id) endStroke();
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  /* Auf dem Schreibtisch gibt es keine zweite Hand – dort tut das Rad
     dasselbe. Für das iPad ist das ohne Bedeutung. */
  canvas.addEventListener('wheel', function (event) {
    event.preventDefault();
    stopViewAnim();
    awaken();
    const factor = Math.exp(-event.deltaY * 0.0016);
    const scale = Math.max(1, Math.min(VIEW_MAX, view.scale * factor));
    const ox = event.clientX - view.cx, oy = event.clientY - view.cy;
    const ux = (ox - view.tx) / view.scale;
    const uy = (oy - view.ty) / view.scale;
    const lim = viewLimit(scale);
    setView(
      scale,
      Math.max(-lim, Math.min(lim, ox - scale * ux)),
      Math.max(-lim, Math.min(lim, oy - scale * uy))
    );
  }, { passive: false });

  /* Safari fängt sonst Wischgesten ab. */
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove',  function (e) { e.preventDefault(); }, { passive: false });
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!sheet.relief) return;

  if (hand.down) {
    const dt = Math.min(64, now - hand.lastFrame);
    hand.lastFrame = now;
    if (dt > 0) applyHand(dt);
  }

  if (dirty.any) {
    ctx.putImageData(
      imageData, 0, 0,
      dirty.x0, dirty.y0,
      dirty.x1 - dirty.x0 + 1, dirty.y1 - dirty.y0 + 1
    );
    dirty.any = false;
  }

  tickStillness(now);
  tickSave(now);
}

function applyHand(dt) {
  const q = hand.queue;
  const rgb = current().rgb;

  /* Gesamtweg dieses Bildes. */
  let len = 0;
  let px = hand.x, py = hand.y;
  for (let i = 0; i < q.length; i += 2) {
    const dx = q[i] - px, dy = q[i + 1] - py;
    len += Math.sqrt(dx * dx + dy * dy);
    px = q[i]; py = q[i + 1];
  }

  const speed = len / dt;
  Klang.move(speed);

  /* Wie tief der Kontakt greift. Der gemeldete Druck geht ein, wo es ihn
     gibt – aber die meisten Geräte melden keinen. Deshalb trägt die
     Langsamkeit den größeren Teil: wer verweilt, greift in die Fläche,
     wer wischt, streift nur die Höhen. */
  const slow = 1 - Math.min(1, speed / 1.1);
  setBite(Math.min(1, hand.press * 0.62 + slow * 0.44));

  if (len < 0.4) {
    /* Die Hand steht. Auch das trägt auf – wer den Stift hält und wartet,
       bekommt einen dunklen Fleck. Gedeckelt, damit es nicht ausufert.

       Nur ganz am Anfang nicht: Solange sich noch nichts bewegt hat und die
       Frist für die zweite Hand läuft, bleibt das Blatt unberührt. Ein
       Reiben beginnt mit einer Bewegung, ein Heranholen mit zwei ruhenden
       Fingern – und ohne diese Frist bliebe von jedem Heranholen ein
       dunkler Punkt zurück. */
    q.length = 0;
    if (!hand.moved && performance.now() - hand.downAt < GESTURE_GRACE) return;
    rub(hand.x, hand.y, hand.x, hand.y,
        Math.min(DWELL_CAP, dt * 0.35), hand.radius, rgb);
    return;
  }

  const dwell = Math.min(DWELL_CAP, dt / len);
  px = hand.x; py = hand.y;
  for (let i = 0; i < q.length; i += 2) {
    rub(px, py, q[i], q[i + 1], dwell, hand.radius, rgb);
    px = q[i]; py = q[i + 1];
  }
  hand.x = px; hand.y = py;
  q.length = 0;
  hand.lastMove = performance.now();
}


/* ---------------------------------------------------------------------------
   11. Speicher

   Gesichert wird das zusammengesetzte Bild, nicht der Zustand. Beim
   Fortsetzen wird die Dichte aus der Helligkeit zurückgerechnet – eine
   Näherung, aber eine ehrliche: Das Blatt erinnert sich an das, was man
   sieht.

   Ohne IndexedDB (Safari im privaten Modus) hält die App das Blatt nur für
   die laufende Sitzung. Gesagt wird das im Fach, nicht als Meldung – wer
   nicht danach sucht, soll nicht gestört werden.
   ------------------------------------------------------------------------- */

const Speicher = {
  db: null,
  ok: false,

  open: function () {
    const self = this;
    return new Promise(function (resolve) {
      let request;
      try {
        request = indexedDB.open('atelier3-regal3-1', 1);
      } catch (err) {
        resolve(false);
        return;
      }
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains('kv'))     db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('blaetter')) {
          db.createObjectStore('blaetter', { keyPath: 'id' }).createIndex('zeit', 'zeit');
        }
      };
      request.onsuccess = function () {
        self.db = request.result;
        self.ok = true;
        resolve(true);
      };
      request.onerror = function () { resolve(false); };
      request.onblocked = function () { resolve(false); };
    });
  },

  put: function (store, value, key) {
    const self = this;
    if (!this.ok) return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        const tx = self.db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      } catch (err) { resolve(false); }
    });
  },

  get: function (store, key) {
    const self = this;
    if (!this.ok) return Promise.resolve(null);
    return new Promise(function (resolve) {
      try {
        const req = self.db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (err) { resolve(null); }
    });
  },

  all: function (store) {
    const self = this;
    if (!this.ok) return Promise.resolve([]);
    return new Promise(function (resolve) {
      try {
        const req = self.db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { resolve([]); };
      } catch (err) { resolve([]); }
    });
  },

  del: function (store, key) {
    const self = this;
    if (!this.ok) return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        const tx = self.db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      } catch (err) { resolve(false); }
    });
  }
};

let saveTimer = 0;
let saving = false;
let savedAt = 0;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrent, SAVE_MS);
}

/* Gesichert wird sonst nur, wenn die Hand kurz innehält. Wer eine Viertel-
   stunde am Stück kreist, ohne abzusetzen, hätte bis dahin nichts auf der
   Platte. Deshalb zusätzlich eine Langstreckensicherung – selten genug, dass
   sie nicht stört, und ausdrücklich nur zwischen zwei Bildern. */
function tickSave(now) {
  if (saving || !sheet.touched || !Speicher.ok) return;
  if (now - savedAt < LONG_SAVE_MS) return;
  saveCurrent();
}

function snapshot() {
  return new Promise(function (resolve) {
    const type = 'image/webp';
    canvas.toBlob(function (blob) {
      if (blob) { resolve(blob); return; }
      canvas.toBlob(function (jpg) { resolve(jpg); }, 'image/jpeg', 0.94);
    }, type, 0.93);
  });
}

async function saveCurrent() {
  if (!Speicher.ok || !sheet.touched || saving) return;
  saving = true;
  savedAt = performance.now();
  try {
    const blob = await snapshot();
    if (!blob) return;
    await Speicher.put('kv', {
      blob: blob, seed: sheet.seed, mode: sheet.mode, world: sheet.world.id,
      pigment: pigmentIndex, zeit: Date.now()
    }, 'blatt');
    savedAt = performance.now();
  } finally {
    saving = false;
  }
}

/* Ein Blatt weglegen: als Ganzes auf den Stapel, mit allem, was es
   wiederherstellbar macht. */
async function shelveCurrent() {
  if (!sheet.touched || !Speicher.ok) return false;
  const blob = await snapshot();
  if (!blob) return false;
  await Speicher.put('blaetter', {
    id: String(Date.now()) + '-' + Math.floor(Math.random() * 1e6),
    blob: blob, seed: sheet.seed, mode: sheet.mode, world: sheet.world.id,
    zeit: Date.now()
  });
  return true;
}

/* Ein gesichertes Blatt wird wieder das laufende – beim Start und beim
   Aufnehmen vom Stapel derselbe Weg. */
async function adoptSheet(rec) {
  makeSheet(rec.seed, rec.mode, rec.world);
  buildPigments();
  setPigment(rec.pigment || 0);

  const img = await loadBitmap(rec.blob);
  if (img) {
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    sheet.pix = imageData.data;
    densityFromPixels();
    sheet.touched = true;
  }
  paint();
  return !!img;
}

/* Dichte aus der Helligkeit zurückrechnen. */
function densityFromPixels() {
  const pix = sheet.pix;
  const dens = sheet.dens;
  const p = sheet.look.paper;
  const base = (p[0] + p[1] + p[2]) / 3;
  const screen = sheet.look.blend === 'screen';

  for (let o = 0, k = 0; o < dens.length; o++, k += 4) {
    const lum = (pix[k] + pix[k + 1] + pix[k + 2]) / 3;
    let d = screen ? (lum - base) / (255 - base) : 1 - lum / base;
    /* Korn und Randabschattung schwanken um ein paar Helligkeitsstufen.
       Ohne diesen Totgang läse sich unberührtes Papier als leichtes
       Pigment, und ein wieder aufgenommenes Blatt nähme etwas schlechter
       an als ein frisches. */
    d = (d - GRAIN_DEADBAND) / (1 - GRAIN_DEADBAND);
    if (d < 0) d = 0;
    if (d > SAT_LIMIT) d = SAT_LIMIT;
    dens[o] = d;
  }
}

function loadBitmap(blob) {
  return new Promise(function (resolve) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}


/* ---------------------------------------------------------------------------
   12. Oberfläche

   Neun Pigmente, sichtbar am Blattrand, dauerhaft. Kein Auf- und Zuklappen,
   keine Schublade, kein Dialog. Eine Schublade fragt; Stifte auf dem Tisch
   liegen einfach da.

   Dazu ein einziges stilles Zeichen für alles Übrige. Kein Menüknopf, der
   ruft – aber auch keine geheime Geste, denn Geheimnisse sind gegenüber
   Erreichbarkeit unfair.
   ------------------------------------------------------------------------- */

let pigmentIndex = 0;
const ui = {};

function current() {
  return sheet.pigments[pigmentIndex];
}

function buildPigments() {
  const strip = ui.pigments;
  strip.innerHTML = '';
  sheet.pigments.forEach(function (pig, i) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pigment';
    button.dataset.index = String(i);
    button.setAttribute('aria-label', pig.name);
    button.setAttribute('aria-pressed', i === pigmentIndex ? 'true' : 'false');
    button.style.setProperty('--pigment', 'rgb(' + pig.rgb.join(',') + ')');
    strip.appendChild(button);
  });
}

function setPigment(i) {
  pigmentIndex = Math.max(0, Math.min(sheet.pigments.length - 1, i));
  const all = ui.pigments.querySelectorAll('.pigment');
  for (let k = 0; k < all.length; k++) {
    all[k].setAttribute('aria-pressed', k === pigmentIndex ? 'true' : 'false');
  }
  scheduleSave();
}

function setTray(open) {
  ui.tray.hidden = !open;
  ui.mark.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    awaken();
    ui.trayNew.focus();
  }
}


/* ---------------------------------------------------------------------------
   13. Der Stapel

   Ein Stapel, kein Kachelraster. Ein Raster stellt Bilder nebeneinander und
   lädt damit zum Vergleichen ein, und Vergleichen ist der Anfang von
   Bewertung. Ein Stapel zeigt eines.
   ------------------------------------------------------------------------- */

const stack = { items: [], at: 0, url: '' };

async function openStack() {
  setTray(false);
  stack.items = await Speicher.all('blaetter');
  stack.items.sort(function (a, b) { return b.zeit - a.zeit; });
  stack.at = 0;
  ui.stack.hidden = false;
  showStackItem();
}

function closeStack() {
  ui.stack.hidden = true;
  if (stack.url) { URL.revokeObjectURL(stack.url); stack.url = ''; }
}

function showStackItem() {
  if (typeof resetDiscard === 'function') resetDiscard();
  const empty = stack.items.length === 0;
  ui.stackEmpty.hidden = !empty;
  ui.stackFigure.hidden = empty;
  ui.stackPrev.disabled = empty || stack.at <= 0;
  ui.stackNext.disabled = empty || stack.at >= stack.items.length - 1;
  ui.stackRemove.hidden = empty;
  ui.stackTake.hidden = empty;
  if (empty) return;

  if (stack.url) URL.revokeObjectURL(stack.url);
  stack.url = URL.createObjectURL(stack.items[stack.at].blob);
  ui.stackImage.src = stack.url;
}

function stepStack(delta) {
  const next = stack.at + delta;
  if (next < 0 || next >= stack.items.length) return;
  stack.at = next;
  showStackItem();
}

/* Ein Blatt vom Stapel wieder aufnehmen. Es wird das laufende Blatt, und
   das bisherige wandert dafür auf den Stapel – zwei Blätter tauschen die
   Plätze. Kein Speichern, kein Laden, kein Dialog; auf dem Tisch tut man
   genau das, wenn man ein liegengebliebenes Blatt wieder hervorholt.

   Die Reihenfolge ist Absicht: erst das laufende Blatt in Sicherheit
   bringen, dann das andere holen, und erst wenn das geglückt ist, den
   alten Eintrag entfernen. Bricht etwas dazwischen ab, liegt schlimmsten-
   falls ein Blatt doppelt – aber keines fehlt. */
async function takeStackItem() {
  if (!stack.items.length) return;
  const item = stack.items[stack.at];

  clearTimeout(saveTimer);
  await shelveCurrent();

  document.body.classList.add('is-turning');
  await new Promise(function (r) { setTimeout(r, 260); });

  const ok = await adoptSheet(item);
  document.body.classList.remove('is-turning');

  if (ok) {
    await Speicher.del('blaetter', item.id);
    await saveCurrent();
  }
  closeStack();
  awaken();
}

/* Das Verwerfen ist das einzige Endgültige in dieser App – überall sonst
   geht nichts verloren. Deshalb als einzige Stelle eine Rückfrage, und zwar
   ohne Dialog: Der Knopf selbst fragt, und wer danebentippt oder wartet,
   hat nichts getan.

   Es hieß hier einmal „Weglegen“. Genau das tut aber „Neues Blatt“ – ein
   Blatt weglegen heißt, es auf den Stapel zu legen. Dasselbe Wort für das
   Gegenteil zu verwenden, hat Arbeit gekostet. */
let discardArmed = 0;

function resetDiscard() {
  discardArmed = 0;
  ui.stackRemove.textContent = 'Verwerfen';
  ui.stackRemove.classList.remove('is-armed');
}

async function removeStackItem() {
  if (!stack.items.length) return;

  if (!discardArmed || Date.now() - discardArmed > 5000) {
    discardArmed = Date.now();
    ui.stackRemove.textContent = 'Wirklich verwerfen';
    ui.stackRemove.classList.add('is-armed');
    return;
  }

  const item = stack.items[stack.at];
  await Speicher.del('blaetter', item.id);
  stack.items.splice(stack.at, 1);
  if (stack.at >= stack.items.length) stack.at = Math.max(0, stack.items.length - 1);
  resetDiscard();
  showStackItem();
}

/* Das laufende Blatt weglegen und ein frisches nehmen. */
async function newSheet() {
  setTray(false);
  clearTimeout(saveTimer);
  await shelveCurrent();
  await Speicher.del('kv', 'blatt');

  document.body.classList.add('is-turning');
  await new Promise(function (r) { setTimeout(r, 260); });
  makeSheet((Math.random() * 4294967296) >>> 0, preferredMode());
  buildPigments();
  setPigment(0);
  paint();
  document.body.classList.remove('is-turning');
  awaken();
}


/* ---------------------------------------------------------------------------
   14. Die Stille

   Nach vierzig Sekunden ohne Berührung tritt die Bedienung ab: Die Pigmente
   verblassen, das Zeichen verschwindet, das Blatt steht allein.

   Kein Knopf, kein „Gespeichert!“, kein Titelfeld, keine Frage. Wer die Hand
   wieder auflegt, macht weiter.
   ------------------------------------------------------------------------- */

let lastTouch = 0;
let still = false;

function awaken() {
  lastTouch = performance.now();
  if (still) {
    still = false;
    document.body.classList.remove('is-still');
    /* Sinkt das Blatt gerade in die Vollansicht zurück und jemand legt die
       Hand wieder auf, bleibt es stehen, wo es ist. Die Hand hat Vorrang. */
    stopViewAnim();
  }
}

function tickStillness(now) {
  if (still || hand.down || !sheet.touched) return;
  if (!ui.tray.hidden || !ui.stack.hidden) { lastTouch = now; return; }
  if (now - lastTouch < STILL_MS) return;
  still = true;
  document.body.classList.add('is-still');
  /* Der Abschluss zeigt das ganze Mandala, nicht einen Ausschnitt. */
  viewHome();
}


/* ---------------------------------------------------------------------------
   15. Start
   ------------------------------------------------------------------------- */

function preferredMode() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'nacht' : 'tag';
}

function hintStrength() {
  const raw = new URLSearchParams(location.search).get('relief');
  const factor = raw === null ? 1 : Math.max(0, Math.min(2, parseFloat(raw) || 0));
  return HINT_BASE * factor;
}

/* Baut Relief, Papier und Puffer für ein Blatt. */
function makeSheet(seed, mode, worldId) {
  sheet.seed   = seed >>> 0;
  sheet.mode   = SHEETS[mode] ? mode : 'tag';
  sheet.look   = SHEETS[sheet.mode];

  /* Die Welt steckt im Seed. Gesicherte Blätter tragen sie zusätzlich bei
     sich: Käme später eine Welt dazu, verschöbe sich sonst die Farbe eines
     Blattes, das längst gemalt ist. */
  sheet.world = (worldId && WORLDS.filter(function (w) { return w.id === worldId; })[0])
              || worldFor(sheet.seed);
  sheet.pigments = pigmentsOf(sheet.world, sheet.mode);

  sheet.plan   = buildPlan(sheet.seed);
  sheet.relief = rasterRelief(sheet.plan);

  if (!sheet.pix) {
    imageData  = ctx.createImageData(SIZE, SIZE);
    sheet.pix  = imageData.data;
    sheet.dens = new Float32Array(SIZE * SIZE);
  } else {
    sheet.dens.fill(0);
  }

  renderPaper(sheet.pix, sheet.relief, sheet.look, hintStrength());
  sheet.touched = false;
  document.body.dataset.sheet = sheet.mode;
}

function paint() {
  ctx.putImageData(imageData, 0, 0);
  dirty.any = false;
}

function fitSheet() {
  /* Das Blatt bekommt die größte Quadratseite, die in den Innenraum passt.
     In CSS lässt sich das nicht verlässlich ausdrücken, sobald Breite und
     Höhe beide feststehen – dann wird aus dem Quadrat ein Rechteck.

     Gemessen wird der Inhaltsbereich von .room, nicht das Fenster: Sonst
     stünde die Höhe der Pigmentleiste an zwei Stellen (hier und im CSS),
     und das Blatt säße bei jeder Änderung wieder schief. */
  const room = ui.room;
  const cs = getComputedStyle(room);
  const w = room.clientWidth
          - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const h = room.clientHeight
          - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const side = Math.max(160, Math.floor(Math.min(w, h)));
  canvas.style.width  = side + 'px';
  canvas.style.height = side + 'px';

  /* Grundgröße und Mitte merken, damit die zweite Hand ohne einen einzigen
     Blick ins Layout rechnen kann. Die Mitte steht fest: Eine Verschiebung
     des Blattes ändert nur seine Darstellung, nicht seinen Platz im Raster. */
  view.base = side;
  const box = ui.wrap.getBoundingClientRect();
  view.cx = box.left + box.width * 0.5 - view.tx;
  view.cy = box.top + box.height * 0.5 - view.ty;

  const fit = clampedView();
  setView(fit.scale, fit.tx, fit.ty);
}

function cacheUi() {
  ui.room        = document.querySelector('.room');
  ui.wrap        = document.querySelector('.sheet-wrap');
  ui.pigments    = document.getElementById('pigments');
  ui.mark        = document.getElementById('mark');
  ui.tray        = document.getElementById('tray');
  ui.trayNew     = document.getElementById('tray-new');
  ui.trayStack   = document.getElementById('tray-stack');
  ui.traySound   = document.getElementById('tray-sound');
  ui.trayNote    = document.getElementById('tray-note');
  ui.stack       = document.getElementById('stack');
  ui.stackImage  = document.getElementById('stack-image');
  ui.stackFigure = document.getElementById('stack-figure');
  ui.stackEmpty  = document.getElementById('stack-empty');
  ui.stackPrev   = document.getElementById('stack-prev');
  ui.stackNext   = document.getElementById('stack-next');
  ui.stackTake   = document.getElementById('stack-take');
  ui.stackRemove = document.getElementById('stack-remove');
  ui.stackClose  = document.getElementById('stack-close');
  ui.hint        = document.getElementById('hint');
}

function bindUi() {
  ui.pigments.addEventListener('click', function (event) {
    const button = event.target.closest('.pigment');
    if (button) { setPigment(Number(button.dataset.index)); awaken(); }
  });

  ui.mark.addEventListener('click', function () { setTray(ui.tray.hidden); });

  document.addEventListener('pointerdown', function (event) {
    if (ui.tray.hidden) return;
    if (event.target.closest('#tray') || event.target.closest('#mark')) return;
    setTray(false);
  });

  ui.trayNew.addEventListener('click', newSheet);
  ui.trayStack.addEventListener('click', openStack);
  ui.traySound.addEventListener('click', function () {
    Klang.wake();
    Klang.setMuted(!Klang.muted);
    try { localStorage.setItem('atelier3-regal3-1-ton', Klang.muted ? 'aus' : 'an'); } catch (err) {}
    syncSoundLabel();
  });

  ui.stackPrev.addEventListener('click', function () { stepStack(-1); });
  ui.stackNext.addEventListener('click', function () { stepStack(1); });
  ui.stackTake.addEventListener('click', takeStackItem);
  ui.stackRemove.addEventListener('click', removeStackItem);
  ui.stackClose.addEventListener('click', closeStack);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (!ui.stack.hidden) closeStack();
      else if (!ui.tray.hidden) setTray(false);
    }
    if (!ui.stack.hidden) {
      if (event.key === 'ArrowLeft')  stepStack(-1);
      if (event.key === 'ArrowRight') stepStack(1);
    }
  });

  window.addEventListener('resize', fitSheet);
  window.addEventListener('orientationchange', fitSheet);

  const flush = function () { clearTimeout(saveTimer); saveCurrent(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flush();
  });
}

function syncSoundLabel() {
  ui.traySound.textContent = Klang.muted ? 'Ton an' : 'Ton aus';
}

async function start() {
  canvas = document.getElementById('sheet');
  canvas.width = SIZE;
  canvas.height = SIZE;
  ctx = canvas.getContext('2d', { alpha: false });

  cacheUi();

  try { Klang.muted = localStorage.getItem('atelier3-regal3-1-ton') === 'aus'; } catch (err) {}
  syncSoundLabel();

  const stored = await Speicher.open();
  ui.trayNote.hidden = stored;

  /* Ein begonnenes Blatt liegt da, wo man es verlassen hat. */
  let resumed = null;
  if (stored) resumed = await Speicher.get('kv', 'blatt');

  if (resumed) {
    await adoptSheet(resumed);
  } else {
    makeSheet((Math.random() * 4294967296) >>> 0, preferredMode());
    buildPigments();
    setPigment(0);
    paint();
  }

  fitSheet();
  bindUi();
  bindHand();

  /* Der einzige Satz, den diese App je sagt – und nur beim allerersten Mal. */
  let seen = false;
  try { seen = localStorage.getItem('atelier3-regal3-1-gesehen') === 'ja'; } catch (err) {}
  if (!seen && !sheet.touched) {
    ui.hint.hidden = false;
    requestAnimationFrame(function () { ui.hint.classList.add('is-on'); });
    const dismiss = function () {
      ui.hint.classList.remove('is-on');
      setTimeout(function () { ui.hint.hidden = true; }, 900);
      try { localStorage.setItem('atelier3-regal3-1-gesehen', 'ja'); } catch (err) {}
      canvas.removeEventListener('pointerdown', dismiss);
    };
    canvas.addEventListener('pointerdown', dismiss);
    setTimeout(dismiss, 9000);
  }

  document.body.classList.add('is-ready');
  lastTouch = performance.now();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }
}

/* Für den Testlauf in tools/test-atelier3.js. Die App selbst benutzt nichts
   davon – es ist ein Fenster, kein Bedienelement. */
window.Blatt = {
  SIZE: SIZE, R_DISC: R_DISC, VIEW_MAX: VIEW_MAX,
  sheet: sheet, hand: hand, view: view,
  contactRadius: contactRadius,
  setViewForTest: function (scale, tx, ty) { stopViewAnim(); setView(scale, tx || 0, ty || 0); },
  viewHome: viewHome,
  buildPlan: buildPlan, fieldAt: fieldAt,
  WORLDS: WORLDS,
  makeSheet: function (seed, mode, world) {
    makeSheet(seed, mode, world); buildPigments(); setPigment(0); paint();
  },
  setPigment: setPigment,
  rubPath: function (points, dwell, press) {
    const rgb = current().rgb;
    setBite(press === undefined ? 0.5 : press);
    for (let i = 0; i + 3 < points.length; i += 2) {
      rub(points[i], points[i + 1], points[i + 2], points[i + 3],
          dwell, contactRadius(false), rgb);
    }
    paint();
  },
  meanDensity: function () {
    let sum = 0;
    for (let i = 0; i < sheet.dens.length; i += 7) sum += sheet.dens[i];
    return sum / Math.ceil(sheet.dens.length / 7);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
