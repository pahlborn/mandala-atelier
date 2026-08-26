'use strict';

/* ============================================================================
   Zeigt ein Motiv des Malstudios als Bild – Schritt für Schritt und fertig.

     node tools/motiv-blick.js <entwurf.js> [ziel.png]

   Wozu: Ein Motiv besteht aus SVG-Pfaden in einem 800×600-Raster. Wer die
   von Hand schreibt, zeichnet blind. Dieses Werkzeug macht daraus ein Bild,
   damit man sieht, was man tut, statt es zu hoffen.

   Der Entwurf ist eine Datei, die ein Motiv oder mehrere ausgibt:

     module.exports = [{ name:'Kompass', emoji:'🧭', level:'schwer',
                         steps:[ { title:'…', text:'…', shapes:[ '…' ] } ] }];

   Gezeichnet wird genau so wie im Malstudio: Koordinaten 800×600,
   Strichstärke 6, runde Enden und Ecken, Farbe #0C3A4A auf Papier. Ein
   Dreiergespann [x, y, r] ist ein Kreis, alles andere ein SVG-Pfad. Beides
   steht so in outlineToCanvas().

   Oben steht das fertige Bild, darunter die Schritte einzeln – und in jedem
   Schritt grau, was vorher schon da war. So sieht man, ob die Reihenfolge
   für ein Kind Sinn ergibt: Jeder Schritt soll an etwas anschließen, das
   schon steht.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BREIT = 800, HOCH = 600;
const PAPIER = '#FFFDF7';
const TINTE = '#0C3A4A';
const VORHER = '#C9D6DC';   /* was in früheren Schritten schon stand */

async function main() {
  const entwurf = process.argv[2];
  if (!entwurf) {
    console.error('Aufruf: node tools/motiv-blick.js <entwurf.js> [ziel.png]');
    process.exit(1);
  }
  const motive = require(path.resolve(entwurf));
  const liste = Array.isArray(motive) ? motive : [motive];
  const ziel = process.argv[3] ||
    path.join(path.dirname(path.resolve(entwurf)), 'blick.png');

  const browser = await launch();
  const seite = await browser.newPage();

  /* Breite: fertiges Bild oben, darunter die Schritte in Reihen zu vier. */
  const spalten = 4;
  const klein = 260, kleinH = Math.round(klein * HOCH / BREIT);

  let hoehe = 0;
  liste.forEach(function (m) {
    const reihen = Math.ceil(m.steps.length / spalten);
    hoehe += 40 + Math.round(klein * 1.6 * HOCH / BREIT) + 30 + reihen * (kleinH + 34) + 26;
  });

  await seite.setViewportSize({ width: spalten * (klein + 14) + 40, height: Math.max(400, hoehe) });

  const html = bau(liste, klein, kleinH, spalten);
  await seite.setContent(html);
  await seite.waitForTimeout(300);
  await seite.screenshot({ path: ziel, fullPage: true });
  await browser.close();

  liste.forEach(function (m) {
    console.log(m.name + ': ' + m.steps.length + ' Schritte, ' +
      m.steps.reduce(function (n, s) { return n + s.shapes.length; }, 0) + ' Formen');
  });
  console.log('Bild: ' + ziel);
}

/* Ein Motiv als SVG. `bis` sagt, wie viele Schritte in Tinte stehen; alles
   davor ist grau, alles danach fehlt. */
function svg(motiv, bis, breite) {
  const hoehe = Math.round(breite * HOCH / BREIT);
  let s = '<svg width="' + breite + '" height="' + hoehe + '" viewBox="0 0 ' + BREIT + ' ' + HOCH + '">'
        + '<rect width="' + BREIT + '" height="' + HOCH + '" fill="' + PAPIER + '"/>';

  motiv.steps.forEach(function (st, i) {
    if (i > bis) return;
    const farbe = (i === bis) ? TINTE : VORHER;
    st.shapes.forEach(function (sh) {
      if (Array.isArray(sh)) {
        s += '<circle cx="' + sh[0] + '" cy="' + sh[1] + '" r="' + sh[2] + '" fill="none" stroke="'
           + farbe + '" stroke-width="6"/>';
      } else {
        s += '<path d="' + sh + '" fill="none" stroke="' + farbe
           + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>';
      }
    });
  });
  return s + '</svg>';
}

function bau(liste, klein, kleinH, spalten) {
  let h = '<style>body{margin:0;background:#EDE6D8;'
        + 'font:13px/1.4 -apple-system,system-ui,sans-serif;color:#2f2a22}'
        + '.motiv{padding:20px}'
        + 'h2{margin:0 0 10px;font-size:19px}'
        + '.gross{border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.18)}'
        + '.reihe{display:flex;flex-wrap:wrap;gap:14px;margin-top:16px}'
        + '.schritt{width:' + klein + 'px}'
        + '.schritt svg{border-radius:7px;box-shadow:0 1px 4px rgba(0,0,0,.14)}'
        + '.schritt b{display:block;margin-top:5px;font-size:12.5px}'
        + '.schritt small{color:#6d6355;font-size:11.5px}'
        + '</style>';

  liste.forEach(function (m) {
    h += '<div class="motiv"><h2>' + (m.emoji || '') + ' ' + m.name +
         ' <small style="color:#6d6355;font-weight:400">' + (m.level || '') + ' · ' +
         m.steps.length + ' Schritte</small></h2>';
    h += '<div class="gross">' + svg(m, m.steps.length - 1, Math.round(klein * 1.6)) + '</div>';
    h += '<div class="reihe">';
    m.steps.forEach(function (st, i) {
      h += '<div class="schritt">' + svg(m, i, klein) +
           '<b>' + (st.emoji || '') + ' ' + (i + 1) + '. ' + (st.title || '') + '</b>' +
           '<small>' + (st.text || '') + '</small></div>';
    });
    h += '</div></div>';
  });
  return h;
}

main().catch(function (err) { console.error(err); process.exit(1); });
