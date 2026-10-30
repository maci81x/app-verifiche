// Figure degli esercizi di matematica (issue #5, fetta #7): SVG disegnato qui dalla
// specifica del modello { forma, misure: [{ nome, valore }] }, senza librerie e mai da
// un'immagine. Le stesse figure servono in stampa (fetta #9): tratto in currentColor.
// Script classico, senza dipendenze: lo caricano l'app e i test.

// Stesso elenco di supabase/functions/_shared/generati.js (un test controlla che coincidano).
const FORME_FIGURE = {
  triangolo: ["base", "altezza", "lato_sinistro", "lato_destro"],
  triangolo_rettangolo: ["cateto1", "cateto2", "ipotenusa"],
  rettangolo: ["base", "altezza", "diagonale"],
  quadrato: ["lato", "diagonale"],
  parallelogramma: ["base", "altezza", "lato"],
  rombo: ["diagonale_maggiore", "diagonale_minore", "lato"],
  trapezio: ["base_maggiore", "base_minore", "altezza", "lato_obliquo"],
  cerchio: ["raggio", "diametro"],
  cubo: ["spigolo"],
  parallelepipedo: ["lunghezza", "larghezza", "altezza"],
  cilindro: ["raggio", "altezza"],
};

// Le linee dentro la figura portano una lettera davanti alla misura, come sul libro.
const SIGLE_FIGURE = { altezza: "h", diagonale: "d", diagonale_maggiore: "D", diagonale_minore: "d", raggio: "r", diametro: "d" };

const FIG_W = 240, FIG_H = 180;                                  // viewBox
const AREA = { x: 120, y: 86, w: 140, h: 108 };                  // dove sta il disegno (centro e misure)
const SCOSTA = 13;                                               // distanza delle etichette dalla linea

const escFig = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
const r1 = (x) => Math.round(x * 10) / 10;
const fra = (x, min, max) => Math.min(max, Math.max(min, x));

// Il numero all'inizio di una misura ("12 cm" → 12); null se non c'è o non ha senso.
function numeroMisura(v) {
  const m = /^\s*(\d+(?:[.,]\d+)?)/.exec(String(v || ""));
  const n = m ? Number(m[1].replace(",", ".")) : NaN;
  return n > 0 && n < 1e6 ? n : null;
}
// Rapporto fra due misure per le proporzioni del disegno, entro limiti leggibili.
function rapporto(a, b, min, max, predefinito) {
  return a && b ? fra(a / b, min, max) : predefinito;
}

/* Ogni forma, in coordinate proprie (larghezza w, altezza h, y verso il basso):
   linee e poligoni da disegnare e, per ogni misura, il tratto (o il punto) a cui
   attaccare l'etichetta e la direzione in cui spostarla. */
