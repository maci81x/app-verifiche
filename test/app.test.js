// Logica di app.js caricata senza browser, come nei test di Shanghai Card.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, setTimeout, clearTimeout, setInterval, clearInterval });
vm.runInContext(readFileSync(new URL("../app.js", import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);

test("curva del voto del prototipo: 0% vale 3, 60% vale 6, 100% vale 10, al mezzo punto", () => {
  assert.deepEqual([0, 30, 60, 70, 75, 80, 90, 100].map((i) => run(`voto(${i})`)), [3, 4.5, 6, 7, 7.5, 8, 9, 10]);
  assert.equal(run("votoIt(6.5)"), "6,5");
  assert.equal(run("votoIt(7)"), "7");
});

test("indice pesato sui concetti, verdetto come nel prototipo", () => {
  const es = run(`calcolaEsito(
    [{id:"d1",concetto_id:"a",peso:3},{id:"d2",concetto_id:"a",peso:3},{id:"d3",concetto_id:"b",peso:1}],
    {d1:10,d2:6,d3:0})`);
  // a: media 8 (verde) peso 3; b: media 0 (rosso) peso 1 → (8*3+0)/4 = 6 → 60%
  assert.equal(es.indice, 60);
  assert.equal(es.voto, 6);
  assert.equal(es.rossiPesanti, 0); // il rosso pesa 1: non conta fra quelli importanti
  assert.equal(es.pronta, false);
  const tutto = run(`calcolaEsito([{id:"d1",concetto_id:"a",peso:2}],{d1:9})`);
  assert.equal(tutto.pronta, true);
});

test("semaforo: da 8 verde, da 5 giallo, sotto rosso", () => {
  assert.deepEqual([8, 7.9, 5, 4.9].map((m) => run(`statoDaMedia(${m})`)), ["verde", "giallo", "giallo", "rosso"]);
});

test("mescola restituisce sempre tutte le posizioni", () => {
  for (let k = 0; k < 50; k++) assert.equal(run("JSON.stringify(mescola(4).sort())"), "[0,1,2,3]");
});

test("andamento: in salita, in calo o stabile sulle ultime dieci", () => {
  assert.equal(run("andamento([5,6,7]).verso"), "su");
  assert.equal(run("andamento([8,7,6]).verso"), "giu");
  assert.equal(run("andamento([7,7.5,7]).verso"), "pari");
  assert.equal(run("andamento([3,3,3,3,3,10,10,10,10,10,10,10]).voti.length"), 10);
});

test("pagine del materiale: una per foto più una ogni 2000 caratteri scritti", () => {
  assert.equal(run('pagineMateriale(4, "")'), 4);
  assert.equal(run('pagineMateriale(0, "x".repeat(4500))'), 3);
  assert.equal(run('pagineMateriale(0, "")'), 1);
});

test("a voce: lettere, ordinali e testo dell'opzione; nel dubbio non sceglie", () => {
  const opz = JSON.stringify(["Federico II di Svevia", "Carlo Magno", "Lorenzo de' Medici", "Dante Alighieri"]);
  const scegli = (detto) => run(`opzioneDetta(${JSON.stringify(detto)}, ${opz})`);
  assert.equal(scegli("la b"), 1);
  assert.equal(scegli("Lettera C"), 2);
  assert.equal(scegli("di"), 3);
  assert.equal(scegli("la seconda"), 1);
  assert.equal(scegli("Federico secondo di Svevia"), 0);
  assert.equal(scegli("Carlo Magno"), 1);
  assert.equal(scegli("a me sembra difficile"), -1); // "a" dentro una frase non è la lettera A
  assert.equal(scegli(""), -1);
});

test("a voce: riconosce quando non sa", () => {
  assert.equal(run('eNonLoSo("Non lo so")'), true);
  assert.equal(run('eNonLoSo("boh")'), true);
  assert.equal(run('eNonLoSo("non so se è giusto ma credo il 1250")'), false);
});

test("domanda guidata: aperta parte dal primo elemento atteso, chiusa rilegge le opzioni", () => {
  const ap = run(`domandaGuidata({tipo:"aperta", testo:"Perché si chiama siciliana?", elementi:["fiorì in Sicilia","poeti da varie regioni"]})`);
  assert.match(ap, /Parti da qui: fiorì in Sicilia\. Perché si chiama siciliana\?/);
  const ch = run(`domandaGuidata({tipo:"chiusa", testo:"Chi?", opzioni:["x","y","z","w"], _ord:[2,0,1,3]})`);
  assert.match(ch, /A: z\. B: x\. C: y\. D: w\./);
});
