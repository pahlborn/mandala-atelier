'use strict';

/* ============================================================================
   Erzeugt fonts.css neu.

     node tools/gen-fonts.js              → für diese App
     node tools/gen-fonts.js malstudio    → für die Schwester-App

   Holt die Schriften einmalig von Google Fonts und legt sie als Daten-URI
   in fonts.css ab. Danach braucht die App keinen externen Abruf mehr – das
   ist der einzige Zweck dieses Skripts. Es läuft nicht beim Ausliefern,
   sondern nur, wenn die Schriften ausgetauscht werden sollen.

   Eingebettet wird ausschließlich der Schnitt „latin“. Er deckt Deutsch
   samt Umlauten und ß ab; die übrigen Schnitte würden die Datei ohne
   Nutzen vervielfachen.

   Warum hier auch das Malstudio steht, obwohl es in einem eigenen Repo
   liegt: Es holt seine Schriften bislang bei jedem Start von Google. Das
   ist der einzige Abruf nach außen in allen drei Apps – er bricht den
   Offline-Betrieb (die Schriften stehen in keinem Service-Worker-Vorrat)
   und zwingt der Datenschutzerklärung einen Absatz über einen
   Drittanbieter auf. Das Werkzeug lag hier schon; es doppelt zu schreiben
   wäre die schlechtere Lösung gewesen.

   Das Ziel liegt dann außerhalb dieses Repos. Wo, sagt MALSTUDIO=…,
   sonst wird ../malstudio angenommen.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');

const WURZEL = path.join(__dirname, '..');

const SAETZE = {
  mandala: {
    quelle: 'https://fonts.googleapis.com/css2' +
      '?family=Fraunces:opsz,wght@9..144,400;9..144,600' +
      '&family=Work+Sans:wght@400;500;600' +
      '&family=IBM+Plex+Mono:wght@400;500' +
      '&display=swap',
    ziel: path.join(WURZEL, 'fonts.css')
  },
  malstudio: {
    quelle: 'https://fonts.googleapis.com/css2' +
      '?family=Baloo+2:wght@500;700;800' +
      '&family=Caveat:wght@600;700' +
      '&family=Grandstander:wght@700;800' +
      '&family=Nunito:wght@600;700;800;900' +
      '&display=swap',
    ziel: path.join(process.env.MALSTUDIO || path.join(WURZEL, '..', 'malstudio'),
                    'fonts.css')
  }
};

const WAHL = process.argv[2] || 'mandala';
const SATZ = SAETZE[WAHL];

if (!SATZ) {
  console.error('Unbekannt: ' + WAHL + '. Möglich sind: ' + Object.keys(SAETZE).join(', '));
  process.exit(1);
}

const SOURCE = SATZ.quelle;
const TARGET = SATZ.ziel;

/* Ohne Browser-Kennung liefert Google eine Fassung ohne woff2. */
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
};

function fetch(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: HEADERS }, function (response) {
      if (response.statusCode !== 200) {
        reject(new Error(url + ' antwortete mit ' + response.statusCode));
        return;
      }
      const chunks = [];
      response.on('data', function (chunk) { chunks.push(chunk); });
      response.on('end', function () { resolve(Buffer.concat(chunks)); });
    }).on('error', reject);
  });
}

(async function main() {
  const css = (await fetch(SOURCE)).toString('utf8');

  /* Die Antwort ist eine Folge aus Kommentar (Schnittname) und @font-face. */
  const blocks = css.split('/*').slice(1)
    .map(function (block) { return '/*' + block; })
    .filter(function (block) { return /^\/\*\s*latin\s*\*\//.test(block); });

  if (!blocks.length) throw new Error('Kein Schnitt „latin“ in der Antwort gefunden.');

  let out = '/* ============================================================\n' +
            '   Schriften, lokal eingebettet.\n' +
            '   Erzeugt von tools/gen-fonts.js – nicht von Hand ändern.\n' +
            '   Quelle: Google Fonts, Schnitt latin, Lizenz SIL Open Font License.\n' +
            '   ============================================================ */\n\n';

  for (const block of blocks) {
    const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];
    if (!url) continue;
    const font = await fetch(url);
    out += block
      .replace(/^\/\*[^*]*\*\/\s*/, '')
      .replace(/url\(https:[^)]+\)/,
        'url(data:font/woff2;base64,' + font.toString('base64') + ')')
      .trim() + '\n\n';
    console.log('eingebettet: ' + (block.match(/font-family: '([^']+)'/) || [])[1] +
      ' ' + (block.match(/font-weight: ([^;]+)/) || [])[1] +
      '  (' + Math.round(font.length / 1024) + ' kB)');
  }

  fs.writeFileSync(TARGET, out);
  console.log('\ngeschrieben: ' + TARGET + '  (' + Math.round(out.length / 1024) + ' kB)');
})().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
