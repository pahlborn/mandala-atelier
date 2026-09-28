'use strict';
/* Zeichnet jeden Entwurf im echten Browser, misst die Füllbarkeit und legt
   das Bild ab. Gemessen wird das, worauf es ankommt: Läuft die Farbe aus?
   Gibt es Splitter, die kein Finger trifft? */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { launch } = require('/home/user/mandala-atelier/tools/browser.js');

const HIER = __dirname;
const ZIEL = process.argv[2] || path.join(HIER, 'bilder');
const TYPEN = { '.html':'text/html; charset=utf-8', '.js':'text/javascript' };

function server(){
  return new Promise(ok => {
    const s = http.createServer((q,r) => {
      const rein = decodeURIComponent(q.url.split('?')[0]);
      if (rein === '/favicon.ico'){ r.writeHead(204); return r.end(); }
      const p = path.join(HIER, rein === '/' ? 'seite.html' : rein);
      if (!fs.existsSync(p)) { r.writeHead(404); return r.end('weg'); }
      r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'text/plain' });
      r.end(fs.readFileSync(p));
    });
    s.listen(0, '127.0.0.1', () => ok({ s, port: s.address().port }));
  });
}

function pad(s,n){ s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  const { s, port } = await server();
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', e => fehler.push(e.message));
  p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  await p.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });

  if (fehler.length){
    console.log('\n  FEHLER beim Laden:');
    Array.from(new Set(fehler)).slice(0,5).forEach(f => console.log('    ' + f.slice(0,200)));
    await b.close(); s.close(); process.exit(1);
  }

  const liste = await p.evaluate(() => window.Entwuerfe.ENTWUERFE.map(e => ({
    id: e.id, name: e.name, fuer: e.fuer, quelle: e.quelle })));

  console.log('\nEntwürfe — Füllbarkeit gemessen (900 × 900, Wand = alpha > 60)\n');
  console.log('  ' + pad('Entwurf',15) + pad('für',9) + pad('Felder',8) +
              pad('Splitter',10) + pad('winzig',8) + pad('größtes',9) +
              pad('Median',8) + 'kleinstes');
  const befunde = [];
  const zeilen = [];

  for (const e of liste){
    const info = await p.evaluate(id => window.zeichne(id), e.id);
    const mass = await p.evaluate(() => window.messe());
    await p.evaluate(() => window.aufPapier());
    const bild = path.join(ZIEL, 'entwurf-' + e.id + '.png');
    await p.locator('#linien').screenshot({ path: bild });

    /* Die Regeln der App: kein Feld über 4 % der Scheibe, keines breiter als
       1,6 × sein Segment. Splitter sind hier zusätzlich ein Befund - sie sind
       auf dem iPad mit dem Finger nicht zu treffen. */
    /* Die Regeln der App gelten fürs MANDALA: kein Feld über 4 % der Scheibe,
       keines breiter als 1,6 × sein Segment, und keine Splitter, die kein
       Finger trifft. Für Blatt gelten sie NICHT - dort wird nicht getippt,
       sondern Pigment über ein Relief gerieben. Ein Entwurf nur für Blatt
       wird deshalb gezählt, aber nicht danach beurteilt. */
    const schlimm = [];
    if (e.fuer !== 'Blatt'){
      if (mass.groesstes > 4) schlimm.push('größtes Feld ' + mass.groesstes + ' %');
      if (mass.splitter > 12) schlimm.push(mass.splitter + ' Splitter');
      if (mass.felder < 20) schlimm.push('nur ' + mass.felder + ' Felder');
    }
    console.log('  ' + pad(e.name,15) + pad(e.fuer,9) + pad(mass.felder,8) +
      pad(mass.splitter,10) + pad(mass.winzig,8) + pad(mass.groesstes + ' %',9) +
      pad(mass.median,8) + mass.kleinstes +
      (schlimm.length ? '   ← ' + schlimm.join(', ') : ''));
    if (schlimm.length) befunde.push(e.name + ': ' + schlimm.join(', '));
    zeilen.push(Object.assign({}, e, mass, { info: info }));
  }

  fs.writeFileSync(path.join(ZIEL, 'messung.json'), JSON.stringify(zeilen, null, 2) + '\n');
  await b.close(); s.close();
  if (fehler.length){
    console.log('\n  FEHLER im Browser:');
    Array.from(new Set(fehler)).slice(0,5).forEach(f => console.log('    ' + f.slice(0,160)));
  }
  console.log('\n' + (befunde.length ? '  ' + befunde.length + ' Befund(e).'
                                     : '  Alle Entwürfe füllbar.') + '\n');
})();
