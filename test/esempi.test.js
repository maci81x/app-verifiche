// Issue #28 (resto): esempi svolti che si ritirano piano piano ed esercizi mescolati (esempi.js), senza browser.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "formule.js", "figure.js", "compito.js", "classe-app.js", "esempi.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const json = (expr) => JSON.parse(vm.runInContext("JSON.stringify(" + expr + ")", ctx));
const run = (expr) => vm.runInContext(expr, ctx);

const P = [{ testo: "a" }, { testo: "b" }, { testo: "c" }, { testo: "d" }];
test("esempio completo, poi manca l'ultimo passo, poi due, poi nessun passo", () => {
  assert.deepEqual(json(`passiVisibili(${JSON.stringify(P)}, 0)`), { visibili: 4, nascosti: 0 });
  assert.deepEqual(json(`passiVisibili(${JSON.stringify(P)}, 1)`), { visibili: 3, nascosti: 1 });
  assert.deepEqual(json(`passiVisibili(${JSON.stringify(P)}, 2)`), { visibili: 2, nascosti: 2 });
  assert.deepEqual(json(`passiVisibili(${JSON.stringify(P)}, 3)`), { visibili: 0, nascosti: 4 });
  assert.deepEqual(json(`passiVisibili([{ testo: "a" }, { testo: "b" }], 2)`), { visibili: 0, nascosti: 2 });
  assert.equal(run("GRADINI_ESEMPI.length"), 4);
  assert.equal(run("GRADINI_ESEMPI[0]"), "Esempio svolto");
  assert.match(run("GRADINI_ESEMPI[3]"), /tocca a te/i);
  assert.doesNotMatch(run("GRADINI_ESEMPI.join(' ')"), /sol\*|sola|solo\b/);
});

test("esercizi mescolati: mai due dello stesso tipo di fila, se si può", () => {
  const es = [["A", 1], ["A", 2], ["A", 3], ["B", 4], ["B", 5], ["C", 6]].map(([t, n]) => ({ tipo_id: t, n }));
  const m = json(`mescolaPerTipo(${JSON.stringify(es)}, (e) => e.tipo_id)`);
  assert.deepEqual(m.map((e) => e.n), [1, 4, 6, 2, 5, 3]);
  assert.equal(m.length, es.length);
  assert.deepEqual(json(`mescolaPerTipo([], (e) => e)`), []);
  // un tipo solo: resta com'è
  assert.deepEqual(json(`mescolaPerTipo([{ t: 1 }, { t: 1 }], (e) => e.t)`), [{ t: 1 }, { t: 1 }]);
});

test("ripassi dovuti mescolati per strategia", () => {
  const v = (s, n) => ({ compito: { testo: "c" + n, strategia: { nome: s } }, n });
  const m = json(`ripassiMescolati(${JSON.stringify([v("Ritroso", 1), v("Ritroso", 2), v("Parte-intero", 3)])})`);
  assert.deepEqual(m.map((x) => x.n), [1, 3, 2]);
});

test("fine degli esempi: preciso, solo con quello che è successo", () => {
  assert.equal(run("fineEsempi([undefined, true, true, true])"), "L'ultimo l'hai fatto senza passi: 3 su 3 al primo colpo.");
  assert.match(run("fineEsempi([undefined, true, false, false])"), /^1 su 3 al primo colpo\. Riprova l'ultimo gradino/);
});

// la scaletta dell'esame (esame.js, client)
const ctx2 = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "formule.js", "figure.js", "compito.js", "classe-app.js", "esame.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx2);
test("scaletta dell'esame: partenza, tappe numerate con materia e collegamento, concetti, domande; testo del modello sempre escapato", () => {
  const E = { titolo: "La guerra <e> le parole", partenza: { argomento: { id: "u-1", titolo: "La Prima guerra mondiale", materia: "Storia" }, apertura: "Parto dalle trincee." },
    tappe: [{ argomento: { id: "u-2", titolo: "Ungaretti", materia: "Italiano" }, collegamento: "Ungaretti scrive al fronte.", concetti: ["Il porto sepolto"] }],
    domande: [{ argomento: { id: "u-1", titolo: "La Prima guerra mondiale", materia: "Storia" }, testo: "Perché Caporetto?" }], consigli: ["Parla piano."] };
  const h = vm.runInContext(`htmlScaletta(${JSON.stringify(E)})`, ctx2);
  assert.match(h, /La guerra &lt;e&gt; le parole/);
  assert.match(h, /Si parte da/);
  assert.match(h, /La Prima guerra mondiale/);
  assert.match(h, /Parto dalle trincee\./);
  assert.match(h, /Italiano/);
  assert.match(h, /Ungaretti scrive al fronte\./);
  assert.match(h, /Il porto sepolto/);
  assert.match(h, /Perché Caporetto\?/);
  assert.match(h, /collegamento proposto/i); // il collegamento è un'idea, non un fatto del quaderno
  assert.doesNotMatch(h, / · |→/);
});

test("i passi che si ritirano sono quelli della soluzione: il controllo finale non conta", () => {
  const p = [{ testo: "Sommiamo le frazioni" }, { testo: "Frazione che resta" }, { testo: "Dalla parte all'intero" }, { testo: "Controllo: 200 + 50 = 250." }];
  assert.deepEqual(json(`passiDaRitirare(${JSON.stringify(p)})`).map((x) => x.testo), ["Sommiamo le frazioni", "Frazione che resta", "Dalla parte all'intero"]);
  assert.equal(json(`passiDaRitirare([{ testo: "Verifica: 3 × 4 = 12" }, { testo: "a" }])`).length, 2); // solo in fondo
});

test("ripasso del giorno: il prossimo ha una strategia diversa dall'ultimo fatto", () => {
  const v = (s, n) => ({ compito: { testo: "c" + n, strategia: { nome: s } }, n });
  const dovuti = [v("Ritroso", 1), v("Ritroso", 2), v("Parte-intero", 3)];
  assert.equal(json(`prossimoRipasso(${JSON.stringify(dovuti)}, "Ritroso")`).n, 3);
  assert.equal(json(`prossimoRipasso(${JSON.stringify(dovuti)}, "Parte-intero")`).n, 1);
  assert.equal(json(`prossimoRipasso(${JSON.stringify([v("Ritroso", 1)])}, "Ritroso")`).n, 1); // non c'è altro
  assert.equal(json(`prossimoRipasso([], "x")`), null);
});

test("fine degli esempi con meno di quattro esempi: niente gradino che non c'è", () => {
  assert.equal(run("fineEsempi([undefined, true, true], 3)"), "Hai fatto tutti gli esempi che avevo: 2 su 2 al primo colpo.");
  assert.equal(run("fineEsempi([undefined, true, true, true], 4)"), "L'ultimo l'hai fatto senza passi: 3 su 3 al primo colpo.");
});

test("esempio non ancora giusto: i passi si mostrano con cosa fare (confrontare), non solo «Ecco tutti i passi»", () => {
  assert.match(run("MSG_ESEMPIO_NON_ANCORA"), /confronta/i);
});
