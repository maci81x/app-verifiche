// «Aiutami con un compito» (issue #27). JavaScript puro: lo usano la Edge Function e i test.
//
// Regola della matematica: nessun conto arriva alla ragazz* senza essere ricalcolato qui.
// Ogni `calcolo` è una catena "a = b = c" di espressioni con soli numeri: ogni uguale deve
// tornare (calcolo.js). L'ultimo conto dei passi dà il risultato, la verifica rimette il
// risultato nei dati del testo, la soluzione del libro (se c'è) deve coincidere.

import { valutaSicuro, coincide, decimaliDichiarati } from "./calcolo.js";
import { leggiRisposta, confrontaRisultato } from "./correzione.js";
import { numeriIn } from "./generati.js";

export const MAX_INDIZI = 5, MAX_PASSI = 12, DOMANDE_PRONTE = 3, MAX_CRONOLOGIA = 10, MAX_PARTI_BARRA = 24;
const testo = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v, max, lung = 600) => (Array.isArray(v) ? v.map((x) => testo(x, lung)).filter(Boolean).slice(0, max) : []);

// "2" o "2ª media" → «2ª media»; elementari → «scuola elementare»; altrimenti «scuola media».
export function perClasse(classe) {
  const c = String(classe ?? "").trim().toLowerCase();
  if (/elem|primaria/.test(c)) return "scuola elementare";
  const n = /^([123])/.exec(c);
  return n ? n[1] + "ª media" : "scuola media";
}

// Euro e unità di misura dopo un numero si tolgono per fare il conto, ma in una catena ce ne può
// essere una sola: «1 km + 500 m = 501 m» non torna e le equivalenze si scrivono come conti.
const UNITA = /(\d|\))\s*(€|euro|mm|cm|dm|km|m|kg|hg|g|ml|cl|dl|l|ore|min|°)((?:[²³]|\^?[23])?)(?![a-zà-ù\d])/gi;
const unitaIn = (s) => new Set([...String(s).replace(/€\s*(?=\d)/g, "1€").matchAll(UNITA)].map((m) => (m[2] === "euro" ? "€" : m[2].toLowerCase()) + m[3].replace(/\^/, "").replace("²", "2").replace("³", "3")));
const senzaUnita = (s) => String(s).replace(/€\s*(?=\d)/g, "").replace(UNITA, "$1");
// «70 x 18»: la x fra due numeri è un per.
const conPer = (s) => String(s).replace(/(\d)\s*[xX]\s*(?=\d)/g, "$1×");

// Ogni uguale della catena torna. Un pezzo scritto come numero decimale vale anche arrotondato
// alle sue cifre (come in correzione.js), confrontato con il valore esatto del primo pezzo.
export function contoTorna(calcolo) {
  const grezzo = conPer(testo(calcolo, 400));
  if (unitaIn(grezzo).size > 1) return false;
  const pezzi = senzaUnita(grezzo).split("=").map((p) => p.trim());
  if (pezzi.length < 2 || pezzi.some((p) => !p || /[a-zà-ù%π]/i.test(p))) return false;
  const valori = pezzi.map(valutaSicuro);
  if (valori.some((v) => v === null)) return false;
  const esatto = valori[0];
  return valori.every((v, i) => i === 0 || (decimaliDichiarati(pezzi[i]) ? coincide(esatto, pezzi[i])
    : Math.abs(v - esatto) <= 1e-9 * Math.max(1, Math.abs(v))));
}
// Valore dell'ultimo pezzo di una catena che torna.
export const finale = (calcolo) => valutaSicuro(senzaUnita(conPer(calcolo)).split("=").pop().trim());

// Il ricalcolo non dipende solo da quello che dice il modello: un passo con un conto o una
// materia di numeri bastano a fare i controlli.
export const eMatematica = (c) => c.matematica === true || /mat|geom|aritm|algebr/i.test(c.materia || "") || (c.passi || []).some((p) => p.calcolo);

// Gli indizi aiutano a fare il passo dopo: quelli che contengono già il risultato si tolgono.
export const indiziSenzaRisultato = (c) => (c.indizi || []).filter((t) => !numeriIn(t, true).some((n) => coincide(n, String(c.risultato?.valore ?? ""))));

// Il risultato del libro e il nostro coincidono? null se il libro non dice un numero leggibile.
// "1.260,00 €" = 1260; "3/4" = "6/8" = 0,75.
export function stessoRisultato(libro, risultato) {
  const l = leggiRisposta(String(libro ?? "").replace(/[[\]()]/g, "").trim());
  const nostro = valutaSicuro(String(risultato?.valore ?? "").trim());
  if (!l || nostro === null) return null;
  return [l.numero, l.alternativa].filter(Boolean).some((n) => coincide(nostro, n) || coincide(valutaSicuro(n), String(risultato.valore)));
}

// { ok: true } oppure { ok: false, motivo: "passo" (con il numero del passo) | "risultato" | "verifica" | "libro" }.
// Parole che valgono un numero del testo. Confini di parola con le lettere accentate (\b non vede la «à» di «metà»).
// «Terzo» e «quarto» contano solo come frazioni («un terzo», «tre quarti»), non come ordinali («il terzo giorno»).
const PAROLE_NUMERO = [[/(?<!\p{L})(doppi[oa]|metà)(?!\p{L})/iu, 2], [/(?<!\p{L})(tripl[oa]|(?:un|una|due)\s+terz[oi]|(?:la|una)\s+terza\s+parte)(?!\p{L})/iu, 3],
  [/(?<!\p{L})(quadrupl[oa]|(?:un|una|tre)\s+quart[oi]|(?:la|una)\s+quarta\s+parte)(?!\p{L})/iu, 4]];
