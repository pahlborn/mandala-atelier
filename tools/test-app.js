'use strict';

/* ============================================================================
   Automatischer Durchlauf durch alle Motive.

     npm install
     node tools/test-app.js

   Geprüft wird vor allem eines: Bleibt die Farbe in ihrem Feld? Eine Vorlage
   mit einer offenen Stelle lässt Farbe bis in die Ecken laufen und ist damit
   für das Füllwerkzeug unbrauchbar.

   Zwei Hinweise zur Auswertung:
     * Meldungen zu Service Worker und ERR_CONNECTION_RESET sind beim Öffnen
       über file:// normal – es gibt keinen Origin und keine Schriften.
     * Ein sehr niedriger Füllanteil liegt meist an den Testpunkten, nicht an
       der App: liegt ein Punkt genau auf einer Linie, füllt er nichts.
   ========================================================================== */

const path = require('path');
const { launch } = require('./browser');

const FILE_URL = 'file://' + path.join(__dirname, '..', 'index.html');

/* Testpunkte: Radien quer durch das Motiv, Winkel in den Feldmitten und
   leicht daneben – aber nie auf der Speiche bei einem halben Segment. */
const RADII = [70, 130, 190, 250, 310, 370, 400];
const ANGLE_OFFSETS = [0, 0.22, -0.22];
const WEDGES = 12;

