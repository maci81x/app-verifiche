// Issue #28, la parte dell'app: errore tipico per nome, mini-ripasso, poesia a memoria, INVALSI (senza browser).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "formule.js", "figure.js", "compito.js", "classe-app.js", "poesia.js", "invalsi.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));

test("classe del profilo come numero", () => {
  for (const [v, n] of [["1", 1], ["2ª media", 2], ["terza", 3], ["", null], ["4", null]]) assert.equal(run(`classeNumero(${JSON.stringify(v)})`), n);
});

const ET = { errore_tipico: { id: "frazioni-somma-denominatori", errore: "Sommare i denominatori", esempio: "1/2 + 1/3 = 2/5",
  spiegazione: "Mezza pizza più mezza pizza fa una pizza intera.", argomento: { id: "ma2-frazioni-operazioni", titolo: "Operazioni con le frazioni" } } };

test("errore tipico detto per nome; con il prerequisito, il mini-ripasso", () => {
  const solo = run(`htmlErroreTipico(${JSON.stringify({ ...ET, prerequisito: null })}, "e0")`);
  assert.match(solo, /Errore tipico/);
  assert.match(solo, /Sommare i denominatori/);
  assert.match(solo, /Mezza pizza/);
  assert.doesNotMatch(solo, /data-prereq/);
  const pre = run(`htmlErroreTipico(${JSON.stringify({ ...ET, prerequisito: { id: "ma2-frazioni-operazioni", titolo: "Operazioni con le frazioni", classe: 2 } })}, "e0")`);
  assert.match(pre, /Viene da «Operazioni con le frazioni» della 2ª media/);
  assert.match(pre, /data-prereq="e0"/);
  assert.equal(run(`htmlErroreTipico({ esito: "sbagliato" }, "e0")`), "");
  assert.equal(run(`esitoMiniRipasso([true, true, true])`), "Ripasso fatto: 3 su 3. Adesso torna all'esercizio.");
  assert.match(run(`esitoMiniRipasso([true, false, true])`), /^2 su 3 al primo colpo/);
  assert.equal(run(`esitoMiniRipasso([])`), "");
});

const POESIA = { titolo: "San Martino", autore: "Giosuè Carducci", strofe: [
  ["La nebbia a gl'irti colli", "piovigginando sale,", "e sotto il maestrale", "urla e biancheggia il mar;"],
  ["ma per le vie del borgo", "dal ribollir de' tini", "va l'aspro odor de i vini", "l'anime a rallegrar."]] };

test("poesia: le parole spariscono un po' alla volta (una ogni cinque, metà, strofe intere)", () => {
  const conta = (liv) => { const v = json(`nascondiParole(${JSON.stringify(POESIA.strofe)}, ${liv})`).flat(2).filter((t) => t.parola);
    return { tot: v.length, nascoste: v.filter((t) => t.nascosta).length }; };
  const l0 = conta(0), l1 = conta(1), l2 = conta(2), l3 = conta(3);
  assert.equal(l0.nascoste, 0);
  assert.equal(l1.nascoste, Math.floor(l1.tot / 5));
  assert.equal(l2.nascoste, Math.floor(l2.tot / 2));
  assert.ok(l3.nascoste > l2.nascoste && l3.nascoste < l3.tot); // resta solo la prima parola di ogni strofa
  // la punteggiatura resta in vista, «gl'irti» si divide in due parole
  const v = json(`nascondiParole(${JSON.stringify(POESIA.strofe)}, 3)`);
  assert.equal(v[0][0][0].testo, "La"); assert.equal(v[0][0][0].nascosta, false);
  assert.ok(v[0][1].some((t) => !t.parola && t.testo.includes(",")));
  assert.equal(run(`LIVELLI_POESIA.length`), 4);
});

