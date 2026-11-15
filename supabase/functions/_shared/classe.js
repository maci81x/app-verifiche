// La classe del profilo negli aiuti (issue #28): dal programma (programma.js, solo dati) al pezzo di prompt
// con la classe, come scrivere, l'argomento più vicino con le sue strategie e i suoi errori tipici, i prerequisiti.
// Il materiale fotografato ha sempre la precedenza: il programma è la base di partenza.
import { PROGRAMMA, MATERIE } from "./programma.js";

const CLASSI = [1, 2, 3];
const piano = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// "2", 2, "2ª media", "3a", "terza" → 2/3; elementari, superiori o niente → null.
export function numeroClasse(classe) {
  const c = piano(classe).trim();
  if (!c || /element|superior/.test(c)) return null;
  const parola = { prima: 1, seconda: 2, terza: 3 }[c.split(/\s+/)[0]];
  if (parola) return parola;
  const m = c.match(/^([123])(?![0-9])/);
  return m ? Number(m[1]) : null;
}

// I nomi che si trovano sul libro e sul quaderno.
const ALIAS = [
  [/matemat|geometr|aritmet|algebra/, "matematica"], [/italian|grammatic|epica|antolog|letteratur|narrativ/, "italiano"],
  [/stori/, "storia"], [/geograf/, "geografia"], [/scienz|biolog|chimic|fisic/, "scienze"], [/ingles|english/, "inglese"],
];
export const materiaDi = (m) => { const p = piano(m); return (p && (ALIAS.find(([re]) => re.test(p)) || [])[1]) || null; };

const tutti = CLASSI.flatMap((classe) => MATERIE.flatMap((materia) => (PROGRAMMA[classe][materia] || []).map((a) => ({ ...a, classe, materia }))));
const perId = new Map(tutti.map((a) => [a.id, a]));

// Gli argomenti di quella classe e quelli degli anni prima (della stessa materia, se nota), ordinati per
// quante parole chiave compaiono nel testo; a parità vince la classe del profilo. Al più `quanti`.
export function trovaArgomenti({ classe, materia, testo }, quanti = 2) {
  const n = numeroClasse(classe), m = materiaDi(materia) ?? (MATERIE.includes(materia) ? materia : null);
  if (!n) return [];
  const t = " " + piano(testo).replace(/[^a-z0-9/+=%?]+/g, " ") + " ";
  const parole = t.trim().split(/\s+/);
  // i numeri dicono l'argomento anche senza parole: 1/2 + 1/3 è una frazione, 2x + 3 = 11 un'equazione
  if (/\d\s*\/\s*\d/.test(t)) parole.push("frazione", "frazioni");
  if (/\d\s*x\b(?!\s*\d)|\bx\s*[=+\-/]/.test(t) && t.includes("=")) parole.push("equazione", "incognita"); // 3 x 4 = 12 no
  if (t.includes("%")) parole.push("percentuale");
  if (t.includes("?") && parole.length > 10) parole.push("problema");
  // una parola chiave vale se c'è la frase intera o, per una parola sola, la stessa radice (frazione/frazioni)
  const presente = (k) => { const kk = piano(k).trim(); if (kk.includes(" ")) return t.includes(" " + kk + " ");
    const radice = kk.length > 4 ? kk.slice(0, kk.length - 1) : kk; return parole.some((w) => (kk.length > 4 ? w.startsWith(radice) : w === kk)); };
  return tutti.filter((a) => a.classe <= n && (!m || a.materia === m))
    // una parola sola basta solo se è specifica (6 lettere o più, o una frase): «verso», «parte», «tempo» da sole no
    .map((a) => { const prese = a.parole_chiave.filter(presente); return { a, punti: prese.length, forte: prese.some((k) => k.includes(" ") || k.length >= 6) }; })
    .filter((x) => x.punti >= 2 || (x.punti === 1 && x.forte))
    .sort((x, y) => y.punti - x.punti || (y.a.classe === n) - (x.a.classe === n) || y.a.classe - x.a.classe)
    .slice(0, quanti).map((x) => x.a);
}

const STILE = {
  1: "1ª media (11-12 anni): frasi molto corte, una cosa per frase, esempi concreti e di tutti i giorni; una parola tecnica solo se la spieghi subito.",
  2: "2ª media (12-13 anni): frasi corte, esempi concreti, le parole tecniche della materia con una breve spiegazione.",
  3: "3ª media (13-14 anni): un po' più di formalità e le parole tecniche giuste (sono quelle dell'esame), esempi anche meno concreti.",
};
const prerequisitiDi = (a) => a.prerequisiti.map((id) => perId.get(id)).filter(Boolean);

