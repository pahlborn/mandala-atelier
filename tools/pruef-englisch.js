'use strict';

/* ============================================================================
   Zählt die Zeichen in docs/englisch.html nach.

     node tools/pruef-englisch.js

   Warum ein Werkzeug für etwas, das man auch von Hand zählen könnte: weil
   man es eben nicht tut. Die Grenzen im App Store sind hart – 30 Zeichen für
   Name und Untertitel, 170 für den Werbetext, 100 für die Schlüsselwörter –
   und ein Feld, das über der Grenze liegt, fällt erst beim Hochladen auf,
   Wochen nachdem der Text geschrieben wurde.

   Auf der Seite steht bei jedem Feld eine Zahl der Form „26/30". Dieses
   Werkzeug liest den Text daneben, zählt ihn und vergleicht. Es meldet
   zweierlei:

     falsch gezählt   die Zahl auf der Seite stimmt nicht mit dem Text
     über der Grenze  der Text passt nicht in das Feld

   Der erste Fall ist der heimtückischere: Eine Zahl, der man vertraut, ist
   schlimmer als gar keine.

   Gelesen wird im Browser, nicht mit einem Muster über den Quelltext. Ein
   Feld enthält Auszeichnungen und über mehrere Zeilen umbrochenen Text; was
   am Ende zählt, ist der Text, den der Store sähe – und den kennt nur, wer
   die Seite wirklich aufbaut.
   ========================================================================== */

const path = require('path');
const { launch } = require('./browser');

const SEITE = 'file://' + path.join(__dirname, '..', 'docs', 'englisch.html');

(async () => {
  const browser = await launch();
  const seite = await browser.newPage();
  await seite.goto(SEITE);

  const felder = await seite.evaluate(() => {
    const raus = [];
    for (const zelle of document.querySelectorAll('td')) {
      const marke = zelle.querySelector('.zahl');
      if (!marke) continue;

      /* Der Text des Feldes ist die Zelle ohne ihre eigene Zahl. Über mehrere
         Zeilen umbrochener Quelltext wird dabei zu einer Zeile – so, wie ihn
         auch der Store bekäme. */
      const kopie = zelle.cloneNode(true);
      kopie.querySelector('.zahl').remove();
      const text = kopie.textContent.replace(/\s+/g, ' ').trim();

      const treffer = marke.textContent.match(/(\d+)\s*\/\s*(\d+)/);
      if (!treffer) continue;

      const zeile = zelle.closest('tr');
      raus.push({
        feld: zeile.querySelector('td').textContent.trim(),
        spalte: zelle.cellIndex === 1 ? 'deutsch' : 'englisch',
        text,
        gezaehlt: text.length,
        behauptet: Number(treffer[1]),
        grenze: Number(treffer[2])
      });
    }
    return raus;
  });

  await browser.close();

  if (!felder.length) {
    console.error('Keine Felder gefunden – hat sich der Aufbau der Seite geändert?');
    process.exit(1);
  }

  let klagen = 0;
  for (const f of felder) {
    const name = (f.feld + ' (' + f.spalte + ')').padEnd(30);

    if (f.gezaehlt !== f.behauptet) {
      klagen++;
      console.log('  falsch  ' + name +
                  'steht ' + f.behauptet + ', sind ' + f.gezaehlt);
      console.log('          „' + f.text + '"');
    } else if (f.gezaehlt > f.grenze) {
      klagen++;
      console.log('  drüber  ' + name +
                  f.gezaehlt + ' bei ' + f.grenze + ' erlaubten');
    } else {
      console.log('  ok      ' + name + f.gezaehlt + '/' + f.grenze);
    }
  }

  console.log('');
  if (klagen) {
    /* Ein Feld darf wissentlich über der Grenze stehen – die deutschen
       Schlüsselwörter des Malstudios tun das, und die Seite sagt es dazu.
       Deshalb wird hier gemeldet, nicht abgebrochen. Wer die Zahl auf der
       Seite ändert, ohne den Text zu ändern, merkt es trotzdem. */
    console.log(klagen + ' Feld(er) zu prüfen. Steht die Abweichung auf der ' +
                'Seite erklärt, ist sie in Ordnung.');
  } else {
    console.log('Alle ' + felder.length + ' Felder gezählt und im Rahmen.');
  }
})();
