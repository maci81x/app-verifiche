// Issue #22, la parte dell'app: mappa per paragrafi, «Le 5 cose da sapere», «Raccontalo in 2 minuti» (senza browser).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "stampa.js", "aiuto.js", "mappa-card.js", "studio.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));
const blocchi = (testo, nodi, nFoto = 1) => json(`blocchiMappa(${JSON.stringify(testo)}, ${JSON.stringify(nodi)}, ${nFoto})`);

const NODI = [
  { id: "c1", ancora: "Nel 1347 alcune navi genovesi portarono la peste a Messina" },
  { id: "c2", ancora: "Le pulci dei topi trasmettevano la malattia" },
  { id: "c3", ancora: "Morì circa un terzo della popolazione europea" },
  { id: "c4", ancora: "le campagne si spopolarono per molti anni" },
];

test("mappa per paragrafi: titoli di paragrafo e pagine dalla trascrizione, blocchi in ordine di lettura", () => {
  const testo = [
    "pag. 24", "1. Dove e quando",
    "La peste nera arrivò dall'Asia. Nel 1347 alcune navi genovesi portarono la peste a Messina, e da lì il contagio si allargò.",
    "", "**Come si diffondeva**",
    "Le pulci dei topi trasmettevano la malattia agli uomini che vivevano in città sporche e affollate.",
    "pag. 25", "## Le conseguenze",
    "Morì circa un terzo della popolazione europea. Le campagne si spopolarono per molti anni e i salari crebbero.",
  ].join("\n");
  const b = blocchi(testo, NODI);
  assert.deepEqual(b.map((x) => [x.n, x.titolo, x.pagine, x.ids]), [
    [1, "Dove e quando", [24, 24], ["c1"]],
    [2, "Come si diffondeva", [24, 24], ["c2"]],
    [3, "Le conseguenze", [25, 25], ["c3", "c4"]],
  ]);
  assert.equal(run(`etichettaBlocco(${JSON.stringify(b[0])})`), "Dove e quando — pag. 24");
  assert.equal(run(`etichettaBlocco({ n: 1, titolo: "Le cause", pagine: [24, 26], ids: [] })`), "Le cause — pagg. 24-26");
  assert.equal(run(`etichettaBlocco({ n: 1, titolo: "", pagine: [12, 12], ids: [] })`), "Pagina 12");
});

test("mappa per paragrafi: il numero di pagina stampato in fondo vale per il testo sopra; senza titoli, un blocco per pagina", () => {
  const testo = [
    "Nel 1347 alcune navi genovesi portarono la peste a Messina, e da lì il contagio si allargò in poco tempo.",
    "Le pulci dei topi trasmettevano la malattia agli uomini che vivevano in città sporche e affollate.",
    "24",
    "Morì circa un terzo della popolazione europea. Le campagne si spopolarono per molti anni e i salari crebbero.",
    "25",
  ].join("\n");
  assert.deepEqual(blocchi(testo, NODI).map((x) => [x.n, x.titolo, x.pagine, x.ids]), [
    [1, "", [24, 24], ["c1", "c2"]],
    [2, "", [25, 25], ["c3", "c4"]],
  ]);
  // in cima alla pagina: vale per il testo sotto
  const inCima = ["24", NODI[0].ancora + " e altro ancora per fare una riga lunga.", "25", NODI[2].ancora + " e altro ancora."].join("\n");
  assert.deepEqual(blocchi(inCima, NODI.slice(0, 3)).map((x) => [x.pagine, x.ids]), [[[24, 24], ["c1", "c2"]], [[25, 25], ["c3"]]]);
});

