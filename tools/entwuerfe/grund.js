'use strict';
/* Gemeinsames Handwerkszeug für die Entwürfe. Maße wie in der App. */

const SIZE = 900, C = 450, R_OUT = 410, R_IN = 46;
const TAU = Math.PI * 2, UP = -Math.PI / 2;

function pol(r, a){ return [C + Math.cos(a) * r, C + Math.sin(a) * r]; }

/* ---- Kleine komplexe Arithmetik. Descartes' Kreissatz braucht sie. ---- */
const Z = {
  add: (a,b) => [a[0]+b[0], a[1]+b[1]],
  sub: (a,b) => [a[0]-b[0], a[1]-b[1]],
  mul: (a,b) => [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]],
  sca: (a,s) => [a[0]*s, a[1]*s],
  /* Hauptwurzel. */
  sqrt: a => {
    const r = Math.hypot(a[0], a[1]);
    if (r < 1e-18) return [0,0];
    const re = Math.sqrt((r + a[0]) / 2);
    let im = Math.sqrt(Math.max(0,(r - a[0]) / 2));
    if (a[1] < 0) im = -im;
    return [re, im];
  }
};

/* ---- Bessel J_n, über die Integraldarstellung. Langsam, aber sicher:
   die Aufwärts-Rekursion kippt, sobald n größer als x wird, und genau
   dort liegen die interessanten Moden. Simpson mit 512 Schritten. ---- */
function besselJ(n, x){
  const M = 512, h = Math.PI / M;
  let s = 0;
  for (let i = 0; i <= M; i++){
    const th = i * h;
    const f = Math.cos(n * th - x * Math.sin(th));
    s += f * (i === 0 || i === M ? 1 : (i % 2 ? 4 : 2));
  }
  return s * h / 3 / Math.PI;
}

/* Eine Tafel über r, damit das Gitter nicht 90 000 Integrale rechnet. */
function besselTafel(n, xmax, stufen){
  const t = new Float64Array(stufen + 1);
  for (let i = 0; i <= stufen; i++) t[i] = besselJ(n, xmax * i / stufen);
  return { t: t, xmax: xmax, stufen: stufen,
    at: function (x){
      if (x <= 0) return this.t[0];
      if (x >= this.xmax) return this.t[this.stufen];
      const u = x / this.xmax * this.stufen, i = Math.floor(u), f = u - i;
      return this.t[i] * (1 - f) + this.t[i+1] * f;
    } };
}

/* Die m-te positive Nullstelle von J_n.

   ACHTUNG, hier lag ein stiller Fehler: Für n >= 1 ist J_n(0) = 0, und
   dicht bei Null liefert die Integration nur Rauschen um 1e-17. Ein
   Vorzeichenwechsel-Zähler findet dort dutzende „Nullstellen" und gab
   j_8,3 = 0,0598 zurück statt 18,76. Der zweite Term einer Überlagerung war
   damit Rauschen, und dreißig gemessene Zeilen zeigten in Wahrheit eine
   einzelne Mode.

   Zwei Riegel: Gesucht wird erst ab x = n (die erste Nullstelle von J_n
   liegt immer darüber, j_n,1 ~ n + 1,86 n^(1/3)), und zwischen zwei
   gezählten Wechseln muss |J| einmal über eine Schwelle gekommen sein. */
function besselNull(n, m, xmax){
  const start = n === 0 ? 0.3 : n;
  const SCHWELLE = 1e-4, N = 6000;
  const f = x => besselJ(n, x);
  let gefunden = 0, vor = f(start), hoch = Math.abs(vor), xvor = start;
  for (let i = 1; i <= N; i++){
    const x = start + (xmax - start) * i / N, jetzt = f(x);
    hoch = Math.max(hoch, Math.abs(jetzt));
    if ((vor < 0) !== (jetzt < 0) && hoch > SCHWELLE){
      gefunden++;
      if (gefunden === m){
        let a = xvor, b = x;
        for (let k = 0; k < 70; k++){
          const mid = (a+b)/2;
          if ((f(a) < 0) !== (f(mid) < 0)) b = mid; else a = mid;
        }
        return (a+b)/2;
      }
      hoch = 0;
    }
    vor = jetzt; xvor = x;
  }
  return null;
}

