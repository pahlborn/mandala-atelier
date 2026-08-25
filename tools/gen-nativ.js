'use strict';

/* ============================================================================
   Bereitet eine App für den nativen Rahmen vor.

     node tools/gen-nativ.js            → Mandala Atelier
     node tools/gen-nativ.js blatt      → Mandala Atelier 2

   Das Ergebnis liegt in nativ/<app>/ und ist alles, was Capacitor braucht:
   ein Ordner www mit genau den Dateien dieser App, die Konfiguration, das
   Store-Symbol – und eine LIESMICH.md mit den Schritten am Mac.

   Der Ordner steht in .gitignore. Er ist erzeugt und gehört nicht ins Repo:
   Er wäre eine zweite Kopie derselben Dateien, und zwei Kopien laufen
   auseinander.

   Was hier NICHT passiert: Der Code wird nicht umgeschrieben. Xcode
   übersetzt kein JavaScript – die Dateien ziehen um, mehr nicht. Die einzige
   Änderung ist die Registrierung des Service Workers, und die fällt weg,
   weil im Bundle ohnehin alles auf dem Gerät liegt. Bliebe sie stehen,
   lieferte der Worker aus einem Vorrat aus, den niemand mehr auffrischt.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { ohneAlpha } = require('./png');
const { drawIcon } = require('./gen-icons');

const WURZEL = path.join(__dirname, '..');

const APPS = {
  mandala: {
    name: 'Mandala Atelier',
    kennung: 'de.pahlborn.mandalaatelier',
    quelle: '.',
    dateien: ['index.html', 'app.js', 'style.css', 'fonts.css',
              'manifest.webmanifest',
              'icon-72.png', 'icon-120.png', 'icon-152.png',
              'icon-180.png', 'icon-192.png', 'icon-512.png'],
    grund: '#efe9dd'
  },
  blatt: {
    name: 'Mandala Atelier 2',
    kennung: 'de.pahlborn.mandalaatelier2',
    quelle: 'atelier3',
    dateien: ['index.html', 'app.js', 'style.css', 'manifest.webmanifest',
              'icon-72.png', 'icon-120.png', 'icon-152.png',
              'icon-180.png', 'icon-192.png', 'icon-512.png'],
    grund: '#e6dfd1'
  }
};

const WAHL = process.argv[2] || 'mandala';
const APP = APPS[WAHL];
if (!APP) {
  console.error('Unbekannt: ' + WAHL + '. Möglich: ' + Object.keys(APPS).join(', '));
  process.exit(1);
}

const ZIEL = path.join(WURZEL, 'nativ', WAHL);
const WWW = path.join(ZIEL, 'www');

/* Die eine Änderung am Code. Sie greift in die Kopie, nie ins Original.

   Mit einem regulären Ausdruck ging das schief, und zwar lehrreich: „bis
   zum nächsten Semikolon“ endete mitten im Ausdruck, weil in der Kette ein
   `reg.update().catch(function () {});` steckt. Übrig blieb eine Ruine, die
   der Browser mit „Unexpected token )“ quittierte.

   Deshalb wird jetzt abgetastet statt gesucht: von der Registrierung an
   vorwärts, Klammern mitzählen, Zeichenketten und Kommentare überspringen –
   und erst bei dem Semikolon aufhören, das wirklich außerhalb von allem
   liegt. */
function ohneWorker(code) {
  const start = code.indexOf('navigator.serviceWorker.register');
  if (start < 0) {
    console.log('  Hinweis: keine Worker-Registrierung gefunden – nichts entfernt.');
    return code;
  }

  let i = start, tiefe = 0;
  while (i < code.length) {
    const z = code[i], zwei = code.substr(i, 2);

    if (zwei === '/*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? code.length : e + 2; continue; }
    if (zwei === '//') { const e = code.indexOf('\n', i);     i = e < 0 ? code.length : e + 1; continue; }

    if (z === '"' || z === "'" || z === '`') {
      i++;
      while (i < code.length && code[i] !== z) i += (code[i] === '\\' ? 2 : 1);
      i++; continue;
    }

    if (z === '(' || z === '{' || z === '[') tiefe++;
    else if (z === ')' || z === '}' || z === ']') tiefe--;
    else if (z === ';' && tiefe === 0) { i++; break; }

    i++;
  }

  return code.slice(0, start) +
         '/* Im nativen Rahmen ohne Service Worker – alles liegt im Bundle. */' +
         code.slice(i);
}

function schreibe(datei, inhalt) {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, inhalt);
}