// Numeri scritti a parole («tre amici», «2 dozzine»): si possono usare nella verifica, ma non contano fra i dati da usare.
// «Uno/una» no (articoli), «sei» no (verbo).
const CARDINALI = [];
for (const [parola, n] of [["due", 2], ["tre", 3], ["quattro", 4], ["cinque", 5], ["sette", 7], ["otto", 8], ["nove", 9], ["dieci", 10], ["undici", 11],
  ["dodici", 12], ["venti", 20], ["trenta", 30], ["cento", 100], ["decin[ae]", 10], ["dozzin[ae]", 12], ["centinai[oa]", 100]])
  CARDINALI.push([new RegExp("(?<!\\p{L})" + parola + "(?!\\p{L})", "iu"), n]);
// Frazioni scritte a parole, per le parti e i complementi («la terza parte»: 1/3, resta 2/3).
const FRAZIONI_PAROLA = [[/(?<!\p{L})metà(?!\p{L})/iu, "1/2"], [/(?<!\p{L})((?:un|una)\s+terz[oa]|(?:la|una)\s+terza\s+parte)(?!\p{L})/iu, "1/3"],
  [/(?<!\p{L})((?:un|una)\s+quart[oa]|(?:la|una)\s+quarta\s+parte)(?!\p{L})/iu, "1/4"], [/(?<!\p{L})due\s+terzi(?!\p{L})/iu, "2/3"], [/(?<!\p{L})tre\s+quarti(?!\p{L})/iu, "3/4"]];
