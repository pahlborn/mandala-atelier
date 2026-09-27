'use strict';

/* ============================================================================
   fassung.json schreiben — die Datei, die eine eingerichtete App abruft, um
   zu erfahren, dass es eine neuere gibt.

     node tools/fassung-datei.js

   Sie enthält drei Angaben und sonst nichts: die Nummer, das Datum und einen
   Satz dazu, was die Fassung gebracht hat. Kein Zähler, keine Kennung, nichts,
   was einen Anwender beträfe — die Datei ist für alle dieselbe und weiß nicht,
   wer sie holt.

   Der Satz kommt aus der Git-Geschichte, nicht aus der Hand: aus dem Commit,
   der die Nummer eingeführt hat. Von Hand gepflegt veraltete er beim zweiten
   Mal, wie schon siebzehn Zahlen vor ihm.

   Nebenbei prüft der Lauf, dass die Nummer in sw.js und in app.js dieselbe
   ist, und bricht sonst ab. Gingen sie auseinander, meldete die Datei eine
   Fassung, die es so nicht gibt.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const APPS = [
  { name: 'atelier', ordner: '.',         muster: /mandala-atelier-v1-(\d+)/, stamm: '2' },
  { name: 'blatt',   ordner: 'atelier3',  muster: /atelier3-v1-(\d+)/,        stamm: '3' }
];

function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 }); }
  catch (e) { return ''; }
}

function nummern(app) {
  const sw  = fs.readFileSync(path.join(ROOT, app.ordner, 'sw.js'), 'utf8');
  const js  = fs.readFileSync(path.join(ROOT, app.ordner, 'app.js'), 'utf8');
  const a = sw.match(app.muster);
  const b = js.match(/const FASSUNG = '([\d.]+)'/);
  if (!a) throw new Error(app.name + ': keine Cache-Nummer in sw.js');
  if (!b) throw new Error(app.name + ': kein FASSUNG in app.js');
  const ausCache = app.stamm + '.' + a[1];
  if (ausCache !== b[1]) {
    throw new Error(app.name + ': die Nummern gehen auseinander — sw.js sagt ' +
                    ausCache + ', app.js sagt ' + b[1] + '.');
  }
  return b[1];
}

/* Datum und Satz aus dem Commit, der diese Nummer eingeführt hat. Wurde sie
   noch nicht committet, gilt heute und der Arbeitsstand. */
function woher(app, nr) {
  const swPfad = path.join(app.ordner, 'sw.js').replace(/\\/g, '/');
  const zeilen = git(['log', '--format=%H|%ad|%s', '--date=short', '--', swPfad])
    .trim().split('\n').filter(Boolean);
  for (const z of zeilen) {
    const [hash, datum, betreff] = z.split('|');
    const sw = git(['show', hash + ':' + swPfad]);
    const m = sw.match(app.muster);
    if (m && app.stamm + '.' + m[1] === nr) return { seit: datum, was: betreff };
  }
  return { seit: new Date().toISOString().slice(0, 10), was: '' };
}

function schreiben() {
  const raus = [];
  APPS.forEach(function (app) {
    const nr = nummern(app);
    const w = woher(app, nr);
    const datei = path.join(ROOT, app.ordner, 'fassung.json');
    const inhalt = { fassung: nr, seit: w.seit, was: w.was };
    fs.writeFileSync(datei, JSON.stringify(inhalt, null, 2) + '\n');
    raus.push({ app: app.name, nr: nr, datei: path.relative(ROOT, datei), was: w.was });
  });
  return raus;
}

if (require.main === module) {
  console.log('\nfassung.json\n');
  try {
    schreiben().forEach(function (r) {
      console.log('  ' + r.app.padEnd(9) + r.nr.padEnd(7) + r.datei);
      if (r.was) console.log('  ' + ' '.repeat(16) + r.was);
    });
  } catch (err) {
    console.log('  ABBRUCH: ' + err.message + '\n');
    process.exit(1);
  }
  console.log('');
}

module.exports = { schreiben, nummern };