async function storeSymbol() {
  /* 1024 × 1024, dieselbe Zeichnung wie die Symbole auf dem Homescreen –
     nur ohne Alphakanal, sonst weist Apple es beim Hochladen ab. */
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Symbol</title>');

  /* Playwright reicht genau ein Argument durch – also beides in einem
     Objekt. */
  const pixel = await page.evaluate(function (auftrag) {
    const zeichne = auftrag.zeichne, groesse = auftrag.groesse;
    const f = new Function('return (' + zeichne + ')')();
    const c = document.createElement('canvas');
    c.width = c.height = groesse;
    document.body.appendChild(c);
    /* drawIcon legt sich ein eigenes Canvas an und gibt eine Daten-URL
       zurück – wir brauchen aber die rohen Pixel. Also das Bild einmal
       durchzeichnen und danach auslesen. */
    const url = f(groesse);
    return new Promise(function (fertig) {
      const bild = new Image();
      bild.onload = function () {
        const g = c.getContext('2d');
        g.drawImage(bild, 0, 0);
        const d = g.getImageData(0, 0, groesse, groesse).data;
        fertig(Array.prototype.slice.call(d));
      };
      bild.src = url;
    });
  }, { zeichne: drawIcon.toString(), groesse: 1024 });

  await browser.close();
  return ohneAlpha(Buffer.from(pixel), 1024, 1024);
}

async function main() {
  console.log('Bereite vor: ' + APP.name + '\n');

  fs.rmSync(ZIEL, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });

  const basis = path.join(WURZEL, APP.quelle);
  let gesamt = 0;

  APP.dateien.forEach(function (name) {
    const von = path.join(basis, name);
    if (!fs.existsSync(von)) { console.log('  FEHLT: ' + name); return; }
    let inhalt = fs.readFileSync(von);
    if (name === 'app.js') inhalt = Buffer.from(ohneWorker(inhalt.toString('utf8')));
    schreibe(path.join(WWW, name), inhalt);
    gesamt += inhalt.length;
    console.log('  www/' + name);
  });

  /* sw.js kommt ausdrücklich nicht mit – deshalb steht es in keiner Liste. */

  const symbol = await storeSymbol();
  schreibe(path.join(ZIEL, 'resources', 'icon.png'), symbol);
  console.log('  resources/icon.png   1024 × 1024, Farbtyp ' + symbol[25] +
              (symbol[25] === 2 ? ' (ohne Alphakanal)' : ' – ACHTUNG, sollte 2 sein'));

  schreibe(path.join(ZIEL, 'capacitor.config.json'), JSON.stringify({
    appId: APP.kennung,
    appName: APP.name,
    webDir: 'www',
    backgroundColor: APP.grund,
    ios: { contentInset: 'never', limitsNavigationsToAppBoundDomains: true }
  }, null, 2) + '\n');

  schreibe(path.join(ZIEL, 'package.json'), JSON.stringify({
    name: 'nativ-' + WAHL,
    version: '1.0.0',
    private: true,
    devDependencies: {
      '@capacitor/cli': '^6.0.0',
      '@capacitor/core': '^6.0.0',
      '@capacitor/ios': '^6.0.0'
    }
  }, null, 2) + '\n');

  schreibe(path.join(ZIEL, 'LIESMICH.md'), anleitung());

  console.log('\nFertig: ' + path.relative(WURZEL, ZIEL) + '/  (' +
              Math.round(gesamt / 1024) + ' kB in www)');
  console.log('Die Schritte am Mac stehen in ' + path.relative(WURZEL, ZIEL) + '/LIESMICH.md');
}