export function controllaCompito(c) {
  const conConto = c.passi.map((p, i) => ({ p, n: i + 1 })).filter((x) => x.p.calcolo);
  if (!conConto.length) return { ok: false, motivo: "passo", passo: 1 };
  const rotto = conConto.find((x) => !contoTorna(x.p.calcolo));
  if (rotto) return { ok: false, motivo: "passo", passo: rotto.n };
  const valore = testo(c.risultato?.valore, 40);
  if (valutaSicuro(valore) === null || !coincide(finale(conConto[conConto.length - 1].p.calcolo), valore)) return { ok: false, motivo: "risultato" };
  // La verifica: uno o più controlli (una ✓ ciascuno), ogni conto torna. Due forme:
  //  - all'indietro: un controllo finisce con il risultato (210 + 280 + 465 + 305 = 1260);
  //  - in avanti: il risultato entra nel primo conto e l'ultimo arriva a un dato del testo
  //    (48 − (48 : 4 + 4) = 32 … 32 − (32 : 4 + 4) = 20).
  // In tutte e due rientrano almeno due dati veri del testo (o tutti, se sono meno), senza contare
  // le cifre delle frazioni, 0, 1 e il risultato. Se il testo ha solo frazioni, ne serve una.
  let controlli = controlliDi(c.verifica).map((x) => x.calcolo);
  if (!controlli.length || controlli.some((x) => !contoTorna(x))) return { ok: false, motivo: "verifica" };
  let sinistre = controlli.map((x) => senzaUnita(conPer(x)).split("=").slice(0, -1).join(" "));
  const consegna = String(c.testo).replace(/\[[^\]]*\]/g, " ");
  const frazioni = consegna.match(/\d+\s*\/\s*\d+/g) || [];
  const dati = new Set(numeriIn(consegna.replace(/\d+\s*\/\s*\d+/g, " "), true).filter((n) => n !== 0 && n !== 1 && !coincide(n, valore)));
  // Anche le parole-numero sono dati: «il triplo dell'altezza» è un 3 da rispettare.
  for (const [re, n] of PAROLE_NUMERO) if (re.test(consegna)) dati.add(n);
  const cardinali = CARDINALI.filter(([re]) => re.test(consegna)).map(([, n]) => n);
  // Un ultimo controllo fatto di soli dati che arriva allo stesso numero del controllo prima («48 − 18 = 30», poi
  // «5 × 6 = 30») si unisce a lui: «48 − 18 = 30 = 5 × 6», come se l'avesse scritto in una riga.
  if (controlli.length >= 2) {
    const ultimoPezzo = senzaUnita(conPer(controlli[controlli.length - 1])).split("=");
    const sinistraUltima = ultimoPezzo.slice(0, -1).join(" "), numeri = numeriIn(sinistraUltima.replace(/\d+\s*\/\s*\d+/g, " "));
    if (numeri.length >= 2 && numeri.every((n) => dati.has(n)) && coincide(finale(controlli[controlli.length - 1]), String(finale(controlli[controlli.length - 2])))) {
      controlli = [...controlli.slice(0, -2), controlli[controlli.length - 2] + " = " + ultimoPezzo[0].trim()];
      sinistre = controlli.map((x) => senzaUnita(conPer(x)).split("=").slice(0, -1).join(" "));
    }
  }
  // Se il testo ha frazioni, usarne una (o il suo denominatore) vale come un dato in più: «10 × 7 = 70» per
  // «spende 1/4 e restano 10 €» non rimette niente della frazione e non basta.
  const denominatori = new Set(frazioni.map((f) => Number(f.split("/")[1])));
  // il denominatore conta solo se non è già un dato del testo (in «1/4 … più 4» il 4 non vale due volte)
  const usaFrazione = (s) => frazioni.some((f) => s.replace(/\s/g, "").includes(f.replace(/\s/g, ""))) || numeriIn(s).some((n) => denominatori.has(n) && !dati.has(n));
  const quanti = Math.min(2, dati.size + (frazioni.length ? 1 : 0));
  const contaDati = (s) => datiIn(s).size + (frazioni.length && usaFrazione(s) ? 1 : 0);
  const datiIn = (s) => new Set(numeriIn(s.replace(/\d+\s*\/\s*\d+/g, " ")).filter((n) => dati.has(n)));
  const conFrazione = (s) => frazioni.some((f) => s.replace(/\s/g, "").includes(f.replace(/\s/g, "")));
  const haValore = (s) => numeriIn(s).some((n) => coincide(n, valore)) || (/\//.test(valore) && s.replace(/\s/g, "").includes(valore.replace(/\s/g, "")));
  // All'indietro: un controllo arriva al risultato senza averlo a sinistra e usa lui stesso i dati.
  // Solo in geometria: il conto del risultato usa misure trovate, e OGNI misura trovata compare in un
  // controllo che arriva a un dato del testo («(21 + 7) × 2 = 56», «21 : 7 = 3», poi «21 × 7 = 147»).
  // I dati si contano solo dal conto del risultato e da quei controlli.
  const operandi = (s) => new Set(numeriIn(s).filter((n) => n !== 0 && n !== 1));
  const finali = controlli.map(finale);
  const conMisure = (s, i) => {
    if (!/geom/i.test(c.materia || "")) return false;
    const misure = [...operandi(s)].filter((n) => !dati.has(n));
    const legati = controlli.map((_, k) => k).filter((k) => k !== i && dati.has(finali[k]) && misure.some((n) => operandi(sinistre[k]).has(n)));
    if (!misure.length || !misure.every((n) => legati.some((k) => operandi(sinistre[k]).has(n)))) return false;
    // Contano anche i controlli che legano un dato a una misura trovata («7 × 3 = 21»: il triplo).
    const relazioni = controlli.map((_, k) => k).filter((k) => k !== i && misure.some((n) => coincide(finali[k], String(n)) || operandi(sinistre[k]).has(n)));
    return new Set([...datiIn(s), ...legati.map((k) => finali[k]), ...[...legati, ...relazioni].flatMap((k) => [...datiIn(sinistre[k])])]
      .filter((n) => dati.has(n))).size >= quanti;
  };
  // All'indietro a catena (gemelli «variante», 16 novembre 2026). Una parte della somma finale può venire da un
  // controllo «pulito» che arriva a lei con soli dati e frazioni del testo («125 × 4 = 500»). La catena vale solo se,
  // riscritta in una riga sola mettendo il conto al posto della parte («300 + 200 + (125 × 4) + 200»), passa la stessa
  // regola di prima: così non accetta niente che scritto in una riga sarebbe stato scartato. In più, se il testo ha
  // frazioni, la catena ne deve usare una (anche nelle parti ricavate dal risultato, «1200 : 6 = 200»).
  const numFrazioni = new Set(frazioni.flatMap((f) => f.split("/").map((x) => Number(x.trim()))));
  const pulito = (sx, ammessi) => numeriIn(sx).every((n) => n === 0 || n === 1 || dati.has(n) || numFrazioni.has(n) || ammessi.some((a) => coincide(n, String(a))));
  const tokenDi = (n) => new RegExp("(?<![\\d.,])" + String(n).replace(".", ",?\\.?") + "(?![\\d.,])", "g");
  // Un controllo «al contrario» con un'operazione sola, dalla parte a un dato con un altro dato («220 + 80 = 300»),
  // si riscrive come conto che arriva alla parte (220 = 300 − 80) e si sostituisce come gli altri.
  const alContrario = (n) => {
    for (const k of controlli.keys()) {
      if (haValore(sinistre[k]) || !dati.has(finali[k])) continue;
      const m = senzaUnita(conPer(sinistre[k])).replace(/\s/g, "").replace(/[−–]/g, "-").match(/^(\d+(?:[.,]\d+)?)([-+×x*:])(\d+(?:[.,]\d+)?)$/);
      if (!m) continue;
      const [a, op, b] = [Number(m[1].replace(",", ".")), m[2], Number(m[3].replace(",", "."))];
      const altro = coincide(a, String(n)) ? b : coincide(b, String(n)) && (op === "+" || op === "×" || op === "x" || op === "*") ? a : null;
      if (altro === null || !(dati.has(altro) || numFrazioni.has(altro))) continue;
      const inverso = { "+": "-", "-": "+", "×": ":", x: ":", "*": ":", ":": "×" }[op];
      return finali[k] + " " + inverso + " " + altro;
    }
    return null;
  };
  const conCatena = (s, i) => {
    const ricavate = [...operandi(s)].filter((n) => !dati.has(n) && !numFrazioni.has(n));
    const altri = controlli.map((_, k) => k).filter((k) => k !== i);
    const dalRisultato = altri.filter((k) => haValore(sinistre[k]) && [...operandi(s)].some((n) => coincide(finali[k], String(n))) && pulito(sinistre[k], [valore]));
    let riga = s, sostituite = 0;
    for (const n of ricavate) {
      const k = altri.find((x) => !haValore(sinistre[x]) && coincide(finali[x], String(n)) && pulito(sinistre[x], []));
      const conto = k !== undefined ? sinistre[k] : alContrario(n);
      if (!conto) continue;
      riga = riga.replace(tokenDi(n), "(" + conto + ")"); sostituite++;
    }
    if (!sostituite || haValore(riga)) return false;
    if (frazioni.length && ![riga, ...dalRisultato.map((k) => sinistre[k])].some(usaFrazione)) return false;
    return contaDati(riga) >= quanti;
  };
  const indietro = sinistre.some((s, i) => coincide(finale(controlli[i]), valore) && !haValore(s) &&
    (dati.size ? contaDati(s) >= quanti || conMisure(s, i) || conCatena(s, i) : conFrazione(s)));
  // In avanti: il risultato entra davvero nel primo conto (cambiandolo, cambia il conto), ogni controllo
  // riparte da dove è arrivato il precedente, l'ultimo arriva a un dato del testo.
  const ultimo = finale(controlli[controlli.length - 1]);
  // L'ultimo controllo arriva a un dato del testo, o a un conto fatto solo di dati del testo («24 = 4 × 6»: 4 bustine da 6).
  const pezzoFinale = senzaUnita(conPer(controlli[controlli.length - 1])).split("=").pop();
  const numeriFinali = numeriIn(pezzoFinale.replace(/\d+\s*\/\s*\d+/g, " "));
  const arrivo = dati.has(ultimo) || (numeriFinali.length >= 2 && numeriFinali.every((n) => dati.has(n)));
  const primo = senzaUnita(conPer(controlli[0])).split("=")[0];
  const conta = valutaSicuro;
  const spostato = primo.replace(new RegExp("(?<![\\d.,])" + String(valore).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\d.,])", "g"), String(valutaSicuro(valore) + 1));
  // In avanti ogni controllo usa solo il risultato, i numeri trovati nei controlli prima, i dati e le frazioni del testo:
  // un numero inventato («52 − 22 = 30») non c'entra con la storia.
  const primiPezzi = controlli.map((x) => senzaUnita(conPer(x)).split("=")[0]);
  const extraTesto = [...(/(?<!\p{L})media(?!\p{L})/iu.test(consegna) ? [numeriIn(consegna.replace(/\d+\s*\/\s*\d+/g, " "), true).length] : []), ...(/%|per\s*cento/i.test(consegna) ? [100] : [])];
  const senzaInventati = /geom/i.test(c.materia || "") || /(?<!\p{L})perimetr/iu.test(consegna) || primiPezzi.every((x, i) => pulito(x.replace(/\d+\s*\/\s*\d+/g, " "), [valore, ...cardinali, ...extraTesto, ...finali.slice(0, i).filter((n) => n !== null)]));
  const avanti = !indietro && senzaInventati && haValore(sinistre[0]) && conta(spostato) !== null && conta(primo) !== null && Math.abs(conta(spostato) - conta(primo)) > 1e-9 &&
    sinistre.every((s, i) => i === 0 || numeriIn(s).some((n) => coincide(n, String(finale(controlli[i - 1]))))) &&
    // Arrivare a un dato, o a un prodotto di dati, vale un dato solo: gli altri devono stare nei controlli.
    // Usare una frazione del testo vale un dato, come all'indietro («36 : 3 = 12», «36 − 12 = 24»).
    arrivo && (dati.size ? new Set([...sinistre.flatMap((s) => [...datiIn(s)]), ...(dati.has(ultimo) ? [ultimo] : [])]).size + (dati.has(ultimo) ? 0 : 1) +
      (frazioni.length && sinistre.some(usaFrazione) ? 1 : 0) >= quanti : true);
  // I dati veri del testo, presi sul serio (17 novembre 2026, caso H della revisione e i casi della revisione avversaria).
  // Si guardano i primi pezzi dei controlli (gli altri ripetono gli stessi numeri) e, in avanti, l'arrivo.
  const tutteFrazioni = [...frazioni.map((f) => f.replace(/\s/g, "")), ...FRAZIONI_PAROLA.filter(([re]) => re.test(consegna)).map(([, f]) => f)];
  const valoreF = (f) => { const [a, b] = f.split("/").map(Number); return a / b; };
  const denominatoriTutti = new Set(tutteFrazioni.map((f) => Number(f.split("/")[1])));
  const geometria = /geom/i.test(c.materia || "") || /(?<!\p{L})perimetr/iu.test(consegna);
  const senzaFrazioni = (x) => String(x).replace(/\d+\s*\/\s*\d+/g, " ");
  const primiPezziTutti = controlli.map((x) => senzaUnita(conPer(x)).split("=")[0]);
  const v = valutaSicuro(valore);
  // Le parti di una quantità con le frazioni del testo e i loro complementi («1/4 di 600» = 150, «3/4 di 600» = 450).
  const parti = (x) => x === null ? [] : tutteFrazioni.flatMap((f) => [x * valoreF(f), x * (1 - valoreF(f))]);
  const partiDelRisultato = parti(v);
  const legamiFrazione = (x) => numeriIn(String(x)).some((n) => denominatoriTutti.has(n) && !dati.has(n)) || /(?<!\p{L})metà(?!\p{L})/iu.test(consegna) && /:\s*2(?![\d.,])/.test(String(x));
  // Le parti di un dato solo se quel dato è il totale, cioè non più piccolo del risultato (Giulia ha 30 € e ne spende
  // 1/5): con «regala 1/3 delle figurine … 4 bustine da 6» il 6 × 1/3 = 2 sarebbe una coincidenza.
  const partiDeiDati = [...dati].filter((d) => v !== null && d >= v).flatMap(parti);
  // 1. Numeri inventati (fuori dalla geometria, dove le misure trovate hanno la loro regola): ogni numero di un controllo
  //    viene dal testo (dati, frazioni e i loro complementi), dal risultato, da un altro controllo, da una parte del
  //    risultato o di un dato, o da un controllo al contrario. «24 + 2 + 34 = 60»: il 34 non viene da niente.
  // Con il denominatore comune: «1/4 + 1/6 = 3/12 + 2/12 = 5/12» rende giusti 12, 3, 2, 5 e 7 (quello che resta).
  const mcd = (a, b) => (b ? mcd(b, a % b) : a);
  const comune = [...denominatoriTutti].reduce((m, d) => (m * d) / mcd(m, d), 1);
  const riportati = tutteFrazioni.map((f) => { const [a, b] = f.split("/").map(Number); return (a * comune) / b; });
  const somme = riportati.reduce((tutte, x) => [...tutte, ...tutte.map((t) => t + x)], [0]).filter((x) => x > 0);
  const ammessiBase = [...dati, ...cardinali, ...tutteFrazioni.flatMap((f) => { const [a, b] = f.split("/").map(Number); return [a, b, b - a]; }),
    ...(tutteFrazioni.length ? [comune, ...somme, ...somme.map((x) => comune - x)] : []), ...partiDelRisultato, ...partiDeiDati,
    ...extraTesto]; // la media si divide per quanti sono i valori; con le percentuali serve il 100
  const inventato = !geometria && primiPezziTutti.some((x, i) => numeriIn(senzaFrazioni(x)).some((n) => n !== 0 && n !== 1 && !coincide(n, valore) &&
    !ammessiBase.some((a) => coincide(n, String(a))) && !finali.some((f, k) => k !== i && f !== null && coincide(f, String(n))) && !alContrario(n)));
  // 2. Ogni dato che usa la soluzione entra anche nella verifica.
  const tuttiINumeri = controlli.flatMap((x) => numeriIn(senzaFrazioni(senzaUnita(conPer(x)))));
  // Solo i dati che usa anche la soluzione: i libri mettono apposta dati superflui (l'anno, la classe, l'ora di partenza).
  const neiPassi = conConto.flatMap((x) => numeriIn(senzaFrazioni(senzaUnita(conPer(x.p.calcolo)))));
  const datoIgnorato = numeriIn(senzaFrazioni(consegna), true).some((n) => dati.has(n) && neiPassi.some((m) => coincide(m, String(n))) && !tuttiINumeri.some((m) => coincide(m, String(n))));
  // 3. Nessun dato si usa più volte di quante compare: «60 : 3 + 2 = 22», «22 + 2 = 24» usa due volte il «più 2».
  //    Un uso in più è giusto quando il numero:
  //    - compare di nuovo nel testo, anche dentro una frazione («1/4 … più 4»); in geometria ogni misura vale due
  //      volte (i lati opposti del perimetro);
  //    - è il risultato di un altro controllo («600 : 4 = 150», poi «150 + 150 + 300»);
  //    - è una parte frazione del risultato o di un dato (Giulia: 30 × 1/5 = 6 e il dato 6 €);
  //    - è usato «come legame»: diviso per il denominatore o moltiplicato per una frazione del testo («50 : 5 × 4»),
  //      oppure moltiplicato per 2 o 3 se il testo dice «il doppio / il triplo di», o diviso per 2 se dice «la metà di».
  //    Ogni «in più» / «in meno» del testo vale un riuso in più in tutta la verifica (Luca 10 anni, la sorella 4 in più).
  const datoRiusato = (pezzoArrivo, kArrivo) => {
    const conteggio = (lista) => lista.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
    const nelTesto = conteggio(numeriIn(senzaFrazioni(consegna), true));
    for (const [re, n] of PAROLE_NUMERO) nelTesto.set(n, (nelTesto.get(n) || 0) + (consegna.match(new RegExp(re.source, "giu")) || []).length);
    const nelleFrazioni = conteggio(frazioni.flatMap((f) => f.split("/").map((x) => Number(x.trim()))));
    const ultimoK = controlli.length - 1;
    const ricavati = conteggio(finali.filter((n, k) => n !== null && k !== kArrivo));
    const quanteParti = (n) => [...partiDelRisultato, ...partiDeiDati].filter((p) => coincide(p, String(n))).length;
    const doppio = /(?<!\p{L})doppi[oa](?!\p{L})/iu.test(consegna), triplo = /(?<!\p{L})tripl[oa](?!\p{L})/iu.test(consegna), meta = /(?<!\p{L})metà(?!\p{L})/iu.test(consegna);
    const num = "(?<![\\d.,/])";
    const legami = (x, n) => {
      const t = String(x), N = num + String(n).replace(".", "\\.") + "(?![\\d.,/])";
      let k = 0;
      for (const d of denominatoriTutti) k += (t.match(new RegExp(N + "\\s*:\\s*" + d + "(?![\\d.,/])", "g")) || []).length;
      k += (t.match(new RegExp(N + "\\s*[×x*]\\s*\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+\\s*[×x*]\\s*" + N, "g")) || []).length;
      for (const [vale, m] of [[doppio, 2], [triplo, 3]]) if (vale) k += (t.match(new RegExp(N + "\\s*[×x*]\\s*" + m + "(?![\\d.,/])|" + num + m + "\\s*[×x*]\\s*" + N, "g")) || []).length;
      if (meta) k += (t.match(new RegExp(N + "\\s*:\\s*2(?![\\d.,/])", "g")) || []).length;
      // la base di una percentuale («25 × 40 : 100»): un uso come legame
      if (/%|per\s*cento/i.test(consegna) && /:\s*100(?![\d.,])/.test(t)) k += (t.match(new RegExp(N + "\\s*[×x*]", "g")) || []).length;
      return k;
    };
    const pezzi = [...primiPezziTutti];
    if (pezzoArrivo !== null) pezzi.push(pezzoArrivo);
    const usi = conteggio(pezzi.flatMap((x) => numeriIn(senzaFrazioni(x))));
    // «4 anni in più», «5 € più di Paolo»: ogni frase vale un riuso in più, ma non per il numero attaccato alla frase
    // (in «regala 1/3 e 2 in più» il 2 resta da usare una volta sola: è il caso H).
    const frasi = [...consegna.matchAll(/(\d+(?:[.,]\d+)?)?[^\d.,;]{0,12}?(?<!\p{L})(?:in\s+(?:più|meno)|(?:più|meno)\s+(?:di|del|dello|della|dei|degli|delle|rispetto))(?!\p{L})/giu)];
    let inPiu = frasi.length;
    const attaccati = new Set(frasi.filter((m) => m[1]).map((m) => Number(m[1].replace(",", "."))));
    for (const [n, u] of usi) {
      if (!dati.has(n)) continue;
      const permessi = (nelTesto.get(n) || 0) * (geometria ? 2 : 1) + (nelleFrazioni.get(n) || 0) + (ricavati.get(n) || 0) + quanteParti(n) +
        pezzi.reduce((t, x) => t + legami(x, n), 0);
      if (u > permessi && attaccati.has(n)) return true;
      if (u > permessi) { inPiu -= u - permessi; if (inPiu < 0) return true; }
    }
    return false;
  };
  // Ricomporre il totale (17 novembre 2026): il risultato è una parte, e un controllo rimette insieme il risultato e le
  // altre parti fino a un dato del testo («36 : 2 = 18», poi «18 + 5 + 13 = 36»). Le altre parti vengono da controlli
  // puliti fatti con i dati, o sono una frazione di un dato («180 + 60 = 240» con lo sconto di 1/4 su 240 €).
  const pezzoArrivoDi = (k) => senzaUnita(conPer(controlli[k])).split("=").pop();
  const puliti = controlli.map((_, k) => !haValore(sinistre[k]) && pulito(senzaFrazioni(sinistre[k]), [...cardinali, ...extraTesto]));
  const kRicomposto = indietro || avanti ? -1 : controlli.findIndex((_, i) => {
    if (!haValore(primiPezziTutti[i]) || !dati.has(finali[i])) return false;
    const altri = numeriIn(senzaFrazioni(primiPezziTutti[i])).filter((n) => n !== 0 && n !== 1 && !coincide(n, valore));
    const coperture = [];
    for (const n of altri) {
      if (dati.has(n) || cardinali.includes(n) || [...partiDeiDati, ...partiDelRisultato].some((p) => coincide(p, String(n)))) continue;
      const k = controlli.findIndex((_, x) => x !== i && puliti[x] && coincide(finali[x], String(n)));
      if (k < 0) return false;
      coperture.push(k);
    }
    const usati = new Set([...datiIn(primiPezziTutti[i]), finali[i], ...coperture.flatMap((k) => [...datiIn(sinistre[k])])]);
    const frazione = frazioni.length || tutteFrazioni.length ? [primiPezziTutti[i], ...coperture.map((k) => sinistre[k])].some((x) => usaFrazione(x) || legamiFrazione(x)) ||
      altri.some((n) => [...partiDeiDati, ...partiDelRisultato].some((p) => coincide(p, String(n)))) : false;
    return usati.size + (frazione ? 1 : 0) >= quanti;
  });
  const ricomposto = kRicomposto >= 0;
  if (!(indietro || avanti || ricomposto)) return { ok: false, motivo: "verifica" };
  const arrivoPezzo = avanti ? pezzoFinale : ricomposto ? pezzoArrivoDi(kRicomposto) : null;
  if (inventato || datoIgnorato || datoRiusato(arrivoPezzo, avanti ? controlli.length - 1 : kRicomposto)) return { ok: false, motivo: "verifica" };
  if (c.soluzione_libro && stessoRisultato(c.soluzione_libro, c.risultato) === false) return { ok: false, motivo: "libro" };
  return { ok: true };
}

