// Mini-lezione a schede (issue #23). JavaScript puro: lo usano la Edge Function `modello` e i test.
//
// Tutto viene dagli appunti: la frase del quaderno di ogni scheda passa il filtro di ancoraggio
// (se non regge si toglie), ogni conto si ricalcola come nei compiti (se non torna la scheda cade),
// gli anni della linea del tempo devono essere scritti negli appunti, le misure delle figure nel testo.
import { ancoraRegge, fonteDi } from "./ancoraggio.js";
import { contoTorna } from "./compito.js";
import { pulisciFigura, numeriIn, FORME } from "./generati.js";
import { contestoClasse } from "./classe.js";

// Struttura fissa: (1) una domanda vera che incuriosisce, (2) i nomi delle cose, (3) la regola con la
// frase del quaderno, (4) un esempio svolto, (5) «Ora tocca a te». Esempi e nomi possono essere più d'uno.
export const TIPI_SCHEDA = ["domanda", "nomi", "regola", "esempio", "tocca"];
export const FIGURE_LEZIONE = ["nessuna", "geometria", "linea_tempo", "frecce", "gruppi"];
export const MIN_SCHEDE = 4, MAX_SCHEDE = 7;
const MAX_CALCOLI = 4, MAX_EVENTI = 6, MAX_PASSI = 6, MAX_GRUPPI = 3, MAX_VOCI = 5, MAX_ETICHETTA = 60;
const MAX_APPUNTI = 60_000;

const testo = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v, max, lung) => (Array.isArray(v) ? v.map((x) => testo(x, lung)).filter(Boolean).slice(0, max) : []);

export function promptLezione({ classe, materia, titolo, trascrizione, concetti }) {
  return [
    "Sei un insegnante di scuola media italiana. Prepara una mini-lezione a schede da sfogliare sul telefono, per spiegare bene un argomento a partire dagli appunti di chi studia.",
    contestoClasse({ classe, materia, testo: titolo + " " + (concetti || []).map((c) => c.titolo).join(" ") }),
    "Materia: " + materia + ". Argomento: " + titolo + ".",
    (concetti || []).length ? "I punti già trovati negli appunti: " + concetti.map((c) => c.titolo).join("; ") + "." : "",
    "Da 5 a 7 schede, una idea per scheda, in quest'ordine di tipo: domanda (un problema o una domanda vera che incuriosisce, legata all'argomento), nomi (i nomi delle cose: le parole nuove, ognuna spiegata in breve), regola (la regola o l'idea centrale), esempio (un esempio svolto passo per passo), tocca (Ora tocca a te: una domanda o un piccolo esercizio da provare da sol*). Puoi mettere due schede nomi o due schede esempio.",
    "titolo: al massimo sei parole. testo: 2-5 frasi corte, una cosa per frase, seconda persona, forme neutre di genere, niente elenchi tecnici. Tutto quello che scrivi deve stare negli appunti: non aggiungere date, nomi o numeri che negli appunti non ci sono.",
    "ancora: la frase degli appunti che regge la scheda, copiata carattere per carattere dagli appunti (numeri compresi). Nella scheda regola è obbligatoria; nelle altre mettila solo se c'è una frase degli appunti che dice proprio quello, altrimenti stringa vuota.",
    "calcoli: solo in matematica e scienze con i numeri, i conti dell'esempio come catene di uguali con soli numeri (+ − × : / ^ √ e parentesi, decimali con la virgola), ogni uguale vero: il server li ricalcola e una scheda con un conto sbagliato viene scartata. Nelle altre materie lista vuota.",
    "figura: al massimo una per scheda, solo dove aiuta davvero, altrimenti tipo nessuna. geometria (solo matematica): forma fra " + Object.keys(FORME).join(", ") + " e misure con i numeri scritti nel testo della scheda. linea_tempo (storia): eventi con anno (numero intero, negativo per avanti Cristo) ed etichetta brevissima, solo anni scritti negli appunti. frecce: passi in ordine (cause ed effetti, fasi di un ciclo, passaggi di un procedimento), etichette brevissime. gruppi: 2 o 3 gruppi con titolo e voci (classificazioni). Mai persone, volti, luoghi o paesaggi disegnati: solo schemi.",
    "Gli appunti:\n" + String(trascrizione || "").slice(0, MAX_APPUNTI),
    'Rispondi solo con JSON: {"schede":[{"tipo":"domanda","titolo":"","testo":"","ancora":"","calcoli":[],"figura":{"tipo":"nessuna","forma":"nessuna","misure":[],"eventi":[],"passi":[],"gruppi":[]}}]}',
  ].filter(Boolean).join("\n\n");
}

