'use strict';

/* ============================================================================
   Automatischer Durchlauf durch alle Motive.

     npm install
     node tools/test-app.js

   Geprüft wird vor allem eines: Bleibt die Farbe in ihrem Feld? Eine Vorlage
   mit einer offenen Stelle lässt Farbe bis in die Ecken laufen und ist damit
   für das Füllwerkzeug unbrauchbar.

   Zwei Hinweise zur Auswertung:
     * Meldungen zum Service Worker sind beim Öffnen über file:// normal –
       ohne Origin lässt er sich nicht registrieren.
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

  /* Die App darf nichts von außen holen. Schriften stecken als Daten-URI
     in fonts.css – ein Abruf hier wäre ein Rückfall. */
  const external = [];
  page.on('request', function (request) {
    const url = request.url();
    if (!url.startsWith('file:') && !url.startsWith('data:')) external.push(url);
  });

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
    { name: 'Telefon groß', width: 430, height: 932 },
    { name: 'Schreibtisch', width: 1600, height: 900 }
  ];

  /* Mit der längsten Farblegende – genau dieser Fall hat die Bühne
     zusammengedrückt, bis das Blatt unter der Bedienleiste lag. */
  await page.evaluate(function () { window.MandalaAtelier.loadMotif('zaehlen10'); });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    /* Die Kantenlänge setzt ein ResizeObserver – der braucht einen Bildaufbau. */
    await page.waitForTimeout(150);
    const box = await page.evaluate(function () {
      const stack = document.getElementById('stack').getBoundingClientRect();
      const stage = document.querySelector('.stage').getBoundingClientRect();

      /* Alle Pigmente der Farbwelt müssen im Schnellzugriff sichtbar sein –
         eine seitlich scrollbare Reihe findet niemand. */
      const row = document.getElementById('quick-palette').getBoundingClientRect();
      const swatches = Array.prototype.slice.call(
        document.querySelectorAll('#quick-palette .pigment'));
      const shown = swatches.filter(function (el) {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.left >= row.left - 1 && b.right <= row.right + 1;
      }).length;

      return {
        width: stack.width,
        height: stack.height,
        contained: stack.top >= stage.top - 1 && stack.bottom <= stage.bottom + 1,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        pigments: swatches.length,
        shown: shown
      };
    });
    const square = Math.abs(box.width - box.height) <= 1;
    const allShown = box.shown === box.pigments;
    if (!square || box.overflow || !box.contained || !allShown) {
      layoutProblems.push(viewport.name);
    }
    console.log(
      pad('  ' + viewport.name, 26) +
      pad(Math.round(box.width) + ' × ' + Math.round(box.height), 16) +
      pad(box.shown + '/' + box.pigments + ' Farben', 14) +
      (square ? 'quadratisch' : '← gestaucht') +
      (box.contained ? '' : ', ← ragt aus der Bühne') +
      (allShown ? '' : ', ← Farben abgeschnitten') +
      (box.overflow ? ', ← Seite läuft seitlich über' : '')
    );
  }
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.waitForTimeout(150);

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

  /* Vergrößern: Knöpfe, richtige Koordinaten trotz Maßstab, und – der
     eigentliche Anlass – zwei Finger dürfen nie einen Strich hinterlassen. */
  console.log('\nVergrößern');
  const zoom = await page.evaluate(function () {
    const app = window.MandalaAtelier;
    app.resetZoom();
    app.loadMotif('sternkranz');

    app.zoomBy(1.25);
    app.zoomBy(1.25);
    const scaled = app.state.zoom;

    /* Ein Tipp muss trotz Maßstab an der gemeinten Stelle landen. */
    const canvas = app.layers.draw.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.left + (450 / 900) * rect.width;
    const sy = rect.top + (180 / 900) * rect.height;
    const touch = function (type, id, x, y) {
      return new PointerEvent(type, {
        clientX: x, clientY: y, pointerId: id,
        pointerType: 'touch', bubbles: true, isPrimary: id === 1
      });
    };
    canvas.dispatchEvent(touch('pointerdown', 1, sx, sy));
    canvas.dispatchEvent(touch('pointerup', 1, sx, sy));

    const dpr = canvas.width / app.SIZE;
    const data = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let hit = false;
    const x = Math.round(450 * dpr), y = Math.round(180 * dpr);
    for (let oy = -8; oy <= 8 && !hit; oy++) {
      for (let ox = -8; ox <= 8 && !hit; ox++) {
        if (data[((y + oy) * canvas.width + (x + ox)) * 4 + 3] > 60) hit = true;
      }
    }

    /* Zwei Finger: schieben und zoomen, aber nicht malen. */
    app.resetZoom();
    app.loadMotif('sternkranz');
    const before = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data.slice();
    const box = canvas.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    canvas.dispatchEvent(touch('pointerdown', 1, cx - 60, cy));
    canvas.dispatchEvent(touch('pointerdown', 2, cx + 60, cy));
    for (let i = 1; i <= 8; i++) {
      canvas.dispatchEvent(touch('pointermove', 1, cx - 60 - i * 8, cy));
      canvas.dispatchEvent(touch('pointermove', 2, cx + 60 + i * 8, cy));
    }
    canvas.dispatchEvent(touch('pointerup', 1, cx - 120, cy));
    canvas.dispatchEvent(touch('pointerup', 2, cx + 120, cy));
    const after = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    for (let i = 3; i < after.length; i += 4 * 64) {
      if (after[i] !== before[i]) changed++;
    }
    const gestureZoom = app.state.zoom;
    app.resetZoom();

    return {
      scaled: scaled,
      reset: app.state.zoom,
      hit: hit,
      clean: changed === 0,
      gestureZoom: gestureZoom
    };
  });

  const zoomOk = Math.abs(zoom.scaled - 1.5625) < 0.01 && zoom.reset === 1 &&
    zoom.hit && zoom.clean && zoom.gestureZoom > 1.5;
  console.log('  Knöpfe: ' + Math.round(zoom.scaled * 100) + ' %, zurück auf ' +
    Math.round(zoom.reset * 100) + ' %');
  console.log('  Zeichnen trifft trotz Maßstab: ' + (zoom.hit ? 'ja' : '← NEIN'));
  console.log('  Zwei Finger zoomen auf ' + Math.round(zoom.gestureZoom * 100) +
    ' % und hinterlassen keinen Strich: ' + (zoom.clean ? 'ja' : '← NEIN'));

  /* Größe der einzelnen Felder. Nicht nur „läuft Farbe bis in die Ecken“,
     sondern: Wie viel färbt ein Tipp wirklich? Zu große Felder wirken wie
     eine offene Linie, auch wenn die Geometrie geschlossen ist. Für die
     Messung wird die Symmetrie abgeschaltet, sonst misst man n Felder. */
  console.log('\nGrößtes Einzelfeld je Motiv');
  const cells = await page.evaluate(function () {
    const app = window.MandalaAtelier;
    const canvas = app.layers.fill.canvas;
    const w = canvas.width, h = canvas.height, dpr = w / app.SIZE;
    const ctx = canvas.getContext('2d');
    const rOut = app.R_OUT * dpr;

    function measure() {
      const data = ctx.getImageData(0, 0, w, h).data;
      let inside = 0, filled = 0;
      const sectors = new Set();
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
          const dx = x - w / 2, dy = y - h / 2;
          if (dx * dx + dy * dy > rOut * rOut) continue;
          inside++;
          if (data[(y * w + x) * 4 + 3] > 0) {
            filled++;
            sectors.add(Math.round(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 90)));
          }
        }
      }
      return { share: (filled / inside) * 100, degrees: sectors.size * 2 };
    }

    return app.MOTIFS.map(function (motif) {
      let worst = { share: 0, degrees: 0 };
      [70, 120, 170, 220, 270, 320, 370, 400].forEach(function (r) {
        [0, 0.15, 0.3, -0.15].forEach(function (offset) {
          app.loadMotif(motif.id);
          const kind = motif.kind;
          motif.kind = 'count';                    // Symmetrie fürs Messen aus
          const p = app.pol(r, -Math.PI / 2 + offset * (Math.PI * 2 / motif.axes));
          app.floodFill(p[0], p[1], '#2e6b6b');
          motif.kind = kind;
          const result = measure();
          if (result.share > worst.share) worst = result;
        });
      });
      return {
        id: motif.id,
        name: motif.name,
        kind: motif.kind || 'plain',
        share: worst.share,
        degrees: worst.degrees,
        segment: 360 / motif.axes
      };
    });
  });

  /* Zähl- und Rechenmandalas haben absichtlich große Felder, ebenso das
     Kindergarten-Motiv. Für alles andere gilt eine Obergrenze. */
  const BIG_ON_PURPOSE = ['zaehlen6', 'zaehlen10', 'rechnen10', 'rechnen20', 'ersteformen'];
  const cellProblems = [];

  cells.sort(function (a, b) { return b.share - a.share; });
  cells.slice(0, 6).forEach(function (cell) {
    console.log(
      pad('  ' + cell.name, 26) +
      pad(cell.share.toFixed(1) + ' %', 10) +
      pad(Math.round(cell.degrees) + '° breit', 13) +
      'Segment ' + Math.round(cell.segment) + '°'
    );
  });

  cells.forEach(function (cell) {
    const limit = BIG_ON_PURPOSE.indexOf(cell.id) >= 0 ? 12 : 4;
    /* Reicht ein Feld deutlich über sein Segment hinaus, ist eine Linie offen. */
    if (cell.share > limit || cell.degrees > cell.segment * 1.6) cellProblems.push(cell.name);
  });
  if (cellProblems.length) {
    console.log('  ← zu große oder segmentübergreifende Felder: ' + cellProblems.join(', '));
  }

  /* Galerie: ablegen, wiederfinden, umbenennen, herausnehmen. */
  const gallery = await page.evaluate(function () {
    const app = window.MandalaAtelier;
    app.loadMotif('bluete');
    const p = app.pol(200, -Math.PI / 2);
    app.floodFill(p[0], p[1], '#b5654a');

    return app.Gallery.open()
      .then(function () { return app.keepWork(); })
      .then(function () { return app.Gallery.all(); })
      .then(function (works) {
        const work = works[works.length - 1];
        work.title = 'Probe';
        return app.Gallery.put(work)
          .then(function () { return app.Gallery.all(); })
          .then(function (after) {
            const found = after.filter(function (w) { return w.id === work.id; })[0];
            return app.Gallery.remove(work.id).then(function () {
              return app.Gallery.all().then(function (rest) {
                return {
                  dauerhaft: app.Gallery.persistent,
                  abgelegt: !!found,
                  titel: found ? found.title : '',
                  bild: found ? found.full.slice(0, 14) : '',
                  entfernt: rest.every(function (w) { return w.id !== work.id; })
                };
              });
            });
          });
      });
  });

  const galleryOk = gallery.abgelegt && gallery.titel === 'Probe' &&
    gallery.bild === 'data:image/png' && gallery.entfernt;
  console.log('\nGalerie');
  console.log('  Speicher: ' + (gallery.dauerhaft ? 'IndexedDB' : 'nur diese Sitzung'));
  console.log('  Ablegen, umbenennen, herausnehmen: ' + (galleryOk ? 'wie erwartet' : '← FEHLER'));

  /* Personen, eigene Farbwelt und Sicherung. */
  const atelier = await page.evaluate(function () {
    const app = window.MandalaAtelier;
    const out = {};

    /* Eigene Farbwelt mischen */
    app.setPalette('eigen');
    app.state.color = app.pigments()[0].hex;
    app.mixPigment('#123456');
    out.mischen = app.pigments()[0].hex === '#123456' && app.state.color === '#123456';
    app.setPalette('erde');

    /* Getrennte Galerien */
    return app.Gallery.open().then(function () {
      app.addPerson();
      app.renamePerson('Prüfung A');
      const a = app.state.person;
      app.loadMotif('bluete');
      const p = app.pol(200, -Math.PI / 2);
      app.floodFill(p[0], p[1], '#b5654a');
      return app.keepWork()
        .then(function () { return app.refreshGallery(); })
        .then(function () {
          out.werkeA = app.state.works.length;
          app.addPerson();
          app.renamePerson('Prüfung B');
          return app.refreshGallery();
        })
        .then(function () {
          out.werkeB = app.state.works.length;
          app.selectPerson(a);
          return app.refreshGallery();
        })
        .then(function () {
          out.zurueckA = app.state.works.length;
          return app.Gallery.all();
        })
        .then(function (works) {
          out.alleHabenPerson = works.every(function (w) { return !!w.person; });
          /* Sicherung: einlesen darf nichts verlieren und nichts doppeln. */
          const backup = {
            app: 'mandala-atelier', version: 1,
            people: app.state.people,
            ownPalette: app.PALETTES.filter(function (p) { return p.custom; })[0].colors,
            works: works
          };
          const file = new File([JSON.stringify(backup)], 'sicherung.json',
            { type: 'application/json' });
          app.loadBackup(file);
          return new Promise(function (resolve) { setTimeout(resolve, 500); });
        })
        .then(function () { return app.Gallery.all(); })
        .then(function (after) {
          out.nachEinlesen = after.length;
          return out;
        });
    });
  });

  const atelierOk = atelier.mischen && atelier.werkeA === 1 && atelier.werkeB === 0 &&
    atelier.zurueckA === 1 && atelier.alleHabenPerson &&
    atelier.nachEinlesen === atelier.werkeA;

  console.log('\nAtelier');
  console.log('  Eigene Farbwelt mischen: ' + (atelier.mischen ? 'wie erwartet' : '← FEHLER'));
  console.log('  Galerien getrennt: ' + atelier.werkeA + ' / ' + atelier.werkeB +
    ' / zurück ' + atelier.zurueckA + (atelier.zurueckA === atelier.werkeA ? '   wie erwartet' : '   ← FEHLER'));
  console.log('  Sicherung einlesen ohne Dopplung: ' +
    (atelier.nachEinlesen === atelier.werkeA ? 'wie erwartet' : '← ' + atelier.nachEinlesen + ' statt ' + atelier.werkeA));

  /* Schriften: eingebettet, nicht nachgeladen. */
  const typeOk = await page.evaluate(async function () {
    await document.fonts.load('500 20px "IBM Plex Mono"');
    return ['600 21px Fraunces', '500 15px "Work Sans"', '500 20px "IBM Plex Mono"']
      .every(function (spec) { return document.fonts.check(spec); });
  });
  console.log('\nSchriften geladen: ' + (typeOk ? 'alle drei' : 'NICHT vollständig'));
  console.log('Abrufe nach außen: ' + (external.length ? external.length + ' ← ' + external[0] : 'keine'));

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
  broken.push.apply(broken, cellProblems);
  if (!galleryOk) broken.push('Galerie');
  if (!atelierOk) broken.push('Atelier');
  if (!zoomOk) broken.push('Vergrößern');
  if (!typeOk) broken.push('Schriften');
  if (external.length) broken.push('externe Abrufe');

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