test("mappa per paragrafi: senza titoli né pagine si divide per foto; una frase non trovata segue il punto prima", () => {
  const testo = NODI[0].ancora + ". " + "x ".repeat(80) + "\n" + NODI[1].ancora + ".\n" + "y ".repeat(80) + NODI[2].ancora + ".";
  const b = blocchi(testo, [...NODI.slice(0, 3), { id: "c9", ancora: "una frase che negli appunti non c'è proprio" }], 2);
  // «Foto N» sarebbe una stima: la trascrizione non dice dove finisce una foto, quindi «Parte N»
  assert.deepEqual(b.map((x) => [x.titolo, x.ids]), [["Parte 1", ["c1", "c2"]], ["Parte 2", ["c3", "c9"]]]);
  // una foto sola e niente segni: un blocco solo (la mappa resta com'era)
  assert.equal(blocchi(testo, NODI.slice(0, 3), 1).length, 1);
});

test("mappa per paragrafi: un numero da solo che non segue le pagine (un anno, un elenco) non è una pagina", () => {
  const testo = ["24", NODI[0].ancora + " e altro testo ancora per la riga.", "3", NODI[1].ancora + " e altro testo ancora.", "25", NODI[2].ancora + "."].join("\n");
  assert.deepEqual(blocchi(testo, NODI.slice(0, 3)).map((x) => [x.pagine, x.ids]), [[[24, 24], ["c1", "c2"]], [[25, 25], ["c3"]]]);
});

test("mappa a blocchi: titolo numerato con la pagina, sotto i punti con il semaforo; il punto si apre sotto", () => {
  const albero = { titolo: "La peste", nodi: [
    { id: "c1", titolo: "Arrivo", ancora: "nel 1347", fonte: "appunti", figli: [{ id: "web-1", titolo: "Caffa", testo: "t", url: "https://x.it", fonte: "web", figli: [] }] },
    { id: "c2", titolo: "Contagio", ancora: "le pulci", fonte: "appunti", figli: [] }] };
  const b = [{ n: 1, titolo: "Dove e quando", pagine: [24, 24], ids: ["c1"] }, { n: 2, titolo: "Come", pagine: null, ids: ["c2"] }];
  const html = run(`htmlAlberoMappa(${JSON.stringify(albero)}, { c1: "rosso" }, ${JSON.stringify(b)})`);
  assert.match(html, /<span class="m-blocco-n"[^>]*>1<\/span>\s*Dove e quando — pag\. 24/);
  assert.ok(html.indexOf('data-id="c1"') < html.indexOf("Come") && html.indexOf("Come") < html.indexOf('data-id="c2"'));
  assert.match(html, /data-id="c1" data-l="1" data-s="rosso" aria-expanded="false"/);
  assert.match(html, /data-id="web-1"[^>]*aria-haspopup="dialog"/); // il web apre la card con il link
  // un blocco solo: la mappa di prima, senza titoli
  assert.doesNotMatch(run(`htmlAlberoMappa(${JSON.stringify(albero)}, {}, [{ n: 1, titolo: "", pagine: null, ids: ["c1", "c2"] }])`), /m-blocco/);
});

test("punto aperto sotto: frase del quaderno evidenziata e «Provami su questo»", () => {
  const h = run(`htmlPuntoAperto({ id: "c1", titolo: "Arrivo", ancora: "nel 1347 <navi>" }, { concetto: { id: "c1", titolo: "Arrivo", sintesi: "In breve." }, errore: "", stato: "rosso" })`);
  assert.match(h, /<mark class="evidenzia">nel 1347 &lt;navi&gt;<\/mark>/);
  assert.match(h, /data-azione="prova"[^>]*>Provami su questo</);
  assert.match(h, /In breve\./);
  const sotto = run(`htmlPuntoAperto({ id: "c1-1", titolo: "Navi", ancora: "navi" }, { concetto: { id: "c1", titolo: "Arrivo" } })`);
  assert.match(sotto, />Provami su «Arrivo»</);
});

