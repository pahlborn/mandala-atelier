'use strict';

/* ============================================================================
   Erzeugt die App-Icons für Atelier 3.0.

     node tools/gen-atelier3-icons.js

   Sie müssen sich vom Mandala Atelier auf einen Blick unterscheiden – auf
   dem Homescreen liegen beide nebeneinander, und eine Testperson soll nicht
   erst lesen müssen, welche sie gerade öffnet.

   Deshalb ein anderes Bild: nicht ein fertiges Mandala, sondern eines, das
   halb hervorgerieben ist. Ein Ornament, das links unten im Papier
   verschwindet, und darüber die Spur einer Hand.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const SIZES = [72, 120, 152, 180, 192, 512];
const OUT = path.join(__dirname, '..', 'atelier3');

/* Läuft im Browser. */
function drawIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const PAPER  = '#f2ece0';
  const INK    = '#3c342c';
  const WARM   = '#9a4a32';
  const TAU    = Math.PI * 2;
  const c      = size / 2;
  const R      = size * 0.33;      // maskable: Motiv innerhalb ~80 %

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);

  /* Das Ornament kommt auf eine eigene Ebene, damit es danach als Ganzes
     ins Papier zurücktreten kann. */
  const layer = document.createElement('canvas');
  layer.width = size;
  layer.height = size;
  const lx = layer.getContext('2d');

  const petals = 12;
  const step = TAU / petals;

  lx.strokeStyle = INK;
  lx.lineCap = 'round';

  /* Zwei Randlinien. */
  [R, R * 0.86].forEach(function (r) {
    lx.lineWidth = Math.max(1, size * 0.011);
    lx.beginPath();
    lx.arc(c, c, r, 0, TAU);
    lx.stroke();
  });

  /* Blätterkranz. */
  lx.lineWidth = Math.max(1, size * 0.0135);
  for (let i = 0; i < petals; i++) {
    const a = -Math.PI / 2 + i * step;
    lx.save();
    lx.translate(c, c);
    lx.rotate(a);
    lx.beginPath();
    const r1 = R * 0.40, r2 = R * 0.80, half = step * 0.40;
    for (let s = 0; s <= 16; s++) {
      const t = s / 16;
      const rr = r1 + (r2 - r1) * t;
      const da = half * Math.sin(Math.PI * t);
      const x = Math.cos(-Math.PI / 2 - da + Math.PI / 2) * rr;
      const y = Math.sin(-Math.PI / 2 - da + Math.PI / 2) * rr;
      if (s === 0) lx.moveTo(x, y); else lx.lineTo(x, y);
    }
    for (let s = 16; s >= 0; s--) {
      const t = s / 16;
      const rr = r1 + (r2 - r1) * t;
      const da = half * Math.sin(Math.PI * t);
      lx.lineTo(Math.cos(-Math.PI / 2 + da + Math.PI / 2) * rr,
                Math.sin(-Math.PI / 2 + da + Math.PI / 2) * rr);
    }
    lx.closePath();
    lx.stroke();
    lx.restore();
  }

  /* Nabe. */
  lx.lineWidth = Math.max(1, size * 0.013);
  lx.beginPath();
  lx.arc(c, c, R * 0.30, 0, TAU);
  lx.stroke();
  lx.fillStyle = INK;
  lx.beginPath();
  lx.arc(c, c, R * 0.10, 0, TAU);
  lx.fill();

  /* Und jetzt das Eigentliche: Das Ornament ist nur dort da, wo eine Hand
     gewesen ist. Nach links unten läuft es ins leere Papier aus. */
  const fade = lx.createLinearGradient(size * 0.14, size * 0.92, size * 0.86, size * 0.16);
  fade.addColorStop(0.00, 'rgba(0,0,0,1)');
  fade.addColorStop(0.34, 'rgba(0,0,0,0.82)');
  fade.addColorStop(0.62, 'rgba(0,0,0,0.10)');
  fade.addColorStop(1.00, 'rgba(0,0,0,0)');
  lx.globalCompositeOperation = 'destination-out';
  lx.fillStyle = fade;
  lx.fillRect(0, 0, size, size);

  /* Die Spur selbst: ein warmer, weicher Wisch quer über die obere Hälfte. */
  const smudge = ctx.createRadialGradient(
    c + R * 0.30, c - R * 0.42, R * 0.05,
    c + R * 0.30, c - R * 0.42, R * 1.15);
  smudge.addColorStop(0, 'rgba(154, 74, 50, 0.30)');
  smudge.addColorStop(1, 'rgba(154, 74, 50, 0)');
  ctx.fillStyle = smudge;
  ctx.fillRect(0, 0, size, size);

  ctx.drawImage(layer, 0, 0);

  /* Ein Hauch Korn, damit es nach Papier aussieht und nicht nach Vektor. */
  const grain = ctx.getImageData(0, 0, size, size);
  const d = grain.data;
  for (let i = 0; i < d.length; i += 4) {
    /* Sparsam: Rauschen lässt sich nicht komprimieren, und das 512er
       Icon liegt im Vorrat des Service Workers. */
    const n = (Math.random() - 0.5) * (size > 200 ? 2.2 : 4);
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  /* Ein einzelner warmer Punkt am Rand – der Wiedererkennungsanker, der
     auch bei 72 Pixeln noch trägt. */
  ctx.fillStyle = WARM;
  ctx.beginPath();
  ctx.arc(c + R * 0.72, c - R * 0.72, Math.max(1.6, size * 0.030), 0, TAU);
  ctx.fill();

  return canvas.toDataURL('image/png');
}

(async function main() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Icons</title>');

  for (const size of SIZES) {
    const dataUrl = await page.evaluate(drawIcon, size);
    const file = path.join(OUT, 'icon-' + size + '.png');
    fs.writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    console.log('geschrieben: atelier3/' + path.basename(file));
  }

  await browser.close();
})().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
