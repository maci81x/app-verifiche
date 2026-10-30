// «In breve» dei concetti della mappa (issue #11). JavaScript puro: lo usano la Edge
// Function e i test.
//
// La sintesi la scrive il modello insieme alla mappa, in 1-2 frasi per 12-13 anni, solo dal
// materiale. Non è una citazione, quindi non passa dal filtro di ancoraggio: qui si controlla
// che le parole importanti stiano nel materiale. Numeri e nomi propri devono esserci tutti;
// delle altre parole lunghe almeno SOGLIA_SINTESI, confrontate per radice (le prime lettere),
// così «contadini» regge su «contadino» e «aumentarono» su «aumentano».

import { normalizza } from "./ancoraggio.js";

export const SOGLIA_SINTESI = 0.75;
export const MAX_SINTESI = 320;      // caratteri: due frasi brevi
const MIN_IMPORTANTE = 5;            // lettere di una parola che conta
const RADICE = 5;

// Parole lunghe che non dicono niente sul contenuto.
const VUOTE = new Set((
  "perché quando quindi anche molto molti molte molta sono erano essere stato stata stati state aveva avevano " +
  "questo questa questi queste quello quella quelli quelle prima dopo ancora sempre tutto tutti tutte tutta " +
  "altri altre altro altra stesso stessa stessi cioè mentre dove come ogni nella nelle negli nello della delle " +
  "degli dello dalla dalle dagli dallo sulla sulle sugli sullo alla alle agli allo loro perciò invece proprio " +
  "volta volte cosa cose modo fatto fare fece fecero fanno fatta diventò diventa diventano diventare grande " +
  "grandi piccolo piccola poco pochi poche parte parti tanto tanti tante spesso infatti allora quasi nessuno " +
  "qualcosa qualcuno ognuno insieme verso contro senza sopra sotto dentro fuori oltre circa secondo poiché " +
  "dunque però ovvero quale quali questo"
).split(" "));

const radice = (w) => w.slice(0, w.length > RADICE ? RADICE : Math.max(3, w.length - 1));

// Nomi propri: parole con la maiuscola che non aprono una frase.
function nomiPropri(testo) {
  const nomi = [];
  String(testo).split(/(?<=[.!?:;])\s+/).forEach((frase) => {
    frase.split(/\s+/).slice(1).forEach((w) => {
      const pulita = w.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, "");
      if (/^[A-ZÀ-Ý][a-zà-ÿ]{2,}/.test(pulita)) nomi.push(normalizza(pulita));
    });
  });
  return nomi;
}

// fonte: materiale normalizzato (normalizza). Vero se la sintesi si regge sul materiale.
export function sintesiRegge(sintesi, fonte) {
  const testo = String(sintesi || "").trim();
  if (!testo || testo.length > MAX_SINTESI) return false;
  const parole = new Set(String(fonte || "").split(" ").filter(Boolean));
  const radici = new Set([...parole].filter((w) => w.length >= 3).map(radice));
  const c = normalizza(testo).split(" ").filter(Boolean);
  if (!c.filter((w) => /^\d+$/.test(w)).every((n) => parole.has(n))) return false;
  if (!nomiPropri(testo).every((n) => radici.has(radice(n)))) return false;
  const importanti = c.filter((w) => w.length >= MIN_IMPORTANTE && !/^\d+$/.test(w) && !VUOTE.has(w));
  if (!importanti.length) return true;
  const dentro = importanti.filter((w) => radici.has(radice(w))).length;
  return dentro / importanti.length >= SOGLIA_SINTESI;
}

// Sintesi tenuta (ripulita) o "" se non regge.
export function sintesiPulita(sintesi, fonte) {
  const s = String(sintesi || "").replace(/\s+/g, " ").trim();
  return sintesiRegge(s, fonte) ? s : "";
}
