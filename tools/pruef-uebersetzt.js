'use strict';

/* ============================================================================
   Sucht deutschen Text, der zur Laufzeit gesetzt wird, ohne durch die
   Sprache zu gehen.

     node tools/pruef-uebersetzt.js [pfad ...]

   Der Anlass: Im Malstudio stand

     btn.textContent = isFS() ? '⛶ Vollbild aus' : '⛶ Vollbild';

   Ein Knopf, der beim Umschalten auf Vollbild seine Beschriftung neu setzt –
   roh, ohne t(). Beim Start war er übersetzt, nach dem ersten Wechsel nicht
   mehr. Ein Durchgang über die fertige Seite findet so etwas nie: Zur
   Ladezeit stimmt ja alles.

   Deshalb hier ein Blick in den Quelltext statt in die Seite. Gesucht wird
   nach Zuweisungen an Dinge, die ein Mensch liest –

     textContent, innerHTML, innerText, value, title, placeholder, alt,
     setAttribute('aria-label' | 'title' | 'placeholder' | 'alt', …)

   – deren rechte Seite eine deutsche Zeichenkette enthält, die NICHT in
   t(…), tf(…) oder T(…) steckt.

   Was als deutsch gilt: Umlaute, ß, oder eines der Wörter, die es nur im
   Deutschen gibt. `Ring`, `Band`, `Indigo`, `Start` und ähnliche stehen
   absichtlich nicht darin – sie sind in beiden Sprachen dasselbe Wort und
   wären nur Rauschen.

   Falsche Treffer sind möglich und in Ordnung: Lieber einer zu viel als der
   Knopf, der beim Vollbild umkippt. Wer einen findet, hängt ihn unten an
   AUSNAHMEN an, mit einer Zeile Begründung.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

/* Was ein Mensch liest. */
const ZIELE = [
  /\.textContent\s*=/,
  /\.innerHTML\s*=/,
  /\.innerText\s*=/,
  /\.placeholder\s*=/,
  /\.title\s*=/,
  /\.alt\s*=/,
  /setAttribute\s*\(\s*['"](?:aria-label|title|placeholder|alt)['"]/
];

/* Nur im Deutschen. Absichtlich knapp gehalten. */
/* Die Endungen stehen mit dabei: „Bilder" wurde beim ersten Anlauf nicht
   gefunden, weil nur „Bild" in der Liste stand und \b davor und dahinter
   greift. Ein Prüfer, der die Mehrzahl übersieht, übersieht die Hälfte. */
const DEUTSCH = /[äöüßÄÖÜ]|\b(?:und|oder|nicht|kein(?:e[nms]?)?|ein(?:e[nmrs]?)?|der|die|das|dem|den|mit|für|von|auf|aus|ist|sind|wird|werden|hier|sich|nach|beim|zum|zur|dir|dich|du|wir|ihr|Vollbild|Knopf|Kn(?:ö|oe)pfe|Blatt|Bl(?:ä|ae)tter|Bild(?:er|ern|es)?|Werk(?:e|en|es)?|Farbe(?:n)?|Stift(?:e|en)?|Seite(?:n)?|Kind(?:er|ern|es)?|Eltern|Schatz|Insel(?:n)?|Wissen|Sprache(?:n)?|Galerie(?:n)?|Motiv(?:e|en|s)?|Punkt(?:e|en)?|Ergebnis(?:se)?|Reihe(?:n)?|Vorlage(?:n)?|Achse(?:n)?|Person(?:en)?|Sicherung(?:en)?|gesetzt|gefunden|gespeichert|geladen|gemalt|fertig|zur(?:ü|ue)ck|weiter|schlie(?:ß|ss)en)\b/;

/* Bekannte, geprüfte Ausnahmen. */
const AUSNAHMEN = [
  /* Reine Auszeichnung ohne Text – die Hüllen werden danach gefüllt. */
  /innerHTML\s*=\s*'<(img|span|strong|div|i|b|em)[^>]*>(<\/?[a-z][^>]*>)*'/,
  /* Schlüssel des Wörterbuchs selbst: dort IST Deutsch richtig. */
  /^\s*'[^']*':\s*'/
];

const WORTE_MIT_T = /\b(?:t|tf|T)\s*\(/;

function istAusnahme(zeile) {
  return AUSNAHMEN.some(function (r) { return r.test(zeile); });
}

/* Eine Zuweisung kann über mehrere Zeilen gehen. Gelesen wird deshalb ab der
   Fundstelle bis zum Semikolon, das außerhalb von Klammern und
   Zeichenketten steht – dieselbe Abtastung wie in gen-nativ.js, aus
   demselben Grund: Ein Muster über „bis zum nächsten Semikolon" endet
   mitten im Ausdruck. */
function ausdruckAb(code, start) {
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
    else if (z === ';' && tiefe <= 0) break;
    i++;
  }
  return code.slice(start, i);
}

/* Alle Zeichenketten eines Ausdrucks, die NICHT in t(…)/tf(…)/T(…) stecken.

   Mit einem Muster ging das schief, und zwar lehrreich: `tf('{m} wartet auf
   Farbe!', {m: tName(motif)})` hat geschweifte Klammern im zweiten Argument,
   und „bis zur nächsten runden Klammer" endete davor. Sieben von elf ersten
   Funden waren so entstanden – Fehlalarme, und damit wäre der ganze Prüfer
   wertlos gewesen.

   Deshalb wird auch hier abgetastet statt gesucht: Trifft der Lauf auf
   t( / tf( / T(, springt er zur zugehörigen schließenden Klammer und
   überspringt alles dazwischen. Was danach an Zeichenketten übrig bleibt,
   steht wirklich ungedeckt da. */
function ungedeckteTexte(ausdruck) {
  const raus = [];
  let i = 0;

  function ueberspringeAufruf() {
    /* steht auf der öffnenden Klammer */
    let tiefe = 0;
    while (i < ausdruck.length) {
      const z = ausdruck[i];
      if (z === '"' || z === "'" || z === '`') {
        const q = z; i++;
        while (i < ausdruck.length && ausdruck[i] !== q) i += (ausdruck[i] === '\\' ? 2 : 1);
        i++; continue;
      }
      if (z === '(' || z === '{' || z === '[') tiefe++;
      else if (z === ')' || z === '}' || z === ']') { tiefe--; if (tiefe === 0) { i++; return; } }
      i++;
    }
  }

  while (i < ausdruck.length) {
    const z = ausdruck[i];

    /* Ein Aufruf der Sprache: alles darin ist gedeckt. */
    const rest = ausdruck.slice(i);
    const auf = /^(?:\b(?:tf|t|T))\s*\(/.exec(rest);
    if (auf && (i === 0 || !/[A-Za-z0-9_$.]/.test(ausdruck[i - 1]))) {
      i += auf[0].length - 1;
      ueberspringeAufruf();
      continue;
    }

    if (z === '"' || z === "'" || z === '`') {
      const q = z; const von = i + 1; i++;
      while (i < ausdruck.length && ausdruck[i] !== q) i += (ausdruck[i] === '\\' ? 2 : 1);
      const text = ausdruck.slice(von, i);
      if (DEUTSCH.test(text)) raus.push(text);
      i++; continue;
    }

    i++;
  }
  return raus;
}

function pruefe(datei) {
  const code = fs.readFileSync(datei, 'utf8');
  const zeilen = code.split('\n');
  const funde = [];

  /* Zeilenanfänge merken, um aus einem Zeichenversatz eine Zeilennummer zu
     machen. */
  const anfang = [];
  let pos = 0;
  zeilen.forEach(function (z) { anfang.push(pos); pos += z.length + 1; });
  function zeileVon(v) {
    let lo = 0, hi = anfang.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (anfang[m] <= v) lo = m; else hi = m - 1; }
    return lo + 1;
  }

  ZIELE.forEach(function (ziel) {
    const re = new RegExp(ziel.source, 'g');
    let m;
    while ((m = re.exec(code))) {
      const nr = zeileVon(m.index);
      const zeile = zeilen[nr - 1] || '';
      if (istAusnahme(zeile)) continue;
      const texte = ungedeckteTexte(ausdruckAb(code, m.index));
      if (texte.length) funde.push({ nr: nr, texte: texte, zeile: zeile.trim() });
    }
  });

  funde.sort(function (a, b) { return a.nr - b.nr; });
  /* Dieselbe Zeile kann von mehreren Mustern getroffen werden. */
  return funde.filter(function (f, i, alle) { return i === 0 || alle[i - 1].nr !== f.nr; });
}

const DATEIEN = process.argv.slice(2);
if (!DATEIEN.length) {
  const w = path.join(__dirname, '..');
  DATEIEN.push(path.join(w, 'app.js'), path.join(w, 'atelier3', 'app.js'));
}

let gesamt = 0;
DATEIEN.forEach(function (datei) {
  if (!fs.existsSync(datei)) { console.log('fehlt: ' + datei); return; }
  const funde = pruefe(datei);
  gesamt += funde.length;
  console.log('\n' + path.relative(process.cwd(), datei) + ' — ' +
              (funde.length ? funde.length + ' Fund(e)' : 'nichts Ungedecktes'));
  funde.forEach(function (f) {
    console.log('  Zeile ' + String(f.nr).padStart(5) + '  ' +
                f.texte.map(function (t) { return '„' + t.slice(0, 54) + '"'; }).join('  '));
    console.log('               ' + f.zeile.slice(0, 96));
  });
});

console.log('\n' + (gesamt ? gesamt + ' Stelle(n) zu prüfen.' :
                              'Kein deutscher Text, der die Sprache umgeht.'));
process.exit(gesamt ? 1 : 0);
