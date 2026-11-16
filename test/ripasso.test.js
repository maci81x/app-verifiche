// Issue #21: ripasso guidato, «prima provi, poi leggi» (senza browser).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "compito.js", "piano.js", "ripasso.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));
const J = JSON.stringify;

const OGGI = "2026-11-16"; // lunedì
const arg = (stati, extra = {}) => ({ id: "A", materia: "storia", titolo: "La peste", concetti: stati.map((s, i) => ({ id: "c" + i, titolo: "Punto " + i, stato: s, peso: 2 })), ...extra });
const scad = (tipo, data, extra = {}) => ({ id: "s", materia: "storia", tipo, data, argomento_id: "A", ...extra });
const consiglio = (a, sc = []) => json(`consiglioArgomento(${J(a)}, ${J(sc)}, ${J(OGGI)})`);

test("consiglio: mai provato → ripasso", () => {
  const c = consiglio(arg(["mai", "mai", "mai"]));
  assert.equal(c.chiave, "ripassa");
  assert.match(c.motivo, /^Io partirei dal ripasso: non hai ancora provato nessun punto\.$/);
});

test("consiglio: molti rossi → ripasso, con la verifica in calendario nel motivo", () => {
  const c = consiglio(arg(["rosso", "rosso", "verde", "giallo", "verde"]), [scad("scritta", "2026-11-18")]);
  assert.equal(c.chiave, "ripassa");
  assert.equal(c.motivo, "Io partirei dal ripasso: hai due punti rossi e la verifica è mercoledì.");
  // un'interrogazione vicina non batte due rossi: prima si ripassa
  assert.equal(consiglio(arg(["rosso", "rosso", "verde"]), [scad("orale", "2026-11-17")]).motivo,
    "Io partirei dal ripasso: hai due punti rossi e l'interrogazione è domani.");
});

test("consiglio: quasi tutto verde → verifica", () => {
  const c = consiglio(arg(["verde", "verde", "verde", "verde", "giallo"]));
  assert.equal(c.chiave, "verifica");
  assert.match(c.motivo, /^Io farei la verifica: 4 punti su 5 li sai\.$/);
});

test("consiglio: interrogazione in calendario → interrogami", () => {
  const c = consiglio(arg(["verde", "verde", "giallo", "rosso"]), [scad("orale", "2026-11-19")]);
  assert.equal(c.chiave, "interroga");
  assert.equal(c.motivo, "Io mi farei interrogare: l'interrogazione è giovedì.");
  // scadenza di un'altra materia o già passata: non conta
  assert.equal(consiglio(arg(["verde", "verde", "giallo", "rosso"]), [scad("orale", "2026-11-19", { materia: "scienze", argomento_id: null })]).chiave, "ripassa");
  assert.equal(consiglio(arg(["verde", "verde", "giallo", "rosso"]), [scad("orale", "2026-11-10")]).chiave, "ripassa");
  // senza argomento vale la materia
  assert.equal(consiglio(arg(["verde", "verde", "giallo", "rosso"]), [scad("orale", "2026-11-19", { argomento_id: null, materia: "Storia" })]).chiave, "interroga");
});

