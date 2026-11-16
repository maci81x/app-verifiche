// Smistamento delle foto del giorno e date lette sul diario (issue #19). JavaScript puro:
// lo usano la Edge Function e i test.
//
// Il modello sceglie materia e argomento per ogni foto e copia le frasi del diario che
// parlano di una verifica o di un'interrogazione. La data NON la calcola il modello: si
// ricava qui dalla frase copiata, e la frase deve stare davvero nella trascrizione.
// Così una data che sul diario non c'è non può arrivare a chi studia.
import { normalizza } from "./ancoraggio.js";

export const MAX_FOTO = 12;
export const MAX_TESTO_FOTO = 30_000;
export const MAX_ARGOMENTI = 300;

const GIORNI = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
// Il mese: la parola intera o le prime tre lettere seguite da un confine («3 dic», «12 gen.»),
// mai l'inizio di un'altra parola («3 martedì», «1 genitore», «5 ottimo»).
const MESE = "(" + MESI.join("|") + "|" + MESI.map((m) => m.slice(0, 3)).join("|") + ")\\.?(?![a-z])";
const GIORNO_MS = 86_400_000;

const senzaAccenti = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iso = (d) => d.toISOString().slice(0, 10);
// Data vera (niente 31 febbraio) a mezzanotte UTC, o null.
function dataVera(anno, mese, giorno) {
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  return d.getUTCFullYear() === anno && d.getUTCMonth() === mese - 1 && d.getUTCDate() === giorno ? d : null;
}
export function oggiValido(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? dataVera(+m[1], +m[2], +m[3]) : null;
}
const lunedi0 = (d) => (d.getUTCDay() + 6) % 7; // lunedì = 0 ... domenica = 6

// Data scritta nella frase, risolta rispetto a oggi ('YYYY-MM-DD'). null se la frase non
// ne contiene una sola e chiara, o se è già passata.
//   «19/11», «19.11.2026», «3 dicembre», «3 dic»: giorno e mese; senza anno, quest'anno (gennaio e febbraio visti da dicembre: l'anno dopo).
//   «giovedì 19»: il prossimo 19 (questo mese o il successivo), e deve cadere di giovedì.
//   «giovedì»: il prossimo giovedì dopo oggi (se oggi è giovedì, fra una settimana).
//   «giovedì prossimo», «la prossima settimana giovedì»: il giovedì della settimana dopo.
//   «domani», «dopodomani», «oggi».
// Il trattino non conta come separatore: sul diario «pag. 4-5» sono pagine, non il 4 maggio.
// «ore 10.30» e «alle 9.15» sono orari, non date.
export function risolviData(frase, oggi) {
  const base = oggiValido(oggi);
  if (!base) return null;
  const t = senzaAccenti(frase);
  const giorni = GIORNI.filter((g) => new RegExp("\\b" + g + "\\b").test(t));
  if (giorni.length > 1) return null;
  const sett = giorni.length ? GIORNI.indexOf(giorni[0]) : -1;
  const anno0 = base.getUTCFullYear();
  // Senza anno: quest'anno. Già passata = scartata, tranne gennaio e febbraio visti da dicembre.
  const conAnno = (g, m) => {
    const d = dataVera(anno0, m, g);
    if (!d || d >= base) return d;
    return base.getUTCMonth() === 11 && m <= 2 ? dataVera(anno0 + 1, m, g) : null;
  };

  let d = null;
  const num = /(?<!\b(?:ore|alle)\s*)\b(\d{1,2})\s*[/.]\s*(\d{1,2})(?:\s*[/.]\s*(\d{4}|\d{2}))?\b/.exec(t);
  const mese = new RegExp("\\b(\\d{1,2})\\s*°?\\s+" + MESE + "(?:\\s+(\\d{4}))?").exec(t);
  const giornoNum = sett >= 0 ? new RegExp("\\b" + GIORNI[sett] + "\\s+(\\d{1,2})\\b").exec(t) : null;
  if (num) {
    const a = num[3] ? (num[3].length === 2 ? 2000 + +num[3] : +num[3]) : null;
    d = a ? dataVera(a, +num[2], +num[1]) : conAnno(+num[1], +num[2]);
  } else if (mese) {
    const m = MESI.findIndex((x) => x.startsWith(mese[2].slice(0, 3))) + 1;
    d = mese[3] ? dataVera(+mese[3], m, +mese[1]) : conAnno(+mese[1], m);
  } else if (giornoNum) {
    const g = +giornoNum[1];
    const m0 = base.getUTCMonth() + 1;
    d = [0, 1, 2].map((k) => dataVera(anno0 + Math.floor((m0 - 1 + k) / 12), ((m0 - 1 + k) % 12) + 1, g))
      .find((x) => x && x >= base) || null;
  } else if (sett >= 0) {
    // «prossimo» vale solo attaccato al giorno o alla settimana: «prossima verifica giovedì» è questo giovedì.
    const g = GIORNI[sett];
    if (new RegExp("\\b" + g + "\\s+prossim[oa]\\b|\\bprossim[oa]\\s+" + g + "\\b|\\bprossima\\s+settimana\\b|\\bsettimana\\s+prossima\\b").test(t)) {
      const lunediDopo = base.getTime() + (7 - lunedi0(base)) * GIORNO_MS;
      d = new Date(lunediDopo + sett * GIORNO_MS);
    } else {
      d = new Date(base.getTime() + (((sett - lunedi0(base) + 7) % 7) || 7) * GIORNO_MS);
    }
  } else if (/\bdopodomani\b/.test(t)) d = new Date(base.getTime() + 2 * GIORNO_MS);
  else if (/\bdomani\b/.test(t)) d = new Date(base.getTime() + GIORNO_MS);
  else if (/\boggi\b/.test(t)) d = base;

  if (!d || d < base) return null;
  if (sett >= 0 && lunedi0(d) !== sett) return null; // «giovedì 20» se il 20 è venerdì: letta male
  return iso(d);
}

