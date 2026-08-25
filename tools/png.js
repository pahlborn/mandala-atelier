'use strict';

/* ============================================================================
   Schreibt ein PNG ohne Alphakanal.

   Warum von Hand: Apple lehnt das Store-Symbol ab, wenn es einen Alphakanal
   hat – auch dann, wenn jedes Pixel darin völlig deckend ist. Und genau das
   liefert ein Browser: `canvas.toDataURL('image/png')` schreibt immer RGBA,
   selbst wenn der Kontext mit `{ alpha: false }` angelegt wurde. Nachgemessen,
   beides ergibt Farbtyp 6.

   Also werden die rohen Pixel aus dem Browser geholt und hier neu verpackt,
   mit Farbtyp 2 – drei Kanäle, kein vierter. Node bringt dafür alles mit;
   eine Abhängigkeit kommt nicht ins Projekt.
   ========================================================================== */

const zlib = require('zlib');

/* Prüfsumme nach PNG-Vorgabe. Die Tabelle wird einmal berechnet. */
const CRC_TABELLE = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABELLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function block(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length, 0);
  const kopf = Buffer.from(typ, 'ascii');
  const summe = Buffer.alloc(4);
  summe.writeUInt32BE(crc32(Buffer.concat([kopf, daten])), 0);
  return Buffer.concat([laenge, kopf, daten, summe]);
}

/* rgba: die Pixel, wie getImageData sie liefert – vier Bytes je Pixel.
   Der vierte wird verworfen. */
function ohneAlpha(rgba, breite, hoehe) {
  /* Jede Zeile bekommt ein Filterbyte vorangestellt; 0 heißt „unverändert“.
     Aufwendigere Filter würden die Datei kleiner machen, aber hier zählt,
     dass man den Code noch lesen kann. */
  const zeilen = Buffer.alloc(hoehe * (1 + breite * 3));
  let o = 0;
  for (let y = 0; y < hoehe; y++) {
    zeilen[o++] = 0;
    for (let x = 0; x < breite; x++) {
      const i = (y * breite + x) * 4;
      zeilen[o++] = rgba[i];
      zeilen[o++] = rgba[i + 1];
      zeilen[o++] = rgba[i + 2];
    }
  }

  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf[8] = 8;      // acht Bit je Kanal
  kopf[9] = 2;      // Farbtyp 2: RGB, kein Alphakanal
  kopf[10] = 0;     // Verfahren
  kopf[11] = 0;     // Filter
  kopf[12] = 0;     // nicht verschränkt

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block('IHDR', kopf),
    block('IDAT', zlib.deflateSync(zeilen, { level: 9 })),
    block('IEND', Buffer.alloc(0))
  ]);
}

module.exports = { ohneAlpha };
