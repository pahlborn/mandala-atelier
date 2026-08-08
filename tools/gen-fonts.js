'use strict';

/* ============================================================================
   Erzeugt fonts.css neu.

     node tools/gen-fonts.js

   Holt die drei Schriften einmalig von Google Fonts und legt sie als
   Daten-URI in fonts.css ab. Danach braucht die App keinen externen Abruf
   mehr – das ist der einzige Zweck dieses Skripts. Es läuft nicht beim
   Ausliefern, sondern nur, wenn die Schriften ausgetauscht werden sollen.

   Eingebettet wird ausschließlich der Schnitt „latin“. Er deckt Deutsch
   samt Umlauten und ß ab; die übrigen Schnitte würden die Datei ohne
   Nutzen vervielfachen.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE = 'https://fonts.googleapis.com/css2' +
  '?family=Fraunces:opsz,wght@9..144,400;9..144,600' +
  '&family=Work+Sans:wght@400;500;600' +
  '&family=IBM+Plex+Mono:wght@400;500' +
  '&display=swap';

/* Ohne Browser-Kennung liefert Google eine Fassung ohne woff2. */
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
};

const TARGET = path.join(__dirname, '..', 'fonts.css');

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
  console.log('\ngeschrieben: fonts.css  (' + Math.round(out.length / 1024) + ' kB)');
})().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