const CONCETTI = [
  { id: "c1", titolo: "Arrivo della peste", ancora: "Nel 1347 alcune navi genovesi portarono la peste a Messina", peso: 3, ordine: 0, errore_appunti: null },
  { id: "c2", titolo: "Il contagio", ancora: "Le pulci dei topi trasmettevano la malattia", peso: 2, ordine: 1, errore_appunti: "negli appunti: le zanzare invece delle pulci" },
  { id: "c3", titolo: "Le conseguenze", ancora: "Morì circa un terzo della popolazione europea", peso: 3, ordine: 2, errore_appunti: null },
];
const dom = (concetto_id, testo, data, risposta, extra = {}) => ({ concetto_id, testo, tipo: "aperta", opzioni: null, sessioni: { data }, risposte: [risposta], ...extra });

test("occhio a questo: l'errore più ripetuto di chi studia, con la sua risposta; altrimenti l'errore degli appunti", () => {
  const righe = [
    dom("c3", "Quanti morirono?", "2026-11-01T10:00:00Z", { testo: "la metà", punteggio: 3 }),
    dom("c3", "Che cosa successe alla popolazione?", "2026-11-10T10:00:00Z", { testo: "", punteggio: 0 }),
    dom("c1", "Chi portò la peste?", "2026-11-12T10:00:00Z", { scelta: 2, punteggio: 0 }, { tipo: "chiusa", opzioni: ["navi genovesi", "mongoli", "i francesi", "i turchi"] }),
    dom("c1", "Quando?", "2026-11-12T10:00:00Z", { testo: "nel 1347", punteggio: 10 }),
  ];
  const o = json(`occhioDaProve(${JSON.stringify(CONCETTI)}, ${JSON.stringify(righe)})`);
  assert.equal(o.concetto.id, "c3");
  assert.equal(o.domanda, "Che cosa successe alla popolazione?");
  assert.equal(o.mia, "");
  assert.match(run(`htmlOcchio(${JSON.stringify(o)})`), /Alla domanda «Che cosa successe alla popolazione\?» non hai risposto\./);
  const chiusa = json(`occhioDaProve(${JSON.stringify(CONCETTI)}, ${JSON.stringify(righe.slice(2))})`);
  assert.equal(chiusa.mia, "i francesi");
  assert.match(run(`htmlOcchio(${JSON.stringify(chiusa)})`), /hai risposto «i francesi»/);
  const quaderno = json(`occhioDaProve(${JSON.stringify(CONCETTI)}, [])`);
  assert.equal(quaderno.concetto.id, "c2");
  assert.match(run(`htmlOcchio(${JSON.stringify(quaderno)})`), /Sul quaderno c'è un errore: le zanzare invece delle pulci/);
  assert.equal(run(`occhioDaProve(${JSON.stringify(CONCETTI.map((c) => ({ ...c, errore_appunti: null })))}, [])`), null);
});

const CINQUE = {
  punti: [
    { concetto_id: "c1", etichetta: "Quando", testo: "Nel 1347 navi genovesi portarono la peste a Messina.", chiave: "Nel 1347 alcune navi genovesi portarono la peste a Messina" },
    { concetto_id: "c3", etichetta: "Perché conta", testo: "", chiave: "Morì circa un terzo della popolazione europea" },
  ],
  catena: [], parole: ["contagio", "pulci"],
  domanda: { concetto_id: "c3", testo: "Perché mancavano braccia nei campi?", ancora: "Morì circa un terzo della popolazione europea" },
};

test("5 cose: punti numerati con l'etichetta e la frase del quaderno evidenziata; le sezioni vuote non compaiono", () => {
  const h = run(`htmlCinque(${JSON.stringify(CINQUE)}, {})`);
  assert.match(h, /<b>Quando:<\/b> Nel 1347 navi genovesi portarono la peste a Messina\./);
  assert.match(h, /<b>Perché conta:<\/b> <mark class="evidenzia">Morì circa/);
  assert.equal((h.match(/<mark class="evidenzia">/g) || []).length, 3);
  assert.doesNotMatch(h, /causa e effetto/); // niente catena nel materiale: la sezione non c'è
  assert.match(h, /Le parole che fanno bella figura/);
  assert.match(h, /La domanda che ti farà la prof/);
  const conCatena = run(`htmlCinque(${JSON.stringify({ ...CINQUE, catena: [{ testo: "Morì un europeo su tre.", ancora: "a b" }, { testo: "", ancora: "c d" }] })}, {})`);
  assert.match(conCatena, /Per ragionare: causa e effetto/);
  assert.equal((conCatena.match(/<\/span> quindi</g) || []).length, 1);
  assert.equal(run(`titoloCinque(5)`), "Le 5 cose da sapere");
  assert.equal(run(`titoloCinque(1)`), "La cosa da sapere");
  assert.equal(run(`testoProvami(2)`), "Ora provami su queste 2");
  assert.equal(run(`testoProvami(1)`), "Ora provami su questa");
  assert.equal(run(`cinqueValide(${JSON.stringify(CINQUE)})`), true);
  assert.equal(run(`cinqueValide({ punti: [] })`), false);
  assert.equal(run(`cinqueValide(null)`), false);
});

test("racconto: «Hai toccato 2 punti su 3. Hai saltato: …» e ogni punto con la frase del quaderno", () => {
  const r = { esiti: [
    { concetto_id: "c1", esito: "detto", frase_detta: "nel 1347 le navi genovesi" },
    { concetto_id: "c2", esito: "impreciso", frase_detta: "la trasmettevano le zanzare" },
    { concetto_id: "c3", esito: "saltato", frase_detta: "" }], toccati: 2, totale: 3 };
  assert.deepEqual(json(`frasiRacconto(${JSON.stringify(r)}, ${JSON.stringify(CONCETTI)})`), ["Hai toccato 2 punti su 3.", "Hai saltato: Le conseguenze."]);
  const h = run(`htmlEsitoRacconto(${JSON.stringify(r)}, ${JSON.stringify(CONCETTI)})`);
  assert.ok(h.indexOf("Le conseguenze") < h.indexOf("Il contagio") && h.indexOf("Il contagio") < h.indexOf("Arrivo della peste")); // prima i saltati
  assert.match(h, /data-s="rosso"><i aria-hidden="true">✕<\/i> Saltato/);
  assert.match(h, /data-s="giallo"><i aria-hidden="true">▲<\/i> Impreciso/);
  assert.match(h, /Hai detto: «la trasmettevano le zanzare»/);
  assert.match(h, /<mark class="evidenzia">Morì circa/);
  assert.deepEqual(json(`frasiRacconto({ esiti: [], toccati: 0, totale: 3 }, [])`), ["Non ho sentito nessun punto. Riprova seguendo i blocchi.", ""]);
  assert.deepEqual(json(`frasiRacconto({ esiti: [], toccati: 3, totale: 3 }, [])`), ["Hai toccato tutti i 3 punti.", ""]);
  assert.deepEqual(json(`frasiRacconto({ esiti: [{ concetto_id: "c3", esito: "saltato" }], toccati: 1, totale: 2 }, ${JSON.stringify(CONCETTI)})`), ["Hai toccato 1 punto su 2.", "Hai saltato: Le conseguenze."]);
});

test("mappa: firme delle foto, legende e consegne di esercizi non sono titoli di paragrafo", () => {
  const dopo = "Un paragrafo di testo vero che spiega bene l'argomento della pagina con molte parole.";
  for (const riga of ["Jim Pintar/iStock Photo", "Legenda: metalli (giallo), non metalli (azzurro)", "Disegna una [?] l'atomo di [?]", "Trova la formula chimica", "Completa la tabella"])
    assert.equal(run(`titoloDiRiga(${JSON.stringify(riga)}, ${JSON.stringify(dopo)})`), null, riga);
  assert.equal(run(`titoloDiRiga("Il legame ionico", ${JSON.stringify(dopo)})`), "Il legame ionico");
});
