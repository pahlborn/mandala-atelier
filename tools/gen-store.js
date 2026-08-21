'use strict';

/* ============================================================================
   Erzeugt die Bildschirmfotos für docs/store.html – die Attrappe der
   Store-Seiten.

     node tools/gen-store.js
     MALSTUDIO=/pfad/zum/malstudio node tools/gen-store.js

   Warum echte Fotos und keine gezeichneten Kästchen: Eine Attrappe, in der
   erfundene Bilder stecken, beantwortet die einzige Frage nicht, für die man
   sie baut – ob das Material trägt. Was hier zu sehen ist, hat die App selbst
   gezeichnet. Sieht ein Foto mager aus, ist die App gemeint, nicht das Foto.

   Die dritte App liegt in einem eigenen Repository. Ohne sie werden die
   beiden hiesigen trotzdem erneuert; der fehlende Teil wird gemeldet, nicht
   geraten.

     node tools/gen-store.js --einreichen

   Ohne Zusatz entstehen die Bilder für die Attrappe, mit `--einreichen` die
   für App Store Connect. Was das eine vom anderen unterscheidet, steht bei
   den Maßen weiter unten.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const ROOT = path.join(__dirname, '..');
const BILDER = path.join(ROOT, 'docs', 'store');
const MALSTUDIO = process.env.MALSTUDIO ||
  path.join(ROOT, '..', 'malstudio');

/* Zwei Maße, und nur eines davon liegt im Repository.

   Ohne Zusatz entstehen die Bilder für docs/store.html: 1194 × 834 bei 1,5 –
   das Maß, auf dem entwickelt wird, als WebP und leicht genug für eine Seite,
   die der Worker bei jedem Öffnen frisch holt.

   Mit `--einreichen` entsteht das, was App Store Connect annimmt: 2752 × 2064,
   also ein iPad 13" quer, als JPEG. Ein Satz genügt für alle iPads – Apple
   rechnet ihn für mini und Air herunter, es braucht kein Bild je Gerät. WebP
   nimmt der Store nicht, und ein Alphakanal ist verboten; JPEG hat von Haus
   aus keinen. Diese Bilder landen in docs/store/einreichen/ und bleiben
   ungespeichert (.gitignore): Sie wiegen ein Vielfaches und werden erst
   gebraucht, wenn wirklich eingereicht wird. */
const EINREICHEN = process.argv.indexOf('--einreichen') > -1;

const BREITE = EINREICHEN ? 1376 : 1194;
const HOEHE  = EINREICHEN ? 1032 : 834;
const SKALA  = EINREICHEN ? 2 : 1.5;
const GUETE = 0.82;

const ZIEL = EINREICHEN ? path.join(BILDER, 'einreichen') : BILDER;
const ENDUNG = EINREICHEN ? '.jpg' : '.webp';

/* Ein Bildschirmfoto kommt als PNG aus dem Browser und wiegt bei diesem Maß
   ein halbes Megabyte. Die Seite holt der Worker bei jedem Öffnen frisch aus
   dem Netz – deshalb WebP, wie im Katalog. Umgerechnet wird im Browser, damit
   keine weitere Abhängigkeit dazukommt. */
async function alsWebp(ctx, png) {
  const seite = await ctx.newPage();
  const daten = 'data:image/png;base64,' + png.toString('base64');
  const webp = await seite.evaluate(function (uri) {
    return new Promise(function (fertig) {
      const img = new Image();
      img.onload = function () {
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        fertig(cv.toDataURL('image/webp', window.__guete));
      };
      img.src = uri;
    });
  }, daten, { });
  await seite.close();
  return Buffer.from(webp.slice(webp.indexOf(',') + 1), 'base64');
}

function ablegen(name, buffer) {
  fs.writeFileSync(path.join(ZIEL, name.replace(/\.webp$/, ENDUNG)), buffer);
  return Math.round(buffer.length / 1024);
}

