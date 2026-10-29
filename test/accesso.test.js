// Schermate Profilo e Codice con un DOM finto: i nomi arrivano dal server,
// il blocco dopo tre errori lo decide il server.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SORGENTE = readFileSync(new URL("../app.js", import.meta.url), "utf8");

// Quel tanto di DOM che usano le schermate di accesso.
function elemento(tag = "div") {
  const el = {
    tagName: tag, children: [], dataset: {}, attributi: {}, hidden: false, value: "", textContent: "",
    _html: "", onclick: null,
    classList: { add() {}, remove() {} },
    style: { setProperty() {}, removeProperty() {} },
    get innerHTML() { return this._html + this.children.map((c) => c.testo()).join(""); },
    set innerHTML(v) { this._html = v; this.children = []; },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attributi[k] = String(v); },
    getAttribute(k) { return this.attributi[k]; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    focus() {},
    testo() { return this._html + this.textContent + this.children.map((c) => c.testo()).join(""); },
  };
  return el;
}

function ambiente(rispostaServer) {
  const elementi = {};
  const chiamate = [];
  const memoria = {};
  const document = {
    readyState: "loading", // l'app non parte da sola: la guidano i test
    addEventListener() {},
    getElementById: (id) => elementi[id] || (elementi[id] = elemento()),
    createElement: (tag) => elemento(tag),
    createTextNode: (t) => ({ testo: () => t }),
    querySelectorAll: () => [],
    documentElement: elemento("html"),
  };
  const sessioni = [];
  const window = {
    scrollTo() {},
    supabase: {
      createClient: () => ({
        auth: { setSession: async (s) => { sessioni.push(s); return { error: null }; } },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      }),
    },
  };
  const ctx = vm.createContext({
    console: { ...console, warn() {} }, Math, Date, JSON, Promise, setTimeout, clearTimeout, setInterval, clearInterval,
    document, window, navigator: {},
    localStorage: {
      getItem: (k) => (k in memoria ? memoria[k] : null),
      setItem: (k, v) => { memoria[k] = String(v); },
      removeItem: (k) => { delete memoria[k]; },
    },
    fetch: async (url, opz) => {
      const corpo = JSON.parse(opz.body);
      chiamate.push({ url, corpo, headers: opz.headers });
      const r = await rispostaServer(corpo);
      if (r instanceof Error) throw r;
      return { status: r.status, json: async () => r.dati };
    },
  });
  vm.runInContext(SORGENTE, ctx);
  // Le chiamate di rete e di libreria non servono qui.
  vm.runInContext("caricaLibreria = async () => {};", ctx);
  return { run: (e) => vm.runInContext(e, ctx), el: document.getElementById, chiamate, memoria, sessioni };
}

const ELENCO = [{ id: "id-mia", nome: "Mia", classe: "3ª media" }, { id: "id-samira", nome: "Samira", classe: "1ª media" }];

test("Profilo: i nomi arrivano dal server anche su un telefono mai usato", async () => {
  const a = ambiente(() => ({ status: 200, dati: ELENCO }));
  await a.run("caricaProfili()");
  assert.equal(a.chiamate.length, 1);
  assert.match(a.chiamate[0].url, /\/functions\/v1\/accedi$/);
  assert.deepEqual(a.chiamate[0].corpo, { azione: "elenco" });
  assert.equal(a.chiamate[0].headers.authorization, undefined, "l'elenco non deve chiedere una sessione");
  const box = a.el("scelta-profilo");
  assert.equal(box.children.length, 2);
  assert.match(box.testo(), /Mia.*3ª media.*Samira/s);
  assert.doesNotMatch(box.testo(), /Nessun profilo su questo telefono/);
  assert.equal(a.el("err-profili").innerHTML, "");
  assert.equal(JSON.parse(a.memoria["verifiche-profili"]).length, 2, "la copia locale non è stata aggiornata");
});

test("Profilo: senza rete resta la copia locale e compare un messaggio chiaro", async () => {
  const a = ambiente(() => new Error("offline"));
  a.memoria["verifiche-profili"] = JSON.stringify([{ id: "id-mia", nome: "Mia", classe: "", chiave: "sb-verifiche-id-mia" }]);
  await a.run("caricaProfili()");
  assert.equal(a.el("scelta-profilo").children.length, 1);
  assert.match(a.el("err-profili").innerHTML, /Non riesco a caricare i profili: controlla la connessione/);
});

test("Profilo: elenco vuoto dal server → messaggio per il genitore", async () => {
  const a = ambiente(() => ({ status: 200, dati: [] }));
  await a.run("caricaProfili()");
  assert.equal(a.el("scelta-profilo").children.length, 0);
  assert.match(a.el("err-profili").innerHTML, /nessun profilo/i);
});

async function digita(a, codice) {
  for (const n of codice) a.run(`tasto(${JSON.stringify(n)})`);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

test("Codice: con risposta attendi il tastierino si blocca e il messaggio mostra i secondi", async () => {
  const a = ambiente((c) => (c.azione === "elenco" ? { status: 200, dati: ELENCO } : { status: 401, dati: { ok: false, attendi: 60 } }));
  await a.run("caricaProfili()");
  a.el("scelta-profilo").children[1].onclick(); // Samira
  await digita(a, "1234");
  assert.deepEqual(a.chiamate[1].corpo, { azione: "entra", studente_id: "id-samira", pin: "1234" });
  assert.equal(a.el("tastierino").getAttribute("aria-disabled"), "true");
  assert.equal(a.el("cod-msg").textContent, "Troppi tentativi. Riprova fra 60 secondi.");
  await digita(a, "5678"); // durante l'attesa i tasti non partono
  assert.equal(a.chiamate.length, 2);
  a.run("clearInterval(timerBlocco)");
});

test("Codice: codice sbagliato → messaggio, nessuna sessione", async () => {
  const a = ambiente((c) => (c.azione === "elenco" ? { status: 200, dati: ELENCO } : { status: 401, dati: { ok: false, attendi: 0 } }));
  await a.run("caricaProfili()");
  a.el("scelta-profilo").children[0].onclick();
  await digita(a, "0000");
  assert.equal(a.el("cod-msg").textContent, "Codice sbagliato.");
  assert.equal(a.el("tastierino").getAttribute("aria-disabled"), "false");
  assert.equal(a.sessioni.length, 0);
  a.run("clearInterval(timerBlocco)");
});

test("Codice: giusto → sessione dal server nel profilo scelto, ricordato come ultimo", async () => {
  const a = ambiente((c) => (c.azione === "elenco"
    ? { status: 200, dati: ELENCO }
    : { status: 200, dati: { ok: true, access_token: "AT", refresh_token: "RT", nome: "Samira", classe: "1ª media" } }));
  await a.run("caricaProfili()");
  a.el("scelta-profilo").children[1].onclick();
  await digita(a, "2468");
  assert.equal(JSON.stringify(a.sessioni), JSON.stringify([{ access_token: "AT", refresh_token: "RT" }]));
  assert.equal(a.run("profilo && profilo.id"), "id-samira");
  assert.equal(JSON.parse(a.memoria["verifiche-ultimo"]), "id-samira");
  assert.equal(a.el("v-libreria").hidden, false);
});