// I controlli della verifica; la forma vecchia con un calcolo solo vale come un controllo.
const controlliDi = (v) => (Array.isArray(v?.controlli) && v.controlli.length
  ? v.controlli.map((x) => ({ testo: testo(x?.testo, 300), calcolo: testo(x?.calcolo, 400) })).filter((x) => x.calcolo).slice(0, 8)
  : (testo(v?.calcolo, 400) ? [{ testo: "", calcolo: testo(v.calcolo, 400) }] : []));

// «Prova tu»: una mini-domanda con il suo risultato, tenuta solo se il suo conto torna e arriva lì.
export function pulisciProvaTu(p) {
  const t = testo(p?.testo, 400), valore = testo(p?.risultato?.valore, 40), calcolo = testo(p?.calcolo, 400);
  if (!t || !valore || !calcolo || !contoTorna(calcolo) || !coincide(finale(calcolo), valore)) return null;
  const passo = Number(p.passo);
  return { testo: t, risultato: { valore, unita: testo(p.risultato?.unita, 20) }, calcolo,
    passo: Number.isInteger(passo) && passo >= 1 && passo <= MAX_PASSI ? passo : null, spiegazione: testo(p.spiegazione, 800) };
}
// La risposta al «Prova tu» si corregge come gli esercizi (equivalenze, unità): mai il modello.
export function correggiProvaTu(risposta, atteso) {
  const calcolato = valutaSicuro(String(atteso?.valore ?? ""));
  return confrontaRisultato(String(risposta ?? "").slice(0, 60), calcolato, { valore: String(atteso?.valore ?? ""), unita: String(atteso?.unita ?? "") });
}

