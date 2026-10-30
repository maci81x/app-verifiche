// Esercizi simili generati dal modello (issue #5, fetta #7). JavaScript puro: lo usano la
// Edge Function e i test.
//
// Regola: un esercizio entra solo se la sua `verifica` (un'espressione che ricalcola il
// risultato dai dati) valutata qui coincide con il `risultato` dichiarato dal modello.
// Gli altri si scartano e si contano, come fa il filtro di ancoraggio per le domande.

import { valutaSicuro, coincide } from "./calcolo.js";

export const QUANTI = [5, 10];
export const PER_CHIAMATA = 5;  // esercizi per chiamata al modello (10 = due chiamate in parallelo)
export const MAX_ESERCIZI = 10;
const MAX_PASSAGGI = 12;
const MAX_VALORE_MISURA = 24;

// Forme che il client sa disegnare, ognuna con i nomi delle misure che sa etichettare.
// Lo stesso elenco è in figure.js (un test controlla che coincidano).
export const FORME = {
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

// Numeri che una formula può usare senza trovarli nei dati: metà, π scolastico, percentuali,
// angoli, cambi di unità.
const COSTANTI = new Set([0.5, 1, 2, 3, 4, 6, 10, 100, 1000, 3.14, 180, 360]);

// Chiedere qualche esercizio in più: alcuni verranno scartati.
export const quantiDaChiedere = (quanti) => quanti + Math.ceil(quanti / 2);

const testo = (v, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const tiene = (o, k) => typeof k === "string" && Object.hasOwn(o, k);

// Numeri di un testo. Nella consegna (italiano, migliaia = true) "1.500" è millecinquecento
// e "7,5" è sette e mezzo; nella verifica il punto è sempre la virgola dei decimali.
export function numeriIn(s, migliaia = false) {
  const re = migliaia ? /\d{1,3}(?:\.\d{3})+(?:,\d+)?(?![\d.])|\d+(?:[.,]\d+)?/g : /\d+(?:[.,]\d+)?/g;
  return (String(s).match(re) || []).map((n) => Number((migliaia && /^\d{1,3}(?:\.\d{3})+/.test(n) ? n.replace(/\./g, "") : n).replace(",", ".")));
}

// Il risultato dichiarato è un numero o una frazione, mai un'espressione da far calcolare.
const RISULTATO = /^\s*[-−]?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?\s*$/;

// Misure della figura: "?" per quella da trovare, altrimenti numeri che stanno nei dati.
function misuraNeiDati(valore, dati) {
  const n = numeriIn(valore, true);
  return valore.trim() === "?" || (n.length > 0 && n.every((x) => dati.has(x)));
}

export function pulisciFigura(f, consegna = null) {
  const nomi = f && tiene(FORME, f.forma) ? FORME[f.forma] : null;
  if (!nomi) return null;
  const dati = consegna === null ? null : new Set(numeriIn(consegna, true));
  const visti = new Set();
  const misure = [];
  for (const m of Array.isArray(f.misure) ? f.misure : []) {
    const nome = testo(m?.nome, 40), valore = testo(m?.valore, MAX_VALORE_MISURA);
    if (!nomi.includes(nome) || !valore || visti.has(nome) || (dati && !misuraNeiDati(valore, dati))) continue;
    visti.add(nome);
    misure.push({ nome, valore });
  }
  return misure.length ? { forma: f.forma, misure } : null;
}

// Operazioni che non cambiano niente (×1, :1, ^1, +0, −0): servono solo a fingere un ricalcolo.
const IDENTITA = /[*/^]\s*1(?![\d.,])|[-+]\s*0(?![\d.,])/;

// La verifica deve davvero ricalcolare: almeno un'operazione vera, ogni numero che usa
// sta nei dati dell'esercizio (o è una costante delle formule), e usa almeno due numeri
// diversi dei dati quando i dati ne hanno almeno due.
function verificaDaiDati(verifica, consegna) {
  if (!/[-+*/^×·÷:√]|sqrt/.test(verifica.replace(/^\s*[-−]/, "")) || IDENTITA.test(verifica)) return false;
  const dati = new Set(numeriIn(consegna, true));
  const usati = numeriIn(verifica);
  const daiDati = new Set(usati.filter((n) => dati.has(n)));
  return daiDati.size >= Math.min(2, dati.size) && daiDati.size > 0 && usati.every((n) => dati.has(n) || COSTANTI.has(n));
}

// Il risultato deve comparire alla fine dello svolgimento mostrato (ultimi due passaggi):
// i passaggi non possono arrivare a un numero diverso da quello verificato.
function finaleCoincide(passaggi, valore) {
  const ultimi = (Array.isArray(passaggi) ? passaggi : []).slice(-2)
    .map((p) => String(p?.testo ?? "") + " " + String(p?.formula ?? "").replace(/\{,\}/g, ",").replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")).join(" ");
  const attesi = numeriIn(valore, true);
  const trovati = numeriIn(ultimi, true);
  return attesi.every((n) => trovati.includes(n));
}

// null se l'esercizio è buono, altrimenti il motivo dello scarto.
export function motivoScarto(e, tipiPerBreve) {
  if (!e || typeof e !== "object") return "forma";
  if (!tiene(tipiPerBreve, e.tipo)) return "tipo";
  if (!testo(e.testo)) return "consegna";
  const valore = testo(e.risultato?.valore, 40);
  if (!RISULTATO.test(valore)) return "risultato";
  const verifica = testo(e.verifica, 400);
  const calcolato = valutaSicuro(verifica);
  if (calcolato === null) return "verifica";
  if (!verificaDaiDati(verifica, testo(e.testo) + " " + testo(e.dati))) return "verifica";
  if (!coincide(calcolato, valore)) return "risultato";
  if (!finaleCoincide(e.passaggi, valore)) return "passaggi";
  return null;
}

function pulisci(e, tipo) {
  const passaggi = (Array.isArray(e.passaggi) ? e.passaggi : [])
    .map((p) => ({ testo: testo(p?.testo, 400), formula: testo(p?.formula, 300) }))
    .filter((p) => p.testo || p.formula)
    .slice(0, MAX_PASSAGGI);
  return {
    tipo_id: tipo.id,
    tipo: tipo.titolo,
    testo: testo(e.testo),
    dati: testo(e.dati, 300),
    figura: pulisciFigura(e.figura, testo(e.testo) + " " + testo(e.dati)),
    passaggi,
    risultato: { valore: testo(e.risultato.valore, 40), unita: testo(e.risultato?.unita, 20) },
    verifica: testo(e.verifica, 400),
  };
}

// tipiPerBreve: { t1: { id, titolo } }. Restituisce al massimo `quanti` esercizi buoni e
// quanti ne ha scartati; quelli buoni ma in più non contano come scartati.
export function eserciziVerificati(grezzi, tipiPerBreve, quanti) {
  const esercizi = [];
  let scartati = 0;
  for (const e of Array.isArray(grezzi) ? grezzi : []) {
    if (motivoScarto(e, tipiPerBreve)) { scartati++; continue; }
    if (esercizi.length < Math.min(quanti, MAX_ESERCIZI)) esercizi.push(pulisci(e, tipiPerBreve[e.tipo]));
  }
  return { esercizi, scartati };
}
