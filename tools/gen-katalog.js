'use strict';

/* ============================================================================
   Erzeugt docs/katalog.html – was wirklich in den beiden Apps steht.

     node tools/gen-katalog.js

   Die dritte Schautafel, und die einzige, die nicht von Hand gezeichnet ist.
   Auf docs/motive.html und docs/moderne.html stehen **mögliche** Ordnungen,
   als Schemata. Hier stehen die **vorhandenen** – und zwar so, wie die App
   sie zeichnet.

   Das ist der Grund, warum dieses Werkzeug einen echten Browser startet statt
   die Motive nachzuzeichnen: Eine nachgezeichnete Tafel wäre ab dem ersten
   geänderten Motiv gelogen, und niemand merkte es. Hier wird `loadMotif()`
   aufgerufen und das Ergebnis abfotografiert. Weicht die Tafel von der App
   ab, ist die App gemeint.

   Aus demselben Grund kommen Name, Notiz, Achsenzahl und Zonen aus dem
   Datensatz selbst, nicht aus einer zweiten Liste hier. Beschrieben wird von
   Hand nur, was im Code nicht steht: woher eine Ordnung kommt und wofür eine
   Welt gedacht ist.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const BILDER = path.join(ROOT, 'docs', 'katalog');
const PX = 300;                  // Kantenlänge je Abbildung

/* Die Bilder liegen als eigene Dateien daneben, nicht als Daten-URI in der
   Seite. Der erste Anlauf hatte alles eingebettet und wog 2 MB — bei einer
   Seite, die der Worker bei jedem Öffnen frisch aus dem Netz holt, ist das
   respektlos gegenüber einem Mobilfunkvertrag. So wiegt die Seite 20 kB, und
   geladen wird nur, was man wirklich ansieht (`loading="lazy"`).

   WebP statt PNG: gemessen an einer Vorlage 23 kB gegen 56 kB, bei
   Strichzeichnung auf Papier ohne sichtbaren Unterschied. */
function schreibeBild(name, datenUri) {
  const b64 = datenUri.slice(datenUri.indexOf(',') + 1);
  fs.writeFileSync(path.join(BILDER, name), Buffer.from(b64, 'base64'));
}

/* Was die Welten sollen. Steht nirgends im Code – dort stehen nur Titel. */
const WELTEN = {
  geo: 'Die Grundlage. Ring, Speiche, Blatt, Raute, Band — aus diesen ' +
       'Bausteinen besteht auch alles andere. Wer hier anfängt, lernt ' +
       'nebenbei, was das Symmetriewerkzeug tut.',
  natur: 'Gewachsene Ordnung: Blüten, Blätter, Spiralen, Samen. Weichere ' +
         'Kurven, unregelmäßigere Felder — und darum das, was am ehesten ' +
         'nach Zeichnung und am wenigsten nach Konstruktion aussieht.',
  zen: 'Wenig, und das mit Ruhe. Große, klare Felder, wenige Achsen, keine ' +
       'Verflechtung. Gedacht für die Viertelstunde, in der man nichts ' +
       'entscheiden möchte.',
  jahr: 'Vier Blätter mit einer Jahreszeit als Vorwand. Sie sind nicht ' +
        'strenger oder freier als die anderen — sie geben nur einen Anlass, ' +
        'zu einer bestimmten Farbwelt zu greifen.',
  anlage: 'Das Mandala als **Grundriss**, nicht als Muster. Von außen nach ' +
          'innen: Schutzbereich, Vorhöfe, Tore, Mauern, Kammer, Mitte. Dazu ' +
          'gehört die gestaffelte Symmetrie — die Achsenzahl hängt davon ab, ' +
          '*wo* die Hand aufsetzt, nicht nur davon, was eingestellt ist. Die ' +
          'Vorbilder stehen auf der [Schautafel der Motivfamilien](motive.html); ' +
          'übernommen ist jeweils die Ordnung, nicht die Bedeutung.',
  kids: 'Sehr große Felder und wenige Achsen für kleine Hände, dazu Zähl- ' +
        'und Rechenmandalas mit einer Aufgabe über dem Blatt. Bedient wird ' +
        'das von Eltern und Lehrkräften — deshalb kein Kinder-Look, sondern ' +
        'dieselbe ruhige Oberfläche wie sonst.'
};

