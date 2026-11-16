// «Le 5 cose da sapere» e «Raccontalo in 2 minuti» (issue #22). JavaScript puro: lo usano
// la Edge Function e i test.
//
// Le 5 cose: ogni elemento passa dal filtro di ancoraggio come le domande. La chiave di ogni
// punto, ogni anello della catena causa-effetto e l'ancora della domanda della prof devono
// reggere sul materiale (ancoraRegge); le parole tecniche devono esserci scritte così. Il
// testo del modello (non è una citazione) passa dal controllo delle sintesi: se non regge
// resta solo la frase del quaderno. La catena è tutta o niente: con un anello che non regge
// la sezione sparisce.
//
// Il racconto: per ogni concetto detto, impreciso o saltato. Detto e impreciso valgono solo
// con la prova, cioè il pezzo del racconto in cui se ne parla; senza, il punto è saltato.
import { ancoraRegge, normalizza, fonteDi, MAX_ANCORA } from "./ancoraggio.js";
import { sintesiPulita } from "./sintesi.js";
import { concettiInOrdine, idBreve } from "./mappa.js";

export const ETICHETTE = ["Chi", "Quando", "Che cosa", "Perché conta"];
export const MAX_PUNTI = 5, MIN_ANELLI = 2, MAX_ANELLI = 4, MAX_PAROLE = 6;
export const ESITI_RACCONTO = ["detto", "impreciso", "saltato"];

const lista = (v) => (Array.isArray(v) ? v : []);
const pulito = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const perBreveDi = (concetti) => Object.fromEntries(concettiInOrdine(concetti).map((c, i) => [idBreve(i), c.id]));
// La parola (o le due-tre parole) compare nel testo normalizzato, a parole intere.
// ancoraRegge guarda solo i primi MAX_ANCORA caratteri: una frase più lunga non si può controllare tutta, quindi non regge.
const regge = (frase, fonte) => frase.length <= MAX_ANCORA && ancoraRegge(frase, fonte);
const aParoleIntere = (testo, frase) => { const n = normalizza(frase); return !!n && (" " + testo + " ").includes(" " + n + " "); };

