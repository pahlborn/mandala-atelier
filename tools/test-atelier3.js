'use strict';

/* ============================================================================
   Testlauf für Atelier 3.0 – „Blatt“.

     npm install
     node tools/test-atelier3.js

   Geprüft wird nicht, ob es hübsch aussieht – das muss man ansehen. Geprüft
   wird, ob die Zusagen des Entwurfs auch wirklich gelten:

     * Es wird nichts von außen geholt.
     * Die Hand hinterlässt eine Spur, und langsam ist dunkler als schnell.
     * Wiederholung vertieft, sättigt aber und kippt nie ins Schwarze.
     * Was gerieben wurde, ist n-zählig drehsymmetrisch.
     * Das unberührte Papier verrät das Relief fast nicht.
     * Der Handballen malt nicht mit.
     * Es gibt kein Rückgängig, keinen Radierer, kein Werkzeug.
     * Das Blatt bleibt quadratisch, in vier Auflösungen.
     * Ein begonnenes Blatt liegt nach einem Neustart noch da.

   Hinweis zur Auswertung: Meldungen zum Service Worker sind beim Öffnen über
   file:// normal – ohne Origin lässt er sich nicht registrieren.
   ========================================================================== */

const path = require('path');
const { launch } = require('./browser');

const FILE_URL = 'file://' + path.join(__dirname, '..', 'atelier3', 'index.html');

const befunde = [];
function prüfe(name, ok, notiz) {
  console.log((ok ? '  ok    ' : '  FEHLT ') + pad(name, 34) + (notiz || ''));
  if (!ok) befunde.push(name);
}

/* Reibt im Browser einen Kreisbogen mit echten Zeigerereignissen. */
async function reibe(page, opts) {
  const box = await page.locator('#sheet').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rad = box.width * 0.5 * opts.radius;
  const steps = opts.steps || 40;

  const punkt = function (i) {
    const a = opts.from + (opts.to - opts.from) * (i / steps);
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  };

  const p0 = punkt(0);
  await page.mouse.move(p0[0], p0[1]);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const p = punkt(i);
    await page.mouse.move(p[0], p[1]);
    if (opts.pause) await page.waitForTimeout(opts.pause);
  }
  await page.mouse.up();
  await page.waitForTimeout(60);
}

