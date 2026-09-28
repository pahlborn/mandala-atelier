'use strict';
/* Fünf Entwürfe. Jeder zeichnet nur LINIEN - gefüllt wird später vom Kind.
   Bedingung, an der jeder gemessen wird: jede Form braucht einen Rand,
   sonst läuft die Farbe aus. */

/* Eigene Kapsel: grund.js liegt im selben globalen Bereich und deklariert
   SIZE, C, TAU und den Rest schon. Ohne Kapsel bricht dieses Skript mit einer
   Doppeldeklaration ab - lautlos, und window.Entwuerfe entsteht nie. */
(function(){
const G = window.Grund;
const { SIZE, C, R_OUT, R_IN, TAU, UP, pol, Z, besselTafel, besselNull,
        nulllinie, schneideHalbebene, kreisPoly } = G;

/* Ein Band entlang eines Wegs, als UMRISS gezeichnet. Der schwellende Strich
   gehört auf einem Ausmalbogen nicht als Tinte hin, sondern als Paar von
   Rändern - dann ist das Band selbst ein Feld und die Lücke daneben auch. */
function bandUmriss(ctx, punkte, breiteBei){
  if (punkte.length < 2) return;
  const links = [], rechts = [];
  for (let i = 0; i < punkte.length; i++){
    const a = punkte[Math.max(0,i-1)], b = punkte[Math.min(punkte.length-1,i+1)];
    let tx = b[0]-a[0], ty = b[1]-a[1];
    const L = Math.hypot(tx,ty) || 1; tx/=L; ty/=L;
    const hb = breiteBei(i/(punkte.length-1)) / 2;
    links.push([punkte[i][0] - ty*hb, punkte[i][1] + tx*hb]);
    rechts.push([punkte[i][0] + ty*hb, punkte[i][1] - tx*hb]);
  }
  ctx.beginPath();
  ctx.moveTo(links[0][0], links[0][1]);
  for (let i = 1; i < links.length; i++) ctx.lineTo(links[i][0], links[i][1]);
  for (let i = rechts.length-1; i >= 0; i--) ctx.lineTo(rechts[i][0], rechts[i][1]);
  ctx.closePath();
  ctx.stroke();
}

function rahmen(ctx){
  ctx.beginPath(); ctx.arc(C, C, R_OUT, 0, TAU); ctx.stroke();
}
function nabe(ctx){
  ctx.beginPath(); ctx.arc(C, C, R_IN, 0, TAU); ctx.stroke();
}

/* =========================================================================
   1  KREISBRUT — Apollonische Kreispackung
   Descartes' Kreissatz (1643), Soddy „The Kiss Precise" (Nature 1936).
   Drei sich berührende Kreise legen den vierten fest; in jede Lücke der
   größtmögliche nächste. Die Feldgrößen stufen sich von selbst - das ist
   genau das, was dem Katalog fehlt.
   ====================================================================== */
function kreisbrut(ctx, opt){
  const n = opt.achsen || 9, minR = opt.minR || 14;
  const tiefe = opt.tiefe || 4, stufen = opt.stufen || 3;
  const alle = [], luecken = [];

  /* Eine Schicht: ein Ring aus n gleichen Kreisen, die sich gegenseitig und
     die Hülle berühren, und der Kreis, der in der Mitte übrig bleibt. Der
     wird zur Hülle der nächsten Schicht - sonst bliebe er ein Feld von 24 %
     der Scheibe, gemessen beim ersten Anlauf. */
  function schicht(huelle, stufe){
    const s = Math.sin(Math.PI/n), r = huelle.r*s/(1+s), d = huelle.r - r;
    const ring = [];
    for (let i = 0; i < n; i++){
      const a = UP + stufe*Math.PI/n + i*TAU/n;
      ring.push({ x:huelle.x+Math.cos(a)*d, y:huelle.y+Math.sin(a)*d, r:r, k:1/r });
    }
    ring.forEach(c => alle.push(c));
    const rm = huelle.r - 2*r;
    const aussen = { x:huelle.x, y:huelle.y, r:huelle.r, k:-1/huelle.r };
    const innen  = { x:huelle.x, y:huelle.y, r:rm, k:1/rm };
    alle.push(innen);
    for (let i = 0; i < n; i++){
      const j = (i+1)%n;
      luecken.push([aussen, ring[i], ring[j], 0]);
      luecken.push([innen,  ring[i], ring[j], 0]);
    }
    if (stufe+1 < stufen && rm > (opt.minInnen || 60)) schicht({ x:huelle.x, y:huelle.y, r:rm }, stufe+1);

    /* Und in JEDEN Ringkreis noch eine kleine Packung. Ohne das war ein
       Ringkreis mit 6,5 % der Scheibe das größte Feld - der Mittelkreis war
       nur der erste, der auffiel. Einmal, nicht rekursiv: sonst wären es
       bei neun Achsen und drei Stufen über siebenhundert Kreise. */
    const inRing = opt.inRing || 0;
    if (inRing >= 3){
      ring.forEach(c => {
        if (c.r < (opt.minRing || 40)) return;
        const s2 = Math.sin(Math.PI/inRing), r2 = c.r*s2/(1+s2), d2 = c.r - r2;
        for (let i = 0; i < inRing; i++){
          const a2 = UP + i*TAU/inRing;
          alle.push({ x:c.x+Math.cos(a2)*d2, y:c.y+Math.sin(a2)*d2, r:r2, k:1/r2 });
        }
        alle.push({ x:c.x, y:c.y, r:c.r - 2*r2, k:1/(c.r - 2*r2) });
      });
    }
  }

  function beruehrt(a, b){
    const dd = Math.hypot(a.x-b.x, a.y-b.y);
    const soll = (a.k < 0 || b.k < 0) ? Math.abs(Math.abs(1/a.k) - Math.abs(1/b.k))
                                      : Math.abs(1/a.k) + Math.abs(1/b.k);
    return Math.abs(dd - soll) < 0.6;
  }

  /* Der vierte Kreis zu drei gegebenen, Descartes 1643. Beide Wurzelzweige
     werden probiert; genommen wird der, der alle drei wirklich berührt. */
  function soddy(c1, c2, c3){
    const k = [c1.k, c2.k, c3.k];
    const k4 = k[0]+k[1]+k[2] + 2*Math.sqrt(Math.max(0, k[0]*k[1]+k[1]*k[2]+k[2]*k[0]));
    if (!isFinite(k4) || k4 <= 0) return null;
    const w = [c1,c2,c3].map(c => Z.sca([c.x, c.y], c.k));
    const unter = Z.add(Z.add(Z.mul(w[0],w[1]), Z.mul(w[1],w[2])), Z.mul(w[2],w[0]));
    const wr = Z.sqrt(unter);
    const summe = Z.add(Z.add(w[0], w[1]), w[2]);
    for (const vz of [1,-1]){
      const w4 = Z.add(summe, Z.sca(wr, 2*vz));
      const c = { x: w4[0]/k4, y: w4[1]/k4, r: 1/k4, k: k4 };
      if (beruehrt(c,c1) && beruehrt(c,c2) && beruehrt(c,c3)) return c;
    }
    return null;
  }

  schicht({ x:C, y:C, r:R_OUT }, 0);
  const eingesetzt = [];
  while (luecken.length){
    const paar = luecken.shift();
    const a = paar[0], b = paar[1], c = paar[2], t = paar[3];
    if (t >= tiefe) continue;
    const d4 = soddy(a,b,c);
    if (!d4 || d4.r < minR) continue;
    eingesetzt.push(d4);
    luecken.push([a,b,d4,t+1], [b,c,d4,t+1], [a,c,d4,t+1]);
  }

  rahmen(ctx);
  alle.concat(eingesetzt).forEach(c => {
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.stroke();
  });
  return { kreise: alle.length + eingesetzt.length + 1, eingesetzt: eingesetzt.length };
}

/* =========================================================================
   2  KLANGFELD — Knotenlinien einer schwingenden Membran
   Rayleigh, „The Theory of Sound" (1877), §200 ff.; die Idee der Knotenfigur
   von Chladni, „Die Akustik" (1802), geordnet von Mary Waller, „Chladni
   Figures: A Study in Symmetry" (1961).
   Zwei Moden übereinandergelegt, wie auf einer angeregten Trommel, deren
   Frequenzen nahe beieinanderliegen. Die Zellen werden nach außen von selbst
   kleiner. Gekrümmte Wände mit wechselnder Krümmung - im Katalog gibt es das
   nicht ein einziges Mal.
   ====================================================================== */
function klangfeld(ctx, opt){
  const n = opt.n === undefined ? 0 : opt.n, m = opt.m || 4;
  const p = opt.p || 8, q = opt.q || 2;
  const A = opt.A === undefined ? 1 : opt.A, B = opt.B === undefined ? 1.15 : opt.B;
  const alpha = besselNull(n, m, 60), beta = besselNull(p, q, 60);
  const tafA = besselTafel(n, alpha, 3000), tafB = besselTafel(p, beta, 3000);
  const f = (r, th) => {
    const u = r / R_OUT;
    return A * tafA.at(alpha*u) * Math.cos(n*th)
         + B * tafB.at(beta*u)  * Math.cos(p*th);
  };
  /* Bis LEICHT ÜBER den Rahmen rechnen. Beim ersten Anlauf brach das Gitter
     eine Zellenbreite vor dem Rand ab; dort lief alles außen herum zusammen,
     und aus einer Knotenfigur wurden vier Felder mit 45 % Anteil. */
  const st = nulllinie(f, 2.5, R_OUT + 7);
  ctx.beginPath();
  st.forEach(s => { ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); });
  ctx.stroke();
  rahmen(ctx);
  /* Die Speichen laufen in einem Punkt zusammen und geben dort einen
     Schmutzfleck. Die Nabe deckt ihn, wie in jedem anderen Motiv auch. */
  nabe(ctx);
  return { strecken: st.length, alpha: +alpha.toFixed(3), beta: +beta.toFixed(3) };
}

/* =========================================================================
   3  KIESELSCHALE — Gitter aus Poren, nach den Radiolarien
   Haeckel, „Report on the Radiolaria" (1887) und „Kunstformen der Natur"
   (1899-1904); D'Arcy Thompson, „On Growth and Form" (1917).
   Die Zellwände sind ein echtes Voronoi-Gitter (Halbebenen-Schnitt, nicht
   geschätzt), in jeder Zelle eine Pore. Zwei Feldgrößen je Zelle, und die
   Stacheln laufen über die Ringgrenzen hinweg.
   ====================================================================== */
function kieselschale(ctx, opt){
  const n = opt.achsen || 8, ringe = opt.ringe || 5;
  const orte = [];
  for (let k = 0; k < ringe; k++){
    const t = (k + 0.5) / ringe;
    const r = R_IN + 20 + t * (R_OUT - R_IN - 42);
    const zahl = n * (k + 2);
    const versatz = (k % 2) ? Math.PI / zahl : 0;
    for (let i = 0; i < zahl; i++){
      const a = UP + versatz + i * TAU / zahl;
      orte.push({ x: C+Math.cos(a)*r, y: C+Math.sin(a)*r, ring: k, a: a, r: r });
    }
  }
  const scheibe = kreisPoly(C, C, R_OUT - 6, 128);
  const zellen = [];
  orte.forEach(o => {
    let poly = scheibe;
    const nah = orte.filter(q => q !== o)
      .map(q => ({ q: q, d: (q.x-o.x)*(q.x-o.x) + (q.y-o.y)*(q.y-o.y) }))
      .sort((a,b) => a.d - b.d).slice(0, 14);
    nah.forEach(function (eintrag) {
      const q = eintrag.q;
      poly = schneideHalbebene(poly, o.x, o.y, q.x, q.y);
    });
    /* Die Nabe bleibt frei: was hineinragt, wird weggeschnitten. Der Kreis
       liegt eng an R_IN - beim ersten Anlauf lag er bei 2 × R_IN, und der
       freie Ring dazwischen war mit 5 % das größte Feld. */
    for (let i = 0; i < 64; i++){
      const a = i*TAU/64, gx = C+Math.cos(a)*(R_IN*2 - 8), gy = C+Math.sin(a)*(R_IN*2 - 8);
      poly = schneideHalbebene(poly, o.x, o.y, gx, gy);
    }
    if (poly.length >= 3) zellen.push({ o: o, poly: poly });
  });

  /* Stacheln zuerst, damit die Wände darüber liegen. */
  zellen.filter(z => z.o.ring === ringe-1).forEach((z,i) => {
    if (i % 2) return;
    const a = z.o.a;
    const p0 = pol(z.o.r, a), p1 = pol(R_OUT, a);
    const pts = [];
    for (let t = 0; t <= 20; t++){
      const u = t/20;
      pts.push([p0[0]+(p1[0]-p0[0])*u, p0[1]+(p1[1]-p0[1])*u]);
    }
    /* Breiter als beim ersten Anlauf: Ein Stachel schneidet zwei Zellwände,
       und die Späne daneben müssen groß genug bleiben, dass ein Finger sie
       trifft. Schmal erzeugte er Splitter statt Felder. */
    /* Spitz zulaufend und bis an den Rahmen. Stumpf abgeschnitten lasen
       sich die Stacheln wie Schlüssellöcher. */
    bandUmriss(ctx, pts, u => 24 * (1 - u*0.86));
  });

  zellen.forEach(z => {
    ctx.beginPath();
    z.poly.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]));
    ctx.closePath(); ctx.stroke();
    /* Pore: der größte Kreis, der in die Zelle passt, etwas kleiner. */
    let ir = 1e9;
    for (let i = 0; i < z.poly.length; i++){
      const a = z.poly[i], b = z.poly[(i+1)%z.poly.length];
      const L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1;
      const dist = Math.abs((b[0]-a[0])*(a[1]-z.o.y) - (b[1]-a[1])*(a[0]-z.o.x)) / L;
      if (dist < ir) ir = dist;
    }
    /* Eine Pore nur, wenn der Ring zwischen ihr und der Wand ein FELD bleibt.
       Der Ring ist etwa 2·pi·pr·(ir-pr) groß; unter 80 px² trifft ihn kein
       Finger. Ohne diese Schranke waren es 130 Splitter. */
    const pr = ir * 0.5;
    const ringflaeche = 2 * Math.PI * pr * (ir - pr);
    if (ir > 10 && ringflaeche > 200){
      ctx.beginPath(); ctx.arc(z.o.x, z.o.y, pr, 0, TAU); ctx.stroke();
    }
  });
  rahmen(ctx); nabe(ctx);
  return { zellen: zellen.length, poren: zellen.length };
}