/* ---- Marching squares auf Höhe 0. Liefert Strecken, die zusammen die
   Knotenlinie bilden. Geschlossen ist sie durch den Rahmen. ---- */
function nulllinie(f, schritt, rmax){
  const strecken = [];
  const w = Math.ceil(SIZE / schritt);
  const feld = new Float64Array((w+1)*(w+1));
  const drin = new Uint8Array((w+1)*(w+1));
  for (let j = 0; j <= w; j++) for (let i = 0; i <= w; i++){
    const x = i*schritt, y = j*schritt;
    const dx = x - C, dy = y - C, r = Math.hypot(dx,dy);
    const k = j*(w+1)+i;
    drin[k] = r <= rmax ? 1 : 0;
    feld[k] = drin[k] ? f(r, Math.atan2(dy,dx)) : 0;
  }
  const mitte = (a,b,va,vb) => {
    const t = va / (va - vb);
    return [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t];
  };
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++){
    const k = [j*(w+1)+i, j*(w+1)+i+1, (j+1)*(w+1)+i+1, (j+1)*(w+1)+i];
    if (!(drin[k[0]] && drin[k[1]] && drin[k[2]] && drin[k[3]])) continue;
    const p = [[i*schritt,j*schritt],[(i+1)*schritt,j*schritt],
               [(i+1)*schritt,(j+1)*schritt],[i*schritt,(j+1)*schritt]];
    const v = k.map(x => feld[x]);
    const kreuz = [];
    for (let e = 0; e < 4; e++){
      const a = e, b = (e+1)%4;
      if ((v[a] < 0) !== (v[b] < 0)) kreuz.push(mitte(p[a],p[b],v[a],v[b]));
    }
    if (kreuz.length === 2) strecken.push(kreuz);
    else if (kreuz.length === 4){ strecken.push([kreuz[0],kreuz[1]]); strecken.push([kreuz[2],kreuz[3]]); }
  }
  return strecken;
}

/* ---- Halbebenen-Schnitt: daraus wird die Voronoi-Zelle exakt. ---- */
function schneideHalbebene(poly, px, py, qx, qy){
  /* behalte, was näher an (px,py) liegt als an (qx,qy) */
  const mx = (px+qx)/2, my = (py+qy)/2, nx = qx-px, ny = qy-py;
  const seite = p => (p[0]-mx)*nx + (p[1]-my)*ny;   /* <0 = näher an p */
  const raus = [];
  for (let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i+1)%poly.length];
    const sa = seite(a), sb = seite(b);
    if (sa <= 0) raus.push(a);
    if ((sa < 0) !== (sb < 0)){
      const t = sa / (sa - sb);
      raus.push([a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]);
    }
  }
  return raus;
}

function kreisPoly(cx, cy, r, n){
  const p = [];
  for (let i = 0; i < n; i++){ const a = i*TAU/n; p.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); }
  return p;
}

/* ---- Der schwellende Strich: eine Linie als GEFÜLLTES Vieleck, dessen
   Halbbreite entlang des Wegs wandert. Das ist der Hebel, den der Katalog
   nicht hatte - dort liegt jede Breite zwischen 0,9 und 2,6. ---- */
function schwellBand(ctx, punkte, breiteBei, farbe){
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
  ctx.fillStyle = farbe; ctx.fill();
}

if (typeof window !== 'undefined'){
  window.Grund = { SIZE, C, R_OUT, R_IN, TAU, UP, pol, Z, besselJ, besselTafel,
                   besselNull, nulllinie, schneideHalbebene, kreisPoly, schwellBand };
}