async function run() {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  const page = await context.newPage();

  const lärm = [];
  page.on('pageerror', function (err) { lärm.push('pageerror: ' + err.message); });
  page.on('console', function (msg) {
    if (msg.type() === 'error') lärm.push(msg.text());
  });

  /* Diese App hat keine Schriftdatei und keine Klangdatei. Ein Abruf nach
     außen wäre ein Rückfall hinter die eigene Zusage. */
  const extern = [];
  page.on('request', function (request) {
    const url = request.url();
    if (!url.startsWith('file:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      extern.push(url);
    }
  });

  await page.goto(FILE_URL);
  await page.waitForFunction('window.Blatt && window.Blatt.sheet.relief');

  console.log('Atelier 3.0 – „Blatt“\n');

  /* ---- Abgeschlossenheit ------------------------------------------------ */
  console.log('Abgeschlossenheit');
  prüfe('nichts von außen', extern.length === 0,
        extern.length ? extern.slice(0, 2).join(' ') : '');

  /* ---- Das unberührte Blatt --------------------------------------------- */
  console.log('\nDas unberührte Blatt');
  const leer = await page.evaluate(function () {
    const B = window.Blatt;
    B.makeSheet(4242, 'tag');
    const c = document.getElementById('sheet');
    const d = c.getContext('2d').getImageData(0, 0, B.SIZE, B.SIZE).data;

    /* Wie stark schwankt die Helligkeit auf einem Ring quer durchs Ornament?
       Sichtbares Relief hieße: große Schwankung. */
    let min = 255, max = 0;
    const C = B.SIZE / 2, r = B.R_DISC * 0.55;
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2;
      const x = Math.round(C + Math.cos(a) * r);
      const y = Math.round(C + Math.sin(a) * r);
      const k = (y * B.SIZE + x) * 4;
      const lum = (d[k] + d[k + 1] + d[k + 2]) / 3;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    return { spanne: max - min, dichte: B.meanDensity() };
  });
  prüfe('Prägung bleibt Ahnung', leer.spanne < 26, 'Spanne ' + leer.spanne.toFixed(1) + ' von 255');
  prüfe('noch kein Pigment', leer.dichte < 1e-6);

  /* ---- Die Hand hinterlässt eine Spur ----------------------------------- */
  console.log('\nDie Hand');
  await reibe(page, { radius: 0.55, from: 0, to: Math.PI * 0.5, steps: 40 });
  const nachStrich = await page.evaluate(function () { return window.Blatt.meanDensity(); });
  prüfe('Reiben trägt auf', nachStrich > 0);

  /* Langsam gegen schnell, sonst gleich. */
  const tempo = await page.evaluate(function () {
    const B = window.Blatt;
    const C = B.SIZE / 2, r = B.R_DISC * 0.5, TAU = Math.PI * 2;
    const bogen = function (von, bis) {
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const a = von + (bis - von) * (i / 60);
        pts.push(C + Math.cos(a) * r, C + Math.sin(a) * r);
      }
      return pts;
    };
    const messe = function (von, bis) {
      let sum = 0, n = 0;
      for (let i = 0; i <= 60; i++) {
        const a = von + (bis - von) * (i / 60);
        const x = Math.round(C + Math.cos(a) * r);
        const y = Math.round(C + Math.sin(a) * r);
        sum += B.sheet.dens[y * B.SIZE + x];
        n++;
      }
      return sum / n;
    };

    B.makeSheet(4242, 'tag');
    B.setPigment(0);
    B.rubPath(bogen(0, 0.6), 2.2, 0.5);            // langsam
    B.rubPath(bogen(Math.PI, Math.PI + 0.6), 0.35, 0.5);  // schnell
    return { langsam: messe(0, 0.6), schnell: messe(Math.PI, Math.PI + 0.6) };
  });
  prüfe('langsam ist dichter', tempo.langsam > tempo.schnell * 1.8,
        tempo.langsam.toFixed(3) + ' gegen ' + tempo.schnell.toFixed(3));

  /* ---- Wiederholung: vertieft, sättigt, kippt nicht --------------------- */
  console.log('\nWiederholung');
  const runden = await page.evaluate(function () {
    const B = window.Blatt;
    B.makeSheet(4242, 'tag');
    B.setPigment(0);
    const C = B.SIZE / 2, r = B.R_DISC * 0.5;
    const pts = [];
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      pts.push(C + Math.cos(a) * r, C + Math.sin(a) * r);
    }
    const spitze = function () {
      let m = 0;
      for (let i = 0; i < B.sheet.dens.length; i += 3) {
        if (B.sheet.dens[i] > m) m = B.sheet.dens[i];
      }
      return m;
    };
    const stufen = [];
    for (let lap = 0; lap < 40; lap++) {
      B.rubPath(pts, 2.0, 0.7);
      if (lap === 0 || lap === 4 || lap === 39) stufen.push(spitze());
    }

    /* Dunkelste Stelle des Bildes – darf nie schwarz werden. */
    const d = document.getElementById('sheet')
      .getContext('2d').getImageData(0, 0, B.SIZE, B.SIZE).data;
    let dunkelst = 255;
    for (let k = 0; k < d.length; k += 4 * 7) {
      const lum = (d[k] + d[k + 1] + d[k + 2]) / 3;
      if (lum < dunkelst) dunkelst = lum;
    }
    return { erst: stufen[0], fünf: stufen[1], vierzig: stufen[2], dunkelst: dunkelst };
  });
  prüfe('zweite Runde vertieft', runden.fünf > runden.erst,
        runden.erst.toFixed(3) + ' → ' + runden.fünf.toFixed(3));
  prüfe('Dichte sättigt', runden.vierzig < 1 && runden.vierzig - runden.fünf < runden.fünf - runden.erst,
        'nach 40 Runden ' + runden.vierzig.toFixed(3));
  prüfe('kippt nie ins Schwarze', runden.dunkelst > 16,
        'dunkelste Stelle ' + runden.dunkelst.toFixed(0));

  /* ---- Symmetrie -------------------------------------------------------- */
  console.log('\nOrdnung');
  const symm = await page.evaluate(function () {
    const B = window.Blatt;
    B.makeSheet(4242, 'tag');
    B.setPigment(0);
    const n = B.sheet.plan.n;
    const C = B.SIZE / 2, TAU = Math.PI * 2;

    /* Eine volle Runde auf mittlerem Radius: Was dabei herauskommt, muss
       um 2π/n gedreht auf sich selbst passen. */
    const r = B.R_DISC * 0.55;
    const pts = [];
    for (let i = 0; i <= 400; i++) {
      const a = (i / 400) * TAU;
      pts.push(C + Math.cos(a) * r, C + Math.sin(a) * r);
    }
    B.rubPath(pts, 1.6, 0.6);
    B.rubPath(pts, 1.6, 0.6);

    /* Gemessen wird die Dichte, nicht die Helligkeit: Das Papierkorn ist
       ortsfest und nicht drehsymmetrisch, es würde die Messung sonst
       zudecken. Zusätzlich über eine kleine Umgebung mitteln, denn das
       Relief trägt bewusst ein winziges kartesisches Rauschen. */
    const dens = B.sheet.dens;
    const S = B.SIZE;
    const fleck = function (a) {
      let sum = 0, n2 = 0;
      for (let dr = -6; dr <= 6; dr += 3) {
        for (let da = -0.012; da <= 0.012; da += 0.006) {
          const rr = r + dr;
          const x = Math.round(C + Math.cos(a + da) * rr);
          const y = Math.round(C + Math.sin(a + da) * rr);
          sum += dens[y * S + x];
          n2++;
        }
      }
      return sum / n2;
    };

    const dreh = TAU / n;
    let passt = 0, schief = 0;
    const proben = 240;
    for (let i = 0; i < proben; i++) {
      const a = (i / proben) * TAU;
      const hier = fleck(a);
      passt  += Math.abs(hier - fleck(a + dreh));
      schief += Math.abs(hier - fleck(a + dreh * 0.5));
    }
    return { n: n, passt: passt / proben, schief: schief / proben };
  });
  prüfe('n-zählig drehsymmetrisch', symm.passt < symm.schief * 0.5,
        symm.n + '-zählig: ' + symm.passt.toFixed(1) + ' gegen ' + symm.schief.toFixed(1) + ' schief');

  /* ---- Der Handballen malt nicht mit ------------------------------------ */
  console.log('\nDer Handballen');
  const ballen = await page.evaluate(async function () {
    const B = window.Blatt;
    B.makeSheet(4242, 'tag');
    const c = document.getElementById('sheet');
    const box = c.getBoundingClientRect();
    const mach = function (typ, id, primär, x, y) {
      c.dispatchEvent(new PointerEvent(typ, {
        pointerId: id, isPrimary: primär, pointerType: 'touch',
        clientX: x, clientY: y, bubbles: true, cancelable: true, pressure: 0.6
      }));
    };

    /* Nur der zweite Kontakt – der Handballen – bewegt sich. Er kommt
       bewusst spät: Ein zweiter Finger kurz nach dem ersten wäre die zweite
       Hand und damit ein anderer Fall. */
    mach('pointerdown', 1, true, box.left + box.width * 0.5, box.top + box.height * 0.5);
    for (let i = 0; i < 6; i++) {
      mach('pointermove', 1, true,
           box.left + box.width * (0.5 + i * 0.004), box.top + box.height * 0.5);
    }
    await new Promise(function (r) { setTimeout(r, 420); });
    mach('pointerdown', 2, false, box.left + box.width * 0.2, box.top + box.height * 0.8);
    for (let i = 0; i < 30; i++) {
      mach('pointermove', 2, false,
           box.left + box.width * (0.2 + i * 0.01), box.top + box.height * 0.8);
    }
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });

    /* Was hat der Ballen in seiner Ecke hinterlassen? */
    const S = B.SIZE;
    let sum = 0, n = 0;
    for (let y = (S * 0.72) | 0; y < (S * 0.88) | 0; y += 2) {
      for (let x = (S * 0.12) | 0; x < (S * 0.5) | 0; x += 2) { sum += B.sheet.dens[y * S + x]; n++; }
    }
    mach('pointerup', 1, true, box.left + box.width * 0.5, box.top + box.height * 0.5);
    mach('pointerup', 2, false, box.left + box.width * 0.5, box.top + box.height * 0.8);
    return sum / n;
  });
  prüfe('zweiter Kontakt malt nicht', ballen < 1e-6, 'Dichte ' + ballen.toExponential(1));

  /* ---- Farbwelten ------------------------------------------------------- */
  console.log('\nFarbwelten');
  const welten = await page.evaluate(function () {
    const B = window.Blatt;
    const gesehen = {};
    for (let i = 0; i < 400; i++) {
      B.makeSheet(1000 + i * 7919, 'tag');
      gesehen[B.sheet.world.id] = (gesehen[B.sheet.world.id] || 0) + 1;
    }

    /* Dieselbe Welt bei Tag und bei Nacht: gleicher Farbton, hellere Kreide. */
    B.makeSheet(4242, 'tag');
    const tag = B.sheet.pigments.map(function (p) { return p.name; }).join(',');
    const tagHell = B.sheet.pigments.map(function (p) {
      return (p.rgb[0] + p.rgb[1] + p.rgb[2]) / 3;
    });
    const welt = B.sheet.world.id;
    B.makeSheet(4242, 'nacht');
    const nacht = B.sheet.pigments.map(function (p) { return p.name; }).join(',');
    const nachtHell = B.sheet.pigments.map(function (p) {
      return (p.rgb[0] + p.rgb[1] + p.rgb[2]) / 3;
    });

    /* Stabil: derselbe Seed muss dieselbe Welt ergeben. */
    B.makeSheet(4242, 'tag');
    const nochmal = B.sheet.world.id;

    let heller = 0;
    for (let i = 0; i < tagHell.length; i++) if (nachtHell[i] > tagHell[i]) heller++;

    return {
      anzahl: Object.keys(gesehen).length,
      verteilung: gesehen,
      gleich: tag === nacht,
      heller: heller,
      welt: welt,
      stabil: welt === nochmal,
      alle: B.WORLDS.length
    };
  });
  prüfe('alle Farbwelten kommen vor', welten.anzahl === welten.alle,
        Object.keys(welten.verteilung).join(', '));
  prüfe('die Welt hängt am Blatt, nicht am Zufall', welten.stabil,
        'Seed 4242 → ' + welten.welt);
  prüfe('Tag und Nacht sind dieselbe Welt', welten.gleich);
  prüfe('bei Nacht wird daraus Kreide', welten.heller === 9,
        welten.heller + ' von 9 Pigmenten heller');

  /* ---- Die Blattlade ---------------------------------------------------- */
  console.log('\nDie Blattlade');

  const charaktere = await page.evaluate(function () {
    const B = window.Blatt;

    /* Ohne Charakter muss der Bauplan genau der alte bleiben – sonst bekäme
       ein Blatt von früher beim Wiederaufnehmen ein anderes Relief. */
    const ohneA = B.buildPlan(4242);
    const ohneB = B.buildPlan(4242);
    const stabil = ohneA.n === ohneB.n && ohneA.bands.length === ohneB.bands.length;

    /* Und die Charaktere müssen sich messbar unterscheiden. */
    const profil = {};
    B.KINDS.forEach(function (k) {
      let achsen = 0, baender = 0;
      for (let i = 0; i < 60; i++) {
        const plan = B.buildPlan(9000 + i * 137, k.id);
        achsen += plan.n;
        baender += plan.bands.length;
      }
      profil[k.id] = { n: achsen / 60, b: baender / 60 };
    });
    return { stabil: stabil, profil: profil, namen: B.KINDS.map(function (k) { return k.name; }) };
  });
  prüfe('vier Charaktere', charaktere.namen.length === 4, charaktere.namen.join(' · '));
  prüfe('ohne Charakter bleibt der Bauplan der alte', charaktere.stabil);
  prüfe('Ruhe ist ruhiger als Fülle',
        charaktere.profil.ruhe.n < charaktere.profil.fuelle.n &&
        charaktere.profil.ruhe.b < charaktere.profil.fuelle.b,
        'Achsen ' + charaktere.profil.ruhe.n.toFixed(1) + ' gegen ' +
        charaktere.profil.fuelle.n.toFixed(1) + ', Bänder ' +
        charaktere.profil.ruhe.b.toFixed(1) + ' gegen ' + charaktere.profil.fuelle.b.toFixed(1));

  const ladeAuf = await page.evaluate(async function () {
    const B = window.Blatt;
    B.openLade();
    await new Promise(function (r) { setTimeout(r, 900); });
    return {
      offen: !document.getElementById('lade').hidden,
      kategorien: document.querySelectorAll('.lade-kind').length,
      welten: document.querySelectorAll('.lade-world').length,
      blaetter: document.querySelectorAll('.lade-sheet canvas').length,
      gemalt: Array.prototype.every.call(
        document.querySelectorAll('.lade-sheet canvas'),
        function (cv) {
          const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          let min = 255, max = 0;
          for (let k = 0; k < d.length; k += 4 * 37) {
            const l = (d[k] + d[k + 1] + d[k + 2]) / 3;
            if (l < min) min = l;
            if (l > max) max = l;
          }
          return max - min > 25;
        })
    };
  });
  prüfe('die Lade zeigt Stimmung, Pigmente und Blätter',
        ladeAuf.offen && ladeAuf.kategorien === 4 && ladeAuf.welten === 4 && ladeAuf.blaetter === 6,
        ladeAuf.kategorien + ' Stimmungen, ' + ladeAuf.welten + ' Welten, ' + ladeAuf.blaetter + ' Blätter');
  prüfe('die Ausschnitte zeigen wirklich etwas', ladeAuf.gemalt);

  const gewechselt = await page.evaluate(async function () {
    const B = window.Blatt;
    const vorher = B.lade.world.id;
    const andere = B.WORLDS.filter(function (w) { return w.id !== vorher; })[0];
    document.querySelector('.lade-world[data-world="' + andere.id + '"]').click();
    await new Promise(function (r) { setTimeout(r, 900); });
    const nachher = B.lade.world.id;

    document.querySelector('.lade-kind[data-kind="fuelle"]').click();
    await new Promise(function (r) { setTimeout(r, 900); });
    const stimmung = B.lade.kind.id;

    const seed = Number(document.querySelector('.lade-sheet').dataset.seed) >>> 0;
    document.querySelector('.lade-sheet').click();
    await new Promise(function (r) { setTimeout(r, 900); });
    return {
      welt: nachher === andere.id,
      stimmung: stimmung === 'fuelle',
      genommen: B.sheet.seed === seed &&
                B.sheet.world.id === nachher &&
                B.sheet.kind && B.sheet.kind.id === 'fuelle',
      zu: document.getElementById('lade').hidden
    };
  });
  prüfe('die Farbwelt lässt sich wählen', gewechselt.welt);
  prüfe('die Stimmung lässt sich wählen', gewechselt.stimmung);
  prüfe('das gewählte Blatt kommt genau so', gewechselt.genommen && gewechselt.zu);

  /* ---- Die zweite Hand -------------------------------------------------- */
  console.log('\nDie zweite Hand');

  const naeher = await page.evaluate(async function () {
    const B = window.Blatt;
    B.setViewForTest(1, 0, 0);
    const weit = B.contactRadius(false);
    B.setViewForTest(2, 0, 0);
    const nah = B.contactRadius(false);
    const stift = B.contactRadius(true);
    B.setViewForTest(1, 0, 0);
    return { weit: weit, nah: nah, stift: stift };
  });
  prüfe('Kontakt bleibt am Glas, nicht am Bild',
        Math.abs(naeher.nah - naeher.weit / 2) < 0.01,
        naeher.weit.toFixed(1) + ' Einheiten → ' + naeher.nah.toFixed(1) + ' bei doppelter Ansicht');
  prüfe('Stift ist feiner als der Finger', naeher.stift < naeher.weit);

  /* Zwei Finger holen das Blatt heran – mit echten Zeigerereignissen. */
  const geste = await page.evaluate(async function () {
    const B = window.Blatt;
    B.setViewForTest(1, 0, 0);
    const c = document.getElementById('sheet');
    const box = c.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const mach = function (typ, id, primär, x, y) {
      c.dispatchEvent(new PointerEvent(typ, {
        pointerId: id, isPrimary: primär, pointerType: 'touch',
        clientX: x, clientY: y, bubbles: true, cancelable: true, pressure: 0.5
      }));
    };

    const vorher = B.sheet.touched;
    mach('pointerdown', 11, true,  cx - 40, cy);
    mach('pointerdown', 12, false, cx + 40, cy);
    for (let i = 1; i <= 10; i++) {
      const d = 40 + i * 12;
      mach('pointermove', 11, true,  cx - d, cy);
      mach('pointermove', 12, false, cx + d, cy);
    }
    const gezoomt = B.view.scale;
    const schmutz = B.sheet.touched !== vorher;
    mach('pointerup', 11, true,  cx - 160, cy);
    mach('pointerup', 12, false, cx + 160, cy);
    await new Promise(function (r) { setTimeout(r, 600); });
    return { gezoomt: gezoomt, nachher: B.view.scale, schmutz: schmutz, max: B.VIEW_MAX };
  });
  prüfe('zwei Finger holen das Blatt heran', geste.gezoomt > 1.3,
        'Maßstab ' + geste.gezoomt.toFixed(2));
  prüfe('kein Pigment beim Heranholen', !geste.schmutz);
  prüfe('Anschlag hält', geste.nachher <= geste.max + 0.001,
        'nach dem Loslassen ' + geste.nachher.toFixed(2) + ' von höchstens ' + geste.max);

  /* Kleiner als bildfüllend darf es nicht bleiben. */
  const zurueck = await page.evaluate(async function () {
    const B = window.Blatt;
    B.setViewForTest(1.8, 120, -60);
    B.viewHome();
    await new Promise(function (r) { setTimeout(r, 2400); });
    return { scale: B.view.scale, tx: B.view.tx, ty: B.view.ty };
  });
  prüfe('das Blatt sinkt in die Vollansicht zurück',
        Math.abs(zurueck.scale - 1) < 0.01 &&
        Math.abs(zurueck.tx) < 1 && Math.abs(zurueck.ty) < 1,
        'Maßstab ' + zurueck.scale.toFixed(2));

  /* ---- Landet die Farbe unter dem Finger? ------------------------------- */
  console.log('\nDie Farbe unter dem Finger');
  const treffer = await page.evaluate(async function () {
    const B = window.Blatt;
    const faelle = [
      { scale: 1,   tx: 0,   ty: 0,  resize: false },
      { scale: 2,   tx: 0,   ty: 0,  resize: false },
      { scale: 2,   tx: 120, ty: 60, resize: false },
      { scale: 2,   tx: 120, ty: 60, resize: true  },
      { scale: 1.6, tx: -90, ty: 40, resize: true  }
    ];
    const out = [];

    for (const f of faelle) {
      B.makeSheet(4242, 'tag');
      B.setViewForTest(f.scale, f.tx, f.ty);
      if (f.resize) window.dispatchEvent(new Event('resize'));
      await new Promise(function (r) { requestAnimationFrame(r); });

      const cv = document.getElementById('sheet');
      const box = cv.getBoundingClientRect();
      const px = box.left + box.width * 0.62;
      const py = box.top + box.height * 0.38;
      const sollX = ((px - box.left) / box.width) * B.SIZE;
      const sollY = ((py - box.top) / box.height) * B.SIZE;

      const mach = function (t, x, y) {
        cv.dispatchEvent(new PointerEvent(t, {
          pointerId: 9, isPrimary: true, pointerType: 'touch',
          clientX: x, clientY: y, bubbles: true, cancelable: true, pressure: 0.7
        }));
      };
      mach('pointerdown', px, py);
      for (let i = 1; i <= 22; i++) {
        mach('pointermove', px + i * 1.4, py + i * 0.9);
        await new Promise(function (r) { setTimeout(r, 12); });
      }
      await new Promise(function (r) { setTimeout(r, 120); });
      mach('pointerup', px + 31, py + 20);

      let sx = 0, sy = 0, n = 0;
      const d = B.sheet.dens, S = B.SIZE;
      for (let y = 0; y < S; y += 2) {
        for (let x = 0; x < S; x += 2) {
          const v = d[y * S + x];
          if (v > 0.004) { sx += x * v; sy += y * v; n += v; }
        }
      }
      out.push({
        wie: 'Maßstab ' + f.scale + (f.tx ? ', verschoben' : '') + (f.resize ? ', nach resize' : ''),
        versatz: n ? Math.hypot(sx / n - sollX, sy / n - sollY) : Infinity
      });
    }
    B.setViewForTest(1, 0, 0);
    return out;
  });
  treffer.forEach(function (t) {
    prüfe('Farbe unter dem Finger', t.versatz < 12,
          t.wie + ': ' + (isFinite(t.versatz) ? t.versatz.toFixed(0) + ' Einheiten daneben' : 'nichts gemalt'));
  });

  /* ---- Was es nicht gibt ------------------------------------------------ */
  console.log('\nWas es nicht gibt');
  const bedienung = await page.evaluate(function () {
    const text = document.body.innerText.toLowerCase();
    return {
      knöpfe: document.querySelectorAll('button').length,
      pigmente: document.querySelectorAll('.pigment').length,
      zurück: /rückgängig|undo|radier|löschen/.test(text),
      verwerfen: (document.getElementById('stack-remove') || {}).textContent,
      zahl: /\d+\s*%/.test(text),
      speichern: /speichern|sichern/.test(text)
    };
  });
  prüfe('neun Pigmente', bedienung.pigmente === 9, bedienung.pigmente + ' Stück');
  prüfe('kein Rückgängig, kein Radierer', !bedienung.zurück);
  prüfe('keine Prozentanzeige', !bedienung.zahl);
  prüfe('kein Speichern-Knopf', !bedienung.speichern);
  prüfe('Verwerfen heißt nicht Weglegen', bedienung.verwerfen === 'Verwerfen',
        'im Stapel steht: ' + bedienung.verwerfen);

  /* ---- Layout ----------------------------------------------------------- */
  console.log('\nLayout');
  const auflösungen = [
    [1024, 768], [768, 1024], [1366, 1024], [820, 1180]
  ];
  const schief = [];
  for (const [w, h] of auflösungen) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(120);
    const box = await page.locator('#sheet').boundingBox();
    const abweichung = Math.abs(box.width - box.height);
    const passt = abweichung <= 1 && box.width + box.x <= w + 1 && box.height + box.y <= h + 1;
    if (!passt) schief.push(w + '×' + h);
  }
  prüfe('Blatt bleibt quadratisch', schief.length === 0, schief.join(', '));

  /* ---- Das Blatt liegt noch da ------------------------------------------ */
  console.log('\nFortsetzen');
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.waitForTimeout(120);

  /* Über file:// gibt es keinen Origin und damit keine IndexedDB, die den
     Neustart überlebt. Deshalb hier über einen echten Origin nachprüfen. */
  const server = await startServer(path.join(__dirname, '..'));
  let fortsetzen = 'übersprungen';
  try {
    const p2 = await context.newPage();
    await p2.goto(server.url + '/atelier3/index.html');
    await p2.waitForFunction('window.Blatt && window.Blatt.sheet.relief');
    await p2.waitForFunction('window.Blatt.sheet.plan !== null');

    const box = await p2.locator('#sheet').boundingBox();
    await p2.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await p2.mouse.down();
    for (let i = 0; i < 30; i++) {
      await p2.mouse.move(box.x + box.width * (0.5 + i * 0.008), box.y + box.height * 0.3);
    }
    await p2.mouse.up();
    const vorher = await p2.evaluate(function () {
      return { seed: window.Blatt.sheet.seed, dichte: window.Blatt.meanDensity() };
    });
    await p2.waitForTimeout(2200);          // Sicherung ist entprellt
    await p2.reload();
    await p2.waitForFunction('window.Blatt && window.Blatt.sheet.relief');
    await p2.waitForTimeout(400);
    const nachher = await p2.evaluate(function () {
      return { seed: window.Blatt.sheet.seed, dichte: window.Blatt.meanDensity() };
    });
    fortsetzen = (nachher.seed === vorher.seed && nachher.dichte > vorher.dichte * 0.4)
      ? 'ok' : 'FEHLT';
    prüfe('Blatt überlebt den Neustart', fortsetzen === 'ok',
          'Dichte ' + vorher.dichte.toExponential(1) + ' → ' + nachher.dichte.toExponential(1));

    /* Der ganze Kreislauf: weglegen, wiederfinden, aufnehmen, weitermalen. */
    console.log('\nWeglegen und wiederaufnehmen');
    const altSeed = nachher.seed;
    const altDichte = nachher.dichte;

    await p2.click('#mark');
    await p2.click('#tray-new');
    await p2.waitForSelector('.lade-sheet canvas', { timeout: 10000 });
    await p2.waitForTimeout(600);
    await p2.click('.lade-sheet');
    await p2.waitForFunction(function (alt) {
      return window.Blatt.sheet.seed !== alt;
    }, altSeed, { timeout: 10000 });
    const frisch = await p2.evaluate(function () {
      return { seed: window.Blatt.sheet.seed, dichte: window.Blatt.meanDensity() };
    });
    prüfe('aus der Lade kommt ein leeres Blatt', frisch.seed !== altSeed && frisch.dichte < 1e-6);

    await p2.click('#mark');
    await p2.click('#tray-stack');
    await p2.waitForTimeout(500);
    const imStapel = await p2.evaluate(function () {
      return {
        sichtbar: !document.getElementById('stack').hidden,
        aufnehmen: !document.getElementById('stack-take').hidden,
        leer: !document.getElementById('stack-empty').hidden
      };
    });
    prüfe('das weggelegte Blatt liegt im Stapel',
          imStapel.sichtbar && imStapel.aufnehmen && !imStapel.leer);

    await p2.click('#stack-take');
    await p2.waitForTimeout(1400);
    const wieder = await p2.evaluate(function () {
      return {
        seed: window.Blatt.sheet.seed,
        dichte: window.Blatt.meanDensity(),
        welt: window.Blatt.sheet.world.id,
        zu: document.getElementById('stack').hidden
      };
    });
    prüfe('Aufnehmen holt genau dieses Blatt zurück',
          wieder.seed === altSeed && wieder.dichte > altDichte * 0.4 && wieder.zu,
          'Dichte ' + wieder.dichte.toExponential(1));

    /* Und es lässt sich darauf weitermalen. */
    const box2 = await p2.locator('#sheet').boundingBox();
    await p2.mouse.move(box2.x + box2.width * 0.35, box2.y + box2.height * 0.62);
    await p2.mouse.down();
    for (let i = 0; i < 40; i++) {
      await p2.mouse.move(box2.x + box2.width * (0.35 + i * 0.007), box2.y + box2.height * 0.62);
    }
    await p2.mouse.up();
    await p2.waitForTimeout(200);
    const weiter = await p2.evaluate(function () { return window.Blatt.meanDensity(); });
    prüfe('auf dem aufgenommenen Blatt lässt sich weitermalen', weiter > wieder.dichte,
          wieder.dichte.toExponential(1) + ' → ' + weiter.toExponential(1));

    await p2.close();
  } finally {
    server.close();
  }

  if (lärm.length) {
    console.log('\nMeldungen des Browsers (bei file:// erwartbar):');
    Array.from(new Set(lärm)).slice(0, 6).forEach(function (line) {
      console.log('  ' + line.slice(0, 120));
    });
  }

  console.log('\n' + (befunde.length
    ? befunde.length + ' Befund(e): ' + befunde.join(', ')
    : 'Alles wie zugesagt.'));

  await browser.close();
  process.exitCode = befunde.length ? 1 : 0;
}

/* Ein winziger Dateiserver – nur damit es einen Origin gibt und IndexedDB
   den Neustart übersteht. */
function startServer(root) {
  const http = require('http');
  const fs = require('fs');
  const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png'
  };
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      let file = path.join(root, rel);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      if (file.indexOf(root) !== 0 || !fs.existsSync(file)) {
        res.writeHead(404); res.end('nicht da'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', function () {
      resolve({
        url: 'http://127.0.0.1:' + server.address().port,
        close: function () { server.close(); }
      });
    });
  });
}

function pad(text, width) {
  text = String(text);
  return text.length >= width ? text + '  ' : text + ' '.repeat(width - text.length);
}

run().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
