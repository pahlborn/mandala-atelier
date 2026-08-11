'use strict';

/* ============================================================================
   Beispielbilder für die Arbeitsseite PA-APPS.html.

     npm install
     node tools/gen-schaufenster.js

   Die Bilder landen in pa-apps/ und heißen <app>-<szene>-<gerät>.png.

   Warum ein Werkzeug und keine Bilder von Hand: Die Aufnahmen sollen bei
   jeder Änderung an einer App neu entstehen können, ohne dass jemand ein
   iPad holt. Und ein leerer Startbildschirm zeigt bei diesen Apps nichts –
   das Blatt ist ja absichtlich leer. Deshalb bedient das Skript die Apps
   erst ein wenig und drückt dann ab.

   Malstudio liegt in einem eigenen Repo. Standardmäßig wird es neben diesem
   Ordner gesucht (../malstudio), sonst:

     MALSTUDIO=/pfad/zu/malstudio node tools/gen-schaufenster.js

   Fehlt es, entstehen die anderen Bilder trotzdem – nur die des Malstudios
   bleiben, wie sie sind.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const WURZEL = path.join(__dirname, '..');
const ZIEL = path.join(WURZEL, 'pa-apps');

const MALSTUDIO = process.env.MALSTUDIO || path.join(WURZEL, '..', 'malstudio');

/* Zwei Geräte, weil die Apple-Vorschau beides verlangt: Telefon hochkant,
   Tablet quer. Die Maße entsprechen iPhone 15/16 und iPad 11". */
const GERAETE = [
  { name: 'iphone', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 },
  { name: 'ipad', viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2 }
];

/* --------------------------------------------------------------------------
   Kleine Helfer
   -------------------------------------------------------------------------- */

/* Ein Strich über die Zeichenfläche. Bewusst über echte Zeigerereignisse und
   in vielen kleinen Schritten – beide Apps zeichnen entlang der Bewegung,
   ein Sprung von A nach B ergäbe eine gerade Linie oder gar nichts. */
async function strich(page, von, nach, schritte) {
  schritte = schritte || 24;
  await page.mouse.move(von.x, von.y);
  await page.mouse.down();
  for (let i = 1; i <= schritte; i++) {
    const t = i / schritte;
    await page.mouse.move(von.x + (nach.x - von.x) * t, von.y + (nach.y - von.y) * t);
  }
  await page.mouse.up();
  await page.waitForTimeout(60);
}

/* Ein Zug entlang einer Kurve. Gerade Striche quer über ein Blatt sehen auf
   einer Produktseite nach Gekritzel aus; ein Bogen sieht nach Absicht aus. */