/* =========================================================================
   4  FÄCHERGEWÖLBE — Rippen als Stützlinien
   Hooke (1675, als Anagramm veröffentlicht); Gaudís hängende Schnüre;
   Block/Ochsendorf zur Gewölbestatik. Radial angeordnet ist eine Schar
   Stützlinien ein Fächergewölbe von unten gesehen. Alle Zellen sind von
   Rippen und Ringen geschlossen.
   ====================================================================== */
function faechergewoelbe(ctx, opt){
  const n = opt.achsen || 8, rippen = opt.rippen || 9;
  const ringe = opt.ringe || [0.30, 0.52, 0.74, 0.94];
  const spreiz = (opt.spreiz || 74) * Math.PI / 180;
  const seg = TAU / n;

  /* Ein Fächergewölbe ist kein Polargitter. Jeder Fächer sitzt auf EINEM
     Kämpfer, und alles darüber ist ein Kegel um diesen Punkt: Die Rippen
     gehen strahlenförmig vom Kämpfer aus, und die Ringe (Lierne) sind
     Kreisbögen UM DEN KÄMPFER - nicht um die Mitte des Blattes.
     Der erste Anlauf hatte die Ringe um die Mitte gelegt; daraus wurde eine
     Dartscheibe mit tadellosen Messwerten. */
  for (let sIdx = 0; sIdx < n; sIdx++){
    const phi = UP + sIdx*seg;
    /* Der Kämpfer steht WEIT AUSSEN, nicht an der Nabe. Bei acht Segmenten
       ist die Lücke an der Nabe nur vierzig Pixel breit; ein Fächer hat dort
       keinen Platz und zerfällt in Stummel, die wie ein Stachelstern
       aussehen. Im Gewölbe stehen die Kämpfer auf den Pfeilern am Rand, und
       in der Mitte treffen sich die Fächer über einem Schlussstein. */
    const kaempfer = pol((opt.kaempfer || 0.56) * R_OUT, phi);

    ctx.save();
    /* Nur im eigenen Segment zeichnen, und NUR AUSSERHALB DER NABE. Ohne den
       inneren Bogen liefen die Rippen mit großer Spreizung über den Kämpfer
       hinaus nach innen und ergaben einen Stachelstern um die Mitte. */
    ctx.beginPath();
    ctx.arc(C, C, R_IN + 1, phi - seg/2, phi + seg/2);
    ctx.arc(C, C, R_OUT - 1, phi + seg/2, phi - seg/2, true);
    ctx.closePath();
    ctx.clip();

    const weit = R_OUT * 2;
    for (let i = 0; i < rippen; i++){
      const f = rippen === 1 ? 0 : (i/(rippen-1) - 0.5) * 2;
      const a = phi + f * spreiz;
      ctx.beginPath();
      ctx.moveTo(kaempfer[0], kaempfer[1]);
      ctx.lineTo(kaempfer[0] + Math.cos(a)*weit, kaempfer[1] + Math.sin(a)*weit);
      ctx.stroke();
    }
    ringe.forEach(t => {
      ctx.beginPath();
      ctx.arc(kaempfer[0], kaempfer[1], t * (R_OUT - R_IN), phi - spreiz, phi + spreiz);
      ctx.stroke();
    });
    ctx.restore();
  }
  rahmen(ctx); nabe(ctx);
  return { faecher: n, rippen: n*rippen, ringe: ringe.length };
}

