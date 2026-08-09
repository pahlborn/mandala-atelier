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

    /* Nur der zweite Kontakt – der Handballen – bewegt sich. */
    mach('pointerdown', 1, true, box.left + box.width * 0.5, box.top + box.height * 0.5);
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
    return sum / n;
  });
  prüfe('zweiter Kontakt malt nicht', ballen < 1e-6, 'Dichte ' + ballen.toExponential(1));

  /* ---- Was es nicht gibt ------------------------------------------------ */
  console.log('\nWas es nicht gibt');
  const bedienung = await page.evaluate(function () {
    const text = document.body.innerText.toLowerCase();
    return {
      knöpfe: document.querySelectorAll('button').length,
      pigmente: document.querySelectorAll('.pigment').length,
      zurück: /rückgängig|undo|radier|löschen/.test(text),
      zahl: /\d+\s*%/.test(text),
      speichern: /speichern|sichern/.test(text)
    };
  });
  prüfe('neun Pigmente', bedienung.pigmente === 9, bedienung.pigmente + ' Stück');
  prüfe('kein Rückgängig, kein Radierer', !bedienung.zurück);
  prüfe('keine Prozentanzeige', !bedienung.zahl);
  prüfe('kein Speichern-Knopf', !bedienung.speichern);

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