function warte(seite, ms) {
  return seite.waitForTimeout(ms);
}

(async function () {
  fs.mkdirSync(ZIEL, { recursive: true });

  const browser = await launch();
  const ctx = await browser.newContext({
    viewport: { width: BREITE, height: HOEHE },
    deviceScaleFactor: SKALA,
    colorScheme: 'light'
  });
  await ctx.addInitScript(function (g) { window.__guete = g; }, GUETE);

  const bericht = [];

  async function schuss(seite, name) {
    const bild = EINREICHEN
      ? await seite.screenshot({ type: 'jpeg', quality: 92 })
      : await alsWebp(ctx, await seite.screenshot({ type: 'png' }));
    const kb = ablegen(name, bild);
    bericht.push(name.replace(/\.webp$/, ENDUNG) + '  ' + kb + ' kB');
  }

  /* ---- Mandala Atelier -------------------------------------------------- */
  const atelier = await ctx.newPage();
  await atelier.goto('file://' + path.join(ROOT, 'index.html'));
  await atelier.waitForFunction('window.MandalaAtelier');

  /* Ein Motiv, ausgemalt wie von Hand: Ring für Ring eine andere Farbe.
     Ein leeres Blatt wäre ehrlich, aber es zeigt nichts. */
  await atelier.evaluate(function (arg) {
    const A = window.MandalaAtelier;
    A.loadMotif(arg.motiv);
    if (arg.palette) A.setPalette(arg.palette);
    const farben = A.pigments().map(function (p) { return p.hex || p; });
    const step = (Math.PI * 2) / 12;
    const radien = [80, 150, 220, 290, 350, 400];
    radien.forEach(function (r, i) {
      const farbe = farben[(i + 1) % farben.length];
      for (let w = 0; w < 24; w++) {
        const p = A.pol(r, -Math.PI / 2 + (w + 0.4) * step / 2);
        A.floodFill(p[0], p[1], farbe);
      }
    });
  }, { motiv: 'bluete', palette: null });
  await warte(atelier, 400);
  await schuss(atelier, 'atelier-1.webp');

  /* Zweites Foto: ein anderes Motiv, andere Farbwelt. */
  await atelier.evaluate(function () {
    const A = window.MandalaAtelier;
    A.loadMotif('kuppel');
    const farben = A.pigments().map(function (p) { return p.hex || p; });
    const step = (Math.PI * 2) / 16;
    [110, 190, 265, 330, 395].forEach(function (r, i) {
      for (let w = 0; w < 32; w++) {
        const p = A.pol(r, -Math.PI / 2 + (w + 0.45) * step / 2);
        A.floodFill(p[0], p[1], farben[(i * 2 + 1) % farben.length]);
      }
    });
  });
  await warte(atelier, 400);
  await schuss(atelier, 'atelier-2.webp');

  /* Drittes Foto: dieselbe App im Dunkeln – das gibt es wirklich und
     gehört auf eine Store-Seite. */
  await atelier.emulateMedia({ colorScheme: 'dark' });
  await atelier.evaluate(function () {
    const t = document.getElementById('btn-theme');
    if (t) t.click();
  });
  await warte(atelier, 500);
  await schuss(atelier, 'atelier-3.webp');
  await atelier.close();

  /* ---- Blatt ------------------------------------------------------------ */
  const blatt = await ctx.newPage();
  await blatt.goto('file://' + path.join(ROOT, 'atelier3', 'index.html'));
  await blatt.waitForFunction('window.Blatt');

  /* Die Hand. Zwei Arten, ein Blatt hervorzuholen:

     `bahnen` – quer darüber, wie beim ersten Prüfen, ob überhaupt etwas
     kommt. Eine Farbe, sonst legen sich waagerechte Farbstreifen über ein
     rundes Muster, und das sieht nach Maschine aus, weil es eine war.

     `ringe` – im Kreis, wie jemand malt, der das Muster schon sieht. Hier
     darf die Farbe von Ring zu Ring wechseln: Sie folgt dann der Ordnung
     des Blattes statt quer darüber zu laufen. */
  async function reiben(seite, arg) {
    await seite.evaluate(function (a) {
      const B = window.Blatt;
      const S = B.SIZE, C = S / 2;

      if (a.ringe) {
        for (let i = 0; i < a.ringe; i++) {
          const r = S * (0.06 + 0.44 * i / (a.ringe - 1));
          if (a.wechsel) B.setPigment(Math.floor(i / 2) % a.wechsel);
          const punkte = [];
          for (let t = 0; t <= 64; t++) {
            const w = t / 64 * Math.PI * 2;
            punkte.push(C + Math.cos(w) * r, C + Math.sin(w) * r);
          }
          B.rubPath(punkte, a.druck);
        }
        return;
      }

      for (let i = 0; i < a.bahnen; i++) {
        const y = S * (0.06 + 0.88 * i / (a.bahnen - 1));
        const punkte = [];
        for (let x = 0; x <= S; x += S / 40) {
          punkte.push(x, y + Math.sin(x / S * 6) * 6);
        }
        B.rubPath(punkte, a.druck);
      }
    }, arg);
    await warte(seite, 200);
  }

  await blatt.evaluate(function () {
    window.Blatt.makeSheet(20260820, 'ruhe');
  });
  await reiben(blatt, { bahnen: 26, druck: 0.35 });
  await schuss(blatt, 'blatt-1.webp');

  await blatt.evaluate(function () {
    window.Blatt.makeSheet(20260304, 'bluete');
  });
  await reiben(blatt, { ringe: 22, druck: 0.8, wechsel: 4 });
  await schuss(blatt, 'blatt-2.webp');

  /* Drittes Foto: das Fach, in dem die Blätter liegen. */
  try {
    await blatt.evaluate(function () { window.Blatt.openLade(); });
    /* Die Vorschauen im Fach rechnen sich nach und nach heraus. Zu früh
       abgedrückt, zeigt das Foto halb fertige Blätter. */
    await warte(blatt, 2500);
    await schuss(blatt, 'blatt-3.webp');
  } catch (err) {
    bericht.push('blatt-3.webp  ausgelassen (' + err.message + ')');
  }
  await blatt.close();

  /* ---- Malstudio (eigenes Repository) ----------------------------------- */
  const malIndex = path.join(MALSTUDIO, 'index.html');
  if (!fs.existsSync(malIndex)) {
    bericht.push('Malstudio übersprungen – nicht gefunden unter ' + MALSTUDIO);
  } else {
    const mal = await ctx.newPage();
    await mal.goto('file://' + malIndex);
    await warte(mal, 800);

    /* Ein Kind anlegen und auswählen, sonst steht die App auf
       „Wer malt heute?" – und ein leerer Auswahlbildschirm ist das
       Uninteressanteste, was die App zu zeigen hat. */
    try {
      await mal.locator('.pcard.new').click();
      await warte(mal, 300);
      await mal.locator('#pname').fill('Mia');
      const avatar = mal.locator('#avatars button').first();
      if (await avatar.count()) await avatar.click();
      await mal.locator('#pcreate').click();
      await warte(mal, 600);
      await mal.locator('.pcard:not(.new)').first().click();
      await warte(mal, 900);
    } catch (err) {
      bericht.push('Malstudio: Profil nicht angelegt (' + err.message + ')');
    }

    await schuss(mal, 'malstudio-1.webp');

    /* Ein Motiv öffnen – und wirklich hineinmalen. Ein leeres weißes Blatt
       zeigt die Oberfläche, aber nicht die App: Was diese App ausmacht, ist
       die Linie, die unter der Hand glatt wird. Also fährt die Maus das
       Herz nach, wie es ein Kind täte. */
    try {
      await mal.locator('#picker button').first().click();
      await warte(mal, 1200);

      const rot = mal.locator('#colors button').nth(18);
      if (await rot.count()) { await rot.click(); await warte(mal, 200); }

      const pad = await mal.locator('#pad').boundingBox();
      if (pad) {
        const cx = pad.x + pad.width / 2;
        const cy = pad.y + pad.height * 0.52;
        const k = Math.min(pad.width, pad.height) / 42;
        /* Erst an den Anfang der Kurve, dann aufsetzen – sonst zieht der
           Weg vom Aufsetzpunkt zum Kurvenanfang einen Strich quer durchs
           Herz. */
        for (let t = 0; t <= 120; t++) {
          const w = -Math.PI / 2 + t / 120 * Math.PI * 2;
          /* Die bekannte Herzkurve – 16 sin³ waagerecht, die Kosinusreihe
             senkrecht. Von unten herum, damit der Zug dort beginnt, wo die
             Aufgabe es sagt. */
          const x = 16 * Math.pow(Math.sin(w), 3);
          const y = -(13 * Math.cos(w) - 5 * Math.cos(2 * w)
                      - 2 * Math.cos(3 * w) - Math.cos(4 * w));
          await mal.mouse.move(cx + x * k, cy + y * k);
          if (t === 0) await mal.mouse.down();
        }
        await mal.mouse.up();
        await warte(mal, 600);
      }

      await schuss(mal, 'malstudio-2.webp');
    } catch (err) {
      bericht.push('Malstudio: Motiv nicht bemalt (' + err.message + ')');
    }

    /* Drittes Foto: der zweite Modus. „Ausmalen" legt den fertigen Umriss
       vor, und ein Tippen füllt ein Feld – das ist etwas anderes als
       Nachmalen und gehört deshalb auf eine eigene Tafel. Die Schatzinsel
       wäre das buntere Motiv, sie ist aber verschlossen, bis zwanzig Bilder
       gemalt sind; ein Foto davon müsste man sich erschleichen. */
    try {
      if (await mal.locator('#home-btn').isVisible()) {
        await mal.locator('#home-btn').click();
        await warte(mal, 700);
      }
      await mal.locator('#modeColor').click();
      await warte(mal, 500);
      await mal.locator('#picker button').filter({ hasText: 'Fisch' }).first().click();
      await warte(mal, 1200);

      await mal.locator('#tFill').click();
      await warte(mal, 200);

      const pad = await mal.locator('#pad').boundingBox();
      if (pad) {
        const cx = pad.x + pad.width / 2, cy = pad.y + pad.height / 2;
        /* Fünf Tupfer: Körper, Flossen, Auge – und einer oben links, der
           das Wasser ringsum färbt. Der zuletzt gesetzte liegt hinten, also
           steht er hier als letzter und bekommt ein helles Blau. */
        const tupfer = [
          [0, -0.10, 10], [-0.16, 0.02, 24], [0.16, 0.04, 2],
          [0, 0.16, 16], [-0.05, -0.28, 3]
        ];
        for (const t of tupfer) {
          const farbe = mal.locator('#colors button').nth(t[2]);
          if (await farbe.count()) await farbe.click();
          await mal.mouse.click(cx + t[0] * pad.width, cy + t[1] * pad.height);
          await warte(mal, 250);
        }
      }
      await warte(mal, 400);
      await schuss(mal, 'malstudio-3.webp');
    } catch (err) {
      bericht.push('Malstudio: Ausmalen nicht gezeigt (' + err.message + ')');
    }

    await mal.close();
  }

  await browser.close();

  console.log('Bildschirmfotos in ' + path.relative(ROOT, ZIEL) + '/  (' +
              (BREITE * SKALA) + ' × ' + (HOEHE * SKALA) + ')');
  bericht.forEach(function (z) { console.log('  ' + z); });
})();