test("poesia: dove ti blocchi, con un po' di tolleranza per il riconoscimento vocale", () => {
  const tutto = POESIA.strofe.flat().join(" ");
  assert.deepEqual(json(`doveTiBlocchi(${JSON.stringify(POESIA.strofe)}, ${JSON.stringify(tutto.toLowerCase())})`), { completa: true, fino: 38, totale: 38 });
  // il riconoscimento sbaglia una parola («gli irti»): si va avanti
  const r1 = json(`doveTiBlocchi(${JSON.stringify(POESIA.strofe)}, "la nebbia agli irti colli piovigginando sale e sotto il maestrale urla e biancheggia il mare")`);
  assert.equal(r1.completa, false);
  assert.equal(r1.strofa, 2); assert.equal(r1.verso, 1); assert.equal(r1.parola, "ma");
  // si ferma a metà del secondo verso
  const r2 = json(`doveTiBlocchi(${JSON.stringify(POESIA.strofe)}, "la nebbia agli irti colli piovigginando")`);
  assert.deepEqual([r2.strofa, r2.verso, r2.parola], [1, 2, "sale"]);
  // salta un verso: blocco sul verso saltato
  const r3 = json(`doveTiBlocchi(${JSON.stringify(POESIA.strofe)}, "la nebbia a gli irti colli piovigginando sale urla e biancheggia il mar")`);
  assert.deepEqual([r3.strofa, r3.verso, r3.parola], [1, 3, "e"]);
  assert.equal(json(`doveTiBlocchi(${JSON.stringify(POESIA.strofe)}, "")`).fino, 0);
  assert.match(run(`fraseBlocco(${JSON.stringify(r3)})`), /^Qui ti blocchi: «e» \(strofa 1, verso 3\)\./);
  assert.match(run(`fraseBlocco({ completa: true, fino: 38, totale: 38 })`), /tutta/);
});

const DOMANDE = [
  { ambito: "Numeri", formato: "scelta_multipla", testo: "3/4 di 120?", opzioni: ["80", "90", "100", "30"], corretta: 1, risposta: "90" },
  { ambito: "Numeri", formato: "risposta_breve", testo: "Area del quadrato di lato 7 cm?", opzioni: [], corretta: 0, risposta: "49 cm²" },
  { ambito: "Dati e previsioni", formato: "vero_falso", testo: "La media di 4, 6, 8 è 6.", opzioni: ["Vero", "Falso"], corretta: 0, risposta: "Vero" },
  { ambito: "Relazioni e funzioni", formato: "completamento", testo: "2x + 3 = 11, x = ___", opzioni: [], corretta: 0, risposta: "4" },
  { ambito: "Spazio e figure", formato: "risposta_breve", testo: "Quanti lati ha un esagono?", opzioni: [], corretta: 0, risposta: "6" },
];

test("INVALSI: correzione delle risposte e punteggio per ambito", () => {
  const r = json(`correggiInvalsi(${JSON.stringify(DOMANDE)}, [1, "49", 0, " 4 ", "sei"])`);
  assert.deepEqual(r.esiti, [true, true, true, true, false]);
  assert.equal(r.giuste, 4); assert.equal(r.totale, 5);
  assert.deepEqual(r.ambiti, [{ ambito: "Numeri", giuste: 2, totale: 2 }, { ambito: "Dati e previsioni", giuste: 1, totale: 1 },
    { ambito: "Relazioni e funzioni", giuste: 1, totale: 1 }, { ambito: "Spazio e figure", giuste: 0, totale: 1 }]);
  assert.deepEqual(json(`correggiInvalsi(${JSON.stringify(DOMANDE)}, [])`).esiti, [false, false, false, false, false]);
  // numeri scritti in modi diversi, parole senza maiuscole e punto finale
  assert.equal(run(`rispostaInvalsiGiusta({ formato: "risposta_breve", risposta: "12,5 cm" }, "12.5")`), true);
  assert.equal(run(`rispostaInvalsiGiusta({ formato: "completamento", risposta: "went" }, "Went.")`), true);
  assert.equal(run(`rispostaInvalsiGiusta({ formato: "completamento", risposta: "went" }, "go")`), false);
});

test("INVALSI a tempo: due minuti a domanda, mm:ss", () => {
  assert.equal(run(`tempoInvalsi(5)`), 600);
  assert.equal(run(`orologioInvalsi(600)`), "10:00");
  assert.equal(run(`orologioInvalsi(65)`), "1:05");
  assert.equal(run(`orologioInvalsi(-3)`), "0:00");
});

test("INVALSI: numeri negativi scritti con il segno meno tipografico", () => {
  assert.equal(run(`rispostaInvalsiGiusta({ formato: "risposta_breve", risposta: "−3" }, "-3")`), true);
  assert.equal(run(`rispostaInvalsiGiusta({ formato: "risposta_breve", risposta: "-3" }, "−3")`), true);
  assert.equal(run(`rispostaInvalsiGiusta({ formato: "risposta_breve", risposta: "−3" }, "3")`), false);
});