// Limite degli aiuti (compito e compito_domanda): 30 al giorno per profilo, il giorno di Roma.
export const MAX_AIUTI_GIORNO = 30;
export const giornoRoma = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
// Un aiuto prenotato e non usato (la risposta non è riuscita) torna indietro, nello stesso giorno.
export function rimborsoAiuti(appMetadata, giorno) {
  const a = appMetadata?.aiuti;
  return a && a.giorno === giorno ? { giorno, n: Math.max(0, (Number(a.n) || 0) - 1) } : null;
}
// limite: quello della famiglia (issue #30); senza, 30 come prima.
export function contaAiuti(appMetadata, giorno, limite = MAX_AIUTI_GIORNO) {
  const a = appMetadata?.aiuti;
  const n = a && a.giorno === giorno ? Number(a.n) || 0 : 0;
  return n >= limite ? { permesso: false, aiuti: { giorno, n } } : { permesso: true, aiuti: { giorno, n: n + 1 } };
}

// I dati con il loro significato («1/6» → «la parte spesa per gli anelli»); le stringhe sole valgono ancora.
const datiPuliti = (v) => (Array.isArray(v) ? v : []).map((d) => (typeof d === "string" ? { valore: testo(d, 120), significato: "" }
  : { valore: testo(d?.valore, 120), significato: testo(d?.significato, 200) })).filter((d) => d.valore).slice(0, 20);

