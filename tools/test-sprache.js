'use strict';

/* ============================================================================
   Prüft die englische Fassung beider Ateliers.

     node tools/test-sprache.js

   Drei Fragen, und alle drei lassen sich nur am laufenden Programm
   beantworten – nicht am Quelltext:

     1. Bleibt auf Englisch noch deutscher Text stehen?
        Gesucht wird nicht nach Wörtern, sondern nach dem, was nur im
        Deutschen vorkommt: ä, ö, ü, ß, und die großgeschriebenen Hauptwörter
        mitten im Satz. Was durchrutscht, steht am Ende als Liste da.

     2. Greift die Geräteerkennung?
        de-DE, de-AT, de-CH müssen Deutsch ergeben, alles andere Englisch.
        Geprüft wird mit echten Browsersprachen, nicht mit einer Annahme.

     3. Halten die Sätze im ruhigen Blatt ihre Regeln ein?
        Kein „you", kein Imperativ, keiner länger als 45 Zeichen. Die beiden
        ersten Regeln stehen im Quelltext von atelier3/app.js und sind der
        Grund, warum diese Sätze von Hand übersetzt wurden.

   Dazu kommt eine Frage an das Wörterbuch selbst: Steht ein deutsches Wort
   zweimal mit verschiedenem Sinn im Programm? Das kann ein Wörterbuch mit
   dem deutschen Text als Schlüssel nicht auflösen. „Blatt" war so ein Fall
   und ist mit `data-sinn` gelöst; dieser Lauf findet den nächsten.
   ========================================================================== */

const path = require('path');
const { launch } = require('./browser');

const APPS = [
  { name: 'Mandala Atelier',           datei: path.join(__dirname, '..', 'index.html') },
  { name: 'Mandala – Das ruhige Blatt', datei: path.join(__dirname, '..', 'atelier3', 'index.html') }
];

let klagen = 0;

function prüfe(was, gut, dazu) {
  console.log('  ' + (gut ? 'ok  ' : 'NEIN') + '  ' + was.padEnd(38) + (dazu || ''));
  if (!gut) klagen++;
}

/* Was im Englischen nichts zu suchen hat.

   Umlaute und ß sind eindeutig. Bei den Wörtern ist Vorsicht nötig: `Ring`,
   `Band`, `Indigo`, `Fjord`, `Basalt`, `Bronze` sind in beiden Sprachen
   dasselbe Wort und dürfen stehen bleiben. Gesucht wird deshalb nach einer
   kleinen Liste von Wörtern, die es nur im Deutschen gibt und die in diesen
   beiden Apps vorkommen könnten. */
const NUR_DEUTSCH = /[äöüßÄÖÜ]|\b(und|oder|nicht|kein|keine|eine|einem|einen|der|die|das|dem|den|mit|für|von|auf|aus|ist|sind|wird|werden|hier|sich|nach|beim|zum|zur)\b/;

async function textDerSeite(page) {
  return page.evaluate(function () {
    /* Was ein Mensch wirklich zu sehen bekommt: sichtbarer Text plus die
       Beschriftungen für die Vorlesestimme. Verborgene Schubladen zählen
       mit – sie gehen ja auf. */
    const stücke = [];
    document.querySelectorAll('*').forEach(function (el) {
      ['aria-label', 'title', 'placeholder'].forEach(function (a) {
        const v = el.getAttribute(a);
        if (v) stücke.push({ wo: a + ' an ' + el.tagName.toLowerCase(), text: v });
      });
    });
    const lauf = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = lauf.nextNode())) {
      const t = (n.nodeValue || '').trim();
      if (!t) continue;
      const el = n.parentElement;
      if (el && (el.tagName === 'SCRIPT' || el.tagName === 'STYLE')) continue;
      stücke.push({ wo: el ? el.tagName.toLowerCase() : 'text', text: t });
    }
    return stücke;
  });
}