/* =========================================================================
   5  PENDELRISS — Harmonograph
   Benham, „Harmonic Vibrations" (1909); Ashton, „Harmonograph".
   Zwei abklingende Pendel. Die Kurve wird von selbst dünner und wandert
   nach innen - genau die zwei Hebel, die fehlen, und sie kommen aus der
   Physik statt aus einem Einfall. Gezeichnet als BAND MIT ZWEI RÄNDERN,
   nicht als Tinte: nur so ist das Band selbst ein Feld.
   ====================================================================== */
function pendelriss(ctx, opt){
  const n = opt.achsen || 6;
  const f1 = opt.f1 || 2, f2 = opt.f2 || 3, ph = opt.ph === undefined ? Math.PI/4 : opt.ph;
  const dz = opt.dz === undefined ? 0.0028 : opt.dz;
  const TMAX = opt.tmax || 620, A = opt.A || (R_OUT - 34);

  const pts = [];
  for (let t = 0; t <= TMAX; t += 1.1){
    const e = Math.exp(-dz*t);
    const x = C + A*e*Math.sin(f1*t*0.031);
    const y = C + A*e*Math.sin(f2*t*0.031 + ph);
    pts.push([x,y]);
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(C, C, R_OUT-2, 0, TAU); ctx.clip();
  for (let s = 0; s < n; s++){
    ctx.save();
    ctx.translate(C,C); ctx.rotate(s*TAU/n); ctx.translate(-C,-C);
    bandUmriss(ctx, pts, u => 4 + 13*Math.pow(1-u, 1.6));
    ctx.restore();
  }
  ctx.restore();
  rahmen(ctx);
  return { punkte: pts.length, wiederholt: n };
}

const ENTWUERFE = [
  { id:'kreisbrut',   name:'Kreisbrut',     fn:kreisbrut,       opt:{achsen:7, minR:28, tiefe:3, stufen:3, minInnen:60, inRing:5, minRing:45},
    fuer:'Mandala', quelle:'Descartes 1643 · Soddy, Nature 1936' },
  { id:'klangfeld',   name:'Klangfeld',     fn:klangfeld,       opt:{n:8,m:4,p:24,q:2,B:0.55},
    fuer:'beide',   quelle:'Rayleigh 1877 · Chladni 1802 · Waller 1961' },
  { id:'kieselschale',name:'Kieselschale',  fn:kieselschale,    opt:{achsen:8, ringe:5},
    fuer:'Mandala', quelle:'Haeckel 1887/1899 · D’Arcy Thompson 1917' },
  { id:'faecher',     name:'Fächergewölbe', fn:faechergewoelbe, opt:{achsen:8, rippen:9, spreiz:62, kaempfer:0.12},
    fuer:'beide',   quelle:'Hooke 1675 · Block/Ochsendorf' },
  { id:'pendelriss',  name:'Pendelriss',    fn:pendelriss,      opt:{achsen:1, f1:2, f2:3, dz:0.0019, tmax:900},
    fuer:'Blatt',   quelle:'Benham 1909 · Ashton, Harmonograph' }
];

window.Entwuerfe = { ENTWUERFE: ENTWUERFE, bandUmriss: bandUmriss };
})();
