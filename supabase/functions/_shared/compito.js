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
const finale = (calcolo) => valutaSicuro(senzaUnita(conPer(calcolo)).split("=").pop().trim());

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
  const controlli = controlliDi(c.verifica).map((x) => x.calcolo);
  if (!controlli.length || controlli.some((x) => !contoTorna(x))) return { ok: false, motivo: "verifica" };
  const sinistre = controlli.map((x) => senzaUnita(conPer(x)).split("=").slice(0, -1).join(" "));
  const consegna = String(c.testo).replace(/\[[^\]]*\]/g, " ");
  const frazioni = consegna.match(/\d+\s*\/\s*\d+/g) || [];
  const dati = new Set(numeriIn(consegna.replace(/\d+\s*\/\s*\d+/g, " "), true).filter((n) => n !== 0 && n !== 1 && !coincide(n, valore)));
  // Anche le parole-numero sono dati: «il triplo dell'altezza» è un 3 da rispettare.
  for (const [re, n] of [[/\b(doppi[oa]|metà)\b/i, 2], [/\b(tripl[oa]|terz[oa])\b/i, 3], [/\b(quadrupl[oa]|quart[oa])\b/i, 4]]) if (re.test(consegna)) dati.add(n);
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
  const indietro = sinistre.some((s, i) => coincide(finale(controlli[i]), valore) && !haValore(s) &&
    (dati.size ? contaDati(s) >= quanti || conMisure(s, i) : conFrazione(s)));
  // In avanti: il risultato entra davvero nel primo conto (cambiandolo, cambia il conto), ogni controllo
  // riparte da dove è arrivato il precedente, l'ultimo arriva a un dato del testo.
  const ultimo = finale(controlli[controlli.length - 1]);
  const primo = senzaUnita(conPer(controlli[0])).split("=")[0];
  const conta = valutaSicuro;
  const spostato = primo.replace(new RegExp("(?<![\\d.,])" + String(valore).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\d.,])", "g"), String(valutaSicuro(valore) + 1));
  const avanti = !indietro && haValore(sinistre[0]) && conta(spostato) !== null && conta(primo) !== null && Math.abs(conta(spostato) - conta(primo)) > 1e-9 &&
    sinistre.every((s, i) => i === 0 || numeriIn(s).some((n) => coincide(n, String(finale(controlli[i - 1]))))) &&
    dati.has(ultimo) && (dati.size ? new Set([...sinistre.flatMap((s) => [...datiIn(s)]), ultimo]).size >= quanti : true);
  if (!(indietro || avanti)) return { ok: false, motivo: "verifica" };
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
export function contaAiuti(appMetadata, giorno) {
  const a = appMetadata?.aiuti;
  const n = a && a.giorno === giorno ? Number(a.n) || 0 : 0;
  return n >= MAX_AIUTI_GIORNO ? { permesso: false, aiuti: { giorno, n } } : { permesso: true, aiuti: { giorno, n: n + 1 } };
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
  if (uguale(c.testo || "")) return false;
  const p = r.prova_tu || {};
  return [r.risposta, ...(r.calcoli || []), r.figura?.etichetta, p.testo, p.calcolo, p.spiegazione, p.risultato?.valore]
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
  const indizio = indiziSenzaRisultato(c)[0];
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
  const buoni = new Map(); let scartati = 0;
  for (const g of Array.isArray(r?.gemelli) ? r.gemelli : []) {
    if (motivoGemello(g, c)) { scartati++; continue; } // non rispetta le regole: si scarta (e si rigenera)
    if (buoni.has(g.tipo)) continue;                     // un doppione buono non è uno scarto
    buoni.set(g.tipo, {
      tipo: g.tipo, testo: testo(g.testo, 1500),
      passi: g.passi.map((p) => ({ titolo: testo(p?.titolo, 120), spiegazione: testo(p?.spiegazione, 600), calcolo: testo(p?.calcolo, 400) })).filter((p) => p.titolo || p.calcolo).slice(0, MAX_PASSI + 2),
      risultato: { valore: testo(g.risultato.valore, 40), unita: testo(g.risultato?.unita, 20) },
      verifica: { spiegazione: testo(g.verifica?.spiegazione, 600), controlli: controlliDi(g.verifica) },
    });
  }
  return { gemelli: TIPI_GEMELLI.filter((t) => buoni.has(t)).map((t) => buoni.get(t)), scartati, mancano: TIPI_GEMELLI.filter((t) => !buoni.has(t)) };
}
