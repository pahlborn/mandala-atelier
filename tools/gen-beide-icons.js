'use strict';

/* ============================================================================
   Erzeugt das Symbol der Einstiegsseite.

     node tools/gen-beide-icons.js

   Die Seite ist keine App, bekommt aber ein Symbol: Ohne apple-touch-icon
   legt iOS ein Bildschirmfoto der Seite auf den Homescreen – grau, klein
   beschriftet und von allem anderen nicht zu unterscheiden.

   Wichtiger noch: Es muss sich von den beiden App-Symbolen deutlich
   unterscheiden. Auf dem Homescreen liegen dann drei Dinge nebeneinander,
   und wer zum Malen greift, soll nicht versehentlich die Einstiegsseite
   öffnen. Deshalb kein Mandala und kein Relief, sondern zwei Blätter –
   das Symbol zeigt, dass hier zwei Sachen liegen, nicht eine.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const SIZES = [72, 120, 152, 180, 192, 512];
const ROOT = path.join(__dirname, '..');

function drawIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const ROOM   = '#efe9dd';   // der Ton der Einstiegsseite, nicht der Apps
  const PAPER  = '#f8f4ea';
  const INK    = '#2f2a22';
  const ACCENT = '#2e6b6b';
  const WARM   = '#b5654a';

  const TAU = Math.PI * 2;
  const c = size / 2;

  ctx.fillStyle = ROOM;
  ctx.fillRect(0, 0, size, size);

  /* Zwei Blätter, leicht gegeneinander verdreht, wie sie auf einem Tisch
     liegen. Das hintere ragt nur hervor – so bleibt bei 60 Punkten
     Kantenlänge noch lesbar, dass es zwei sind. */
  function blatt(cx, cy, w, dreh, zeichne) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dreh);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, size * 0.011);
    const r = w * 0.14;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -w / 2);
    ctx.arcTo(w / 2, -w / 2, w / 2, w / 2, r);
    ctx.arcTo(w / 2, w / 2, -w / 2, w / 2, r);
    ctx.arcTo(-w / 2, w / 2, -w / 2, -w / 2, r);
    ctx.arcTo(-w / 2, -w / 2, w / 2, -w / 2, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    zeichne(w);
    ctx.restore();
  }

  const breite = size * 0.50;

  /* hinten: das ruhige Blatt, nur ein paar Bögen – das Relief */
  blatt(c + size * 0.09, c - size * 0.055, breite, 0.13, function (w) {
    ctx.strokeStyle = WARM;
    ctx.lineWidth = Math.max(1, size * 0.013);
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, w * (0.11 + i * 0.09), 0, TAU);
      ctx.stroke();
    }
  });

  /* vorn: das gezeichnete Blatt, ein Stern aus Achsen – die Symmetrie */
  blatt(c - size * 0.09, c + size * 0.055, breite, -0.10, function (w) {
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = Math.max(1, size * 0.013);
    const R = w * 0.30;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.22, Math.sin(a) * R * 0.22);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.60, 0, TAU);
    ctx.stroke();
  });

  return canvas.toDataURL('image/png');
}

(async function main() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Icons</title>');

  for (const size of SIZES) {
    const dataUrl = await page.evaluate(drawIcon, size);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const file = path.join(ROOT, 'beide-icon-' + size + '.png');
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
    console.log('geschrieben: ' + path.basename(file));
  }

  await browser.close();
})().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