function anleitung() {
  return '# ' + APP.name + ' als native App\n\n' +
'Erzeugt von `tools/gen-nativ.js`. Nicht von Hand ändern – bei der nächsten\n' +
'Änderung an der App diesen Ordner neu erzeugen lassen.\n\n' +
'## Was hier liegt\n\n' +
'    www/                  die App, unverändert bis auf eine Zeile\n' +
'    resources/icon.png    1024 × 1024, ohne Alphakanal\n' +
'    capacitor.config.json Name, Kennung, Hintergrund\n' +
'    package.json          die drei Capacitor-Pakete\n\n' +
'Der Service Worker ist **nicht** dabei, und seine Registrierung ist aus\n' +
'`www/app.js` entfernt. Im Bundle liegt ohnehin alles auf dem Gerät.\n\n' +
'## Am Mac, der Reihe nach\n\n' +
'Vorausgesetzt: Xcode ist installiert, und Node ist da (`node --version`).\n' +
'Ein Developer-Programm brauchst du für diesen Teil **nicht**.\n\n' +
'```\ncd nativ/' + WAHL + '\nnpm install\nnpx cap add ios\nnpx cap sync\nnpx cap open ios\n```\n\n' +
'Danach ist Xcode offen. Dort:\n\n' +
'1. Links im Baum auf **App** klicken, Reiter **Signing & Capabilities**\n' +
'2. **Automatically manage signing** anhaken\n' +
'3. Bei **Team** deine Apple-ID wählen (die gewöhnliche genügt)\n' +
'4. iPad per Kabel anschließen, oben als Ziel wählen\n' +
'5. Auf **Start** drücken\n\n' +
'Beim ersten Mal meldet das iPad, dass es dem Entwickler nicht traut. Das\n' +
'steht unter *Einstellungen → Allgemein → VPN & Geräteverwaltung*.\n\n' +
'Mit einer gewöhnlichen Apple-ID läuft die App **sieben Tage**, danach neu\n' +
'aufspielen. Zum Ausprobieren reicht das.\n\n' +
'## Eine Zeile in der Info.plist\n\n' +
'Nach `npx cap add ios` liegt die Datei unter\n' +
'`ios/App/App/Info.plist`. Dort gehoert hinein:\n\n' +
'```xml\n<key>ITSAppUsesNonExemptEncryption</key>\n<false/>\n```\n\n' +
'Ohne sie fragt App Store Connect bei **jedem** Build nach den\n' +
'Exportbestimmungen. Die App verschluesselt nichts Eigenes, also ist die\n' +
'Antwort immer dieselbe - dann kann sie auch gleich dort stehen.\n\n' +
'## Das Symbol\n\n' +
'`resources/icon.png` ist da, muss aber noch in die Größen umgerechnet\n' +
'werden, die iOS erwartet:\n\n' +
'```\nnpx @capacitor/assets generate --ios\n```\n\n' +
'## Worauf du achten solltest\n\n' +
'Das sind die Fragen, die dieser Durchgang beantworten soll:\n\n' +
'* **Flugmodus.** Alles einschalten, App neu starten – läuft sie vollständig?\n' +
'  Das ist das stärkste Argument gegenüber Apples Richtlinie 4.2.\n' +
'* **Teilen.** Ein Werk sichern. Sollte gehen: Die App benutzt das\n' +
'  Teilen-Blatt, nicht den Download-Weg.\n' +
(WAHL === 'mandala'
  ? '* **Druckbogen.** Der wird *nicht* gehen. `window.open` liefert im\n' +
    '  WKWebView nichts zurück, und `print()` gibt es dort nicht. Genau das\n' +
    '  ist die eine Stelle, die im nativen Teil Arbeit braucht.\n'
  : '* **Der Klang.** Er kommt erst nach der ersten Berührung – das ist eine\n' +
    '  Regel des Browsers, keine Macke.\n') +
'* **Apple Pencil.** Neigung, Druck, Geschwindigkeit.\n' +
'* **Die Galerie ist leer.** Das ist richtig so: Für iOS ist das eine andere\n' +
'  App als das Symbol vom Homescreen, mit eigenem Speicher. Wer seine Werke\n' +
'  mitnehmen will, nimmt die Sicherungsdatei.\n\n' +
'## Die Kennung\n\n' +
'`' + APP.kennung + '` steht in `capacitor.config.json`. Sie ist nach der\n' +
'Veröffentlichung **unveränderlich** – wer sie anders haben will, ändert sie\n' +
'jetzt, nicht später. Jede der Apps braucht eine eigene.\n';
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