// La risposta del modello ripulita. Con più esercizi nella pagina solo l'elenco da scegliere;
// null se non c'è un testo da aiutare.
export function pulisciCompito(r) {
  if (!r || typeof r !== "object") return null;
  const esercizi = (Array.isArray(r.esercizi) ? r.esercizi : [])
    .map((e) => ({ id: testo(e?.id, 20), inizio: testo(e?.inizio, 120) })).filter((e) => e.inizio).slice(0, 20);
  if (esercizi.length > 1) return { esercizi };
  const t = testo(r.testo, 4000);
  if (!t) return null;
  return {
    materia: testo(r.materia, 60), matematica: r.matematica === true, testo: t,
    dati: datiPuliti(r.dati), cerca: testo(r.cerca, 300), soluzione_libro: testo(r.soluzione_libro, 120),
    indizi: lista(r.indizi, MAX_INDIZI),
    passi: (Array.isArray(r.passi) ? r.passi : []).slice(0, MAX_PASSI).map((p) => ({
      titolo: testo(p?.titolo, 120), spiegazione: testo(p?.spiegazione, 1200), calcolo: testo(p?.calcolo, 400), ancora: testo(p?.ancora, 400),
      concetto: testo(p?.concetto, 80),
    })).filter((p) => p.titolo || p.spiegazione),
    risultato: { valore: testo(r.risultato?.valore, 60), unita: testo(r.risultato?.unita, 20) },
    verifica: { spiegazione: testo(r.verifica?.spiegazione, 1200), controlli: controlliDi(r.verifica) },
    strategia: { nome: testo(r.strategia?.nome, 80), perche: testo(r.strategia?.perche, 600) },
    trucco: testo(r.trucco, 800), domande_pronte: lista(r.domande_pronte, DOMANDE_PRONTE, 160),
    prova_tu: pulisciProvaTu(r.prova_tu),
  };
}

