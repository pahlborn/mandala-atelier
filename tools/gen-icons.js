'use strict';

/* ============================================================================
   Erzeugt die App-Icons neu.

     node tools/gen-icons.js

   Die Icons sind prozedural – dieselbe Geometrie wie die Motive, nur klein.
   Es liegt also kein Bildbearbeitungsprogramm zwischen Quelltext und Ergebnis.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const SIZES = [72, 120, 152, 180, 192, 512];
const ROOT = path.join(__dirname, '..');

/* Läuft im Browser: zeichnet ein Icon der gegebenen Kantenlänge. */
function drawIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const PAPER  = '#f6f1e7';
  const INK    = '#242424';
  const ACCENT = '#2e6b6b';
  const WARM   = '#b5654a';

  const c = size / 2;
  const TAU = Math.PI * 2;

  /* Hintergrund – bei "maskable" muss das Motiv innerhalb von ~80 % liegen. */
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);

  const R = size * 0.36;          // Außenradius des Motivs
  const axes = 12;
  const step = TAU / axes;
  const UP = -Math.PI / 2;

  function pol(r, a) {
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  }

  function ring(r, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * width);
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.stroke();
  }

  function petals(rInner, rOuter, halfAngle, color, width, fill) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, size * width);
    for (let i = 0; i < axes; i++) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(i * step);
      ctx.translate(-c, -c);
      ctx.beginPath();
      for (let s = 0; s <= 20; s++) {
        const t = s / 20;
        const r = rInner + (rOuter - rInner) * t;
        const da = halfAngle * Math.sin(Math.PI * t);
        const p = pol(r, UP - da);
        if (s === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      for (let s = 20; s >= 0; s--) {
        const t = s / 20;
        const r = rInner + (rOuter - rInner) * t;
        const da = halfAngle * Math.sin(Math.PI * t);
        const p = pol(r, UP + da);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      if (fill) ctx.fill(); else ctx.stroke();
      ctx.restore();
    }
  }

  petals(R * 0.52, R, step * 0.30, WARM, 0.012, true);
  petals(R * 0.52, R, step * 0.30, INK, 0.010, false);
  ring(R * 0.50, 0.012, INK);
  petals(R * 0.14, R * 0.48, step * 0.42, ACCENT, 0.010, true);
  ring(R * 0.12, 0.014, INK);

  return canvas.toDataURL('image/png');
}

/* Auch von gen-nativ.js gebraucht: Das Store-Symbol muss dieselbe Zeichnung
   tragen wie die Symbole auf dem Homescreen, nur größer und ohne
   Alphakanal. Zwei Zeichnungen wären zwei Wahrheiten. */
module.exports = { drawIcon: drawIcon };

/* Nur ausführen, wenn das Skript selbst aufgerufen wurde – nicht, wenn ein
   anderes es einbindet. */
if (require.main !== module) return;

(async function main() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Icons</title>');

  for (const size of SIZES) {
    const dataUrl = await page.evaluate(drawIcon, size);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const file = path.join(ROOT, 'icon-' + size + '.png');
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
    console.log('geschrieben: ' + path.basename(file));
  }

  await browser.close();
})().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
