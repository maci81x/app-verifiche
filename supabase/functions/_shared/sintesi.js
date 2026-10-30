// «In breve» dei concetti della mappa (issue #11). JavaScript puro: lo usano la Edge
// Function e i test.
//
// La sintesi la scrive il modello insieme alla mappa, in 1-2 frasi per 12-13 anni, solo dal
// materiale. Non è una citazione, quindi non passa dal filtro di ancoraggio: qui si controlla
// che le parole importanti stiano nel materiale. Numeri (anche romani) e nomi propri devono
// esserci tutti, scritti uguali; delle altre parole lunghe almeno SOGLIA_SINTESI, confrontate per
// radice (le prime lettere), così «contadini» regge su «contadino». Un «non» o un «mai» che il
// materiale non ha mai fa cadere la sintesi. Resta fuori portata una frase fatta di parole vere
// rimesse insieme in modo sbagliato: per questo la card la presenta come riassunto, sotto la
// frase degli appunti.

import { normalizza } from "./ancoraggio.js";

export const SOGLIA_SINTESI = 0.9;
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

// Migliaia scritte col punto: «1.500» e «1500» sono lo stesso numero.
const senzaMigliaia = (t) => String(t || "").replace(/(\d)\.(?=\d{3}(?!\d))/g, "$1");
// Articolo o preposizione eliso davanti a un nome: «dall'Austria» → «Austria».
const senzaElisione = (w) => w.replace(/^[A-Za-zÀ-ÿ]{1,4}['’]/, "");
const NEGAZIONI = new Set(["non", "mai", "né", "nessun", "nessuno", "nessuna", "niente", "nulla"]);

// Parole con la maiuscola, anche a inizio frase. inizio = apre la frase (lì la maiuscola
// può essere solo grammatica). Numeri romani a parte.
function maiuscole(testo) {
  const fuori = [];
  String(testo).split(/(?<=[.!?:;])\s+/).forEach((frase) => {
    frase.split(/\s+/).forEach((w, i) => {
      const p = senzaElisione(w.replace(/^[^A-Za-zÀ-ÿ']+|[^A-Za-zÀ-ÿ]+$/g, ""));
      if (/^[IVXLCDM]{2,}$/.test(p)) fuori.push({ w: p.toLowerCase(), romano: true });
      else if (/^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(p)) fuori.push({ w: normalizza(p), inizio: i === 0 && p === w.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, "") });
    });
  });
  return fuori;
}

// fonte: materiale normalizzato (normalizza). Vero se la sintesi si regge sul materiale.
export function sintesiRegge(sintesi, fonte) {
  const testo = String(sintesi || "").trim();
  if (!testo || testo.length > MAX_SINTESI) return false;
  const parole = new Set(normalizza(senzaMigliaia(fonte)).split(" ").filter(Boolean));
  const radici = new Set([...parole].filter((w) => w.length >= 3).map(radice));
  const c = normalizza(senzaMigliaia(testo)).split(" ").filter(Boolean);
  if (!c.filter((w) => /^\d+$/.test(w)).every((n) => parole.has(n))) return false;
  if (c.some((w) => NEGAZIONI.has(w)) && ![...parole].some((w) => NEGAZIONI.has(w))) return false;
  // Nomi propri e numeri romani: scritti uguali nel materiale. A inizio frase basta che la
  // parola, in minuscolo, sia una parola comune o stia nel materiale.
  for (const m of maiuscole(testo)) {
    if (parole.has(m.w)) continue;
    if (m.inizio && !m.romano && (VUOTE.has(m.w) || m.w.length < MIN_IMPORTANTE || COMUNI_INIZIO.has(m.w))) continue;
    return false;
  }
  const importanti = c.filter((w) => w.length >= MIN_IMPORTANTE && !/^\d+$/.test(w) && !VUOTE.has(w));
  if (!importanti.length) return true;
  const dentro = importanti.filter((w) => radici.has(radice(w))).length;
  return dentro / importanti.length >= SOGLIA_SINTESI;
}

// Parole corte o comuni che aprono spesso una frase: la maiuscola lì non è un nome.
const COMUNI_INIZIO = new Set(["dopo", "prima", "durante", "quando", "mentre", "anche", "inoltre", "così", "allora", "oggi", "infine"]);

// Sintesi tenuta (ripulita) o "" se non regge.
export function sintesiPulita(sintesi, fonte) {
  const s = String(sintesi || "").replace(/\s+/g, " ").trim();
  return sintesiRegge(s, fonte) ? s : "";
}
