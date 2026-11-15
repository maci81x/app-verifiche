// «Aiutami con un compito» (issue #27). JavaScript puro: lo usano la Edge Function e i test.
//
// Regola della matematica: nessun conto arriva alla ragazz* senza essere ricalcolato qui.
// Ogni `calcolo` è una catena "a = b = c" di espressioni con soli numeri: ogni uguale deve
// tornare (calcolo.js). L'ultimo conto dei passi dà il risultato, la verifica rimette il
// risultato nei dati del testo, la soluzione del libro (se c'è) deve coincidere.

import { valutaSicuro, coincide, decimaliDichiarati } from "./calcolo.js";
import { leggiRisposta } from "./correzione.js";
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

// Euro e unità di misura dopo un numero non contano nel conto: «465 € + 305 €» = «465 + 305».
const UNITA = /(\d|\))\s*(?:€|euro|mm|cm|dm|km|m|kg|hg|g|ml|cl|dl|l|ore|min|°)(?:[²³]|\^[23])?(?![a-zà-ù])/gi;
const senzaUnita = (s) => String(s).replace(/€\s*(?=\d)/g, "").replace(UNITA, "$1");

// Ogni uguale della catena torna. Un pezzo scritto come numero decimale vale anche arrotondato
// alle sue cifre (come in correzione.js); fra espressioni il valore deve essere lo stesso.
export function contoTorna(calcolo) {
  const pezzi = senzaUnita(testo(calcolo, 400)).split("=").map((p) => p.trim());
  if (pezzi.length < 2 || pezzi.some((p) => !p || /[a-zà-ù]/i.test(p))) return false;
  const valori = pezzi.map(valutaSicuro);
  if (valori.some((v) => v === null)) return false;
  return valori.every((v, i) => i === 0 || (decimaliDichiarati(pezzi[i]) ? coincide(valori[i - 1], pezzi[i]) || coincide(v, pezzi[i - 1])
    : Math.abs(v - valori[i - 1]) <= 1e-9 * Math.max(1, Math.abs(v))));
}
// Valore dell'ultimo pezzo di una catena che torna.
const finale = (calcolo) => valutaSicuro(senzaUnita(calcolo).split("=").pop().trim());

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
  // La verifica torna, arriva al risultato e usa almeno un numero dei dati del testo.
  const v = testo(c.verifica?.calcolo, 400);
  const sinistra = senzaUnita(v).split("=").slice(0, -1).join(" ");
  // Dati = i numeri del testo, senza la soluzione del libro fra quadre e senza il risultato stesso.
  const dati = new Set(numeriIn(String(c.testo).replace(/\[[^\]]*\]/g, " "), true).filter((n) => !coincide(n, valore)));
  if (!contoTorna(v) || !coincide(finale(v), valore) || !numeriIn(sinistra).some((n) => dati.has(n))) return { ok: false, motivo: "verifica" };
  if (c.soluzione_libro && stessoRisultato(c.soluzione_libro, c.risultato) === false) return { ok: false, motivo: "libro" };
  return { ok: true };
}

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
    dati: lista(r.dati, 20, 120), cerca: testo(r.cerca, 300), soluzione_libro: testo(r.soluzione_libro, 120),
    indizi: lista(r.indizi, MAX_INDIZI),
    passi: (Array.isArray(r.passi) ? r.passi : []).slice(0, MAX_PASSI).map((p) => ({
      titolo: testo(p?.titolo, 120), spiegazione: testo(p?.spiegazione, 1200), calcolo: testo(p?.calcolo, 400), ancora: testo(p?.ancora, 400),
    })).filter((p) => p.titolo || p.spiegazione),
    risultato: { valore: testo(r.risultato?.valore, 60), unita: testo(r.risultato?.unita, 20) },
    verifica: { spiegazione: testo(r.verifica?.spiegazione, 1200), calcolo: testo(r.verifica?.calcolo, 400) },
    trucco: testo(r.trucco, 800), domande_pronte: lista(r.domande_pronte, DOMANDE_PRONTE, 160),
  };
}

// Risposta a una domanda sull'esercizio. La figura c'è solo se è una barra disegnabile.
export function pulisciRisposta(r) {
  const risposta = testo(r?.risposta, 2500);
  if (!risposta) return null;
  const f = r.figura, parti = Number(f?.parti), colorate = Number(f?.colorate);
  const figura = f && f.tipo === "barra_frazioni" && Number.isInteger(parti) && parti >= 1 && parti <= MAX_PARTI_BARRA &&
    Number.isInteger(colorate) && colorate >= 0 && colorate <= parti ? { tipo: "barra_frazioni", parti, colorate, etichetta: testo(f.etichetta, 40) } : null;
  return { risposta, calcoli: lista(r.calcoli, 6, 400), figura, prova_tu: testo(r.prova_tu, 400) };
}
export const calcoliCheNonTornano = (r) => (r.calcoli || []).filter((x) => !contoTorna(x));

// Cronologia della chat per il prompt: ultimi 10 messaggi, solo testo.
export const cronologiaPulita = (c) => (Array.isArray(c) ? c : []).slice(-MAX_CRONOLOGIA)
  .map((m) => ({ chi: m?.chi === "io" ? "io" : "app", testo: testo(m?.testo, 1500) })).filter((m) => m.testo);
