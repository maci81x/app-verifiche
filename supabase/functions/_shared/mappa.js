// Mappa concettuale di un argomento. JavaScript puro: lo usano la Edge Function e i test.
//
// Radice = l'argomento. Primo livello = i concetti del database, con il loro id,
// così mappa e semaforo parlano dello stesso oggetto. Sotto, i sotto-punti che il
// modello ricava dalla trascrizione: ognuno porta un'ancora presa dagli appunti,
// e quelli la cui ancora non regge (stesso filtro al 60% delle domande) vengono
// scartati insieme ai loro figli.
import { ancoraRegge, normalizza } from "./ancoraggio.js";
import { fontiScelte, FONTE_WEB } from "./web.js";

export const MAX_NODI = 25;

// Ogni nodo dice da dove viene. Per ora solo "appunti"; il web arriverà con un
// ticket a parte e non servirà mai per le domande di verifica.
const FONTE_APPUNTI = "appunti";

const lista = (v) => (Array.isArray(v) ? v : []);
const pulito = (v) => String(v == null ? "" : v).trim();

// Nodi di un sotto-albero, lui compreso: servono per contare gli scartati.
const contaNodi = (n) => 1 + lista(n && n.figli).reduce((s, f) => s + contaNodi(f), 0);

// I concetti al modello arrivano con id brevi (c1, c2...) nel loro ordine, come per
// le domande: un uuid ricopiato male farebbe perdere un ramo buono. Prompt e
// costruisciMappa usano entrambi concettiInOrdine, così gli id brevi coincidono.
export const idBreve = (i) => "c" + (i + 1);
export const concettiInOrdine = (concetti) => [...lista(concetti)].sort((x, y) => (x.ordine || 0) - (y.ordine || 0));

// Livelli sotto la radice: concetti, sotto-punti, dettagli.
export const MAX_LIVELLI = 3;

// Tiene i sotto-punti ben formati e ancorati. Oltre MAX_LIVELLI i figli si tagliano.
// scartati = ancora che non regge (o titolo vuoto); tagliati = oltre i limiti.
function sottoPunti(grezzi, idPadre, livello, fonte) {
  let scartati = 0, tagliati = 0;
  const figli = [];
  lista(grezzi).forEach((g) => {
    const titolo = pulito(g && g.titolo), ancora = pulito(g && g.ancora);
    if (!titolo || !ancoraRegge(ancora, fonte)) { scartati += contaNodi(g); return; }
    const id = idPadre + "-" + (figli.length + 1);
    let sotto = { figli: [], scartati: 0, tagliati: 0 };
    if (livello < MAX_LIVELLI) sotto = sottoPunti(g.figli, id, livello + 1, fonte);
    else tagliati += contaNodi(g) - 1;
    scartati += sotto.scartati; tagliati += sotto.tagliati;
    figli.push({ id, titolo, ancora, fonte: FONTE_APPUNTI, figli: sotto.figli });
  });
  return { figli, scartati, tagliati };
}

// Prende a turno il primo elemento di ogni gruppo, poi il secondo, e così via.
function aTurno(gruppi) {
  const fuori = [];
  const lungo = gruppi.reduce((m, g) => Math.max(m, g.length), 0);
  for (let j = 0; j < lungo; j++) gruppi.forEach((g) => { if (j < g.length) fuori.push(g[j]); });
  return fuori;
}

// Ritaglia i sotto-punti perché l'albero non superi MAX_NODI: i concetti restano
// tutti, poi un sotto-punto per concetto a giro, poi i dettagli allo stesso modo.
function nelLimite(rami) {
  let posti = Math.max(0, MAX_NODI - rami.length);
  const secondi = aTurno(rami.map((r) => r.figli)).slice(0, posti);
  posti -= secondi.length;
  const terzi = aTurno(secondi.map((f) => f.figli)).slice(0, posti);
  const tieni = new Set([...secondi, ...terzi]);
  const pota = (nodi) => nodi.filter((n) => tieni.has(n)).map((n) => ({ ...n, figli: pota(n.figli) }));
  return rami.map((r) => ({ ...r, figli: pota(r.figli) }));
}

