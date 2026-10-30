// Preparazione delle domande: quali concetti mandare al modello e quali domande
// tenere. Logica del prototipo (preparaVerifica). JavaScript puro: lo usano la
// Edge Function e i test.
import { ancorata, fonteDi } from "./ancoraggio.js";
import { FONTE_WEB } from "./web.js";

// Mai verificato: priorità alta ma non massima (prototipo).
export function debolezza(c) {
  return c.media == null ? 6 : 10 - Number(c.media);
}

// argomenti: [{ id, titolo, materia, trascrizione, concetti: [{ id, titolo, descrizione, ancora, peso, media }] }]
// Nel ripasso tiene i 12 concetti più deboli pesati per importanza, come il prototipo.
// Al modello i concetti arrivano con id brevi (c1, c2...) come nel prototipo: un
// uuid ricopiato male farebbe scartare una domanda buona.
// Il web aiuta a studiare ma non entra mai nella verifica (issue #4): un concetto con
// fonte "web" non arriva al modello, e senza id breve nessuna domanda può citarlo.
const concettoDagliAppunti = (c) => c.fonte !== FONTE_WEB;

export function preparaPool(argomenti, ripasso) {
  let pool = [];
  for (const a of argomenti) for (const c of (a.concetti || []).filter(concettoDagliAppunti)) pool.push({ a, c, score: debolezza(c) * c.peso });
  if (ripasso) pool = pool.sort((x, y) => y.score - x.score).slice(0, 12);
  const indice = {};
  pool.forEach((p, i) => { p.breve = "c" + (i + 1); indice[p.breve] = p; });
  const contesto = pool.map((p) => ({
    id: p.breve, argomento: p.a.titolo, materia: p.a.materia, titolo: p.c.titolo, descrizione: p.c.descrizione,
    ancora: p.c.ancora,
    andamento: p.c.media == null ? "mai verificato" : ("ultima volta " + Number(p.c.media).toFixed(1) + "/10"),
  }));
  return { pool, indice, contesto };
}

// Una chiusa deve avere quattro opzioni e la corretta fra quelle, altrimenti non si può correggere.
function benFormata(d) {
  if (!d || typeof d.testo !== "string" || !d.testo.trim()) return false;
  if (d.tipo === "chiusa")
    return Array.isArray(d.opzioni) && d.opzioni.length === 4 && d.opzioni.every((o) => String(o).trim()) &&
      Number.isInteger(d.corretta) && d.corretta >= 0 && d.corretta < 4;
  if (d.tipo === "aperta") return typeof d.risposta_attesa === "string" && !!d.risposta_attesa.trim();
  return false;
}

// Tiene solo le domande ben formate e ancorate (filtro di ancoraggio) e le ricollega
// al concetto e all'argomento veri. Restituisce anche quante ne ha scartate.
export function tieniAncorate(grezze, indice, argomenti) {
  const fonte = fonteDi(argomenti);
  const tenute = [];
  for (const d of grezze || []) {
    if (!benFormata(d) || !ancorata(d, indice, fonte)) continue;
    const p = indice[d.concetto_id];
    tenute.push({
      id: "d" + (tenute.length + 1),
      tipo: d.tipo,
      testo: d.testo.trim(),
      opzioni: d.tipo === "chiusa" ? d.opzioni.map(String) : null,
      corretta: d.tipo === "chiusa" ? d.corretta : null,
      risposta_attesa: d.tipo === "aperta" ? d.risposta_attesa.trim() : null,
      elementi: d.tipo === "aperta" ? (d.elementi || []).map(String).filter((e) => e.trim()) : [],
      ancora: String(d.ancora).trim(),
      concetto_id: p.c.id,
      concetto_titolo: p.c.titolo,
      argomento_id: p.a.id,
      argomento_titolo: p.a.titolo,
      materia: p.a.materia,
    });
  }
  return { domande: tenute, scartate: (grezze || []).length - tenute.length };
}

// Prova lampo su un concetto (issue #11): tre domande, per le miste due chiuse e una aperta
// scelte per tipo (non le prime tre). Meno di MIN_LAMPO domande ancorate: niente prova, perché
// una domanda sola deciderebbe il semaforo del concetto.
export const MIN_LAMPO = 2;
export function sceltaLampo(domande, tipo, quante = 3) {
  if (tipo !== "miste") return domande.slice(0, quante);
  const chiuse = domande.filter((d) => d.tipo === "chiusa"), aperte = domande.filter((d) => d.tipo === "aperta");
  const prese = [...chiuse.slice(0, quante - 1), ...aperte.slice(0, 1)];
  const resto = domande.filter((d) => !prese.includes(d));
  return [...prese, ...resto].slice(0, quante).map((d, i) => ({ ...d, id: "d" + (i + 1) }));
}
