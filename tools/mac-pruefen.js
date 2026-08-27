'use strict';

/* ============================================================================
   Prüft den Mac, bevor der native Durchgang beginnt.

     npm run mac

   Warum es das gibt: Von hier aus lässt sich der Mac nicht ansehen. Wer aus
   der Ferne hilft, sieht weder Xcode noch das Dateisystem noch das
   angeschlossene iPad. Dieses Werkzeug macht daraus einen Bericht, den man
   kopieren und weiterreichen kann — dann ist die Ferndiagnose eine Ablesung
   statt einer Raterei.

   Es ändert nichts. Es liest nur nach und schreibt auf.

   Die Reihenfolge folgt docs/xcode.html: Was oben fehlt, macht alles
   darunter sinnlos.
   ========================================================================== */

const { execSync } = require('child_process');
const fs = require('fs');

/* Ein Befehl, dessen Fehlschlag kein Fehler ist: Vieles darf fehlen, und
   genau das soll der Bericht ja sagen. */
function frag(befehl) {
  try {
    return execSync(befehl, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (err) {
    return null;
  }
}

const zeilen = [];
let fehlt = 0;
let warnung = 0;

function melde(zeichen, name, wert, rat) {
  if (zeichen === '✗') fehlt++;
  if (zeichen === '○') warnung++;
  zeilen.push('  ' + zeichen + '  ' + name.padEnd(26) + (wert || ''));
  if (rat) zeilen.push('       → ' + rat);
}

/* ---------- 0. Überhaupt ein Mac? ---------------------------------------- */

const macOS = frag('sw_vers -productVersion');
if (!macOS) {
  console.log('\nDas hier ist kein Mac.\n');
  console.log('Dieses Werkzeug gehört auf den iMac, nicht auf das iPad und');
  console.log('nicht in eine Cloud-Sitzung. Dort: npm run mac\n');
  process.exit(2);
}

zeilen.push('');
zeilen.push('  Prüfbericht — ' + new Date().toISOString().slice(0, 16).replace('T', ' '));
zeilen.push('  ' + '─'.repeat(56));
melde('✓', 'macOS', macOS + '  (' + (frag('uname -m') || '?') + ')');

/* ---------- 1. Node und npm ---------------------------------------------- */

const node = frag('node --version');
if (node) {
  const gross = parseInt(node.replace(/^v/, ''), 10);
  melde(gross >= 20 ? '✓' : '○', 'Node', node,
        gross >= 20 ? null : 'Capacitor mag Node 20 oder neuer — von nodejs.org die LTS-Fassung');
} else {
  melde('✗', 'Node', 'fehlt', 'nodejs.org, die Fassung mit dem Zusatz LTS');
}

const npm = frag('npm --version');
melde(npm ? '✓' : '✗', 'npm', npm || 'fehlt', npm ? null : 'kommt mit Node mit');

const git = frag('git --version');
melde(git ? '✓' : '✗', 'git', (git || 'fehlt').replace('git version ', ''),
      git ? null : 'macOS bietet die Entwicklerwerkzeuge selbst an — annehmen');

/* ---------- 2. Xcode ------------------------------------------------------ */

const xpfad = frag('xcode-select -p');
const xcode = frag('xcodebuild -version');

if (!xpfad) {
  melde('✗', 'Xcode', 'nicht eingerichtet',
        'Xcode aus dem Mac App Store, danach einmal öffnen und zustimmen');
} else if (/CommandLineTools/.test(xpfad)) {
  melde('✗', 'Xcode', 'nur die Kommandozeilen-Werkzeuge',
        'Das volle Xcode fehlt. Danach: sudo xcode-select -s /Applications/Xcode.app');
} else if (xcode) {
  melde('✓', 'Xcode', xcode.split('\n')[0].replace('Xcode ', ''));
} else {
  melde('○', 'Xcode', 'gefunden, meldet sich aber nicht',
        'Xcode einmal öffnen — beim ersten Start fehlen noch Bauteile');
}

/* Der iOS-Baustein ist die eine Zeile aus dem Xcode-Dialog, ohne die sich
   nur macOS-Programme bauen lassen. */
const sdks = frag('xcodebuild -showsdks');
if (sdks === null) {
  melde('○', 'iOS-Baustein', 'nicht feststellbar', 'hängt an Xcode oben');
} else if (/iphoneos/i.test(sdks)) {
  const treffer = sdks.split('\n').find(function (z) { return /-sdk iphoneos/i.test(z); });
  melde('✓', 'iOS-Baustein', (treffer || '').trim().replace(/.*-sdk /, ''));
} else {
  melde('✗', 'iOS-Baustein', 'fehlt',
        'Xcode → Settings → Components → iOS nachladen (rund 10 GB)');
}

/* ---------- 3. Ein Browser für das App-Symbol ---------------------------- */

const BROWSER = [
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome'],
  ['/Applications/Chromium.app/Contents/MacOS/Chromium', 'Chromium'],
  ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Microsoft Edge']
];
const gefunden = BROWSER.find(function (b) { return fs.existsSync(b[0]); });
melde(gefunden ? '✓' : '✗', 'Chrome oder Chromium', gefunden ? gefunden[1] : 'fehlt',
      gefunden ? null
        : 'Wird gebraucht, um das App-Symbol zu zeichnen. Safari genügt NICHT.');

/* ---------- 4. Hängt ein iPad dran? -------------------------------------- */

const geraete = frag('xcrun xctrace list devices');
if (geraete === null) {
  melde('○', 'Angeschlossene Geräte', 'nicht feststellbar', 'hängt an Xcode oben');
} else {
  /* Alles vor der Zeile „== Simulators ==" ist echte Hardware. Der Mac
     selbst steht mit darin und zählt nicht. */
  const echt = geraete.split(/== Simulators ==/)[0]
    .split('\n')
    .map(function (z) { return z.trim(); })
    .filter(function (z) { return z && !/^==/.test(z) && !/\(Simulator\)/.test(z); })
    .filter(function (z) { return !new RegExp(frag('scutil --get ComputerName') || '\\u0000').test(z); });
  if (echt.length) {
    melde('✓', 'Angeschlossene Geräte', echt.length + '');
    /* Nur Art und Systemfassung. Der Gerätename ist bei einer Familie
       womöglich der Vorname eines Kindes, und die lange Kennung in Klammern
       ist die eindeutige Seriennummer des Geräts. Beides gehört nicht in
       einen Bericht, den man weiterreicht — der Fuß verspricht genau das. */
    echt.forEach(function (z) {
      const art = /ipad/i.test(z) ? 'iPad'
                : /iphone/i.test(z) ? 'iPhone'
                : /watch/i.test(z) ? 'Apple Watch' : 'Gerät';
      const fassung = (z.match(/\((\d+\.\d+(?:\.\d+)?)\)/) || [])[1];
      zeilen.push('       · ' + art + (fassung ? '  ' + fassung : ''));
    });
  } else {
    melde('○', 'Angeschlossene Geräte', 'keines',
          'Fürs Erzeugen nicht nötig. Zum Aufspielen: iPad anstecken, ' +
          'entsperren, „Diesem Computer vertrauen?" bestätigen');
  }
}

/* ---------- 5. Platz ------------------------------------------------------ */

const platz = frag("df -h / | tail -1 | awk '{print $4}'");
if (platz) {
  const gb = parseFloat(platz);
  melde(gb >= 20 || /Ti/.test(platz) ? '✓' : '○', 'Freier Platz', platz + ' frei',
        (gb >= 20 || /Ti/.test(platz)) ? null
          : 'Xcode mit iOS braucht rund 40 GB. Knapp wird es hier.');
}

/* ---------- Schluss ------------------------------------------------------- */

zeilen.push('  ' + '─'.repeat(56));
if (fehlt === 0 && warnung === 0) {
  zeilen.push('  Alles da. Weiter mit  npm run nativ');
} else if (fehlt === 0) {
  zeilen.push('  Nichts fehlt Entscheidendes. Die ○-Zeilen oben lesen,');
  zeilen.push('  dann weiter mit  npm run nativ');
} else {
  zeilen.push('  ' + fehlt + ' Sache(n) fehlen. Erst die ✗-Zeilen erledigen —');
  zeilen.push('  was darunter steht, hängt daran.');
}
zeilen.push('');
zeilen.push('  Die Schritte im Ganzen: docs/xcode.html');
zeilen.push('  Diesen Bericht darf man kopieren und weiterreichen; er enthält');
zeilen.push('  keine Namen, keine Pfade aus dem Benutzerordner, keine Kennungen.');
zeilen.push('');

console.log(zeilen.join('\n'));
process.exit(fehlt ? 1 : 0);