// Figura della scheda: { tipo, ... } pulita, o null. Conta in scarti gli eventi con anni inventati.
function figuraPulita(f, testoScheda, anniAppunti, scarti) {
  if (!f || typeof f !== "object") return null;
  if (f.tipo === "geometria") {
    const g = pulisciFigura(f, testoScheda);
    return g ? { tipo: "geometria", ...g } : null;
  }
  if (f.tipo === "linea_tempo") {
    const eventi = [];
    for (const e of Array.isArray(f.eventi) ? f.eventi : []) {
      const anno = Number(e && e.anno), etichetta = testo(e && e.etichetta, MAX_ETICHETTA);
      if (!Number.isInteger(anno) || !etichetta) continue;
      if (!anniAppunti.has(Math.abs(anno))) { scarti.n++; continue; }
      if (!eventi.some((x) => x.anno === anno)) eventi.push({ anno, etichetta });
    }
    eventi.sort((a, b) => a.anno - b.anno);
    return eventi.length >= 2 ? { tipo: "linea_tempo", eventi: eventi.slice(0, MAX_EVENTI) } : null;
  }
  if (f.tipo === "frecce") {
    const passi = lista(f.passi, MAX_PASSI, MAX_ETICHETTA);
    return passi.length >= 2 ? { tipo: "frecce", passi } : null;
  }
  if (f.tipo === "gruppi") {
    const gruppi = (Array.isArray(f.gruppi) ? f.gruppi : []).map((g) => ({ titolo: testo(g && g.titolo, MAX_ETICHETTA), voci: lista(g && g.voci, MAX_VOCI, MAX_ETICHETTA) }))
      .filter((g) => g.titolo && g.voci.length).slice(0, MAX_GRUPPI);
    return gruppi.length >= 2 ? { tipo: "gruppi", gruppi } : null;
  }
  return null;
}

// argomento: { trascrizione, concetti: [{ ancora }] } (le ancore già controllate dei concetti o dei tipi).
// → { schede: [{ tipo, titolo, testo, ancora, calcoli, figura, fonte: "appunti" }], scartate } o null se ne restano poche.
export function pulisciLezione(r, argomento) {
  const grezze = Array.isArray(r && r.schede) ? r.schede : [];
  const fonte = fonteDi([argomento || {}]);
  const anni = new Set(numeriIn(String((argomento && argomento.trascrizione) || ""), true));
  const scarti = { n: 0 };
  const buone = [];
  for (const s of grezze) {
    const tipo = s && TIPI_SCHEDA.includes(s.tipo) ? s.tipo : null, titolo = testo(s && s.titolo, 80), corpo = testo(s && s.testo, 900);
    if (!tipo || !titolo || !corpo) { scarti.n++; continue; }
    const calcoli = lista(s.calcoli, MAX_CALCOLI, 300);
    if (calcoli.some((c) => !contoTorna(c))) { scarti.n++; continue; } // un esempio con un conto sbagliato non si mostra
    let ancora = testo(s.ancora, 400);
    if (ancora && !ancoraRegge(ancora, fonte)) { ancora = ""; scarti.n++; }
    const figura = figuraPulita(s.figura, corpo + " " + calcoli.join(" "), anni, scarti);
    buone.push({ tipo, titolo, testo: corpo, ancora, calcoli, figura, fonte: "appunti" });
  }
  if (buone.length < MIN_SCHEDE) return null;
  // Ordine fisso per tipo (stabile); con troppe schede si tolgono quelle in mezzo, l'ultima resta.
  const ordinate = buone.map((s, i) => [s, i]).sort((a, b) => TIPI_SCHEDA.indexOf(a[0].tipo) - TIPI_SCHEDA.indexOf(b[0].tipo) || a[1] - b[1]).map((x) => x[0]);
  const schede = ordinate.length > MAX_SCHEDE ? [...ordinate.slice(0, MAX_SCHEDE - 1), ordinate[ordinate.length - 1]] : ordinate;
  return { schede, scartate: scarti.n };
}
