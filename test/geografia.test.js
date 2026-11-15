// Issue #28 (resto): quiz di geografia d'Italia per la 1ª (geografia.js + italia-mappa.js), senza browser.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "classe-app.js", "italia-mappa.js", "geografia.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const json = (expr) => JSON.parse(vm.runInContext("JSON.stringify(" + expr + ")", ctx));
const run = (expr) => vm.runInContext(expr, ctx);

test("cartina: le 20 regioni ISTAT, ognuna con il suo percorso", () => {
  const m = json("MAPPA_ITALIA");
  assert.equal(m.regioni.length, 20);
  assert.deepEqual(m.regioni.map((r) => r.istat), Array.from({ length: 20 }, (_, i) => i + 1));
  for (const r of m.regioni) assert.match(r.d, /^M[\d. L]+Z/, r.nome);
});

test("dati del quiz: 20 regioni con il capoluogo, ogni fatto con le sue regioni e la fonte verificata", () => {
  const g = json("GEOGRAFIA_ITALIA");
  assert.equal(g.regioni.length, 20);
  assert.deepEqual(g.regioni.map((r) => r.istat).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  for (const r of g.regioni) { assert.ok(r.nome && r.capoluogo, r.nome); }
  assert.equal(g.regioni.filter((r) => r.speciale).length, 5);
  assert.match(g.fonte_regioni, /^https:\/\//);
  assert.ok(g.fatti.length >= 12);
  const istat = new Set(g.regioni.map((r) => r.istat));
  for (const f of g.fatti) {
    assert.ok(["monte", "fiume", "lago"].includes(f.tipo), f.nome);
    assert.ok(f.domanda && f.nome && f.dettaglio, f.nome);
    assert.ok(f.regioni.length >= 1 && f.regioni.every((x) => istat.has(x)), f.nome + ": regioni");
    assert.match(f.fonte, /^https:\/\//, f.nome + ": fonte");
  }
});

const rnd = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
test("domande del quiz: tipi mescolati, quattro scelte di regioni diverse con quella giusta", () => {
  const d = json(`domandeGeografia(GEOGRAFIA_ITALIA, 10, (${rnd})())`);
  assert.equal(d.length, 10);
  assert.ok(new Set(d.map((x) => x.tipo)).size >= 4, "tipi diversi");
  for (const q of d) {
    assert.equal(q.scelte.length, 4);
    assert.equal(new Set(q.scelte).size, 4);
    assert.equal(q.scelte.filter((s) => q.giuste.includes(s)).length, 1, q.testo);
    assert.ok(q.testo && q.spiegazione, q.testo);
  }
  for (let i = 1; i < d.length; i++) assert.notEqual(d[i].tipo, d[i - 1].tipo, "mai due dello stesso tipo di fila");
});

test("risposta: con la cartina o con il bottone; vale ogni regione giusta", () => {
  const q = { istat: [3, 5, 4] };
  assert.equal(run(`rispostaGeografia(${JSON.stringify(q)}, 5)`), true);
  assert.equal(run(`rispostaGeografia(${JSON.stringify(q)}, 9)`), false);
  assert.equal(run(`nomeRegione(4)`), "Trentino-Alto Adige");
  assert.equal(run(`nomeRegione(2)`), "Valle d'Aosta");
});

test("la card del quiz in Oggi solo per la 1ª", () => {
  assert.equal(run(`perPrima({ classe: "1" })`), true);
  assert.equal(run(`perPrima({ classe: "2ª media" })`), false);
  assert.equal(run(`perPrima(null)`), false);
});

test("solo dati verificati: ogni fatto del quiz ha la sua fonte nella tabella docs/da-verificare.md", () => {
  const md = readFileSync(new URL("../docs/da-verificare.md", import.meta.url), "utf8");
  for (const f of json("GEOGRAFIA_ITALIA.fatti")) assert.ok(md.includes(f.fonte), f.nome + ": fonte non in tabella");
  assert.ok(md.includes(json("GEOGRAFIA_ITALIA.fonte_regioni")));
  // le correzioni della verifica sono nel quiz
  const testo = json("GEOGRAFIA_ITALIA.fatti").map((f) => f.dettaglio).join(" ");
  assert.match(testo, /Sappada.*Friuli-Venezia Giulia/);
  assert.match(testo, /circa 4800 m/);
  assert.doesNotMatch(testo, /4805|220 km/);
});