// La frase sta davvero in una delle trascrizioni? Stessa normalizzazione dell'ancoraggio
// (minuscole, punteggiatura via), poi sottostringa esatta: qui non si tollera niente.
// Il tipo detto dalla frase: orale per interrogazione/orale, scritta per verifica, compito in
// classe, test. null se la frase non parla di nessuno dei due (per esempio solo «giovedì 19»).
export function tipoDaFrase(frase) {
  const t = senzaAccenti(frase);
  if (/\binterrog|\borale\b/.test(t)) return "orale";
  if (/\bverific|\bcompito in classe\b|\btest\b/.test(t)) return "scritta";
  return null;
}

// La frase deve dire verifica o interrogazione (non solo il giorno, «oggi», «domani») e stare
// davvero in una delle trascrizioni.
export function lettaDavvero(frase, trascrizioni) {
  if (!tipoDaFrase(frase)) return false;
  const f = normalizza(frase);
  if (f.length < 4) return false;
  return trascrizioni.some((t) => (" " + normalizza(t) + " ").includes(" " + f + " "));
}

const pulisci = (v, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
// Le materie si scrivono come quelle già in libreria, se ci sono («matematica» → «Matematica»).
const comeInLibreria = (materia, argomenti) =>
  argomenti.find((a) => a.materia.toLowerCase() === materia.toLowerCase())?.materia ?? materia;

// Id brevi per il modello (a1, a2...): non può inventare un uuid.
export const breviArgomenti = (argomenti) => argomenti.map((_, i) => "a" + (i + 1));

// grezzo: { foto: [{ foto, materia, argomento, nuovo_titolo, confidenza }],
//           scadenze: [{ foto, materia, tipo, testo_letto }] }
// argomento: un id breve, "nuovo" o "nessuno" (pagina di solo diario, niente da archiviare).
// → { foto: [{ materia, argomento_id, nuovo_titolo, confidenza }] una per trascrizione, nello
//     stesso ordine; scadenze: [{ materia, tipo, data, testo_letto }]; scartate }
export function smistamento(grezzo, trascrizioni, argomenti, oggi) {
  const brevi = breviArgomenti(argomenti);
  const perFoto = new Map();
  for (const x of Array.isArray(grezzo?.foto) ? grezzo.foto : []) {
    const i = Number(x?.foto) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= trascrizioni.length || perFoto.has(i)) continue;
    const a = argomenti[brevi.indexOf(x.argomento)];
    const nuovo = !a && x.argomento === "nuovo" ? pulisci(x.nuovo_titolo, 120) || null : null;
    const materia = a ? a.materia : comeInLibreria(pulisci(x.materia, 60), argomenti);
    perFoto.set(i, {
      materia: a || nuovo ? materia : "",
      argomento_id: a ? a.id : null,
      nuovo_titolo: nuovo,
      confidenza: Math.round(Math.min(1, Math.max(0, Number(x.confidenza) || 0)) * 100) / 100,
    });
  }
  const foto = trascrizioni.map((_, i) => perFoto.get(i) ?? { materia: "", argomento_id: null, nuovo_titolo: null, confidenza: 0 });

  const scadenze = [], viste = new Set();
  let scartate = 0;
  for (const s of Array.isArray(grezzo?.scadenze) ? grezzo.scadenze : []) {
    const testo_letto = pulisci(s?.testo_letto, 300);
    const tipo = s?.tipo === "orale" ? "orale" : s?.tipo === "scritta" ? "scritta" : null;
    const i = Number(s?.foto) - 1;
    const materia = comeInLibreria(pulisci(s?.materia, 60) || foto[i]?.materia || "", argomenti);
    const data = tipo && materia && tipo === tipoDaFrase(testo_letto) && lettaDavvero(testo_letto, trascrizioni) ? risolviData(testo_letto, oggi) : null;
    const chiave = [materia.toLowerCase(), tipo, data].join("|");
    if (!data || viste.has(chiave)) { scartate++; continue; }
    viste.add(chiave);
    scadenze.push({ materia, tipo, data, testo_letto });
  }
  return { foto, scadenze, scartate };
}
