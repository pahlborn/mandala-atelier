'use strict';

/* ============================================================================
   Testlauf für die Prüfseite docs/druck.html.

     npm run test:druck

   Die Seite beantwortet eine einzige Frage — meldet dieses Gerät beim
   Berühren irgendetwas, das sich zwischen leichtem und festem Aufdrücken
   unterscheidet? Eine Prüfseite, die falsch misst, ist schlimmer als keine:
   Sie würde ein „meldet nichts“ ausgeben, wo etwas zu holen wäre, und die
   Antwort käme nie wieder in Frage.

   Gefahren wird mit echten Zeigerereignissen, in drei Lagen:

     1. ein Finger ohne Druckmeldung (iPad: pressure konstant 0,5)
     2. ein Gerät, das die Kontaktfläche meldet
     3. ein Stift mit echtem Druck

   Der Lauf hat sich schon bezahlt gemacht: „Noch einmal messen“ legte frische
   Objekte an, während die Ereignisbehandlung weiter in die alten schrieb. Von
   außen sah das aus wie ein Feld, das einfach nichts empfängt — also genau
   wie das Ergebnis, das die Seite auszugeben hat.
   ========================================================================== */

const path = require('path');
const ROOT = '/home/user/mandala-atelier';
const { launch } = require(path.join(ROOT, 'tools', 'browser'));
const URL_SEITE = 'file://' + path.join(ROOT, 'docs', 'druck.html');

async function streiche(page, feld, opts) {
  const box = await page.locator('#' + feld).boundingBox();
  await page.evaluate(function (arg) {
    const el = document.getElementById(arg.feld);
    const schicke = function (art, i) {
      const e = new PointerEvent(art, {
        pointerId: 1, pointerType: arg.typ, isPrimary: true, bubbles: true,
        clientX: arg.x + i * 3, clientY: arg.y + (i % 7),
        pressure: arg.pressure, width: arg.width, height: arg.height
      });
      el.dispatchEvent(e);
    };
    schicke('pointerdown', 0);
    for (let i = 1; i <= arg.schritte; i++) schicke('pointermove', i);
    el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
  }, {
    feld: feld, x: box.x + 20, y: box.y + 120,
    typ: opts.typ || 'touch', pressure: opts.pressure,
    width: opts.width, height: opts.height, schritte: opts.schritte || 40
  });
}

async function lies(page) {
  return page.evaluate(function () {
    const zeilen = Array.from(document.querySelectorAll('#tabelle tr')).slice(1);
    return {
      satz: document.getElementById('satz').textContent.replace(/\s+/g, ' ').trim(),
      tabelle: zeilen.map(function (r) {
        return Array.from(r.cells).map(function (c) { return c.textContent.trim(); });
      }),
      punkte: [document.querySelector('#leicht .zaehler').textContent,
               document.querySelector('#fest .zaehler').textContent]
    };
  });
}

(async function () {
  const browser = await launch();
  const page = await (await browser.newContext({
    viewport: { width: 900, height: 1200 }, hasTouch: true
  })).newPage();

  const fehler = [];
  page.on('pageerror', function (e) { fehler.push(String(e)); });

  await page.goto(URL_SEITE);
  await page.waitForSelector('#tabelle');

  console.log('\n1. Ein Finger ohne Druckmeldung (iPad: pressure immer 0,5)\n');
  await streiche(page, 'leicht', { pressure: 0.5, width: 1, height: 1 });
  await streiche(page, 'fest',   { pressure: 0.5, width: 1, height: 1 });
  let r = await lies(page);
  console.log('  ' + r.punkte.join('  ·  '));
  r.tabelle.forEach(function (z) {
    console.log('  ' + z[0].padEnd(10) + z[1].padEnd(8) + z[2].padEnd(8) + z[3]);
  });
  console.log('  Urteil: ' + r.satz);
  if (!/kein brauchbares Signal/.test(r.satz)) fehler.push('Urteil bei totem Finger falsch');
  if (!/Finger/.test(r.satz)) fehler.push('Zeigerart nicht erkannt');

  console.log('\n2. Ein Gerät, das die Kontaktfläche meldet\n');
  await page.click('#neu');
  await streiche(page, 'leicht', { pressure: 0.5, width: 12, height: 12 });
  await streiche(page, 'fest',   { pressure: 0.5, width: 26, height: 25 });
  r = await lies(page);
  r.tabelle.forEach(function (z) {
    console.log('  ' + z[0].padEnd(10) + z[1].padEnd(8) + z[2].padEnd(8) + z[3]);
  });
  console.log('  Urteil: ' + r.satz);
  if (!/brauchbares Signal/.test(r.satz) || /kein brauchbares/.test(r.satz)) {
    fehler.push('Kontaktfläche wurde nicht als brauchbar erkannt');
  }
  if (!/width/.test(r.satz)) fehler.push('width nicht als Signal genannt');

  console.log('\n3. Ein Stift mit echtem Druck\n');
  await page.click('#neu');
  await streiche(page, 'leicht', { typ: 'pen', pressure: 0.18, width: 1, height: 1 });
  await streiche(page, 'fest',   { typ: 'pen', pressure: 0.82, width: 1, height: 1 });
  r = await lies(page);
  r.tabelle.forEach(function (z) {
    console.log('  ' + z[0].padEnd(10) + z[1].padEnd(8) + z[2].padEnd(8) + z[3]);
  });
  console.log('  Urteil: ' + r.satz);
  if (!/pressure/.test(r.satz)) fehler.push('Stiftdruck nicht erkannt');
  if (!/Stift/.test(r.satz)) fehler.push('Stift nicht als Zeigerart erkannt');

  console.log('\n4. Zurücksetzen\n');
  await page.click('#neu');
  r = await lies(page);
  console.log('  ' + r.punkte.join('  ·  ') + '  —  ' + r.satz);
  if (!/0 Punkte/.test(r.punkte[0]) || !/0 Punkte/.test(r.punkte[1])) {
    fehler.push('Zurücksetzen leert die Felder nicht');
  }

  const netz = await page.evaluate(function () {
    return performance.getEntriesByType('resource')
      .filter(function (e) { return !/^(data|blob|file):/.test(e.name); })
      .map(function (e) { return e.name; });
  });
  console.log('\n  Abrufe nach außen: ' + (netz.length ? netz.join(', ') : 'keine'));
  if (netz.length) fehler.push('die Seite holt etwas von außen');

  await page.screenshot({ path: process.argv[2] || '/tmp/druck.png', fullPage: true });
  await browser.close();

  console.log('');
  if (fehler.length) { fehler.forEach(function (f) { console.log('  FEHLT ' + f); }); process.exit(1); }
  console.log('  Die Prüfseite tut, was sie soll.');
})();