const DISEGNI = {
  rettangolo(n) {
    const w = rapporto(n.base, n.altezza, 0.4, 2.5, 1.6), h = 1;
    return { w, h, forme: [["poli", [[0, 0], [w, 0], [w, h], [0, h]]], ["tratteggio", [0, h], [w, 0]]],
      etichette: { base: [[0, h], [w, h], [0, 1]], altezza: [[w, 0], [w, h], [1, 0]], diagonale: [[0, h], [w, 0], [-0.6, -0.8]] } };
  },
  quadrato() {
    return { w: 1, h: 1, forme: [["poli", [[0, 0], [1, 0], [1, 1], [0, 1]]], ["tratteggio", [0, 1], [1, 0]]],
      etichette: { lato: [[0, 1], [1, 1], [0, 1]], diagonale: [[0, 1], [1, 0], [0.6, 0.8]] } };
  },
  triangolo() {
    const A = [0, 1], B = [1.4, 1], C = [0.5, 0], H = [0.5, 1];
    return { w: 1.4, h: 1, forme: [["poli", [A, B, C]], ["tratteggio", C, H]],
      etichette: { base: [A, B, [0, 1]], lato_sinistro: [A, C, [-0.9, -0.4]], lato_destro: [B, C, [0.8, -0.5]], altezza: [C, H, [1, 0]] } };
  },
  triangolo_rettangolo(n) {
    const w = rapporto(n.cateto1, n.cateto2, 0.5, 2.5, 1.33), A = [0, 1], B = [w, 1], C = [0, 0], q = 0.12;
    return { w, h: 1, forme: [["poli", [A, B, C]], ["linea", [0, 1 - q], [q, 1 - q]], ["linea", [q, 1 - q], [q, 1]]],
      etichette: { cateto1: [A, B, [0, 1]], cateto2: [A, C, [-1, 0]], ipotenusa: [B, C, [0.7, -0.7]] } };
  },
  parallelogramma() {
    return { w: 1.5, h: 1, forme: [["poli", [[0.4, 0], [1.5, 0], [1.1, 1], [0, 1]]], ["tratteggio", [0.4, 0], [0.4, 1]]],
      etichette: { base: [[0, 1], [1.1, 1], [0, 1]], lato: [[0, 1], [0.4, 0], [-0.9, -0.3]], altezza: [[0.4, 0], [0.4, 1], [1, 0]] } };
  },
  rombo(n) {
    const w = rapporto(n.diagonale_maggiore, n.diagonale_minore, 1, 2.5, 1.5), h = 1;
    return { w, h, forme: [["poli", [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]], ["tratteggio", [0, h / 2], [w, h / 2]], ["tratteggio", [w / 2, 0], [w / 2, h]]],
      etichette: { diagonale_maggiore: [[w * 0.75, h / 2], null, [0, 1]], diagonale_minore: [[w / 2, h * 0.28], null, [1, 0]], lato: [[w / 2, 0], [w, h / 2], [0.7, -0.7]] } };
  },
  trapezio() {
    return { w: 1.6, h: 1, forme: [["poli", [[0.4, 0], [1.2, 0], [1.6, 1], [0, 1]]], ["tratteggio", [0.4, 0], [0.4, 1]]],
      etichette: { base_maggiore: [[0, 1], [1.6, 1], [0, 1]], base_minore: [[0.4, 0], [1.2, 0], [0, -1]], lato_obliquo: [[1.2, 0], [1.6, 1], [1, -0.3]], altezza: [[0.4, 0], [0.4, 1], [1, 0]] } };
  },
  cerchio() {
    const c = [0.5, 0.5], p = [0.5 + 0.354, 0.5 - 0.354];
    return { w: 1, h: 1, forme: [["cerchio", c, 0.5], ["punto", c], ["linea", c, p], ["tratteggio", [0, 0.5], [1, 0.5]]],
      etichette: { raggio: [c, p, [-0.7, -0.7]], diametro: [[0.3, 0.5], null, [0, 1]] } };
  },
  cubo() {
    const F = [[0, 0.3], [0.7, 0.3], [0.7, 1], [0, 1]], d = [0.3, -0.3], B = F.map(([x, y]) => [x + d[0], y + d[1]]);
    return { w: 1, h: 1, forme: solido(F, B, 3), etichette: { spigolo: [F[3], F[2], [0, 1]] } };
  },
  parallelepipedo() {
    const F = [[0, 0.35], [1.2, 0.35], [1.2, 1.1], [0, 1.1]], B = F.map(([x, y]) => [x + 0.4, y - 0.35]);
    return { w: 1.6, h: 1.1, forme: solido(F, B, 3),
      etichette: { lunghezza: [F[3], F[2], [0, 1]], altezza: [F[0], F[3], [-1, 0]], larghezza: [F[2], B[2], [0.8, 0.6]] } };
  },
  cilindro() {
    const ry = 0.12, alto = [0.5, ry], basso = [0.5, 1.3 - ry];
    return { w: 1, h: 1.3, forme: [["ellisse", alto, 0.5, ry], ["ellisse", basso, 0.5, ry], ["linea", [0, ry], [0, 1.3 - ry]], ["linea", [1, ry], [1, 1.3 - ry]], ["punto", alto], ["linea", alto, [1, ry]]],
      etichette: { raggio: [alto, [1, ry], [0, -1]], altezza: [[0, ry], [0, 1.3 - ry], [-1, 0]] } };
  },
};

