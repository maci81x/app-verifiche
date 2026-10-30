// Correzione degli esercizi di matematica (issue #5, fetta #8). JavaScript puro: lo usano
// la Edge Function e i test.
//
// Il risultato lo giudica un calcolo (giusto, senza unità, unità sbagliata, sbagliato),
// mai il modello. Il modello legge solo i passaggi della ragazza: trova il primo passaggio
// sbagliato e lo spiega. La citazione del passaggio deve stare in quello che lei ha scritto.

import { valutaSicuro, coincide, decimaliDichiarati } from "./calcolo.js";
import { normalizzaMat } from "./esercizi.js";

// Punti per esito: lo stesso 0..10 delle altre prove, così semaforo e storico non cambiano.
export const PUNTI = { giusto: 10, senza_unita: 8, unita_sbagliata: 5, sbagliato: 0, non_numerica: 0, vuota: 0 };
export const TIPI_ERRORE = ["calcolo", "formula", "segno", "unita", "procedimento", "nessuno", "altro"];
const MAX_SPIEGAZIONE = 1500;

// Davanti al numero: "Risultato:", "Area =", "x =", "circa", "≈". Dopo: un punto o una virgola finali.
const PREFISSO = /^(?:(?:circa|≈|~)\s*|(?:risultato|ris)\.?\s*[:=]?\s*|[a-zà-ù][a-zà-ù ]{0,24}=\s*|=\s*)+/i;
const NUMERO = /^([-−–+]?\s*√?\s*\d+(?:[.,]\d+)*(?:[ \u00a0]\d{3}(?!\d))*(?:\s*[\/^]\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/s;
// Migliaia all'italiana: "2.500" (mai con lo zero davanti: "0.125" è un decimale).
const MIGLIAIA = /^[-−–+]?[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/;
// Un'unità di misura: lettere e simboli, niente numeri a parte gli esponenti, niente "=".
const SEMBRA_UNITA = /^[a-zà-ù€°%'²³µ/^23 .]{1,30}$/i;

const normaleNumero = (n) => n.replace(/[\s\u00a0]+/g, "").replace(/[−–]/g, "-");

// Numero (o frazione) e unità di misura da quello che ha scritto la ragazza; null se non è un numero.
// alternativa: l'altra lettura possibile quando il punto può essere delle migliaia o dei decimali.
export function leggiRisposta(risposta) {
  let s = String(risposta ?? "").trim().replace(/[.,;:]+$/, "").replace(PREFISSO, "");
  let davanti = "";
  if (/^€/.test(s)) { davanti = "€"; s = s.slice(1).trim(); }
  const m = NUMERO.exec(s);
  if (!m) return null;
  const grezzo = normaleNumero(m[1]);
  const numero = grezzo.split("/").map((x) => (MIGLIAIA.test(x) ? x.replace(/\./g, "") : x)).join("/");
  if (valutaSicuro(numero) === null) return null;
  const unita = (davanti || m[2].trim()).slice(0, 30);
  const letta = { numero, unita };
  return numero !== grezzo && valutaSicuro(grezzo) !== null ? { ...letta, alternativa: grezzo } : letta;
}

// Nomi per esteso → simboli; "quadrati"/"q" → 2, "cubi"/"c" → 3.
const NOMI_UNITA = {
  millimetri: "mm", millimetro: "mm", centimetri: "cm", centimetro: "cm", decimetri: "dm", decimetro: "dm",
  metri: "m", metro: "m", chilometri: "km", chilometro: "km", grammi: "g", grammo: "g", chilogrammi: "kg",
  chili: "kg", litri: "l", litro: "l", ore: "h", ora: "h", minuti: "min", minuto: "min", secondi: "s", secondo: "s",
  euro: "€", gradi: "°", grado: "°", cc: "cm3",
};
function unitaNormale(u) {
  let s = String(u ?? "").toLowerCase().trim().replace(/\.$/, "").replace(/\s+/g, " ");
  s = s.replace(/\b(quadrat[io]|quadr[io])\b/g, "2").replace(/\b(cub[io])\b/g, "3");
  s = s.split(" ").map((w) => NOMI_UNITA[w] ?? w).join("");
  s = s.replace(/^(mm|cm|dm|m|dam|hm|km)q$/, "$12").replace(/^(mm|cm|dm|m|dam|hm|km)c$/, "$13");
  return s.replace(/²/g, "2").replace(/³/g, "3").replace(/\^(?=[23]$)/, "");
}
export const unitaUguali = (a, b) => unitaNormale(a) === unitaNormale(b);

// Il valore letto è giusto? Con meno decimali di quelli del risultato vale solo se è esatto
// (1,5 per 1,50 sì, 12,8 per 12,75 no): la precisione la chiede l'esercizio, non la sceglie lei.
function valoreGiusto(calcolato, numero, dichiarato) {
  const dLei = decimaliDichiarati(numero), dEs = decimaliDichiarati(dichiarato);
  if (dLei === null || dEs === null || dLei >= dEs) return coincide(calcolato, numero);
  return Math.abs(calcolato - valutaSicuro(numero)) <= 1e-9 * Math.max(1, Math.abs(calcolato));
}

// calcolato: il valore preciso (dalla verifica dell'esercizio); atteso: { valore, unita }.
export function confrontaRisultato(risposta, calcolato, atteso) {
  const fine = (esito, letto = "") => ({ esito, giusto: esito !== "sbagliato" && PUNTI[esito] > 0, punti: PUNTI[esito], letto });
  if (!String(risposta ?? "").trim()) return fine("vuota");
  const l = leggiRisposta(risposta);
  if (!l) return fine("non_numerica");
  const conUnita = !!String(atteso?.unita ?? "").trim();
  // Dopo il numero ci può stare solo un'unità di misura: "15 = 15" o "5:3" non si leggono.
  if (l.unita && !SEMBRA_UNITA.test(l.unita)) return fine("non_numerica", l.numero);
  const numero = [l.numero, l.alternativa].filter(Boolean).find((n) => valoreGiusto(calcolato, n, atteso?.valore));
  if (!numero) return fine("sbagliato", l.numero);
  if (!conUnita) return fine("giusto", numero);
  if (!l.unita) return fine("senza_unita", numero);
  return fine(unitaUguali(l.unita, atteso.unita) ? "giusto" : "unita_sbagliata", numero);
}

// "3 x 4" scritto con la lettera x vale come "3 × 4".
const compatto = (s) => normalizzaMat(String(s ?? "").replace(/(\d)\s*[xX]\s*(?=\d)/g, "$1*")).replace(/\s+/g, "");

// Il passaggio citato come primo errore deve essere scritto (spazi e simboli a parte) nei suoi passaggi.
export function primoErroreRegge(citazione, passaggi) {
  const c = compatto(citazione);
  return c.length >= 3 && compatto(passaggi).includes(c);
}

const testo = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// a: { primo_errore, tipo_errore, spiegazione, esempio } dal modello; null se manca.
export function analisiPulita(a, passaggi) {
  if (!a || typeof a !== "object") return null;
  const citazione = testo(a.primo_errore, 300);
  return {
    primo_errore: primoErroreRegge(citazione, passaggi) ? citazione : "",
    tipo_errore: TIPI_ERRORE.includes(a.tipo_errore) ? a.tipo_errore : "altro",
    spiegazione: testo(a.spiegazione, MAX_SPIEGAZIONE),
    esempio: testo(a.esempio, MAX_SPIEGAZIONE),
  };
}

export const MAX_PACCHETTO = 10;
const MAX_SVOLGIMENTO = 4000;

const soluzioneInRighe = (passaggi) => (Array.isArray(passaggi) ? passaggi : []).slice(0, 12)
  .map((p) => [testo(p?.testo, 400), testo(p?.formula, 300)].filter(Boolean).join(": ")).filter(Boolean);

const risultatoScritto = (r) => [testo(r?.valore, 40), testo(r?.unita, 20)].filter(Boolean).join(" ");

// Prima metà della correzione, senza modello. pacchetto: [{ id, testo, passaggi, risultato,
// verifica, risposta, svolgimento }]. Il valore giusto è quello della verifica (preciso),
// altrimenti quello dichiarato. daAnalizzare: gli esercizi con i passaggi della ragazza.
export function correggiPacchetto(pacchetto) {
  const correzioni = [], daAnalizzare = [];
  for (const x of (Array.isArray(pacchetto) ? pacchetto : []).slice(0, MAX_PACCHETTO)) {
    const id = testo(x?.id, 40);
    if (!id) continue;
    const risultato = { valore: testo(x.risultato?.valore, 40), unita: testo(x.risultato?.unita, 20) };
    const calcolato = valutaSicuro(testo(x.verifica, 400)) ?? valutaSicuro(risultato.valore);
    if (calcolato === null) continue;
    const c = confrontaRisultato(testo(x.risposta, 200), calcolato, risultato);
    const svolgimento = testo(x.svolgimento, MAX_SVOLGIMENTO);
    correzioni.push({ id, ...c, primo_errore: "", tipo_errore: "", spiegazione: "", esempio: "" });
    if (svolgimento) daAnalizzare.push({
      id, testo: testo(x.testo, 600), soluzione: soluzioneInRighe(x.passaggi), risultato: risultatoScritto(risultato),
      risposta: testo(x.risposta, 200), esito: c.esito, passaggi: svolgimento,
    });
  }
  return { correzioni, daAnalizzare };
}

// Seconda metà: l'analisi del modello, pulita, si aggiunge alla correzione dello stesso id.
// Il giudizio sul risultato (esito, punti) non cambia.
export function conAnalisi(correzioni, analisi, daAnalizzare) {
  const passaggiDi = Object.fromEntries(daAnalizzare.map((x) => [x.id, x.passaggi]));
  const perId = {};
  for (const a of Array.isArray(analisi) ? analisi : []) {
    const id = testo(a?.id, 40);
    if (Object.hasOwn(passaggiDi, id) && !perId[id]) perId[id] = analisiPulita(a, passaggiDi[id]);
  }
  return correzioni.map((c) => (perId[c.id] ? { ...c, ...perId[c.id] } : c));
}