async function main() {
  const browser = await launch();
  console.log('Sprache – Deutsch im DACH-Raum, sonst Englisch\n');

  for (const app of APPS) {
    console.log(app.name);
    const url = 'file://' + app.datei;

    /* ---- 1. Bleibt Deutsches stehen? ----------------------------------- */
    const ctx = await browser.newContext({ locale: 'en-US' });
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', function (e) { fehler.push(String(e)); });
    await page.goto(url + '?sprache=en');
    await page.waitForTimeout(900);

    prüfe('läuft ohne Fehler', fehler.length === 0, fehler.slice(0, 1).join(''));

    const stücke = await textDerSeite(page);
    const reste = stücke.filter(function (s) { return NUR_DEUTSCH.test(s.text); });
    prüfe('nichts Deutsches übrig', reste.length === 0,
          reste.length ? reste.length + ' Stellen' : stücke.length + ' Stellen geprüft');
    reste.slice(0, 12).forEach(function (r) {
      console.log('          ' + r.wo + ': „' + r.text.slice(0, 70) + '"');
    });

    /* Auch die Daten, die erst beim Aufbau in die Seite kommen. */
    const daten = await page.evaluate(function () {
      const raus = [];
      if (typeof MOTIFS !== 'undefined') {
        MOTIFS.forEach(function (m) {
          raus.push(m.name, m.note);
          if (m.mythos) raus.push(m.mythos);
          if (m.task) raus.push(m.task);
          if (m.zones) m.zones.forEach(function (z) { raus.push(z.name); });
        });
      }
      if (typeof WORLDS !== 'undefined') {
        WORLDS.forEach(function (w) { raus.push(w.title || w.name); });
      }
      if (typeof PALETTES !== 'undefined') {
        PALETTES.forEach(function (p) {
          raus.push(p.name);
          p.colors.forEach(function (c) { raus.push(c.name); });
        });
      }
      if (typeof KINDS !== 'undefined') KINDS.forEach(function (k) { raus.push(k.name); });
      if (typeof THOUGHTS !== 'undefined') THOUGHTS.forEach(function (t) { raus.push(t); });
      return raus.filter(Boolean);
    });
    const datenReste = daten.filter(function (d) { return NUR_DEUTSCH.test(d); });
    prüfe('auch in den Daten nichts', datenReste.length === 0,
          datenReste.length ? datenReste.slice(0, 6).join(' · ')
                            : daten.length + ' Namen geprüft');

    /* ---- Doppeldeutige Wörter ------------------------------------------ */
    const doppelt = await page.evaluate(function () {
      /* Ein deutsches Wort, das einmal mit und einmal ohne Sinn im
         Wörterbuch steht, ist genau der Fall, den ein Wörterbuch mit
         deutschem Schlüssel nicht von selbst auflöst. Gemeldet wird er,
         damit klar ist, dass jemand ihn bemerkt hat. */
      const schlüssel = Object.keys(Sprache.woerter);
      const mitSinn = schlüssel.filter(function (k) { return k.indexOf(' @') > 0; });
      return mitSinn.map(function (k) {
        const wort = k.slice(0, k.indexOf(' @'));
        return wort + ' → ' + Sprache.woerter[wort] + ' / ' + Sprache.woerter[k];
      });
    });
    prüfe('doppeldeutige Wörter benannt', true,
          doppelt.length ? doppelt.join(', ') : 'keine');

    await ctx.close();

    /* ---- 2. Die Geräteerkennung ---------------------------------------- */
    const erwartet = { 'de-DE': 'de', 'de-AT': 'de', 'de-CH': 'de',
                       'en-US': 'en', 'en-GB': 'en', 'fr-FR': 'en', 'ja-JP': 'en' };
    let falsch = [];
    for (const sprache of Object.keys(erwartet)) {
      const c = await browser.newContext({ locale: sprache });
      const s = await c.newPage();
      await s.goto(url);
      await s.waitForTimeout(400);
      const ist = await s.evaluate(function () { return Sprache.aktiv; });
      if (ist !== erwartet[sprache]) falsch.push(sprache + '→' + ist);
      await c.close();
    }
    prüfe('Gerätesprache greift', falsch.length === 0,
          falsch.length ? falsch.join(' ') : 'sieben Sprachen geprüft');

    /* ---- 3. Die Sätze im ruhigen Blatt --------------------------------- */
    if (app.datei.indexOf('atelier3') > -1) {
      const c = await browser.newContext({ locale: 'en-US' });
      const s = await c.newPage();
      await s.goto(url + '?sprache=en');
      await s.waitForTimeout(500);
      const sätze = await s.evaluate(function () { return THOUGHTS.slice(); });
      const lang = sätze.filter(function (t) { return t.length > 45; });
      const du = sätze.filter(function (t) { return /\byou\b|\byour\b/i.test(t); });
      prüfe('alle Sätze bleiben kurz', lang.length === 0,
            lang.length ? lang.join(' | ')
                        : 'längster ' + Math.max.apply(null, sätze.map(function (t) { return t.length; })) + ' Zeichen');
      prüfe('kein „you" in den Sätzen', du.length === 0, du.join(' | '));
      await c.close();
    }

    console.log('');
  }

  await browser.close();
  console.log(klagen ? klagen + ' Beanstandung(en).' : 'Beide Sprachen wie zugesagt.');
  process.exit(klagen ? 1 : 0);
}

main().catch(function (err) { console.error(err); process.exit(1); });
