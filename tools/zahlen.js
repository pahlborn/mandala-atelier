'use strict';

/* ============================================================================
   Zahlen nachzählen — und die Seiten dagegen halten.

     npm run zahlen

   Die Absprache dazu: Zahlen und Angaben werden mit jeder Änderung
   mitgezogen. Von Hand geht das schief, sobald es mehr als drei Stellen
   sind — es waren siebzehn, als „34 Vorlagen" zu 46 wurden. Also zählt
   dieser Lauf am laufenden Programm nach (echter Browser, beide Apps) und
   vergleicht mit dem, was in den Seiten steht.

   Es ist eine LISTE, kein Sprachverstand. Was hier nicht steht, wird nicht
   geprüft. Kommt eine neue Behauptung in einen Text, gehört sie unten
   dazu — das ist eine Zeile, und billiger als der nächste falsche Store-
   Eintrag. Richtlinie 2.3.1 verlangt zutreffende Angaben.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const WURZEL = path.join(__dirname, '..');
const WORT = ['null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben',
              'acht', 'neun', 'zehn', 'elf', 'zwölf'];

/* Was geprüft wird: ein Muster mit genau einer Fangklammer, und woher der
   Sollwert kommt. `wort: true` heißt, der Text schreibt die Zahl aus. */
const ZUSICHERUNGEN = [
  { was: 'Motive im Atelier',   muster: /(\d+) Vorlagen in/g,                 soll: z => z.motive },
  { was: 'Motive im Atelier',   muster: /alle (\d+) Vorlagen/g,               soll: z => z.motive },
  { was: 'Motive im Atelier',   muster: /eine der (\d+) Vorlagen/g,           soll: z => z.motive },
  { was: 'Motive im Atelier',   muster: /Motivkatalog \((\d+) Vorlagen/g,     soll: z => z.motive },
  { was: 'Motive im Atelier',   muster: /(\d+) Vorlagen, mathematisch/g,      soll: z => z.motive },
  { was: 'Motive im Atelier',   muster: /(\d+) Motive mit Beischrift/g,       soll: z => z.motive },
  { was: 'Motive im Atelier',   muster: /von (\d+) Motiven/g,                 soll: z => z.motive },
  { was: 'Welten im Atelier',   muster: /Vorlagen in (\d+) (?:Welten|Familien)/g, soll: z => z.welten },
  { was: 'Welten im Atelier',   muster: /Vorlagen in ([a-zäöü]+) Welten/g,    soll: z => z.welten, wort: true },
  { was: 'Welten im Atelier',   muster: /Beischrift, ([a-zäöü]+) Welten/g,    soll: z => z.welten, wort: true },
  { was: 'Welten im Atelier',   muster: /liegen in ([a-zäöü]+) Welten/g,      soll: z => z.welten, wort: true },
  { was: 'Welten im Atelier',   muster: /der ([a-zäöü]+) Welten im Atelier/g, soll: z => z.welten, wort: true },
  { was: 'Welten im Atelier',   muster: /([a-zäöü]+) (?:Motivwelten|Motivfamilien)\b/g,
                                soll: z => z.welten, wort: true },
  { was: 'Bereichsnamen',       muster: /(\d+) Bereichsnamen/g,               soll: z => z.bereiche },
  /* Wie groß Feinwerk ist, stand an zwei Stellen verschieden da: „Acht" in
     beide.html, „Neun" in docs/feinwerk.html. Deshalb hier eine Zeile. */
  { was: 'Motive in Feinwerk',  muster: /([A-Za-zäöü]+) stehen in Feinwerk/g, soll: z => z.feinwerk, wort: true },
  { was: 'Motive in Feinwerk',  muster: /Atelier: (\d+) hier/g,               soll: z => z.feinwerk },
  /* Beide Apps haben fünf Pigmentwelten zu je zehn - die Zahl gilt für
     jede von beiden, deshalb genügt ein Satz. */
  { was: 'Pigmente',            muster: /(\d+) Pigmente/g,                    soll: z => z.pigmente },
  { was: 'Stimmungen in Blatt', muster: /(?<!statt )(?:die |\*\*)?([a-zäöü]+)\*{0,2} Blattarten/g,
                                soll: z => z.stimmungen, wort: true }
];

/* Nur Fließtext, den ein Mensch liest. Erzeugtes und Eingefrorenes bleibt
   außen vor: der Katalog und die Fassungsliste werden geschrieben, nicht
   gepflegt, und unter v/ steht mit Absicht der Stand von damals. */
const AUSGENOMMEN = [/^v\//, /^node_modules\//, /^nativ\//,
                     /^docs\/katalog\.html$/, /^docs\/fassungen\.html$/];

function dateien(dir, raus) {
  raus = raus || [];
  for (const name of fs.readdirSync(dir)) {
    const voll = path.join(dir, name);
    const rel = path.relative(WURZEL, voll);
    if (AUSGENOMMEN.some(r => r.test(rel))) continue;
    if (name.startsWith('.')) continue;
    const stat = fs.statSync(voll);
    if (stat.isDirectory()) dateien(voll, raus);
    else if (/\.(html|md)$/.test(name)) raus.push(rel);
  }
  return raus;
}

async function zaehle() {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  await page.goto('file://' + path.join(WURZEL, 'index.html') + '?sprache=de');
  await page.waitForFunction('window.MandalaAtelier && window.MandalaAtelier.MOTIFS.length > 0');
  const a = await page.evaluate(function () {
    const A = window.MandalaAtelier;
    const namen = [];
    A.MOTIFS.forEach(m => { if (m.zones) m.zones.forEach(z => namen.push(z.name)); });
    /* Die Farbwelt „Eigene" ist die selbstgemischte, keine mitgelieferte. */
    const fertige = A.PALETTES.filter(w => w.id !== 'eigen');
    return {
      motive: A.MOTIFS.length,
      welten: A.WORLDS.length,
      jeWelt: A.WORLDS.map(w => w.title + ' ' + A.MOTIFS.filter(m => m.world === w.id).length),
      bereiche: new Set(namen).size,
      feinwerk: A.MOTIFS.filter(m => m.world === 'feinwerk').length,
      farbwelten: fertige.length,
      pigmente: fertige.reduce((s, w) => s + w.colors.length, 0),
      fassung: A.FASSUNG
    };
  });

  await page.goto('file://' + path.join(WURZEL, 'atelier3', 'index.html') + '?sprache=de');
  await page.waitForFunction('window.Blatt && window.Blatt.KINDS');
  const b = await page.evaluate(function () {
    const B = window.Blatt;
    return { stimmungen: B.KINDS.length, namen: B.KINDS.map(k => k.name),
             grammatiken: B.BAUTEN.length, fassung: B.FASSUNG };
  });

  await browser.close();
  return Object.assign({}, a, { stimmungen: b.stimmungen, stimmungsnamen: b.namen,
                                grammatiken: b.grammatiken, blattFassung: b.fassung });
}

function pad(text, breite) {
  text = String(text);
  return text + ' '.repeat(Math.max(1, breite - text.length));
}

(async () => {
  const z = await zaehle();

  console.log('\nNachgezählt am laufenden Programm\n');
  console.log('  Mandala Atelier ' + z.fassung);
  console.log('    ' + z.motive + ' Motive in ' + z.welten + ' Welten');
  z.jeWelt.forEach(w => console.log('      ' + w));
  console.log('    ' + z.bereiche + ' verschiedene Bereichsnamen der Anlagen');
  console.log('    ' + z.feinwerk + ' Motive in der Familie Feinwerk');
  console.log('    ' + z.farbwelten + ' Farbwelten, zusammen ' + z.pigmente + ' Pigmente');
  console.log('  Mandala – Das ruhige Blatt ' + z.blattFassung);
  console.log('    ' + z.stimmungen + ' Stimmungen: ' + z.stimmungsnamen.join(', '));
  console.log('    ' + z.grammatiken + ' Grammatiken der Anlagen');

  console.log('\nWas in den Seiten steht\n');
  const befunde = [];
  let geprueft = 0;
  for (const datei of dateien(WURZEL)) {
    const text = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
    for (const zu of ZUSICHERUNGEN) {
      const muster = new RegExp(zu.muster.source, 'g');
      let treffer;
      while ((treffer = muster.exec(text)) !== null) {
        const soll = zu.soll(z);
        const sollText = zu.wort ? WORT[soll] : String(soll);
        if (zu.wort && WORT.indexOf(treffer[1].toLowerCase()) < 0) continue;
        geprueft++;
        if (treffer[1].toLowerCase() !== sollText) {
          const zeile = text.slice(0, treffer.index).split('\n').length;
          befunde.push({ datei, zeile, was: zu.was, steht: treffer[1], soll: sollText });
        }
      }
    }
  }

  if (!befunde.length) {
    console.log('  ' + geprueft + ' Angaben geprüft, alle stimmen.\n');
  } else {
    befunde.forEach(b => console.log(
      '  ← ' + pad(b.datei + ':' + b.zeile, 34) + pad(b.was, 24) +
      'steht „' + b.steht + '", müsste „' + b.soll + '" sein'));
    console.log('\n  ' + geprueft + ' Angaben geprüft, ' + befunde.length + ' stimmen nicht.\n');
  }
  process.exit(befunde.length ? 1 : 0);
})();
