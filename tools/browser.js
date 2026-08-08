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
  return null;
}

async function launch() {
  let chromium;
  try {
    chromium = require('playwright-core').chromium;
  } catch (err) {
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