// Risposta a una domanda sull'esercizio. La figura c'è solo se è una barra disegnabile.
export function pulisciRisposta(r) {
  const risposta = testo(r?.risposta, 2500);
  if (!risposta) return null;
  const f = r.figura, parti = Number(f?.parti), colorate = Number(f?.colorate);
  const figura = f && f.tipo === "barra_frazioni" && Number.isInteger(parti) && parti >= 1 && parti <= MAX_PARTI_BARRA &&
    Number.isInteger(colorate) && colorate >= 0 && colorate <= parti ? { tipo: "barra_frazioni", parti, colorate, etichetta: testo(f.etichetta, 40) } : null;
  const passo = Number(r.passo);
  return { risposta, calcoli: lista(r.calcoli, 6, 400), figura, prova_tu: pulisciProvaTu(r.prova_tu), passo: Number.isInteger(passo) && passo >= 1 && passo <= MAX_PASSI ? passo : null };
}
export const calcoliCheNonTornano = (r) => (r.calcoli || []).filter((x) => !contoTorna(x));

// Cronologia della chat per il prompt: ultimi 10 messaggi, solo testo.
export const cronologiaPulita = (c) => (Array.isArray(c) ? c : []).slice(-MAX_CRONOLOGIA)
  .map((m) => ({ chi: m?.chi === "io" ? "io" : "app", testo: testo(m?.testo, 1500) })).filter((m) => m.testo);

/* ---- soluzione bloccata finché non si prova (decisione di Roby sulla #27) ---- */
// La risposta a una domanda dice il risultato finale? Nel testo, nei conti, nell'etichetta della figura
// o nel Prova tu; anche scritto «1.260» o come frazione «5/12». Se il risultato è già un numero
// del testo dell'esercizio non c'è niente da nascondere.
export function rispostaColRisultato(r, c) {
  const valore = String(c?.risultato?.valore ?? "").trim();
  if (!r || valutaSicuro(valore) === null) return false;
  const uguale = (t) => numeriIn(t, true).some((n) => coincide(n, valore)) ||
    (String(t).match(/\d+\s*\/\s*\d+/g) || []).some((f) => coincide(valutaSicuro(f), valore));
  // le cifre di «1/6» non sono numeri del testo: con risultato 6 il controllo resta acceso
  if (uguale(String(c.testo || "").replace(/\d+\s*\/\s*\d+/g, " "))) return false;
  const p = r.prova_tu || {}, f = r.figura;
  if (f && f.parti && coincide(f.colorate / f.parti, valore)) return true; // la barra 5 su 12 dice 5/12
  return [r.risposta, ...(r.calcoli || []), f?.etichetta, p.testo, p.calcolo, p.spiegazione, p.risultato?.valore]
    .filter(Boolean).some(uguale);
}
export const AVVISO_BLOCCATA = "\n\nAttenzione: nel tentativo precedente la risposta conteneva il risultato finale. La soluzione non è ancora sbloccata: non scrivere il risultato in nessun campo (risposta, calcoli, figura, prova_tu) né un conto che ci arriva. Dai invece un indizio sul passo che serve, senza risultato.";
// genera(extra) → risposta pulita o null. Col risultato si rigenera una volta chiedendo un indizio;
// se lo contiene ancora, una risposta di riserva con un indizio che non lo dice.
export async function rispondiSenzaRisultato(genera, c) {
  let r = await genera("");
  if (!r || !rispostaColRisultato(r, c)) return r;
  r = await genera(AVVISO_BLOCCATA);
  if (!r || !rispostaColRisultato(r, c)) return r;
  const indizio = (c.indizi || []).find((t) => !rispostaColRisultato({ risposta: t }, c));
  return { risposta: "Il risultato te lo faccio vedere dopo che hai provato." + (indizio ? " Intanto un indizio: " + indizio : " Rileggi i passi e scrivi la tua risposta."),
    calcoli: [], figura: null, prova_tu: null, passo: null };
}