/* Herkunft, wo es eine gibt. Nur da, wo wirklich etwas dahintersteht. */
const HERKUNFT = {
  anlage:     'Tibetischer Palastgrundriss',
  ringanlage: 'Kalachakra: die äußeren Ringe',
  garten:     'Chahar Bagh, persischer Paradiesgarten',
  stern:      'Sternfestung der Renaissance, Palmanova',
  raster:     'Vastu Purusha Mandala, Indien',
  stufen:     'Borobudur, Java',
  torstadt:   'Srirangam, südindische Tempelstadt',
  kuppel:     'Kassettenkuppel, von unten gesehen'
};

function schütze(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function schmuck(s) {
  return schütze(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+?)\*/g, '$1<em>$2</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

const CSS = `
*, *::before, *::after { box-sizing: border-box; }
:root {
  --room:#efe9dd; --card:#f8f4ea; --ink:#2f2a22; --quiet:#6d6355;
  --edge:rgba(60,48,32,0.16);
}
@media (prefers-color-scheme: dark) {
  :root { --room:#16151a; --card:#201f25; --ink:#e8e2d6; --quiet:#9a9287;
          --edge:rgba(0,0,0,0.5); }
}
html { -webkit-text-size-adjust:100%; }
body {
  margin:0; background:var(--room); color:var(--ink);
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  line-height:1.6; -webkit-font-smoothing:antialiased;
  padding: clamp(24px,6vw,64px) clamp(18px,5vw,40px)
           calc(clamp(24px,6vw,64px) + env(safe-area-inset-bottom));
}
main { max-width:62rem; margin:0 auto; }
h1 { margin:0 0 .15em; font-family:ui-serif,'Iowan Old Style',Georgia,serif;
     font-weight:500; font-size:clamp(28px,6vw,40px); letter-spacing:-.01em; }
.lede { margin:0 0 2.2rem; color:var(--quiet); max-width:44rem; }
h2 { margin:2.8rem 0 .4rem; font-size:14px; font-weight:600; letter-spacing:.08em;
     text-transform:uppercase; color:var(--quiet);
     border-top:1px solid var(--edge); padding-top:1.2rem; }
.wozu { margin:0 0 1.2rem; font-size:14.5px; color:var(--quiet); max-width:44rem; }
.tafel { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); }
.karte { background:var(--card); border-radius:16px; padding:16px;
         box-shadow:0 1px 2px var(--edge), 0 10px 28px -16px var(--edge); }
.karte img { display:block; width:100%; height:auto; border-radius:10px;
             margin-bottom:12px; background:#fff; }
.karte h3 { margin:0; font-size:16.5px; font-weight:600; }
.karte .note { margin:0 0 .5rem; font-size:13.5px; color:var(--quiet); }
.karte dl { margin:0; font-size:13px; color:var(--quiet); }
.karte dt { float:left; clear:left; width:5.2em; font-weight:600; color:var(--ink); }
.karte dd { margin:0 0 .2em 5.2em; }
.hinweis { margin:2.6rem 0 0; padding:16px 18px; border-radius:14px;
           border:1px solid var(--edge); font-size:14.5px; color:var(--quiet); }
.hinweis strong { color:var(--ink); }
.hinweis + .hinweis { margin-top:1rem; }
footer { margin-top:2.4rem; font-size:13.5px; color:var(--quiet); }
a { color:inherit; }
`;

(async function () {
  const browser = await launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });

  /* ---- Die Vorlagen des Ateliers, von der App selbst gezeichnet ---------- */
  const seite = await ctx.newPage();
  await seite.goto('file://' + path.join(ROOT, 'index.html'));
  await seite.waitForFunction('window.MandalaAtelier');

  const atelier = await seite.evaluate(async function (px) {
    const A = window.MandalaAtelier;
    const warte = function () {
      return new Promise(function (r) { requestAnimationFrame(function () {
        requestAnimationFrame(r); }); });
    };
    const raus = [];
    for (const m of A.MOTIFS) {
      A.loadMotif(m.id);
      await warte();
      raus.push({
        id: m.id, welt: m.world, name: m.name, note: m.note || '',
        achsen: m.axes,
        zonen: m.zones ? m.zones.map(function (z) { return z.axes; }) : null,
        bild: A.composeImage(px).toDataURL('image/webp', 0.8)
      });
    }
    return { motive: raus, welten: A.WORLDS, fassung: A.FASSUNG };
  }, PX);

  /* ---- Die Stimmungen von Blatt, ebenfalls echt gerechnet ---------------- */
  const seite2 = await ctx.newPage();
  await seite2.goto('file://' + path.join(ROOT, 'atelier3', 'index.html'));
  await seite2.waitForFunction('window.Blatt');

  const blatt = await seite2.evaluate(function (px) {
    const B = window.Blatt;
    const raus = [];
    B.KINDS.forEach(function (k, i) {
      const plan = B.buildPlan(20250816 + i * 7717, k.id);
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const c = cv.getContext('2d');
      const img = c.createImageData(px, px);
      const d = img.data;
      const C = px / 2, R = C * 0.95;
      for (let y = 0; y < px; y++) {
        for (let x = 0; x < px; x++) {
          const dx = x + 0.5 - C, dy = y + 0.5 - C;
          const rr = Math.sqrt(dx * dx + dy * dy) / R;
          const th = Math.atan2(dy, dx) + Math.PI / 2;
          const h = B.fieldAt(plan, rr, th);
          /* So viel, wie ein paar leichte Züge herausholen. */
          const dicht = 1 - Math.exp(-2 * 0.46 * Math.pow(h, 2.0));
          const o = (y * px + x) * 4;
          d[o]     = Math.round(246 - dicht * 150);
          d[o + 1] = Math.round(242 - dicht * 158);
          d[o + 2] = Math.round(232 - dicht * 156);
          d[o + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      raus.push({ id: k.id, name: k.name, achsen: plan.n,
                  baender: plan.bands.length,
                  bau: plan.bau || null,
                  bild: cv.toDataURL('image/webp', 0.8) });
    });
    return { arten: raus, fassung: B.FASSUNG, bauten: B.BAUTEN.length };
  }, PX);

  await browser.close();

  /* ---- Die Bilder ablegen ---------------------------------------------- */
  fs.rmSync(BILDER, { recursive: true, force: true });
  fs.mkdirSync(BILDER, { recursive: true });
  let bytes = 0;
  atelier.motive.forEach(function (m) {
    schreibeBild(m.id + '.webp', m.bild);
    bytes += m.bild.length * 0.75;
    m.datei = 'katalog/' + m.id + '.webp';
  });
  blatt.arten.forEach(function (k) {
    schreibeBild('blatt-' + k.id + '.webp', k.bild);
    bytes += k.bild.length * 0.75;
    k.datei = 'katalog/blatt-' + k.id + '.webp';
  });

  /* ---- Die Seite ------------------------------------------------------- */
  function karte(m) {
    const zeilen = ['<dt>Achsen</dt><dd>' + m.achsen + '</dd>'];
    if (m.zonen) {
      zeilen.push('<dt>Zonen</dt><dd>' + m.zonen.join(' · ') + ' — von innen nach außen</dd>');
    }
    if (HERKUNFT[m.id]) {
      zeilen.push('<dt>Vorbild</dt><dd>' + schütze(HERKUNFT[m.id]) + '</dd>');
    }
    return '<article class="karte">' +
      '<img src="' + m.datei + '" alt="' + schütze(m.name) +
        '" width="' + PX + '" height="' + PX + '" loading="lazy" decoding="async">' +
      '<h3>' + schütze(m.name) + '</h3>' +
      (m.note ? '<p class="note">' + schütze(m.note) + '</p>' : '') +
      '<dl>' + zeilen.join('') + '</dl></article>';
  }

  let body = '';
  atelier.welten.forEach(function (w) {
    const drin = atelier.motive.filter(function (m) { return m.welt === w.id; });
    if (!drin.length) return;
    body += '<h2>' + schütze(w.title) + ' · ' + drin.length + ' Vorlagen</h2>\n';
    if (WELTEN[w.id]) body += '<p class="wozu">' + schmuck(WELTEN[w.id]) + '</p>\n';
    body += '<div class="tafel">\n' + drin.map(karte).join('\n') + '\n</div>\n';
  });

  body += '<h2>Blatt · ' + blatt.arten.length + ' Stimmungen</h2>\n';
  body += '<p class="wozu">' + schmuck(
    'Blatt hat **keinen Katalog**. Es gibt kein Motiv zum Auswählen — man ' +
    'nimmt eine Stimmung, und das Blatt wird gewürfelt. Was hier steht, ist ' +
    'also je ein Beispiel, nicht die Vorlage selbst: Beim nächsten Mal sieht ' +
    'es anders aus. Gezeigt ist das Relief so, wie es nach ein paar leichten ' +
    'Zügen aussähe. Die Stimmung „Anlage“ zieht dabei eine von ' +
    blatt.bauten + ' Grammatiken — die stehen auf der ' +
    '[eigenen Tafel](../docs/anlage-blatt-acht.png).') + '</p>\n';
  body += '<div class="tafel">\n' + blatt.arten.map(function (k) {
    return '<article class="karte">' +
      '<img src="' + k.datei + '" alt="' + schütze(k.name) +
        '" width="' + PX + '" height="' + PX + '" loading="lazy" decoding="async">' +
      '<h3>' + schütze(k.name) + '</h3>' +
      '<p class="note">ein gewürfeltes Beispiel</p>' +
      '<dl><dt>Achsen</dt><dd>' + k.achsen + '</dd>' +
      '<dt>Bänder</dt><dd>' + k.baender + '</dd>' +
      (k.bau ? '<dt>Grammatik</dt><dd>' + schütze(k.bau) + ' (diesmal)</dd>' : '') +
      '</dl></article>';
  }).join('\n') + '\n</div>\n';

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Katalog</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Alle Vorlagen beider Apps, von den Apps selbst gezeichnet.">
<meta name="theme-color" content="#efe9dd" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16151a" media="(prefers-color-scheme: dark)">
<link rel="icon" href="../beide-icon-192.png">

<!-- Erzeugt von tools/gen-katalog.js — nicht von Hand ändern. -->

<style>${CSS}</style>
</head>
<body>
<main>

  <h1>Katalog</h1>
  <p class="lede">Alle ${atelier.motive.length} Vorlagen des Mandala Ateliers
     und die ${blatt.arten.length} Stimmungen von Blatt — nebeneinander, um sie
     einmal ohne Durchtippen zu sehen.</p>

  <p class="hinweis">
    <strong>Diese Tafel ist nicht gezeichnet, sondern abfotografiert.</strong>
    Auf den beiden Schwesterseiten — <a href="motive.html">Motivfamilien</a>
    und <a href="moderne.html">Moderne</a> — stehen <em>mögliche</em> Ordnungen
    als Schemata von Hand. Hier laufen die Apps selbst: Jedes Bild entsteht,
    indem das Motiv wirklich geladen und die Zeichenfläche ausgelesen wird.
    Eine nachgezeichnete Tafel wäre ab dem ersten geänderten Motiv gelogen, und
    niemand merkte es. Weicht etwas ab, ist die App gemeint.
  </p>

  <p class="hinweis">
    <strong>Was zu sehen ist, ist die leere Vorlage.</strong> Keine Farbe, kein
    Füllstand — so liegt das Blatt da, bevor jemand anfängt. Die Zahlen darunter
    stammen aus dem Datensatz des Motivs, nicht aus einer zweiten Liste: Achsen
    ist die Zähligkeit, Zonen sind die Ringe der gestaffelten Symmetrie mit
    ihrer je eigenen Achsenzahl.
  </p>

${body}
  <p class="hinweis">
    <strong>Stand:</strong> Mandala Atelier ${atelier.fassung}, Blatt
    ${blatt.fassung}. Frühere Fassungen stehen im
    <a href="fassungen.html">Regal</a> und lassen sich dort öffnen.
  </p>

  <footer>
    Zurück zur <a href="../beide.html">Einstiegsseite</a> ·
    <a href="motive.html">Motivfamilien</a> ·
    <a href="moderne.html">Moderne</a> ·
    <a href="fassungen.html">Fassungen</a>
  </footer>

</main>
</body>
</html>
`;

  const ziel = path.join(ROOT, 'docs', 'katalog.html');
  fs.writeFileSync(ziel, html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log('docs/katalog.html: ' + atelier.motive.length + ' Vorlagen, ' +
              blatt.arten.length + ' Stimmungen — Seite ' + kb + ' kB, Bilder ' +
              Math.round(bytes / 1024) + ' kB in docs/katalog/');
})();
