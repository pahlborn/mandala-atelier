'use strict';

/* Gemeinsame Browsersuche für die Werkzeuge in tools/.
   playwright-core bringt selbst keinen Browser mit – wir nehmen einen, der
   ohnehin auf dem Rechner liegt. */

const fs = require('fs');
const path = require('path');

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PLAYWRIGHT_BROWSERS_PATH &&
    path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium', 'chrome-linux', 'chrome'),
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
];

function findChrome() {
  for (const candidate of CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return candidate;
    }
  }
  return findInPlaywrightCache();
}

/* Playwright legt seine Browser versioniert ab (chromium-1194/…). Der feste
   Pfad oben trifft das nicht, deshalb hier noch einmal mit Nachsehen. */
function findInPlaywrightCache() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/opt/pw-browsers',
    path.join(process.env.HOME || '', '.cache', 'ms-playwright')
  ];

  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    let entries;
    try { entries = fs.readdirSync(root); } catch (err) { continue; }

    for (const entry of entries.sort().reverse()) {
      if (entry.indexOf('chromium') !== 0) continue;
      const binary = path.join(root, entry, 'chrome-linux', 'chrome');
      if (fs.existsSync(binary) && fs.statSync(binary).isFile()) return binary;
    }
  }
  return null;
}

/* playwright-core liegt nicht immer im Projekt - in frischen Umgebungen
   steht nur ein globales playwright zur Verfügung. Beide Orte werden
   probiert, bevor der Lauf mit einer Anweisung abbricht, die dort nicht
   hilft. */
function ladeChromium() {
  const orte = ['playwright-core', 'playwright'];
  for (const wurzel of (require('module').globalPaths || [])) {
    orte.push(require('path').join(wurzel, 'playwright'));
    orte.push(require('path').join(wurzel, 'playwright', 'node_modules', 'playwright-core'));
  }
  orte.push('/opt/node22/lib/node_modules/playwright/node_modules/playwright-core');
  orte.push('/opt/node22/lib/node_modules/playwright');
  for (const ort of orte) {
    try { const m = require(ort); if (m && m.chromium) return m.chromium; }
    catch (e) { /* weiter */ }
  }
  return null;
}

async function launch() {
  const chromium = ladeChromium();
  if (!chromium) {
    throw new Error('playwright-core fehlt. Bitte zuerst "npm install" ausführen.');
  }

  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error(
      'Kein Chrome/Chromium gefunden. Pfad über CHROME_PATH setzen, z. B.\n' +
      '  CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/test-app.js'
    );
  }

  return chromium.launch({
    executablePath,
    args: ['--allow-file-access-from-files', '--no-sandbox']
  });
}

module.exports = { launch, findChrome };