// argomento: { trascrizione, concetti: [{ id, ancora, ordine }] }
// grezza: { punti: [{ concetto_id, etichetta, testo, chiave }], catena: [{ testo, ancora }], parole: [""], domanda: { concetto_id, testo, ancora } }
// → { punti, catena, parole, domanda, scartati }
// La chiave è una frase intera del quaderno: comincia con maiuscola, cifra o virgolette (non «che si forma quando…»).
const INIZIO_FRASE = /^[«"“'(]?[A-ZÀ-Ý0-9]/;
// Un pezzo di frase copiato esatto si allarga alla frase intera della trascrizione; se non lo trova resta com'è.
export function fraseIntera(chiave, trascrizione) {
  const t = String(trascrizione || ""), i = chiave ? t.indexOf(chiave) : -1;
  if (i < 0 || INIZIO_FRASE.test(chiave)) return chiave;
  const prima = Math.max(t.lastIndexOf(". ", i), t.lastIndexOf("\n", i), t.lastIndexOf("? ", i), t.lastIndexOf("! ", i));
  const fine = t.slice(i + chiave.length).search(/[.!?](\s|$)|\n/);
  return t.slice(prima < 0 ? 0 : prima + 1, fine < 0 ? t.length : i + chiave.length + fine + 1).trim();
}

export function puntiChiaveDaRisposta(argomento, grezza) {
  const g = grezza || {};
  const perBreve = perBreveDi(argomento.concetti);
  const fonte = fonteDi([argomento]);
  let scartati = 0;

  const punti = [], viste = new Set();
  lista(g.punti).forEach((p) => {
    const concetto_id = perBreve[p && p.concetto_id], etichetta = pulito(p && p.etichetta), chiave = fraseIntera(pulito(p && p.chiave), argomento.trascrizione);
    if (punti.length >= MAX_PUNTI || !concetto_id || !ETICHETTE.includes(etichetta) || viste.has(normalizza(chiave)) || !INIZIO_FRASE.test(chiave) || !regge(chiave, fonte)) { scartati++; return; }
    viste.add(normalizza(chiave));
    punti.push({ concetto_id, etichetta, testo: sintesiPulita(p.testo, fonte), chiave });
  });

  const anelli = lista(g.catena).map((x) => ({ testo: sintesiPulita(x && x.testo, fonte), ancora: pulito(x && x.ancora) }));
  const catenaRegge = anelli.length >= MIN_ANELLI && anelli.length <= MAX_ANELLI && anelli.every((x) => regge(x.ancora, fonte));
  if (anelli.length && !catenaRegge) scartati++;

  const parole = [], vistePar = new Set();
  lista(g.parole).forEach((w) => {
    const p = pulito(w), k = normalizza(p);
    if (!k || vistePar.has(k)) return;
    if (parole.length >= MAX_PAROLE || p.length > 40 || !aParoleIntere(fonte, p)) { scartati++; return; }
    vistePar.add(k); parole.push(p);
  });

  const d = g.domanda || {};
  const domanda = perBreve[d.concetto_id] && pulito(d.testo) && regge(pulito(d.ancora), fonte)
    ? { concetto_id: perBreve[d.concetto_id], testo: pulito(d.testo), ancora: pulito(d.ancora) } : null;
  if (g.domanda && !domanda) scartati++;

  return { punti, catena: catenaRegge ? anelli : [], parole, domanda, scartati };
}

// Il pezzo citato sta nel racconto: uguale a parole intere, o regge come un'ancora (il
// modello a volte toglie un «allora» o un «ehm» in mezzo).
// Oltre MAX_ANCORA caratteri non vale né l'uno né l'altro: la frase si controllerebbe solo a metà.
const MIN_PAROLE_DETTE = 3;
const nelRacconto = (frase, racconto) => frase.length <= MAX_ANCORA && (aParoleIntere(racconto, frase) || ancoraRegge(frase, racconto));

// grezza: { esiti: [{ concetto_id: "c1", esito, frase_detta }] }; racconto: il testo detto.
// → { esiti: [{ concetto_id: uuid, esito, frase_detta }] nell'ordine dei concetti, toccati, totale }
export function esitiRacconto(argomento, grezza, racconto) {
  const concetti = concettiInOrdine(argomento.concetti);
  const perBreve = perBreveDi(concetti);
  const detto = normalizza(racconto);
  const da = {};
  lista(grezza && grezza.esiti).forEach((e) => {
    const id = perBreve[e && e.concetto_id];
    if (!id || da[id]) return;
    const frase = pulito(e.frase_detta);
    const esito = ESITI_RACCONTO.includes(e.esito) && e.esito !== "saltato" && frase && nelRacconto(frase, detto) ? e.esito : "saltato";
    da[id] = { concetto_id: id, esito, frase_detta: esito === "saltato" ? "" : frase };
  });
  // Una frase di meno di 3 parole non prova niente; la stessa frase per due concetti non ne prova nessuno.
  const volte = {};
  Object.values(da).forEach((x) => { if (x.frase_detta) { const k = normalizza(x.frase_detta); volte[k] = (volte[k] || 0) + 1; } });
  Object.values(da).forEach((x) => {
    const k = normalizza(x.frase_detta);
    if (x.esito !== "saltato" && (k.split(" ").length < MIN_PAROLE_DETTE || volte[k] > 1)) { x.esito = "saltato"; x.frase_detta = ""; }
  });
  const esiti = concetti.map((c) => da[c.id] || { concetto_id: c.id, esito: "saltato", frase_detta: "" });
  return { esiti, toccati: esiti.filter((x) => x.esito !== "saltato").length, totale: esiti.length };
}
