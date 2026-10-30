// Ricalcolo dalle figure (issue #10). JavaScript puro: lo usano la Edge Function e i test.
//
// La `verifica` di un esercizio ricalcola i conti che il modello ha scritto, ma non può
// accorgersi di una formula sbagliata: l'area del triangolo senza il /2 torna coerente
// con se stessa. Qui, per le forme standard di FORME, il server ricava area, perimetro,
// volume o la misura mancante dalle misure della figura con la formula giusta, e
// l'esercizio passa solo se il risultato dichiarato coincide.

import { coincide } from "./calcolo.js";

// Cosa chiede l'esercizio rispetto alla figura disegnata (campo `grandezza` dello schema).
export const GRANDEZZE = ["area", "perimetro", "volume", "misura", "altro"];

// π scolastico o π vero: il libro usa 3,14, qualche esercizio lascia la calcolatrice.
const PI = [3.14, Math.PI];

// Valore numerico di una misura della figura ("8 cm" → 8, "7,5" → 7.5, "?" → null).
// Una misura con più di un numero (o nessuno) non si usa.
// Numeri scritti in una misura, con i punti delle migliaia tolti ("1.200 m" → ["1200"]).
function numeriMisura(figura, nome) {
  const m = (figura?.misure || []).find((x) => x.nome === nome);
  return m ? String(m.valore).replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2").match(/\d+(?:[.,]\d+)?/g) || [] : [];
}
export function valoreMisura(figura, nome) {
  const numeri = numeriMisura(figura, nome);
  return numeri.length === 1 ? Number(numeri[0].replace(",", ".")) : null;
}

const ipot = (a, b) => Math.sqrt(a * a + b * b);
const cateto = (i, a) => (i > a ? Math.sqrt(i * i - a * a) : null);
const tutti = (...v) => v.every((x) => x != null && x > 0);

// Formule per forma. Ognuna riceve v(nome) e restituisce un numero, una lista di
// candidati (per π) o null quando le misure non bastano.
const FORMULE = {
  triangolo: {
    area: (v) => tutti(v("base"), v("altezza")) ? v("base") * v("altezza") / 2 : null,
    perimetro: (v) => tutti(v("base"), v("lato_sinistro"), v("lato_destro")) ? v("base") + v("lato_sinistro") + v("lato_destro") : null,
  },
  triangolo_rettangolo: {
    area: (v) => tutti(v("cateto1"), v("cateto2")) ? v("cateto1") * v("cateto2") / 2 : null,
    perimetro: (v) => {
      const [a, b] = [v("cateto1"), v("cateto2")];
      if (!tutti(a, b)) return null;
      return a + b + (tutti(v("ipotenusa")) ? v("ipotenusa") : ipot(a, b));
    },
    misura: { ipotenusa: (v) => tutti(v("cateto1"), v("cateto2")) ? ipot(v("cateto1"), v("cateto2")) : null,
      cateto1: (v) => tutti(v("ipotenusa"), v("cateto2")) ? cateto(v("ipotenusa"), v("cateto2")) : null,
      cateto2: (v) => tutti(v("ipotenusa"), v("cateto1")) ? cateto(v("ipotenusa"), v("cateto1")) : null },
  },
  rettangolo: {
    area: (v) => tutti(v("base"), v("altezza")) ? v("base") * v("altezza") : null,
    perimetro: (v) => tutti(v("base"), v("altezza")) ? 2 * (v("base") + v("altezza")) : null,
    misura: { diagonale: (v) => tutti(v("base"), v("altezza")) ? ipot(v("base"), v("altezza")) : null,
      base: (v) => tutti(v("diagonale"), v("altezza")) ? cateto(v("diagonale"), v("altezza")) : null,
      altezza: (v) => tutti(v("diagonale"), v("base")) ? cateto(v("diagonale"), v("base")) : null },
  },
  quadrato: {
    area: (v) => tutti(v("lato")) ? v("lato") ** 2 : (tutti(v("diagonale")) ? v("diagonale") ** 2 / 2 : null),
    perimetro: (v) => tutti(v("lato")) ? 4 * v("lato") : null,
    misura: { diagonale: (v) => tutti(v("lato")) ? v("lato") * Math.SQRT2 : null,
      lato: (v) => tutti(v("diagonale")) ? v("diagonale") / Math.SQRT2 : null },
  },
  parallelogramma: {
    area: (v) => tutti(v("base"), v("altezza")) ? v("base") * v("altezza") : null,
    perimetro: (v) => tutti(v("base"), v("lato")) ? 2 * (v("base") + v("lato")) : null,
  },
  rombo: {
    area: (v) => tutti(v("diagonale_maggiore"), v("diagonale_minore")) ? v("diagonale_maggiore") * v("diagonale_minore") / 2 : null,
    perimetro: (v) => tutti(v("lato")) ? 4 * v("lato")
      : (tutti(v("diagonale_maggiore"), v("diagonale_minore")) ? 4 * ipot(v("diagonale_maggiore") / 2, v("diagonale_minore") / 2) : null),
    misura: { lato: (v) => tutti(v("diagonale_maggiore"), v("diagonale_minore")) ? ipot(v("diagonale_maggiore") / 2, v("diagonale_minore") / 2) : null },
  },
  trapezio: {
    area: (v) => tutti(v("base_maggiore"), v("base_minore"), v("altezza")) ? (v("base_maggiore") + v("base_minore")) * v("altezza") / 2 : null,
  },
  cerchio: {
    area: (v) => { const r = tutti(v("raggio")) ? v("raggio") : (tutti(v("diametro")) ? v("diametro") / 2 : null); return r ? PI.map((p) => p * r * r) : null; },
    perimetro: (v) => { const d = tutti(v("diametro")) ? v("diametro") : (tutti(v("raggio")) ? 2 * v("raggio") : null); return d ? PI.map((p) => p * d) : null; },
    misura: { diametro: (v) => tutti(v("raggio")) ? 2 * v("raggio") : null, raggio: (v) => tutti(v("diametro")) ? v("diametro") / 2 : null },
  },
  cubo: {
    volume: (v) => tutti(v("spigolo")) ? v("spigolo") ** 3 : null,
  },
  parallelepipedo: {
    volume: (v) => tutti(v("lunghezza"), v("larghezza"), v("altezza")) ? v("lunghezza") * v("larghezza") * v("altezza") : null,
  },
  cilindro: {
    volume: (v) => tutti(v("raggio"), v("altezza")) ? PI.map((p) => p * v("raggio") ** 2 * v("altezza")) : null,
  },
};