// Il pezzo di prompt. Senza classe nota: solo la regola generale.
export function contestoClasse({ classe, materia, testo }) {
  const n = numeroClasse(classe);
  if (!n) return "Chi studia va alla scuola media (10-14 anni): frasi corte ed esempi concreti.";
  const m = materiaDi(materia);
  const righe = ["Classe: " + n + "ª media. Come scrivere: " + STILE[n]];
  if (m) righe.push("Programma di " + m + " della " + n + "ª media: " + PROGRAMMA[n][m].map((a) => a.titolo).join("; ") + ".");
  for (const a of trovaArgomenti({ classe: n, materia: m, testo }, 1)) {
    righe.push("Argomento più vicino: " + a.titolo + " (" + a.classe + "ª media).",
      "Strategie da usare e da chiamare per nome: " + a.strategie.map((s) => "«" + s.nome + "» (" + s.quando + ")").join("; ") + ".",
      // anche quelli dei prerequisiti: in un problema con le frazioni l'errore è spesso nel calcolo con le frazioni
      "Errori tipici da riconoscere per nome: " + [a, ...prerequisitiDi(a)].flatMap((x) => x.errori_tipici).slice(0, 12)
        .map((e) => "[" + e.id + "] " + e.errore + ": " + e.come_riconoscerlo).join("; ") + ".");
    const pre = prerequisitiDi(a);
    if (pre.length) righe.push("Prerequisiti (degli anni prima o di questo): " + pre.map((p) => p.titolo + " (" + p.classe + "ª)").join("; ") + ".");
  }
  righe.push("Il materiale fotografato e il libro hanno sempre la precedenza su questo programma: le prof cambiano l'ordine.");
  return righe.join("\n");
}

// { id, errore, esempio, come_riconoscerlo, spiegazione, argomento: { id, titolo }, classe, materia } o null.
export function erroreDaId(id) {
  for (const a of tutti) {
    const e = a.errori_tipici.find((x) => x.id === id);
    if (e) return { ...e, argomento: { id: a.id, titolo: a.titolo }, classe: a.classe, materia: a.materia };
  }
  return null;
}

// L'errore è di un argomento di un anno prima? Allora prima un mini-ripasso di quel prerequisito.
export function prerequisitoMancante(idErrore, classe) {
  const e = erroreDaId(idErrore), n = numeroClasse(classe);
  return e && n && e.classe < n ? { id: e.argomento.id, titolo: e.argomento.titolo, classe: e.classe } : null;
}

// Gli errori tipici fra cui il modello sceglie: dell'argomento più vicino e dei suoi prerequisiti (al più 20).
export function erroriCandidati(dati) {
  const visti = new Map();
  for (const a of trovaArgomenti(dati, 2)) for (const x of [a, ...prerequisitiDi(a)]) for (const e of x.errori_tipici) visti.set(e.id, e);
  return [...visti.values()].slice(0, 20);
}

// «1/2 + 1/3 = 2/5» senza modello: la risposta vale (a ± c)/(b ± d) invece di a/b ± c/d.
// Con passaggi: true cerca ogni «a/b ± c/d = e/f» scritto da chi studia.
const FRAZ = "(\\d+)\\s*\\/\\s*(\\d+)", OP = "\\s*([+\\-−–])\\s*";
const vale = (s) => { const m = String(s).replace(/\s/g, "").match(/^(-?\d+)\/(-?\d+)$/) || String(s).trim().match(/^(-?\d+(?:[.,]\d+)?)$/); return !m ? null : m[2] ? (Number(m[2]) ? Number(m[1]) / Number(m[2]) : null) : Number(m[1].replace(",", ".")); };
const uguali = (x, y) => x !== null && y !== null && Math.abs(x - y) < 1e-9;
function sommaDenominatori(a, b, op, c, d, risposta) {
  const meno = op !== "+", giusta = meno ? a / b - c / d : a / b + c / d, den = meno ? b - d : b + d;
  if (den <= 0) return false; // «3/4 − 1/6 = 2/−2» non lo scrive nessuno
  const errata = (meno ? a - c : a + c) / den;
  return !uguali(errata, giusta) && uguali(vale(risposta), errata);
}
export function riconosciErroreFrazioni(testo, risposta, { passaggi = false } = {}) {
  const n = (x) => Number(x);
  if (passaggi) {
    for (const m of String(risposta).matchAll(new RegExp(FRAZ + OP + FRAZ + "\\s*=\\s*(-?\\d+\\s*\\/\\s*\\d+)", "g")))
      if (sommaDenominatori(n(m[1]), n(m[2]), m[3], n(m[4]), n(m[5]), m[6])) return "frazioni-somma-denominatori";
    return null;
  }
  const m = String(testo).match(new RegExp(FRAZ + OP + FRAZ));
  return m && sommaDenominatori(n(m[1]), n(m[2]), m[3], n(m[4]), n(m[5]), risposta) ? "frazioni-somma-denominatori" : null;
}

// L'errore tipico di una risposta che non va: { errore_tipico: { id, errore, esempio, spiegazione, argomento }, prerequisito } o null.
// Prima il riconoscimento senza modello (1/2 + 1/3 = 2/5, anche nei passaggi), poi la scelta del modello,
// tenuta solo se è fra gli errori candidati di quell'esercizio (mai un id inventato).
export function erroreTipicoDi({ classe, materia = "matematica", testo, risposta, passaggi = "", scelta = "", giusto }) {
  if (giusto) return null;
  const id = riconosciErroreFrazioni(testo, risposta) || (passaggi && riconosciErroreFrazioni(testo, passaggi, { passaggi: true })) ||
    (scelta && erroriCandidati({ classe, materia, testo }).some((e) => e.id === scelta) ? scelta : null);
  const e = id && erroreDaId(id);
  if (!e) return null;
  return { errore_tipico: { id, errore: e.errore, esempio: e.esempio, spiegazione: e.spiegazione, argomento: e.argomento }, prerequisito: prerequisitoMancante(id, classe) };
}