async function zug(page, punkte) {
  if (!punkte.length) return;
  await page.mouse.move(punkte[0].x, punkte[0].y);
  await page.mouse.down();
  for (const p of punkte.slice(1)) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

async function kasten(page, wahl) {
  const el = await page.$(wahl);
  if (!el) return null;
  return el.boundingBox();
}

/* Beide Apps halten Bedienelemente vorrätig im Markup und blenden sie nur
   ein, wenn sie an der Reihe sind. Ein Klick auf ein verstecktes Element
   würde dreißig Sekunden lang warten und dann den Lauf abbrechen – deshalb
   wird hier grundsätzlich erst nach Sichtbarkeit gefragt. */
async function klick(page, wahl) {
  const el = await page.$(wahl);
  if (!el || !(await el.isVisible())) return false;
  await el.click();
  await page.waitForTimeout(400);
  return true;
}

/* Genauer Text. */
async function tippe(page, text) {
  return klick(page, 'text=' + JSON.stringify(text));
}

/* Text irgendwo im Knopf. Die Motivknöpfe im Malstudio heißen „🐚Muschel“ –
   auf genauen Text zu prüfen ginge dort ins Leere. */
async function tippeTeil(page, text) {
  return klick(page, 'text=' + text);
}

/* JPEG, nicht PNG: Beide Ateliers zeichnen eine Papierkörnung, und die ist
   für PNG der schlimmste Fall – ein einziger Bogen wog zwei Megabyte. Als
   JPEG bleibt von den Aufnahmen ein Zehntel übrig, sichtbar ist kein
   Unterschied. Für eine Seite, die auch unterwegs aufgehen soll, zählt das. */
function ablegen(page, app, szene, geraet) {
  const datei = path.join(ZIEL, app + '-' + szene + '-' + geraet + '.jpg');
  return page.screenshot({ path: datei, type: 'jpeg', quality: 82 }).then(function () {
    const kb = Math.round(fs.statSync(datei).size / 1024);
    console.log('  ' + path.relative(WURZEL, datei) + '  (' + kb + ' kB)');
  });
}

/* --------------------------------------------------------------------------
   Mandala Atelier – ein Motiv einfärben

   Gefüllt wird über das Werkzeug „Füllen“: ein Tippen setzt Farbe in ein Feld
   und, weil die App spiegelt, zugleich in alle übrigen Segmente. Das ist der
   Kern der App und deshalb genau das, was ein Beispielbild zeigen soll.
   -------------------------------------------------------------------------- */
async function mandala(page, geraet) {
  await page.waitForTimeout(1200);

  const buehne = await kasten(page, '#drawCanvas');
  if (!buehne) { console.log('  (Mandala: keine Zeichenfläche gefunden)'); return; }

  const mx = buehne.x + buehne.width / 2;
  const my = buehne.y + buehne.height / 2;
  const r = Math.min(buehne.width, buehne.height) / 2;

  await tippe(page, 'Füllen');

  /* Farbe, Radius, Winkel. Die Radien liegen so, dass sie die Ringe des
     Motivs treffen und nicht auf einer Linie landen. */
  const striche = [
    [2, 0.86, 0.26], [5, 0.66, 0.00], [0, 0.50, 0.26],
    [3, 0.34, 0.13], [8, 0.18, 0.00], [1, 0.95, 0.13]
  ];

  const farben = await page.$$('.quick-colors button, .quick-colors .swatch');

  for (const [farbe, anteil, versatz] of striche) {
    if (farben[farbe]) { await farben[farbe].click(); await page.waitForTimeout(120); }
    const winkel = -Math.PI / 2 + versatz;
    await page.mouse.click(mx + Math.cos(winkel) * r * anteil, my + Math.sin(winkel) * r * anteil);
    await page.waitForTimeout(180);
  }

  /* Zum Schluss ein paar eigene Striche mit dem Stift – sie zeigen, dass
     hier nicht nur ausgemalt, sondern gezeichnet wird. */
  await tippe(page, 'Stift');
  if (farben[7]) await farben[7].click();
  await strich(page, { x: mx + r * 0.30, y: my - r * 0.62 }, { x: mx + r * 0.52, y: my - r * 0.30 });
  await strich(page, { x: mx + r * 0.52, y: my - r * 0.30 }, { x: mx + r * 0.30, y: my - r * 0.06 });

  await page.waitForTimeout(700);
  await ablegen(page, 'mandala', 'werkstatt', geraet);

  /* Zweite Aufnahme: die Motivlade offen. Sie beantwortet die Frage, die auf
     der Produktseite als Erstes kommt – „was ist denn drin?“ */
  if (await tippe(page, 'Motive')) {
    await page.waitForTimeout(900);
    await ablegen(page, 'mandala', 'motive', geraet);
  }
}

/* --------------------------------------------------------------------------
   Blatt – das Relief hervorreiben

   Hier wird nichts vervielfältigt: Man streicht über ein leeres Blatt, und
   darunter kommt eine Zeichnung zum Vorschein. Ein Bild davon braucht viele
   Striche, sonst ist die Fläche noch fast weiß.
   -------------------------------------------------------------------------- */
async function blatt(page, geraet) {
  await page.waitForTimeout(1400);

  const bogen = await kasten(page, '#sheet');
  if (!bogen) { console.log('  (Blatt: kein Bogen gefunden)'); return; }

  /* Ein kräftiges Pigment, sonst bleibt die Aufnahme fast weiß. */
  const pigmente = await page.$$('#pigments button');
  if (pigmente[6]) { await pigmente[6].click(); await page.waitForTimeout(200); }

  const links = bogen.x + bogen.width * 0.06;
  const rechts = bogen.x + bogen.width * 0.94;
  const oben = bogen.y + bogen.height * 0.08;
  const unten = bogen.y + bogen.height * 0.92;

  /* Bahnen von oben nach unten, abwechselnd hin und zurück – so, wie eine
     Hand es täte. Und das Ganze mehrmals: Die App trägt pro Zug absichtlich
     nur wenig auf, das Bild kommt erst beim wiederholten Reiben hervor. Ein
     einzelner Durchgang ergab einen fast leeren Bogen. */
  const bahnen = 26;
  for (let durchgang = 0; durchgang < 3; durchgang++) {
    for (let i = 0; i <= bahnen; i++) {
      const y = oben + (unten - oben) * (i / bahnen);
      const vorwaerts = i % 2 === 0;
      await strich(page,
        { x: vorwaerts ? links : rechts, y: y },
        { x: vorwaerts ? rechts : links, y: y },
        26);
    }
  }

  await page.waitForTimeout(900);
  await ablegen(page, 'blatt', 'werkstatt', geraet);

  /* Zweite Aufnahme: die Blattlade – wonach einem heute ist, welche Pigmente,
     welches Blatt. Sie liegt hinter der kleinen Marke in der Ecke; die App
     hält sich zurück, solange gearbeitet wird.

     Nicht der Stapel („Blätter“): der ist bei einem frischen Start leer und
     zeigte auf der Aufnahme nur „Noch nichts weggelegt.“ */
  if (await klick(page, '#mark')) {
    await page.waitForTimeout(500);
    if (await klick(page, '#tray-new')) {
      await page.waitForTimeout(1200);
      await ablegen(page, 'blatt', 'lade', geraet);
    }
  }
}

/* --------------------------------------------------------------------------
   Malstudio – ein Kind anlegen, ein Motiv wählen, losmalen

   Die App fragt beim ersten Start nach einem Kind. Ohne diesen Schritt kommt
   man nicht zur Motivauswahl, und ein Bild vom leeren Anmeldebildschirm hilft
   niemandem.
   -------------------------------------------------------------------------- */
async function malstudio(page, geraet) {
  await page.waitForTimeout(1200);

  if (await tippe(page, 'Neues Kind')) {
    const feld = await page.$('#pname');
    if (feld && await feld.isVisible()) { await feld.click(); await feld.fill('Mia'); }
    await tippe(page, '🐬');
    await klick(page, '#pcreate');
    await page.waitForTimeout(1200);
  }

  /* Anlegen allein bringt einen nicht weiter – die Karte will noch
     angetippt werden, sonst bleibt die App im „Wer malt heute?“ stehen. */
  await tippeTeil(page, 'Mia');
  await page.waitForTimeout(1200);

  await ablegen(page, 'malstudio', 'auswahl', geraet);

  /* In die Malansicht. Welches Motiv, ist gleich – „Muschel“ ist eines der
     leichten und sieht auf halbem Weg schon nach etwas aus. */
  if (!(await tippeTeil(page, 'Muschel'))) {
    console.log('  (Malstudio: kein Motiv gefunden)');
    return;
  }
  await page.waitForTimeout(1500);

  const pad = await kasten(page, '#pad');
  if (pad) {
    const mx = pad.x + pad.width / 2;
    const my = pad.y + pad.height / 2;
    const w = pad.width, h = pad.height;

    /* Schritt 1 der Muschel heißt „Zwei Bögen, die sich unten treffen“ –
       also genau das malen. Eine Parabel von links unten nach rechts, und
       darüber eine flachere als Andeutung der zweiten Schale. */
    const parabel = function (breite, hoehe, tiefe) {
      const punkte = [];
      for (let i = 0; i <= 40; i++) {
        const t = -1 + (2 * i) / 40;
        punkte.push({ x: mx + t * w * breite, y: my + hoehe * h + (1 - t * t) * h * tiefe });
      }
      return punkte;
    };

    await zug(page, parabel(0.26, -0.16, 0.30));
    await zug(page, parabel(0.17, -0.13, 0.20));
  }

  await page.waitForTimeout(800);
  await ablegen(page, 'malstudio', 'malen', geraet);
}

/* --------------------------------------------------------------------------
   Durchlauf
   -------------------------------------------------------------------------- */

const APPS = [
  { name: 'Mandala Atelier', datei: path.join(WURZEL, 'index.html'), lauf: mandala },
  { name: 'Blatt', datei: path.join(WURZEL, 'atelier3', 'index.html'), lauf: blatt },
  { name: 'Malstudio', datei: path.join(MALSTUDIO, 'index.html'), lauf: malstudio }
];

async function main() {
  fs.mkdirSync(ZIEL, { recursive: true });

  const browser = await launch();
  let fehlend = 0;

  for (const app of APPS) {
    if (!fs.existsSync(app.datei)) {
      console.log('\n' + app.name + ': nicht gefunden unter ' + app.datei + ' – übersprungen.');
      fehlend++;
      continue;
    }

    for (const geraet of GERAETE) {
      console.log('\n' + app.name + ' (' + geraet.name + ')');
      const page = await browser.newPage({
        viewport: geraet.viewport,
        deviceScaleFactor: geraet.deviceScaleFactor,
        hasTouch: true,
        isMobile: geraet.name === 'iphone',
        locale: 'de-DE',
        colorScheme: 'light'
      });

      /* Die Apps sprechen und spielen Musik. Beim Aufnehmen stört das nicht,
         aber die Sprachausgabe kann den Ablauf verzögern – deshalb stumm. */
      await page.addInitScript(function () {
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
      });

      const fehler = [];
      page.on('pageerror', function (err) { fehler.push(err.message); });

      await page.goto('file://' + app.datei, { waitUntil: 'load' });
      await app.lauf(page, geraet.name);

      if (fehler.length) console.log('  Hinweis – Fehler auf der Seite: ' + fehler[0]);
      await page.close();
    }
  }

  await browser.close();

  console.log('\nFertig. Bilder liegen in ' + path.relative(WURZEL, ZIEL) + '/');
  if (fehlend) {
    console.log('Übersprungen: ' + fehlend + ' App(s). Für Malstudio ggf. MALSTUDIO=… setzen.');
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