// Misure date tutte e tre che devono stare insieme (Pitagora, diametro = 2 raggi):
// una figura che non torna è sbagliata anche se il risultato tornasse.
const COERENZE = {
  triangolo_rettangolo: [["ipotenusa", (v) => tutti(v("cateto1"), v("cateto2")) ? ipot(v("cateto1"), v("cateto2")) : null]],
  rettangolo: [["diagonale", (v) => tutti(v("base"), v("altezza")) ? ipot(v("base"), v("altezza")) : null]],
  quadrato: [["diagonale", (v) => tutti(v("lato")) ? v("lato") * Math.SQRT2 : null]],
  cerchio: [["diametro", (v) => tutti(v("raggio")) ? 2 * v("raggio") : null]],
  rombo: [["lato", (v) => tutti(v("diagonale_maggiore"), v("diagonale_minore")) ? ipot(v("diagonale_maggiore") / 2, v("diagonale_minore") / 2) : null]],
};

const lista = (x) => (x == null ? null : (Array.isArray(x) ? x : [x]));

// Figure impossibili: un cateto non può essere lungo quanto l'ipotenusa, né un lato quanto la diagonale.
const IMPOSSIBILI = {
  triangolo_rettangolo: (v) => tutti(v("ipotenusa")) && [v("cateto1"), v("cateto2")].some((c) => c != null && c >= v("ipotenusa")),
  rettangolo: (v) => tutti(v("diagonale")) && [v("base"), v("altezza")].some((c) => c != null && c >= v("diagonale")),
};

// Unità ammesse per grandezza. Vuota va sempre bene (decide il numero).
const UNITA = {
  area: /²|\^ ?2|[a-z]2$|quadr/,
  volume: /³|\^ ?3|[a-z]3$|cub|litr|^(ml|cl|dl|l|hl)$/,
  lunghezza: /^(mm|cm|dm|m|dam|hm|km)$/,
};
function unitaSbagliata(grandezza, unita) {
  const u = String(unita || "").trim().toLowerCase().replace(/\.$/, "");
  if (!u) return false;
  if (grandezza === "area") return !UNITA.area.test(u);
  if (grandezza === "volume") return !UNITA.volume.test(u);
  if (grandezza === "perimetro" || grandezza === "misura") return !UNITA.lunghezza.test(u);
  return false;
}

// Valori che il risultato può avere secondo la formula giusta, o null se la figura non
// basta per ricavarlo (allora decide solo la `verifica`).
export function attesiDallaFigura(figura, grandezza) {
  const formule = figura && Object.hasOwn(FORMULE, figura.forma) ? FORMULE[figura.forma] : null;
  if (!formule) return null;
  const v = (nome) => valoreMisura(figura, nome);
  if (grandezza === "misura") {
    const cercate = (figura.misure || []).filter((m) => String(m.valore).trim() === "?");
    if (cercate.length !== 1 || !formule.misura || !Object.hasOwn(formule.misura, cercate[0].nome)) return null;
    return lista(formule.misura[cercate[0].nome](v));
  }
  if (!["area", "perimetro", "volume"].includes(grandezza) || !Object.hasOwn(formule, grandezza)) return null;
  return lista(formule[grandezza](v));
}

// Il primo motivo per cui figura e risultato non stanno insieme, o null.
// valore: il risultato dichiarato, come stringa ("20", "7,07", "3/4").
export function figuraNonTorna(figura, grandezza, valore, unita = "") {
  if (!figura) return null;
  const v = (n) => valoreMisura(figura, n);
  if (Object.hasOwn(IMPOSSIBILI, figura.forma) && IMPOSSIBILI[figura.forma](v)) return "figura_incoerente";
  for (const [nome, calcola] of (Object.hasOwn(COERENZE, figura.forma) ? COERENZE[figura.forma] : [])) {
    const dato = v(nome), atteso = calcola(v);
    if (dato != null && atteso != null && !coincide(atteso, numeriMisura(figura, nome)[0])) return "figura_incoerente";
  }
  if (unitaSbagliata(grandezza, unita)) return "unita";
  const attesi = attesiDallaFigura(figura, grandezza);
  if (attesi === null || attesi.some((x) => x == null)) return null;
  return attesi.some((x) => coincide(x, valore)) ? null : "formula";
}
