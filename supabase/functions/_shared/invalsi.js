// «Allenati per l'INVALSI» (issue #28, solo 3ª media): domande nel formato della prova al computer.
// Le risposte di matematica si ricalcolano come nei compiti: quelle che non tornano si scartano.
import { contoTorna, finale } from "./compito.js";
import { coincide } from "./calcolo.js";
import { leggiRisposta } from "./correzione.js";
import { contestoClasse } from "./classe.js";
import { numeriIn } from "./generati.js";

export const FORMATI_INVALSI = ["scelta_multipla", "vero_falso", "completamento", "risposta_breve"];
export const AMBITI_INVALSI = {
  matematica: ["Numeri", "Spazio e figure", "Relazioni e funzioni", "Dati e previsioni"],
  italiano: ["Comprensione del testo", "Riflessione sulla lingua"],
  inglese: ["Reading", "Listening"],
};
export const MATERIE_INVALSI = Object.keys(AMBITI_INVALSI);
const testo = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function promptInvalsi({ materia, quante, classe }) {
  const chiedi = quante + 2; // un paio in più: quelle che non tornano si scartano
  const perMateria = {
    matematica: "Domande di matematica come nella prova INVALSI di terza media al computer, una per ambito a rotazione. Ogni domanda ha calcolo: la catena di uguali che porta alla risposta (solo numeri, + − × : / ^ √ e parentesi, decimali con la virgola, ogni uguale vero; il server la ricalcola). Per la scelta multipla la risposta è il testo dell'opzione corretta. Le risposte (l'opzione corretta, il completamento, la risposta breve) sono numeri, eventualmente con l'unità; nel vero/falso l'affermazione contiene il numero da controllare.",
    italiano: "Un brano breve (narrativo o espositivo, 150-250 parole, adatto a 13-14 anni) e domande di comprensione del testo e di riflessione sulla lingua (grammatica, lessico, sintassi), come nella prova INVALSI di terza media. Calcolo vuoto.",
    inglese: "Livello A2 (come la prova INVALSI di inglese di terza media). Un brano in inglese di 100-180 parole: per il Reading lo si legge, per il Listening (ascolto: true) l'app lo legge a voce senza mostrarlo. Domande in inglese. Calcolo vuoto.",
  }[materia];
  return [
    "Sei un insegnante che prepara alla prova INVALSI di terza media.",
    contestoClasse({ classe, materia, testo: "invalsi" }),
    perMateria,
    "Scrivi " + chiedi + " domande, alternando i formati: " + FORMATI_INVALSI.join(", ") + ". Ambiti (usa esattamente questi nomi): " + AMBITI_INVALSI[materia].join(", ") + ".",
    "scelta_multipla: quattro opzioni plausibili, una sola corretta (corretta = la sua posizione, da 0). vero_falso: un'affermazione nel testo, opzioni Vero e Falso, corretta 0 se è vera. completamento: una frase con ___ al posto della parola o del numero, risposta = quello che va al posto di ___. risposta_breve: risposta = la risposta attesa, breve (un numero con l'unità, una parola).",
    "spiegazione: perché la risposta è quella, in 1-2 frasi corte, in seconda persona e con forme neutre di genere. Niente domande su argomenti che in terza media non si fanno.",
    'Rispondi solo con JSON: {"brano":{"titolo":"","testo":"","ascolto":false},"domande":[{"ambito":"","formato":"scelta_multipla","testo":"","opzioni":["","","",""],"corretta":0,"risposta":"","calcolo":"","spiegazione":""}]}',
  ].join("\n\n");
}

const numero = (s) => { const l = leggiRisposta(s); return l ? l.numero : null; };
function domandaPulita(d, materia) {
  if (!d || !AMBITI_INVALSI[materia].includes(d.ambito) || !FORMATI_INVALSI.includes(d.formato)) return null;
  const t = testo(d.testo, 600), spiegazione = testo(d.spiegazione, 600), calcolo = testo(d.calcolo, 400);
  if (!t) return null;
  let opzioni = [], corretta = 0, risposta = "";
  if (d.formato === "scelta_multipla") {
    opzioni = (Array.isArray(d.opzioni) ? d.opzioni : []).map((o) => testo(o, 200));
    corretta = typeof d.corretta === "number" ? d.corretta : NaN;
    if (opzioni.length < 3 || opzioni.length > 4 || opzioni.some((o) => !o) || new Set(opzioni).size !== opzioni.length || !Number.isInteger(corretta) || !opzioni[corretta]) return null;
    risposta = opzioni[corretta];
  } else if (d.formato === "vero_falso") {
    opzioni = ["Vero", "Falso"]; corretta = typeof d.corretta === "number" ? d.corretta : NaN;
    if (corretta !== 0 && corretta !== 1) return null;
    risposta = opzioni[corretta];
  } else {
    risposta = testo(d.risposta, 60);
    if (!risposta) return null;
  }
  if (materia === "matematica") {
    // ogni domanda con il suo conto che torna; se la risposta è un numero, è quello a cui arriva il conto
    if (!calcolo || !contoTorna(calcolo)) return null;
    const giusto = finale(calcolo);
    if (d.formato === "vero_falso") {
      // l'affermazione è vera se dice il numero a cui arriva il conto: e il Vero/Falso deve essere quello
      const dice = numeriIn(t, true).some((x) => coincide(giusto, String(x)));
      if (dice !== (corretta === 0)) return null;
    } else {
      const n = numero(risposta);
      if (n === null || !coincide(giusto, n)) return null; // in matematica la risposta è un numero, quello del conto
      // nessun'altra opzione con lo stesso valore (90 e 90,0): due risposte giuste non vanno
      if (d.formato === "scelta_multipla" && opzioni.some((o, k) => k !== corretta && numero(o) !== null && coincide(giusto, numero(o)))) return null;
    }
  }
  return { ambito: d.ambito, formato: d.formato, testo: t, opzioni, corretta, risposta, calcolo, spiegazione };
}

// { brano, domande (al più quante), scartate }. Italiano e inglese senza brano: niente domande.
export function pulisciInvalsi(r, materia, quante) {
  const b = r && r.brano, brano = b && testo(b.testo, 3000) ? { titolo: testo(b.titolo, 120), testo: testo(b.testo, 3000), ascolto: b.ascolto === true } : null;
  const grezze = Array.isArray(r?.domande) ? r.domande : [];
  const buone = materia !== "matematica" && !brano ? [] : grezze.map((d) => domandaPulita(d, materia)).filter(Boolean);
  return { brano: materia === "matematica" ? null : brano, domande: buone.slice(0, quante), scartate: grezze.length - buone.length };
}
