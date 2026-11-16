// «Esame di terza media» (issue #28): la scaletta del colloquio orale con i collegamenti fra materie,
// a partire dagli argomenti salvati del profilo. Il modello sceglie fra quegli argomenti (con id brevi
// a1, a2…: gli id veri non li deve copiare) e i concetti si tengono solo se sono davvero di quell'argomento.
import { contestoClasse } from "./classe.js";

const testo = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const MAX_ARGOMENTI_ESAME = 40, MAX_TAPPE = 6;

// [{ id, titolo, materia, concetti: [{ titolo }] }] → [{ breve, id, titolo, materia, concetti: [titoli] }]; null con meno di due materie.
export function argomentiPerEsame(argomenti) {
  const a = (Array.isArray(argomenti) ? argomenti : []).filter((x) => x && x.id && testo(x.titolo, 200)).slice(0, MAX_ARGOMENTI_ESAME)
    .map((x, i) => ({ breve: "a" + (i + 1), id: x.id, titolo: testo(x.titolo, 200), materia: testo(x.materia, 60) || "altro",
      concetti: (x.concetti || []).map((c) => testo(c && c.titolo, 200)).filter(Boolean).slice(0, 30) }));
  return new Set(a.map((x) => x.materia.toLowerCase())).size >= 2 ? a : null;
}

export function promptEsame({ classe, argomenti }) {
  return [
    "Sei un insegnante che prepara al colloquio orale dell'esame di terza media. Chi studia parte da un argomento e lo collega ad altre materie, in un percorso che si racconta in 10-15 minuti.",
    contestoClasse({ classe, materia: "", testo: "esame colloquio collegamenti" }),
    "Gli argomenti salvati (id: titolo (materia) — concetti):\n" + argomenti.map((a) => a.breve + ": " + a.titolo + " (" + a.materia + ")" + (a.concetti.length ? " — " + a.concetti.join("; ") : "")).join("\n"),
    "Usa solo gli argomenti dell'elenco, con il loro id. Scegli l'argomento di partenza (quello che si presta di più a collegamenti) e da 2 a " + MAX_TAPPE + " tappe di materie diverse, senza ripetere un argomento. Per ogni tappa: collegamento = una o due frasi corte che dicono come si passa dalla tappa prima a questa (un tema comune, un periodo, una causa, una parola chiave), concetti = 1-3 concetti di quell'argomento da citare, copiati dall'elenco.",
    "Non aggiungere fatti, date o nomi che non stanno nei titoli o nei concetti: il collegamento è un'idea per legare gli argomenti, non una lezione nuova.",
    "apertura: la prima frase che chi studia può dire per cominciare, in prima persona. domande: 3-5 domande che la commissione potrebbe fare, ognuna legata a un argomento dell'elenco. consigli: 2-3 consigli pratici per il colloquio (frasi corte, seconda persona, forme neutre di genere).",
    'Rispondi solo con JSON: {"titolo":"","partenza":{"argomento":"a1","apertura":""},"tappe":[{"argomento":"a2","collegamento":"","concetti":[""]}],"domande":[{"argomento":"a1","testo":""}],"consigli":[""]}',
  ].join("\n\n");
}

// { titolo, partenza: { argomento, apertura }, tappe: [{ argomento, collegamento, concetti }], domande, consigli, scartate } o null.
// argomento = { id, titolo, materia } vero. Null se la partenza non è salvata o se resta una materia sola.
export function pulisciEsame(r, argomenti) {
  if (!r || !Array.isArray(argomenti)) return null;
  const per = new Map(argomenti.map((a) => [a.breve, a]));
  const vero = (a) => ({ id: a.id, titolo: a.titolo, materia: a.materia });
  const p = per.get(testo(r.partenza && r.partenza.argomento, 10));
  if (!p) return null;
  const usati = new Set([p.breve]);
  const grezze = Array.isArray(r.tappe) ? r.tappe : [];
  const tappe = [];
  for (const t of grezze) {
    const a = per.get(testo(t && t.argomento, 10)), collegamento = testo(t && t.collegamento, 400);
    if (!a || usati.has(a.breve) || !collegamento || tappe.length >= MAX_TAPPE) continue;
    usati.add(a.breve);
    tappe.push({ argomento: vero(a), collegamento, concetti: (Array.isArray(t.concetti) ? t.concetti : []).map((c) => testo(c, 200)).filter((c) => a.concetti.includes(c)).slice(0, 3) });
  }
  if (!tappe.length || new Set([p.materia, ...tappe.map((t) => t.argomento.materia)].map((m) => m.toLowerCase())).size < 2) return null;
  const domande = (Array.isArray(r.domande) ? r.domande : []).map((d) => ({ a: per.get(testo(d && d.argomento, 10)), t: testo(d && d.testo, 300) }))
    .filter((d) => d.a && d.t).slice(0, 5).map((d) => ({ argomento: vero(d.a), testo: d.t }));
  return {
    titolo: testo(r.titolo, 120), partenza: { argomento: vero(p), apertura: testo(r.partenza.apertura, 400) }, tappe, domande,
    consigli: (Array.isArray(r.consigli) ? r.consigli : []).map((c) => testo(c, 300)).filter(Boolean).slice(0, 3),
    scartate: grezze.length - tappe.length,
  };
}