async function run() {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  const noise = [];
  page.on('console', function (msg) {
    if (msg.type() === 'error') noise.push(msg.text());
  });
  page.on('pageerror', function (err) { noise.push('pageerror: ' + err.message); });

  await page.goto(FILE_URL);
  await page.waitForFunction('window.MandalaAtelier && window.MandalaAtelier.MOTIFS.length > 0');

  const motifs = await page.evaluate(function () {
    return window.MandalaAtelier.MOTIFS.map(function (m) {
      return { id: m.id, name: m.name, axes: m.axes, kind: m.kind || 'plain' };
    });
  });

  console.log('Mandala Atelier – Motivdurchlauf');
  console.log(motifs.length + ' Vorlagen\n');

  const results = [];

  for (const motif of motifs) {
    const result = await page.evaluate(function (args) {
      const app = window.MandalaAtelier;
      const motif = args.motif;
      const SIZE = app.SIZE;
      const R_OUT = app.R_OUT;

      app.loadMotif(motif.id);

      /* Alle Felder mit derselben Farbe fluten. */
      const step = (Math.PI * 2) / motif.axes;
      const UP = -Math.PI / 2;
      let attempts = 0;
      for (let w = 0; w < Math.min(args.wedges, motif.axes); w++) {
        for (const offset of args.offsets) {
          const a = UP + (w + offset) * step;
          for (const r of args.radii) {
            if (r >= R_OUT - 6) continue;
            const p = app.pol(r, a);
            attempts++;
            app.floodFill(p[0], p[1], '#2e6b6b');
          }
        }
      }

      /* Auswertung auf der Farbebene. */
      const canvas = app.layers.fill.canvas;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      const data = ctx.getImageData(0, 0, w, h).data;
      const dpr = w / SIZE;

      let inside = 0, insideFilled = 0, outsideFilled = 0;
      const cx = w / 2, cy = h / 2, rOut = R_OUT * dpr;

      /* Aus Geschwindigkeitsgründen jede vierte Zeile und Spalte. */
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const alpha = data[(y * w + x) * 4 + 3];
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= rOut * rOut) {
            inside++;
            if (alpha > 0) insideFilled++;
          } else if (alpha > 0) {
            outsideFilled++;
          }
        }
      }

      /* Ecken: dorthin darf von innen nie Farbe gelangen. */
      const corners = [[10, 10], [SIZE - 10, 10], [10, SIZE - 10], [SIZE - 10, SIZE - 10]];
      const leaked = corners.some(function (c) {
        const x = Math.round(c[0] * dpr), y = Math.round(c[1] * dpr);
        return data[(y * w + x) * 4 + 3] > 0;
      });

      return {
        attempts: attempts,
        filled: inside ? (insideFilled / inside) * 100 : 0,
        outside: outsideFilled,
        leaked: leaked,
        legend: app.state.legend.length,
        fields: app.state.fields ? app.state.fields.length : 0
      };
    }, { motif: motif, radii: RADII, offsets: ANGLE_OFFSETS, wedges: WEDGES });

    results.push(Object.assign({ motif: motif }, result));

    const flags = [];
    if (result.leaked) flags.push('UNDICHT');
    if (result.filled < 5) flags.push('kaum gefüllt');
    if (motif.kind !== 'plain' && result.legend === 0) flags.push('LEGENDE LEER');

    console.log(
      pad(motif.name, 24) +
      pad(motif.axes + ' Achsen', 11) +
      pad(result.filled.toFixed(1) + ' % gefüllt', 16) +
      pad(result.attempts + ' Tipps', 11) +
      (flags.length ? '← ' + flags.join(', ') : 'ok')
    );
  }

  /* Legende der Zähl- und Rechenmandalas ist zweimal danebengegangen –
     deshalb wird sie hier ausdrücklich geprüft. */
  console.log('\nZähl- und Rechenmandalas');
  for (const result of results.filter(function (r) { return r.motif.kind !== 'plain'; })) {
    console.log(
      pad('  ' + result.motif.name, 26) +
      pad(result.fields + ' Felder', 12) +
      result.legend + ' Legendeneinträge'
    );
  }

  /* Der Kern der App: ein Tipp färbt alle gleichwertigen Felder zugleich.
     Bei Zähl- und Rechenmandalas gilt genau das Gegenteil – dort trägt jedes
     Feld einen eigenen Wert und darf nur einzeln gefärbt werden. */
  console.log('\nEin einzelner Tipp färbt');
  const singleTap = await page.evaluate(function () {
    const app = window.MandalaAtelier;
    const canvas = app.layers.fill.canvas;
    const dpr = canvas.width / app.SIZE;

    function painted(data, point) {
      const x = Math.round(point[0] * dpr), y = Math.round(point[1] * dpr);
      return data[(y * canvas.width + x) * 4 + 3] > 0;
    }

    function tap(id, r, offset) {
      app.loadMotif(id);
      const motif = app.MOTIFS.filter(function (m) { return m.id === id; })[0];
      const step = (Math.PI * 2) / motif.axes;
      const angle = -Math.PI / 2 + offset * step;
      app.floodFill.apply(null, app.pol(r, angle).concat('#2e6b6b'));

      const data = canvas.getContext('2d')
        .getImageData(0, 0, canvas.width, canvas.height).data;

      if (app.state.fields) {
        /* Zähl-/Rechenmandala: es darf genau ein Feld gefärbt sein. */
        const hit = app.state.fields.filter(function (f) {
          return painted(data, app.pol(f.r, f.a));
        }).length;
        return { id: id, expected: 1, hit: hit, of: app.state.fields.length, kind: 'Feldern' };
      }

      /* Sonst: alle gleichwertigen Positionen zugleich. */
      let hit = 0;
      for (let i = 0; i < motif.axes; i++) {
        if (painted(data, app.pol(r, angle + i * step))) hit++;
      }
      return { id: id, expected: motif.axes, hit: hit, of: motif.axes, kind: 'Positionen' };
    }

    return [
      tap('sternkranz', 340, 0),
      tap('mustertanz', 300, 0.2),
      tap('zaehlen6', 330, 0),
      tap('zaehlen10', 330, 0),
      tap('rechnen10', 330, 0),
      tap('rechnen20', 330, 0)
    ];
  });

  const tapProblems = [];
  singleTap.forEach(function (row) {
    const ok = row.hit === row.expected;
    if (!ok) tapProblems.push(row.id);
    console.log(
      pad('  ' + row.id, 26) +
      pad(row.hit + ' von ' + row.of + ' ' + row.kind, 24) +
      (ok ? 'wie erwartet' : '← erwartet: ' + row.expected)
    );
  });

  /* Das Blatt muss quadratisch bleiben – sonst wird aus dem Mandala eine
     Ellipse. Im Hochformat ist das schon einmal passiert. */
  console.log('\nSeitenverhältnis des Blatts');
  const layoutProblems = [];
  const VIEWPORTS = [
    { name: 'iPad quer',  width: 1180, height: 820 },
    { name: 'iPad hoch',  width: 820,  height: 1180 },
    { name: 'Telefon',    width: 390,  height: 844 },
    { name: 'Schreibtisch', width: 1600, height: 900 }
  ];

  /* Mit der längsten Farblegende – genau dieser Fall hat die Bühne
     zusammengedrückt, bis das Blatt unter der Bedienleiste lag. */
  await page.evaluate(function () { window.MandalaAtelier.loadMotif('zaehlen10'); });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const box = await page.evaluate(function () {
      const stack = document.getElementById('stack').getBoundingClientRect();
      const stage = document.querySelector('.stage').getBoundingClientRect();
      return {
        width: stack.width,
        height: stack.height,
        contained: stack.top >= stage.top - 1 && stack.bottom <= stage.bottom + 1,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
    const square = Math.abs(box.width - box.height) <= 1;
    if (!square || box.overflow || !box.contained) layoutProblems.push(viewport.name);
    console.log(
      pad('  ' + viewport.name, 26) +
      pad(Math.round(box.width) + ' × ' + Math.round(box.height), 16) +
      (square ? 'quadratisch' : '← gestaucht') +
      (box.contained ? '' : ', ← ragt aus der Bühne') +
      (box.overflow ? ', ← Seite läuft seitlich über' : '')
    );
  }
  await page.setViewportSize({ width: 1400, height: 1000 });

  /* Zeichnen über echte Zeigerereignisse – prüft nebenbei die Umrechnung
     von Bildschirm- in Blattkoordinaten. */
  console.log('\nZeichnen mit dem Zeiger');
  await page.evaluate(function () {
    window.MandalaAtelier.loadMotif('');
    window.MandalaAtelier.state.axes = 8;
    window.MandalaAtelier.state.mirror = false;
  });

  const rect = await page.evaluate(function () {
    const r = document.getElementById('stack').getBoundingClientRect();
    return { left: r.left, top: r.top, size: r.width };
  });
  const toScreen = function (p) {
    return [rect.left + (p[0] / 900) * rect.size, rect.top + (p[1] / 900) * rect.size];
  };

  const from = toScreen([450, 180]);
  const to = toScreen([560, 250]);
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await page.mouse.up();

  const strokeHits = await page.evaluate(function () {
    const app = window.MandalaAtelier;
    const canvas = app.layers.draw.canvas;
    const dpr = canvas.width / app.SIZE;
    const data = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;

    /* Mitte des Zuges, um jede Achse gedreht. */
    const mid = [505, 215];
    const dx = mid[0] - 450, dy = mid[1] - 450;
    const step = (Math.PI * 2) / 8;
    let hits = 0;
    for (let i = 0; i < 8; i++) {
      const c = Math.cos(i * step), s = Math.sin(i * step);
      const x = Math.round((450 + dx * c - dy * s) * dpr);
      const y = Math.round((450 + dx * s + dy * c) * dpr);
      /* kleine Umgebung absuchen, der Zug ist nur wenige Pixel breit */
      let found = false;
      for (let oy = -6; oy <= 6 && !found; oy++) {
        for (let ox = -6; ox <= 6 && !found; ox++) {
          const index = ((y + oy) * canvas.width + (x + ox)) * 4 + 3;
          if (data[index] > 60) found = true;
        }
      }
      if (found) hits++;
    }
    return hits;
  });

  const strokeOk = strokeHits === 8;
  if (!strokeOk) tapProblems.push('Zeichnen');
  console.log('  ein Zug erscheint an ' + strokeHits + ' von 8 Positionen   ' +
    (strokeOk ? 'wie erwartet' : '← erwartet: 8'));

  /* Gleicher Seed, gleiche Aufgaben – auf jedem Gerät. */
  const stable = await page.evaluate(function () {
    const app = window.MandalaAtelier;
    const motif = app.MOTIFS.filter(function (m) { return m.id === 'rechnen20'; })[0];
    const a = app.makeFields(motif).map(function (f) { return f.text; }).join('|');
    const b = app.makeFields(motif).map(function (f) { return f.text; }).join('|');
    return { equal: a === b, sample: a.split('|').slice(0, 5).join('  ') };
  });
  console.log('\nSeed stabil: ' + (stable.equal ? 'ja' : 'NEIN') + '   z. B. ' + stable.sample);

  const broken = results.filter(function (r) {
    return r.leaked || (r.motif.kind !== 'plain' && r.legend === 0);
  }).map(function (r) { return r.motif.name; }).concat(tapProblems, layoutProblems);

  if (noise.length) {
    console.log('\nMeldungen des Browsers (bei file:// erwartbar):');
    Array.from(new Set(noise)).slice(0, 6).forEach(function (line) {
      console.log('  ' + line.slice(0, 120));
    });
  }

  console.log('\n' + (broken.length
    ? broken.length + ' Befund(e): ' + broken.join(', ')
    : 'Alle Motive dicht, Symmetrie wie erwartet.'));

  await browser.close();
  process.exitCode = broken.length ? 1 : 0;
}

function pad(text, width) {
  text = String(text);
  return text.length >= width ? text + '  ' : text + ' '.repeat(width - text.length);
}

run().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
