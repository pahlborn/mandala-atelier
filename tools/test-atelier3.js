'use strict';

/* ============================================================================
   Testlauf für Atelier 3.0 – „Blatt“.

     npm install
     node tools/test-atelier3.js

   Geprüft wird nicht, ob es hübsch aussieht – das muss man ansehen. Geprüft
   wird, ob die Zusagen des Entwurfs auch wirklich gelten:

     * Es wird nichts von außen geholt.
     * Die Hand hinterlässt eine Spur, und der Weg trägt auf, nicht die Zeit.
     * Verweilen greift tiefer, brennt aber kein Loch.
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

  /* Der Weg trägt auf, nicht die Zeit. Zweimal derselbe Bogen, einmal in
     sechzig winzigen Schritten, einmal in sechs großen: Das ist derselbe
     Strich, nur anders schnell gefahren – und es muss dasselbe daliegen.

     Vorher galt das Gegenteil, und es war der Grund für zwei Beschwerden
     auf einmal: Fläche blieb blass wie Geschmiere, und jedes Zögern brannte
     einen dunklen Fleck. */
  const tempo = await page.evaluate(function () {
    const B = window.Blatt;
    const C = B.SIZE / 2, halb = B.R_DISC * 0.45;
    /* Zwei gerade Strecken, spiegelbildlich zur Mitte: Auf einer Geraden
       liegen grob und fein gesetzte Punkte auf demselben Weg, sodass die
       Messung wirklich das Tempo prüft und nicht die Sehne. */
    const strecke = function (y, n) {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(C - halb + (2 * halb) * (i / n), y);
      return pts;
    };
    const messe = function (y) {
      let sum = 0, n = 0;
      for (let i = 0; i <= 60; i++) {
        const x = Math.round(C - halb + (2 * halb) * (i / 60));
        sum += B.sheet.dens[Math.round(y) * B.SIZE + x];
        n++;
      }
      return sum / n;
    };

    /* Zweimal dieselbe Strecke auf demselben Relief, jedes Mal auf
       frischem Blatt – sonst verglichen wir nebenbei zwei Orte. */
    const y = C + B.R_DISC * 0.35;
    B.makeSheet(4242, 'tag'); B.setPigment(0);
    B.rubPath(strecke(y, 60), 0.5);       // kriechend, in winzigen Schritten
    const kriechend = messe(y);
    B.makeSheet(4242, 'tag'); B.setPigment(0);
    B.rubPath(strecke(y, 12), 0.5);       // zügig, in großen Schritten
    return { kriechend: kriechend, zügig: messe(y) };
  });
  /* Zwei Schranken, und die obere ist die wichtige: Kriechen darf keinen
     Vorteil bringen, sonst ist das Zeitverhalten durch die Hintertür
     zurück. Die untere hält fest, dass zügiges Arbeiten auch nicht
     bestraft wird. Eng gesetzt, denn beides soll gleich sein. */
  const anteil = tempo.kriechend / Math.max(1e-6, tempo.zügig);
  prüfe('der Weg trägt auf, nicht die Zeit', anteil < 1.15 && anteil > 0.87,
        'kriechend ' + tempo.kriechend.toFixed(3) + ', zügig ' +
        tempo.zügig.toFixed(3) + ' – Faktor ' + anteil.toFixed(2));

  /* Was die Langsamkeit stattdessen ändert: die Tiefe. Ein fester, ruhiger
     Kontakt holt auch aus dem ebenen Grund Farbe, ein flüchtiger streift
     nur die Grate. Gemessen als Verhältnis Grund zu Grat. */
  const griff = await page.evaluate(function () {
    const B = window.Blatt;
    const C = B.SIZE / 2, r = B.R_DISC * 0.5;
    const ring = function (von, bis) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = von + (bis - von) * (i / 24);
        pts.push(C + Math.cos(a) * r, C + Math.sin(a) * r);
      }
      return pts;
    };
    /* Grund gegen Grat, nur dort gemessen, wo die Hand war. */
    const tiefe = function (von, bis) {
      const S = B.SIZE, d = B.sheet.dens, rel = B.sheet.relief;
      let hs = 0, hn = 0, ts = 0, tn = 0;
      for (let i = 0; i <= 240; i++) {
        const a = von + (bis - von) * (i / 240);
        for (let dr = -10; dr <= 10; dr += 2) {
          const x = Math.round(C + Math.cos(a) * (r + dr));
          const y = Math.round(C + Math.sin(a) * (r + dr));
          const o = y * S + x, v = d[o];
          if (v < 0.004) continue;
          if (rel[o] > 200) { hs += v; hn++; }
          else if (rel[o] < 120) { ts += v; tn++; }
        }
      }
      return (ts / Math.max(1, tn)) / Math.max(1e-6, hs / Math.max(1, hn));
    };

    B.makeSheet(4242, 'tag');
    B.setPigment(0);
    B.rubPath(ring(0, 0.7), 0.15);                    // flüchtig
    B.rubPath(ring(Math.PI, Math.PI + 0.7), 1.0);     // fest und ruhig
    return { flüchtig: tiefe(0, 0.7), fest: tiefe(Math.PI, Math.PI + 0.7) };
  });
  prüfe('der feste Griff holt aus dem Grund', griff.fest > griff.flüchtig * 1.5,
        'Grund/Grat flüchtig ' + griff.flüchtig.toFixed(2) +
        ', fest ' + griff.fest.toFixed(2));

  /* Und das Stillhalten brennt kein Loch mehr. Eine Sekunde auf derselben
     Stelle darf nicht dunkler werden als ein paar ehrliche Züge über eine
     Fläche – sonst belohnt die App das Zögern statt die Arbeit. */
  {
    await page.evaluate(function () {
      window.Blatt.makeSheet(4242, 'tag'); window.Blatt.setPigment(0);
    });
    const box = await page.locator('#sheet').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.62);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
    await page.waitForTimeout(80);
    const fleck = await page.evaluate(function () {
      let m = 0; const d = window.Blatt.sheet.dens;
      for (let i = 0; i < d.length; i += 3) if (d[i] > m) m = d[i];
      return m;
    });
    await page.evaluate(function () {
      window.Blatt.makeSheet(4242, 'tag'); window.Blatt.setPigment(0);
    });
    await reibe(page, { radius: 0.5, from: 0, to: Math.PI * 0.6, steps: 30 });
    await reibe(page, { radius: 0.5, from: 0, to: Math.PI * 0.6, steps: 30 });
    const zug = await page.evaluate(function () {
      let m = 0; const d = window.Blatt.sheet.dens;
      for (let i = 0; i < d.length; i += 3) if (d[i] > m) m = d[i];
      return m;
    });
    prüfe('Stillhalten brennt kein Loch', fleck < zug,
          'eine Sekunde stehen ' + fleck.toFixed(2) +
          ', zwei Züge ' + zug.toFixed(2));
  }

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
      B.rubPath(pts, 0.7);
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
    B.rubPath(pts, 0.6);
    B.rubPath(pts, 0.6);

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

    /* Worauf es wirklich ankommt: Jedes Pigment muss sich vom dunklen
       Papier abheben. „Heller als am Tag“ ist nur der Regelfall – die
       ohnehin fast weißen nimmt asChalk sogar etwas zurück, und das ist
       richtig so, sonst blendeten sie. */
    const nachtPapier = (39 + 36 + 32) / 3;   // SHEETS.nacht.paper
    let blass = 0;
    for (let i = 0; i < nachtHell.length; i++) {
      if (nachtHell[i] < nachtPapier + 40) blass++;
    }

    return {
      anzahl: Object.keys(gesehen).length,
      verteilung: gesehen,
      gleich: tag === nacht,
      heller: heller,
      blass: blass,
      papier: nachtPapier,
      pigmente: tagHell.length,
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
  /* Kein Pigment darf bei Nacht dunkler werden – sonst verschwände es auf
     dem dunklen Papier. Dass ein paar der ohnehin fast weißen stehen
     bleiben, ist kein Mangel: Sie sind schon Kreide. */
  prüfe('bei Nacht hebt sich jedes Pigment vom Papier ab',
        welten.blass === 0,
        welten.heller + ' von ' + welten.pigmente + ' heller als am Tag, ' +
        'keines blasser als Papier + 40');

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
  prüfe('fünf Charaktere', charaktere.namen.length === 5, charaktere.namen.join(' · '));
  prüfe('ohne Charakter bleibt der Bauplan der alte', charaktere.stabil);
  prüfe('Ruhe ist ruhiger als Fülle',
        charaktere.profil.ruhe.n < charaktere.profil.fuelle.n &&
        charaktere.profil.ruhe.b < charaktere.profil.fuelle.b,
        'Achsen ' + charaktere.profil.ruhe.n.toFixed(1) + ' gegen ' +
        charaktere.profil.fuelle.n.toFixed(1) + ', Bänder ' +
        charaktere.profil.ruhe.b.toFixed(1) + ' gegen ' + charaktere.profil.fuelle.b.toFixed(1));

  /* Die Anlage. Sie ist der einzige Charakter, der den Generator nicht biegt,
     sondern ersetzt – und der einzige, dessen Relief nach innen abnimmt.
     Gemessen wird genau auf dem Grat jedes Bauteils, nicht flächig: Ein
     Flächenmittel ist von der blanken Fläche beherrscht und sagt nichts. */
  console.log('\nDie Anlage');
  const anlage = await page.evaluate(function () {
    const B = window.Blatt;

    /* Die Vierzähligkeit ist Bedingung, nicht Geschmack: Ein Quadrat ist
       vierzählig, und die Rasterung setzt exakte Drehsymmetrie um 2π/n
       voraus. Käme hier je ein anderes n heraus, zerfiele das Feld. */
    let vier = true, teile = true;
    for (let i = 0; i < 40; i++) {
      const plan = B.buildPlan(3000 + i * 911, 'anlage', 'palast');
      if (plan.n !== 4) vier = false;
      const arten = plan.bands.map(function (b) { return b.kind; });
      ['yard', 'gate', 'wall', 'heart'].forEach(function (k) {
        if (arten.indexOf(k) < 0) teile = false;
      });
    }

    /* Die Staffelung: von außen nach innen muss das Relief abnehmen. */
    const plan = B.buildPlan(20250813, 'anlage', 'palast');
    const wall = plan.bands.filter(function (b) { return b.kind === 'wall'; });
    const yard = plan.bands.filter(function (b) { return b.kind === 'yard'; })[0];
    const herz = plan.bands.filter(function (b) { return b.kind === 'heart'; })[0];
    const S = 0.5;                       // Winkel abseits der Torachse
    const rMid = plan.rules[1].r;
    const at = function (rr, th) { return B.fieldAt(plan, rr, th); };
    const rYard = (yard.s + yard.rOut) / 2;

    const stufen = [
      { ort: 'Schutzbereich', h: at((rMid + 1) / 2, 0) },
      { ort: 'Vorhof',        h: at(rYard, Math.asin(yard.tie / rYard)) },
      { ort: 'Palastmauer',   h: at(wall[0].s2 / Math.cos(S), S) },
      { ort: 'Innenhof',      h: at(wall[1].s1 / Math.cos(S), S) },
      { ort: 'Kammer',        h: at(wall[2].s1 / Math.cos(S), S) },
      { ort: 'Mitte',         h: at(herz.r2, S) }
    ];

    /* Zwei leichte, zügige Züge – so viel holt eine flüchtige Hand heraus. */
    stufen.forEach(function (s) {
      s.dichte = 1 - Math.exp(-2 * 0.46 * Math.pow(s.h, 2.0));
    });

    let faellt = true;
    for (let i = 1; i < stufen.length; i++) {
      if (stufen[i].h >= stufen[i - 1].h) faellt = false;
    }

    /* Und die Untergrenze: Auch die Mitte muss deutlich über der blanken
       Fläche liegen. Ein Bauteil, das man nicht mehr findet, wäre kein
       Widerstand, sondern ein Fehler. */
    const blank = at(0.45, 0.22);
    const herzOben = stufen[stufen.length - 1].h;

    return { vier: vier, teile: teile, faellt: faellt, stufen: stufen,
             blank: blank, verhaeltnis: herzOben / blank,
             spanne: stufen[0].dichte / stufen[stufen.length - 1].dichte };
  });

  anlage.stufen.forEach(function (s) {
    console.log('  ' + pad(s.ort, 24) + pad('Relief ' + s.h.toFixed(2), 14) +
                'nach zwei leichten Zügen ' + s.dichte.toFixed(2));
  });
  prüfe('der Palast ist immer vierzählig', anlage.vier, '40 Seeds');
  prüfe('jeder Palast hat Vorhof, Tore, Mauern, Mitte', anlage.teile);
  prüfe('das Relief nimmt nach innen ab', anlage.faellt,
        'außen ' + anlage.stufen[0].dichte.toFixed(2) + ' gegen innen ' +
        anlage.stufen[anlage.stufen.length - 1].dichte.toFixed(2) +
        ', Spanne ' + anlage.spanne.toFixed(1) + '-fach');
  prüfe('auch die Mitte bleibt auffindbar', anlage.verhaeltnis > 1.25,
        (anlage.verhaeltnis).toFixed(2) + '-fach über der blanken Fläche');

  /* Die acht Grammatiken.

     Blatt hat keinen Katalog, sondern würfelt – die Stimmung „Anlage“ zieht
     je Blatt eine Ordnung. Vier Zusagen hängen daran, und drei davon sind
     nicht Geschmack, sondern Bedingung:

       * Die Rasterung rechnet das Feld über einen einzigen Keil und dreht es
         n-mal. Ist das Feld nicht **exakt** um 2π/n symmetrisch, zerfällt es.
         Das ist die schärfste Prüfung hier, und sie ersetzt jedes Zählen von
         Ornamenten: Gemessen wird das Feld selbst, nicht der Bauplan.
       * Die Wahl der Grammatik darf **keinen** Zufall verbrauchen. Täte sie
         es, verschöbe sich der Strom um einen Zug, und jede Anlage von vor
         dieser Fassung bekäme andere Maße als die, auf denen Farbe liegt.
       * Ein gesichertes Blatt ohne Grammatik ist ein Palast – so hieß die
         einzige Anlage, als es die anderen sieben noch nicht gab.

     Und die vierte: In jeder von ihnen nimmt das Relief nach innen ab. Das
     ist das Gesetz dieser App, und es gilt nicht nur für die eine Anlage,
     mit der es eingeführt wurde. */
  console.log('\nDie acht Grammatiken');
  const bauten = await page.evaluate(function () {
    const B = window.Blatt;
    const namen = B.BAUTEN;

    /* Kommen alle vor, und zieht ein Seed immer dieselbe? */
    const zahl = {};
    namen.forEach(function (b) { zahl[b] = 0; });
    let fest = true;
    for (let i = 0; i < 400; i++) {
      const seed = (i * 2654435761) >>> 0;
      const bau = B.buildPlan(seed, 'anlage').bau;
      if (bau !== B.bauFor(seed)) fest = false;
      zahl[bau]++;
    }

    /* Kostet die Wahl Zufall? Dann wäre lw je nach Grammatik verschieden. */
    let ohneZufall = true, palastBleibt = true;
    for (let i = 0; i < 60; i++) {
      const seed = 7000 + i * 613;
      const a = B.buildPlan(seed, 'anlage', 'palast');
      const b = B.buildPlan(seed, 'anlage', 'kuppel');
      if (a.lw !== b.lw) ohneZufall = false;
      if (a.bau !== 'palast') palastBleibt = false;
    }

    /* Das Feld selbst: exakt drehsymmetrisch um 2π/n. */
    let schief = 0;
    namen.forEach(function (bau) {
      const plan = B.buildPlan(4242, 'anlage', bau);
      const dreh = (Math.PI * 2) / plan.n;
      for (let i = 0; i < 600; i++) {
        const rr = 0.02 + (i % 50) * 0.02;
        const th = (i * 0.7351) % (Math.PI * 2);
        const d = Math.abs(B.fieldAt(plan, rr, th) -
                           B.fieldAt(plan, rr, th + dreh));
        if (d > schief) schief = d;
      }
    });

    /* Die Staffelung, je Grammatik. Gemessen wird der höchste Grat in einem
       Ring – ein Flächenmittel wäre von der blanken Fläche beherrscht und
       sagte nichts. */
    const ringe = [0.90, 0.75, 0.60, 0.45, 0.30];
    const profile = namen.map(function (bau) {
      const plan = B.buildPlan(20250816, 'anlage', bau);
      const hoehen = ringe.map(function (r) {
        let top = 0;
        for (let k = 0; k < 24; k++) {
          const rr = r - 0.045 + k * 0.09 / 23;
          for (let j = 0; j < 360; j++) {
            const h = B.fieldAt(plan, rr, (j / 360) * Math.PI * 2);
            if (h > top) top = h;
          }
        }
        return top;
      });
      /* Verlangt wird nicht, dass jeder Ring niedriger ist als der davor –
         ein Bauteil wie der Vorhof reicht über mehrere Ringe und ist dort
         überall gleich hoch. Verlangt wird, dass es **nie hinaufgeht**, und
         dass zwischen außen und innen eine spürbare Spanne liegt.

         Die halbe Promille Spielraum ist kein Nachlass, sondern die Auflösung
         der Messung selbst: Abgetastet wird ein Raster, und zwei Ringe treffen
         denselben Grat verschieden genau. Beim Raster lagen zwei Werte um
         6·10⁻⁶ auseinander und waren bei feiner Abtastung Bit für Bit gleich –
         gemessen wurde die Abtastung, nicht das Relief. */
      let faellt = true;
      for (let i = 1; i < hoehen.length; i++) {
        if (hoehen[i] > hoehen[i - 1] * 1.0005) faellt = false;
      }
      const spanne = hoehen[0] / hoehen[hoehen.length - 1];

      /* Und die Mitte: flach, leer – aber auffindbar. Ihre Grenze ist mal
         ein Kreis, mal ein Vieleck; abgetastet wird der ganze Streifen
         zwischen Kantenmitte und Ecke. */
      const herz = plan.bands.filter(function (b) { return b.kind === 'heart'; })[0];
      const rEck = herz.m ? herz.r2 / Math.cos(Math.PI / herz.m) : herz.r2;
      let mitte = 0, blank = 1;
      for (let k = 0; k <= 20; k++) {
        const rr = herz.r2 + (rEck - herz.r2) * (k / 20);
        for (let j = 0; j < 360; j++) {
          const h = B.fieldAt(plan, rr, (j / 360) * Math.PI * 2);
          if (h > mitte) mitte = h;
        }
      }
      /* Die blanke Fläche: das Niedrigste, was im Blatt überhaupt vorkommt. */
      for (let k = 0; k <= 30; k++) {
        for (let j = 0; j < 180; j++) {
          const h = B.fieldAt(plan, 0.30 + k * 0.02, (j / 180) * Math.PI * 2);
          if (h < blank) blank = h;
        }
      }
      return { bau: bau, n: plan.n, hoehen: hoehen, faellt: faellt,
               spanne: spanne, mitte: mitte, blank: blank };
    });

    return { zahl: zahl, fest: fest, ohneZufall: ohneZufall,
             palastBleibt: palastBleibt, schief: schief, profile: profile };
  });

  bauten.profile.forEach(function (p) {
    console.log('  ' + pad(p.bau, 14) + pad(p.n + '-zählig', 11) +
                p.hoehen.map(function (h) { return h.toFixed(2); }).join('  ') +
                '   Mitte ' + p.mitte.toFixed(2) +
                '   Spanne ' + p.spanne.toFixed(2));
  });

  const fehlt = Object.keys(bauten.zahl).filter(function (b) { return !bauten.zahl[b]; });
  prüfe('alle acht Grammatiken kommen vor', fehlt.length === 0,
        Object.keys(bauten.zahl).map(function (b) {
          return b + ' ' + bauten.zahl[b];
        }).join(', '));
  prüfe('der Seed bestimmt die Grammatik', bauten.fest, '400 Seeds');
  prüfe('die Wahl verbraucht keinen Zufall', bauten.ohneZufall,
        'gleiche Maße bei Palast und Kuppel');
  prüfe('ein Blatt ohne Grammatik bleibt ein Palast', bauten.palastBleibt);
  prüfe('jedes Feld ist exakt um 2π/n drehsymmetrisch', bauten.schief < 1e-9,
        'größte Abweichung ' + bauten.schief.toExponential(1));
  prüfe('in jeder Grammatik nimmt das Relief nach innen ab',
        bauten.profile.every(function (p) { return p.faellt && p.spanne > 1.15; }),
        bauten.profile.filter(function (p) { return !(p.faellt && p.spanne > 1.15); })
              .map(function (p) { return p.bau; }).join(', ') ||
        'alle acht, schwächste Spanne ' +
        Math.min.apply(null, bauten.profile.map(function (p) { return p.spanne; })).toFixed(2));
  prüfe('in jeder Grammatik bleibt die Mitte auffindbar',
        bauten.profile.every(function (p) { return p.mitte / p.blank > 1.25; }),
        'schwächste ' + Math.min.apply(null, bauten.profile.map(function (p) {
          return p.mitte / p.blank;
        })).toFixed(2) + '-fach');

  /* Die Trennschärfe der leichten Hand. Sie entscheidet, ob man ein Blatt
     erst zeichnen und danach ausmalen kann – und sie war beim Umstieg auf
     den Wegauftrag mitgeändert worden, ohne dass ein Befund das verlangt
     hätte. Über ?griff= lässt sich vergleichen; geprüft wird beides: dass
     die Voreinstellung unangetastet bleibt, und dass der Schalter die
     Fläche zurückhält, ohne die Linie langsamer zu machen. */
  console.log('\nDie Trennschärfe (?griff=)');
  const trenn = await page.evaluate(function () {
    const B = window.Blatt;
    const messe = function (id) {
      B.setGriff(id);
      B.makeSheetFull(555123, 'tag', 'erde', 'bluete');
      const S = B.SIZE, C = S / 2;
      for (let rad = 14; rad < S * 0.47; rad += 18) {
        const pts = [];
        for (let i = 0; i <= 300; i++) {
          const a = (i / 300) * Math.PI * 2;
          pts.push(C + Math.cos(a) * rad, C + Math.sin(a) * rad);
        }
        B.rubPath(pts, 0.0);                       // leichte, zügige Hand
      }
      const rel = B.sheet.relief, den = B.sheet.dens;
      let gS = 0, gN = 0, fS = 0, fN = 0;
      for (let i = 0; i < rel.length; i += 13) {
        const h = rel[i] / 255;
        if (h > 0.90) { gS += den[i]; gN++; }
        else if (h > 0.36 && h < 0.40) { fS += den[i]; fN++; }
      }
      return { linie: gS / gN, flaeche: fS / fN };
    };
    const vor = B.griff();
    const werte = {};
    ['flaechig', 'mittel', 'zart', 'zeichnend'].forEach(function (id) { werte[id] = messe(id); });
    B.setGriff(B.GRIFF_VOREINSTELLUNG);
    const prüfeAlias = function (alt, neu) {
      B.setGriff(alt);
      const a = B.griff();
      B.setGriff(neu);
      const b = B.griff();
      return a.light === b.light && a.firm === b.firm && a.base === b.base;
    };
    const alias = prüfeAlias('damals', 'zeichnend') && prüfeAlias('jetzt', 'flaechig');
    return { vor: vor, werte: werte, namen: Object.keys(B.GRIPS), alias: alias };
  });

  ['flaechig', 'mittel', 'zart', 'zeichnend'].forEach(function (id) {
    const w = trenn.werte[id];
    console.log('  ' + pad(id, 24) + pad('Linie ' + w.linie.toFixed(3), 14) +
                pad('Fläche ' + w.flaeche.toFixed(3), 16) +
                (w.linie / w.flaeche).toFixed(1) + ':1');
  });
  /* Die Voreinstellung ist seit v1-15 wieder die flächige Kurve — nach dem
     zweiten Handtest am iPad, bei dem alle vier Griffe in derselben Fassung
     nebeneinander lagen. Sie steht hier Wert für Wert, weil sich an ihr
     entscheidet, wie sich die App anfühlt, und weil sie schon zweimal
     unbemerkt verrutscht ist. */
  prüfe('ohne Angabe kommt die flächige Kurve',
        trenn.vor.light === 2.0 && trenn.vor.firm === 0.30 &&
        trenn.vor.base === 0.18 && trenn.vor.pressW === 0.55 && trenn.vor.slowW === 0.40,
        'GAMMA_LIGHT ' + trenn.vor.light + ', GAMMA_FIRM ' + trenn.vor.firm +
        ', GRIP_BASE ' + trenn.vor.base);

  /* Und die Reihenfolge muss stehen: Je weiter vorn, desto schärfer trennt
     die leichte Hand. Welcher davon die Voreinstellung ist, entscheidet der
     Handtest — dass sie sich unterscheiden, entscheidet die Rechnung. */
  const reihe = ['zeichnend', 'zart', 'mittel', 'flaechig'].map(function (id) {
    return trenn.werte[id].linie / trenn.werte[id].flaeche;
  });
  let geordnet = true;
  for (let i = 1; i < reihe.length; i++) if (reihe[i] >= reihe[i - 1]) geordnet = false;
  prüfe('die vier Griffe stehen in der Reihenfolge ihrer Trennschärfe', geordnet,
        reihe.map(function (v) { return v.toFixed(1) + ':1'; }).join(' > '));

  /* Die Adressen aus der Vergleichsphase dürfen nicht ins Leere laufen. */
  prüfe('die alten Namen bleiben gültig', trenn.alias,
        'damals → zeichnend, jetzt → flaechig');
  const vFlach = trenn.werte.flaechig.linie / trenn.werte.flaechig.flaeche;
  const vZart  = trenn.werte.zart.linie / trenn.werte.zart.flaeche;
  prüfe('zart hält die Fläche zurück, flaechig nicht', vZart > vFlach * 2.5,
        'zart ' + vZart.toFixed(1) + ':1 gegen flaechig ' + vFlach.toFixed(1) + ':1');
  prüfe('die Linie kommt trotzdem gleich schnell',
        Math.abs(trenn.werte.zart.linie - trenn.werte.flaechig.linie) <
        trenn.werte.flaechig.linie * 0.12,
        trenn.werte.zart.linie.toFixed(3) + ' gegen ' +
        trenn.werte.flaechig.linie.toFixed(3));
  prüfe('vier Griffe stehen zur Wahl', trenn.namen.length === 4,
        trenn.namen.join(' · '));

  const ladeAuf = await page.evaluate(async function () {
    const B = window.Blatt;
    B.openLade();
    for (let i = 0; i < 120; i++) {
      await new Promise(function (r) { requestAnimationFrame(r); });
      const alle = document.querySelectorAll('.lade-sheet canvas');
      if (alle.length === 6 && Array.prototype.every.call(alle, function (cv) {
        const d = cv.getContext('2d').getImageData(cv.width >> 1, 0, 1, cv.height).data;
        for (let k = 0; k < d.length; k += 4) if (d[k] !== d[0]) return true;
        return false;
      })) break;
    }
    return {
      offen: !document.getElementById('lade').hidden,
      kategorien: document.querySelectorAll('.lade-kind').length,
      welten: document.querySelectorAll('.lade-world').length,
      blaetter: document.querySelectorAll('.lade-sheet canvas').length,
      /* Die Vorschauen entstehen eine je Bild, damit die Lade sofort
         dasteht. Wie viele sind fertig, und wie schwach ist die
         schwächste? Beides sagen, sonst weiß man bei einem Befund nicht,
         ob es am Aussehen lag oder am Zeitpunkt. */
      kontraste: Array.prototype.map.call(
        document.querySelectorAll('.lade-sheet canvas'),
        function (cv) {
          const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          let min = 255, max = 0;
          for (let k = 0; k < d.length; k += 4 * 37) {
            const l = (d[k] + d[k + 1] + d[k + 2]) / 3;
            if (l < min) min = l;
            if (l > max) max = l;
          }
          return Math.round(max - min);
        })
    };
  });
  prüfe('die Lade zeigt Stimmung, Pigmente und Blätter',
        ladeAuf.offen && ladeAuf.kategorien === 5 && ladeAuf.welten === 5 && ladeAuf.blaetter === 6,
        ladeAuf.kategorien + ' Stimmungen, ' + ladeAuf.welten + ' Welten, ' + ladeAuf.blaetter + ' Blätter');
  const fertig = ladeAuf.kontraste.filter(function (c) { return c > 25; }).length;
  prüfe('die Ausschnitte zeigen wirklich etwas',
        fertig === ladeAuf.kontraste.length,
        fertig + ' von ' + ladeAuf.kontraste.length + ' fertig, Kontraste ' +
        ladeAuf.kontraste.join('/'));

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

  /* Das Papier. Wer beim dunklen bleiben will, obwohl das Gerät hell steht,
     soll das hier tun können – und beim nächsten Öffnen soll es noch so
     sein. Geprüft wird die ganze Kette: wählen, sehen, mitnehmen, behalten. */
  const papier = await page.evaluate(async function () {
    const B = window.Blatt;
    B.openLade();
    await new Promise(function (r) { setTimeout(r, 400); });
    const kacheln = document.querySelectorAll('.lade-paper');

    document.querySelector('.lade-paper[data-paper="nacht"]').click();
    await new Promise(function (r) { setTimeout(r, 900); });
    const raumDunkel = document.body.dataset.sheet === 'nacht';

    const seed = Number(document.querySelector('.lade-sheet').dataset.seed) >>> 0;
    document.querySelector('.lade-sheet').click();
    await new Promise(function (r) { setTimeout(r, 900); });

    return {
      zwei: kacheln.length === 2,
      raumDunkel: raumDunkel,
      blattDunkel: B.sheet.mode === 'nacht' && B.sheet.seed === seed,
      gemerkt: localStorage.getItem('atelier3-papier')
    };
  });
  prüfe('die Lade zeigt beide Papiere', papier.zwei);
  prüfe('der Raum nimmt den Ton sofort an', papier.raumDunkel);
  prüfe('das Papier kommt mit dem Blatt', papier.blattDunkel);
  prüfe('das Papier bleibt gewählt', papier.gemerkt === 'nacht',
        'gemerkt: ' + papier.gemerkt);

  /* Zurück auf Tag, damit die folgenden Prüfungen auf dem hellen Papier
     laufen wie bisher. */
  await page.evaluate(async function () {
    window.Blatt.openLade();
    await new Promise(function (r) { setTimeout(r, 300); });
    document.querySelector('.lade-paper[data-paper="tag"]').click();
    await new Promise(function (r) { setTimeout(r, 600); });
    document.getElementById('lade-close').click();
    window.Blatt.makeSheet(4242, 'tag');
  });

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

  /* ---- Der Satz an der Tür ---------------------------------------------- */
  console.log('\nDer Satz an der Tür');
  const gedanken = await page.evaluate(function () {
    const B = window.Blatt;
    const alle = B.THOUGHTS;

    /* Kein „du“: Sobald ein Satz anspricht, gibt es jemanden, der spricht. */
    const anrede = alle.filter(function (t) {
      return /\b(du|dir|dich|dein\w*)\b/i.test(t);
    });

    /* Kein Imperativ: „Lass es so stehen“ verlangt etwas, eine Beobachtung
       nicht. */
    const befehl = alle.filter(function (t) {
      return /^(lass|schau|bleib|nimm|probier|folge|denk|atme|halt)/i.test(t);
    });

    /* Keine Erlaubnis erteilende Stimme. */
    const erlaubnis = alle.filter(function (t) {
      return /du (musst|darfst|kannst|sollst)/i.test(t);
    });

    /* Und keiner soll sich zu bald wiederholen. */
    try { localStorage.removeItem('atelier3-gedanken'); } catch (err) {}
    const gezogen = [];
    for (let i = 0; i < 9; i++) gezogen.push(B.nextThought());
    const doppelt = gezogen.length !== new Set(gezogen).size;

    return {
      anzahl: alle.length,
      anrede: anrede, befehl: befehl, erlaubnis: erlaubnis,
      doppelt: doppelt,
      laengster: Math.max.apply(null, alle.map(function (t) { return t.length; }))
    };
  });
  prüfe('fünfundzwanzig Gedanken', gedanken.anzahl === 25, gedanken.anzahl + ' Stück');
  prüfe('keiner sagt „du“', gedanken.anrede.length === 0, gedanken.anrede.join(' | '));
  prüfe('keiner befiehlt', gedanken.befehl.length === 0, gedanken.befehl.join(' | '));
  prüfe('keiner erteilt Erlaubnis', gedanken.erlaubnis.length === 0, gedanken.erlaubnis.join(' | '));
  prüfe('keine Wiederholung in neun Zügen', !gedanken.doppelt);
  prüfe('alle bleiben kurz', gedanken.laengster <= 48, 'längster ' + gedanken.laengster + ' Zeichen');

  /* Er erscheint an der Tür – und nur dort. */
  const tuer = await page.evaluate(async function () {
    const B = window.Blatt;
    const hint = document.getElementById('hint');

    /* Beim bloßen Neuaufbauen eines Blattes: kein Satz. */
    hint.hidden = true;
    hint.textContent = '';
    B.makeSheet(4242, 'tag');
    await new Promise(function (r) { setTimeout(r, 200); });
    const beimFortsetzen = !hint.hidden;

    /* Beim Aufschlagen aus der Lade: einer. */
    B.openLade();
    await new Promise(function (r) { setTimeout(r, 900); });
    document.querySelector('.lade-sheet').click();
    await new Promise(function (r) { setTimeout(r, 900); });
    return {
      beimFortsetzen: beimFortsetzen,
      text: hint.hidden ? '' : hint.textContent,
      ausBibliothek: B.THOUGHTS.indexOf(hint.textContent) !== -1
    };
  });
  prüfe('beim Fortsetzen schweigt die App', !tuer.beimFortsetzen);
  prüfe('am frischen Blatt steht ein Satz', tuer.ausBibliothek, tuer.text ? '„' + tuer.text + '“' : 'nichts');

  /* ---- Was es nicht gibt ------------------------------------------------ */
  console.log('\nWas es nicht gibt');
  const bedienung = await page.evaluate(function () {
    const text = document.body.innerText.toLowerCase();
    return {
      knöpfe: document.querySelectorAll('button').length,
      pigmente: document.querySelectorAll('.pigment').length,
      töne: window.Blatt.sheet.pigments.length,
      zurück: /rückgängig|undo|radier|löschen/.test(text),
      verwerfen: (document.getElementById('stack-remove') || {}).textContent,
      zahl: /\d+\s*%/.test(text),
      speichern: /speichern|sichern/.test(text)
    };
  });
  prüfe('so viele Stifte wie die Welt Töne hat',
        bedienung.pigmente === bedienung.töne,
        bedienung.pigmente + ' Stifte, ' + bedienung.töne + ' Töne');
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