/* ---- problemi gemelli (aggiunta 2 di Roby) ---- */
export const TIPI_GEMELLI = ["vicino", "lontano", "variante"];
const mcd = (a, b) => (b ? mcd(b, a % b) : a);
// Numeri adatti alla classe in ogni pezzo della catena: interi; euro con i centesimi solo se la catena
// parla di euro; frazioni solo come frazioni scritte (fra interi e frazioni, con + e −), non oltre l'intero.
// Niente 7,333… né 22,5 quaderni.
const SOLO_FRAZIONI = /^\(?\s*\d+(?:\s*\/\s*\d+)?(?:\s*[+\-]\s*\d+(?:\s*\/\s*\d+)?)*\s*\)?$/;
export function numeriAdatti(calcolo) {
  const grezzo = conPer(testo(calcolo, 400)), euro = /€|euro/i.test(grezzo);
  const intero = (x) => Math.abs(x - Math.round(x)) < 1e-9;
  return senzaUnita(grezzo).split("=").every((p) => {
    const v = valutaSicuro(p.trim());
    if (v === null) return false;
    if (intero(v)) return true;
    if (euro && intero(v * 100)) return true;
    return /\//.test(p) && SOLO_FRAZIONI.test(p.trim().replace(/[−–]/g, "-")) && Math.abs(v) <= 1;
  });
}
// null se il gemello va bene, altrimenti il motivo: stesso numero di passi con un conto (la variante
// ne può avere uno in più o in meno), contesto diverso, ogni conto torna con numeri adatti, l'ultimo
// arriva al risultato.
export function motivoGemello(g, c) {
  if (!g || !testo(g.testo) || !TIPI_GEMELLI.includes(g.tipo)) return "forma";
  // Un testo con una correzione a metà («una somma di denominatori... no: per il compleanno…») non si mostra.
  if (/(\.\.\.|…)\s*(no|anzi|cioè)\b/i.test(testo(g.testo, 1500))) return "forma";
  if (testo(g.testo).toLowerCase() === testo(c.testo).toLowerCase()) return "contesto";
  const conti = (g.passi || []).map((p) => testo(p?.calcolo, 400)).filter(Boolean);
  const attesi = (c.passi || []).filter((p) => p.calcolo).length;
  if (g.tipo === "variante" ? Math.abs(conti.length - attesi) > 1 : conti.length !== attesi) return "passi";
  if (!conti.every(contoTorna)) return "conto";
  if (!conti.every(numeriAdatti)) return "numeri";
  const valore = testo(g.risultato?.valore, 40);
  if (valutaSicuro(valore) === null || !coincide(finale(conti[conti.length - 1]), valore)) return "risultato";
  // Il risultato si verifica sul testo del gemello, come per il compito: conti scollegati dalla storia non passano.
  const prova = controllaCompito({ testo: g.testo, materia: c.materia, soluzione_libro: "", passi: (g.passi || []).map((p) => ({ calcolo: testo(p?.calcolo, 400) })),
    risultato: { valore, unita: testo(g.risultato?.unita, 20) }, verifica: g.verifica });
  if (!prova.ok) return "verifica";
  return null;
}
// I gemelli buoni, uno per tipo, nell'ordine vicino, lontano, variante; quanti scartati e i tipi mancanti.
export function pulisciGemelli(r, c) {
  const buoni = new Map(), motivi = {}, scarti = []; let scartati = 0;
  for (const g of Array.isArray(r?.gemelli) ? r.gemelli : []) {
    const motivo = motivoGemello(g, c);
    if (motivo) { scartati++; motivi[motivo] = (motivi[motivo] || 0) + 1; scarti.push({ motivo, gemello: g }); continue; } // non rispetta le regole: si scarta (e si rigenera)
    if (buoni.has(g.tipo)) continue;                     // un doppione buono non è uno scarto
    buoni.set(g.tipo, {
      tipo: g.tipo, testo: testo(g.testo, 1500),
      passi: g.passi.map((p) => ({ titolo: testo(p?.titolo, 120), spiegazione: testo(p?.spiegazione, 600), calcolo: testo(p?.calcolo, 400) })).filter((p) => p.titolo || p.calcolo).slice(0, MAX_PASSI + 2),
      risultato: { valore: testo(g.risultato.valore, 40), unita: testo(g.risultato?.unita, 20) },
      verifica: { spiegazione: testo(g.verifica?.spiegazione, 600), controlli: controlliDi(g.verifica) },
    });
  }
  return { gemelli: TIPI_GEMELLI.filter((t) => buoni.has(t)).map((t) => buoni.get(t)), scartati, motivi, scarti, mancano: TIPI_GEMELLI.filter((t) => !buoni.has(t)) };
}