// I concetti restano tutti, senza ripassare dal filtro: sono già stati ancorati quando
// sono stati estratti, e toglierne uno separerebbe la mappa dal semaforo.
// argomento: { titolo, materia, trascrizione, concetti: [{ id, titolo, ancora, peso, ordine }] }
// grezza: risposta del modello, { nodi: [{ concetto_id: "c1", figli: [{ titolo, ancora, figli }] }] }
export function costruisciMappa(argomento, grezza) {
  const concetti = concettiInOrdine(argomento.concetti);
  const fonte = normalizza(argomento.trascrizione);
  const perBreve = {};
  concetti.forEach((c, i) => { perBreve[idBreve(i)] = c.id; });

  let scartati = 0, tagliati = 0;
  const figliDi = {};
  lista(grezza && grezza.nodi).forEach((g) => {
    const id = perBreve[g && g.concetto_id];
    // Ramo di un concetto che non esiste, o ripetuto: non si attacca a niente.
    if (!id || figliDi[id]) { scartati += lista(g && g.figli).reduce((s, f) => s + contaNodi(f), 0); return; }
    const sotto = sottoPunti(g.figli, id, 2, fonte);
    scartati += sotto.scartati; tagliati += sotto.tagliati;
    figliDi[id] = sotto.figli;
  });

  const interi = concetti.map((c) => ({
    id: c.id, titolo: c.titolo, ancora: c.ancora, fonte: FONTE_APPUNTI,
    peso: Math.min(3, Math.max(1, Number(c.peso) || 2)), figli: figliDi[c.id] || [],
  }));
  const nodi = nelLimite(interi);
  const conta = (ns) => ns.reduce((t, n) => t + contaNodi(n), 0);
  tagliati += conta(interi) - conta(nodi);
  return { titolo: argomento.titolo, materia: argomento.materia, nodi, scartati, tagliati };
}

// ------------------------------------------------------------------ nodi dal web (issue #4)
// "Arricchisci dal web" aggiunge fino a 6 nodi con fonte "web", ognuno con il suo
// testo e il link a una fonte citata davvero. Si agganciano solo a concetti e
// sotto-punti degli appunti (la mappa resta a tre livelli) e non toccano i nodi
// degli appunti. Arricchire di nuovo sostituisce i nodi web di prima.
// L'azione `domande` non legge mai la mappa: il web non entra nella verifica.
export const MAX_NODI_WEB = 6;
const nodoDagliAppunti = (n) => n && n.fonte !== FONTE_WEB;

// Nodi a cui il modello può agganciare un nodo web, con id brevi n1, n2...
export function agganciMappa(albero) {
  const agganci = [];
  const visita = (nodi, livello) => lista(nodi).filter(nodoDagliAppunti).forEach((n) => {
    agganci.push({ breve: "n" + (agganci.length + 1), id: n.id, titolo: n.titolo });
    if (livello < 2) visita(n.figli, livello + 1);
  });
  visita(albero && albero.nodi, 1);
  return agganci;
}

// grezza: { nodi: [{ aggancio: "n2", titolo, testo, fonte: numero da 1 }] }
// → { albero, nodi: [{ id, titolo, testo, url, fonte: "web", aggancio: id del nodo }], aggiunti, scartati }
// fonti: le fonti citate nella ricerca (fontiCitate), nell'ordine dato al modello.
export function arricchisciMappa(albero, grezza, fonti) {
  const idDi = {};
  agganciMappa(albero).forEach((a) => { idDi[a.breve] = a.id; });
  let scartati = 0;
  const nuovi = [];
  lista(grezza && grezza.nodi).forEach((g) => {
    const padre = idDi[g && g.aggancio], titolo = pulito(g && g.titolo), testo = pulito(g && g.testo);
    const [fonte] = fontiScelte([g && g.fonte], fonti || []);
    if (!padre || !titolo || !testo || !fonte || nuovi.length >= MAX_NODI_WEB) { scartati++; return; }
    nuovi.push({ padre, nodo: { id: "web-" + (nuovi.length + 1), titolo, testo, url: fonte.url, fonte: FONTE_WEB, figli: [] } });
  });
  const ricostruisci = (nodi) => lista(nodi).filter(nodoDagliAppunti).map((n) => ({
    ...n, figli: [...ricostruisci(n.figli), ...nuovi.filter((x) => x.padre === n.id).map((x) => x.nodo)],
  }));
  return {
    albero: { ...albero, nodi: ricostruisci(albero.nodi) },
    nodi: nuovi.map((x) => ({ ...x.nodo, aggancio: x.padre })), // i nodi nuovi, ognuno con il nodo a cui si aggancia
    aggiunti: nuovi.length, scartati,
  };
}