// Faccia davanti F, faccia dietro B (4 vertici ciascuna); nascosto: il vertice dietro che non si vede.
function solido(F, B, nascosto) {
  const visibili = [["poli", F]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const tipo = (i === nascosto || j === nascosto) ? "tratteggio" : "linea";
    visibili.push([tipo, B[i], B[j]]);
    visibili.push([i === nascosto ? "tratteggio" : "linea", F[i], B[i]]);
  }
  return visibili;
}

// Coordinate proprie → viewBox, centrate nell'AREA e in scala uniforme.
function adatta(w, h) {
  const s = Math.min(AREA.w / w, AREA.h / h), ox = AREA.x - (w * s) / 2, oy = AREA.y - (h * s) / 2;
  return { s, p: ([x, y]) => [r1(ox + x * s), r1(oy + y * s)] };
}

function etichettaSvg(testo, [x, y], [dx, dy]) {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const tx = r1(fra(x + ux * SCOSTA, 6, FIG_W - 6)), ty = r1(fra(y + uy * SCOSTA + 4, 14, FIG_H - 4));
  const ancora = ux > 0.3 ? "start" : ux < -0.3 ? "end" : "middle";
  return `<text x="${tx}" y="${ty}" text-anchor="${ancora}">${escFig(testo)}</text>`;
}

function formaSvg([tipo, a, b, c], { s, p }) {
  if (tipo === "poli") return `<polygon points="${a.map((q) => p(q).join(",")).join(" ")}"/>`;
  if (tipo === "cerchio") { const [cx, cy] = p(a); return `<circle cx="${cx}" cy="${cy}" r="${r1(b * s)}"/>`; }
  if (tipo === "ellisse") { const [cx, cy] = p(a); return `<ellipse cx="${cx}" cy="${cy}" rx="${r1(b * s)}" ry="${r1(c * s)}"/>`; }
  if (tipo === "punto") { const [cx, cy] = p(a); return `<circle cx="${cx}" cy="${cy}" r="2" fill="currentColor"/>`; }
  const [x1, y1] = p(a), [x2, y2] = p(b);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${tipo === "tratteggio" ? ' stroke-dasharray="5 4"' : ""}/>`;
}

// figura: { forma, misure: [{ nome, valore }] } → stringa SVG, "" se la forma non è prevista.
function svgFigura(figura) {
  const nomi = figura && Object.hasOwn(FORME_FIGURE, figura.forma) ? FORME_FIGURE[figura.forma] : null;
  if (!nomi || !Array.isArray(figura.misure)) return "";
  const misure = {}, numeri = {};
  figura.misure.forEach((m) => {
    if (m && nomi.includes(m.nome) && !(m.nome in misure)) { misure[m.nome] = String(m.valore || "?"); numeri[m.nome] = numeroMisura(m.valore); }
  });
  if (!Object.keys(misure).length) return "";
  const d = DISEGNI[figura.forma](numeri), t = adatta(d.w, d.h);
  const etichette = Object.keys(misure).map((nome) => {
    const [a, b, verso] = d.etichette[nome];
    const punto = b ? t.p([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) : t.p(a);
    const testo = SIGLE_FIGURE[nome] ? SIGLE_FIGURE[nome] + " = " + misure[nome] : misure[nome];
    return etichettaSvg(testo, punto, verso);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIG_W} ${FIG_H}" class="figura" role="img" aria-label="${escFig("Figura: " + figura.forma.replace("_", " "))}">` +
    `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${d.forme.map((f) => formaSvg(f, t)).join("")}</g>` +
    `<g fill="currentColor" font-size="13" font-family="inherit">${etichette.join("")}</g></svg>`;
}