test("consiglio: le scelte si ordinano con la consigliata in cima", () => {
  const s = json(`ordineScelte(${J(arg(["verde"]))}, "interroga")`);
  assert.deepEqual(s.map((x) => x.chiave), ["interroga", "verifica", "ripassa"]);
  assert.equal(s[0].consigliata, true);
  assert.match(s.find((x) => x.chiave === "ripassa").spiega, /Prima provi tu, poi leggiamo cosa c'è sul quaderno/);
});

test("punti del ripasso: al massimo 5, prima i rossi, poi i Quasi, i mai provati, i verdi", () => {
  const a = arg(["verde", "mai", "rosso", "giallo", "verde", "rosso", "mai"]);
  assert.deepEqual(json(`puntiDaRipassare(${J(a.concetti)})`), ["c2", "c5", "c3", "c1", "c6"]);
  assert.deepEqual(json(`puntiDaRipassare(${J(a.concetti.slice(0, 2))})`), ["c1", "c0"]);
});

test("ritorno: un punto non riuscito torna dopo altri due punti, una volta sola", () => {
  let coda = json(`codaIniziale(["a", "b", "c", "d", "e"])`);
  assert.deepEqual(coda.map((p) => p.tipo), ["prova", "prova", "prova", "prova", "prova", "parole"]);
  coda = json(`dopoEsito(${J(coda)}, 0, 3)`); // «a» non riuscito
  assert.deepEqual(coda.map((p) => p.concetto_id + ":" + p.tipo).slice(0, 4), ["a:prova", "b:prova", "c:prova", "a:ritorno"]);
  assert.equal(json(`dopoEsito(${J(coda)}, 1, 9)`).length, coda.length, "un punto riuscito non torna");
  const giallo = json(`dopoEsito(${J(coda)}, 1, 6)`);
  assert.equal(giallo.findIndex((p) => p.concetto_id === "b" && p.tipo === "ritorno"), 4, "anche un Quasi torna, dopo altri due passi");
  // il ritorno sbagliato non torna una seconda volta
  assert.equal(json(`dopoEsito(${J(coda)}, 3, 0)`).length, coda.length);
  // in fondo: torna prima di «Spiegalo con parole tue», che resta l'ultimo passo
  const fine = json(`dopoEsito(${J(json(`codaIniziale(["a", "b"])`))}, 1, 2)`);
  assert.deepEqual(fine.map((p) => p.concetto_id + ":" + p.tipo), ["a:prova", "b:prova", "b:ritorno", "null:parole"]);
});

test("Spiegalo con parole tue: sul punto andato meglio, a parità il più recente", () => {
  const fatti = [{ concetto_id: "a", tipo: "prova", punti: 9 }, { concetto_id: "b", tipo: "prova", punti: 9 }, { concetto_id: "c", tipo: "prova", punti: 2 }];
  assert.equal(run(`concettoParoleTue(${J(fatti)})`), "b");
  assert.equal(run(`concettoParoleTue(${J([...fatti, { concetto_id: "c", tipo: "ritorno", punti: 10 }])})`), "c");
  const d = json(`domandaParoleTue({ id: "a", titolo: "La peste nera", ancora: "La peste arrivò nel 1347", descrizione: "arrivo" })`);
  assert.equal(d.testo, "Spiega «La peste nera» con parole tue, come a un'amica o un amico.");
  assert.equal(d.tipo, "aperta");
  assert.match(d.risposta_attesa, /1347/);
});

test("esito con le parole della issue e barra «3 di 4»", () => {
  assert.deepEqual(json(`esitoRipasso(3)`), { stato: "rosso", testo: "Non ancora. Ora lo leggiamo insieme." });
  assert.deepEqual(json(`esitoRipasso(6)`), { stato: "giallo", testo: "Quasi. Guarda cosa manca." });
  assert.deepEqual(json(`esitoRipasso(8)`), { stato: "verde", testo: "Ci sei." });
  assert.equal(run(`barraRipasso(2, [1, 2, 3, 4])`), "3 di 4");
});

const fineSessione = (fatti, prima, ms) => json(`riepilogoRipasso(${J({ fatti, prima, titoli: { a: "Arrivo", b: "Cause", c: "Date" }, inizio: 0, fine: ms })})`);

test("fine sessione: minuti veri, prima e dopo, complimento solo se un rosso è diventato verde", () => {
  const fatti = [
    { concetto_id: "a", tipo: "prova", punti: 9, sicurezza: "ci" },
    { concetto_id: "b", tipo: "prova", punti: 2, sicurezza: "ci" },
    { concetto_id: "c", tipo: "prova", punti: 9, sicurezza: "forse" },
    { concetto_id: "b", tipo: "ritorno", punti: 8 },
    { concetto_id: "c", tipo: "parole", punti: 4 },
  ];
  const r = fineSessione(fatti, { a: "rosso", b: "rosso", c: "mai" }, 9.4 * 60000);
  assert.equal(r.minuti, 9);
  assert.deepEqual(r.punti.map((p) => [p.concetto_id, p.prima, p.dopo]), [["a", "rosso", "verde"], ["b", "rosso", "giallo"], ["c", "mai", "verde"]]);
  // lo stato dopo è la media delle risposte sul punto (prima prova e ritorno), «parole tue» escluso
  assert.equal(r.punti[1].media, 5);
  assert.equal(r.punti[2].media, 9);
  assert.equal(r.complimento, "«Arrivo» era da ripassare, adesso lo sai.");
  assert.equal(r.sicuri, "Su «Cause» eri a colpo sicuro, ma non ci hai preso: domani lo rivediamo per primo.");
  // nessun rosso diventato verde: nessun complimento
  assert.equal(fineSessione(fatti, { a: "verde", b: "rosso", c: "giallo" }, 60000).complimento, null);
  // meno di mezzo minuto vale 1 minuto, non 0
  assert.equal(fineSessione(fatti, {}, 10000).minuti, 1);
  const due = fineSessione([{ concetto_id: "a", tipo: "prova", punti: 1, sicurezza: "ci" }, { concetto_id: "c", tipo: "prova", punti: 0, sicurezza: "ci" }], {}, 60000);
  assert.equal(due.sicuri, "Su «Arrivo» e «Date» eri a colpo sicuro, ma non ci hai preso: domani li rivediamo per primi.");
  assert.equal(fineSessione([{ concetto_id: "a", tipo: "prova", punti: 1, sicurezza: "caso" }], {}, 60000).sicuri, null);
});

test("fine sessione: la riga di domani viene dal piano", () => {
  assert.equal(run(`rigaDomani({ minuti: 8, punti: [{ titolo: "Arrivo" }, { titolo: "Cause" }, { titolo: "Date" }] })`), "Domani, 8 minuti: Arrivo, Cause e Date.");
  assert.equal(run(`rigaDomani({ minuti: 0, punti: [] })`), "");
});
