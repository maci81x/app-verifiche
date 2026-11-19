// Schermate Profilo e Codice con un DOM finto: i nomi arrivano dal server,
// il blocco dopo tre errori lo decide il server.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// semaforo.js prima di app.js, libreria.js dopo (disegno dei profili), come in index.html.
const SORGENTE = ["soldi.js", "semaforo.js", "app.js", "libreria.js", "famiglia.js"].map((f) => readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n;\n");

// Quel tanto di DOM che usano le schermate di accesso.
function elemento(tag = "div") {
  const el = {
    tagName: tag, children: [], dataset: {}, attributi: {}, hidden: false, value: "", textContent: "",
    _html: "", onclick: null,
    classList: { add() {}, remove() {}, contains() { return false; } },
    style: { setProperty() {}, removeProperty() {} },
    get innerHTML() { return this._html + this.children.map((c) => c.testo()).join(""); },
    set innerHTML(v) { this._html = v; this.children = []; },
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren(...c) { this._html = ""; this.children = c; },
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
    body: elemento("body"),
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
      return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.dati };
    },
  });
  vm.runInContext(SORGENTE, ctx);
  // Le chiamate di rete e di libreria non servono qui.
  vm.runInContext("caricaLibreria = async () => {};", ctx);
  return { run: (e) => vm.runInContext(e, ctx), el: document.getElementById, chiamate, memoria, sessioni };
}

// Dalla #30 non c'è più l'elenco dal server: il telefono mostra solo i profili entrati da qui (con una sessione salvata).
const SALVATI = [
  { id: "id-ada", nome: "Ada", classe: "3", nome_utente: "ada-k7m", chiave: "sb-verifiche-id-ada" },
  { id: "id-leo", nome: "Leo", classe: "1", chiave: "sb-verifiche-id-leo" }, // voce della v34: senza nome utente
  { id: "id-zoe", nome: "Zoe", classe: "2", chiave: "sb-verifiche-id-zoe" },  // senza sessione su questo telefono
];
function conSalvati(a) {
  a.memoria["verifiche-profili"] = JSON.stringify(SALVATI);
  a.memoria["sb-verifiche-id-ada"] = "{}";
  a.memoria["sb-verifiche-id-leo"] = "{}";
  return a;
}

test("Profilo: niente elenco dal server, solo i profili entrati da questo telefono", async () => {
  const a = conSalvati(ambiente(() => ({ status: 500, dati: null })));
  await a.run("caricaProfili()");
  assert.equal(a.chiamate.length, 0, "nessuna chiamata: l'elenco delle altre famiglie non si chiede mai");
  const box = a.el("scelta-profilo");
  assert.equal(box.children.length, 2);
  assert.match(box.testo(), /Ada.*Leo/s);
  assert.doesNotMatch(box.testo(), /Zoe/);
  const copia = JSON.parse(a.memoria["verifiche-profili"]);
  assert.deepEqual(copia.map((p) => p.id), ["id-ada", "id-leo"], "la copia locale tiene solo i profili con sessione");
  assert.equal(copia[1].nome_utente, "leo", "la voce della v34 prende il nome in minuscolo come nome utente");
});

test("Profilo: telefono nuovo → invito a entrare con il nome utente", async () => {
  const a = ambiente(() => ({ status: 500, dati: null }));
  await a.run("caricaProfili()");
  assert.equal(a.el("scelta-profilo").children.length, 0);
  assert.match(a.el("err-profili").innerHTML, /nome utente/);
});

async function digita(a, codice) {
  for (const n of codice) a.run(`tasto(${JSON.stringify(n)})`);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

test("Codice: il profilo salvato ha il nome utente già scritto; con risposta attendi il tastierino si blocca", async () => {
  const a = conSalvati(ambiente(() => ({ status: 401, dati: { ok: false, attendi: 60 } })));
  await a.run("caricaProfili()");
  a.el("scelta-profilo").children[1].onclick(); // Leo
  assert.equal(a.el("cod-utente").value, "leo");
  await digita(a, "1234");
  assert.deepEqual(a.chiamate[0].corpo, { azione: "entra", nome_utente: "leo", pin: "1234" });
  assert.equal(a.el("tastierino").getAttribute("aria-disabled"), "true");
  assert.equal(a.el("cod-msg").textContent, "Troppi tentativi. Riprova fra 60 secondi.");
  await digita(a, "5678"); // durante l'attesa i tasti non partono
  assert.equal(a.chiamate.length, 1);
  a.run("clearInterval(timerBlocco)");
});

test("Codice: sbagliato su un profilo salvato → messaggio che ricorda il nome utente nuovo, nessuna sessione", async () => {
  const a = conSalvati(ambiente(() => ({ status: 401, dati: { ok: false, attendi: 0 } })));
  await a.run("caricaProfili()");
  a.el("scelta-profilo").children[0].onclick();
  await digita(a, "0000");
  assert.match(a.el("cod-msg").textContent, /^Non è il codice giusto\. Riprova\..*nome utente nuovo/);
  assert.equal(a.el("tastierino").getAttribute("aria-disabled"), "false");
  assert.equal(a.sessioni.length, 0);
  a.run("clearInterval(timerBlocco)");
});

test("Codice: entrare con il nome utente scritto a mano salva il profilo su questo telefono", async () => {
  const a = ambiente(() => ({ status: 200, dati: { ok: true, access_token: "AT", refresh_token: "RT", id: "id-bea", nome: "Bea", classe: "2", nome_utente: "bea-x2z" } }));
  await a.run("caricaProfili()");
  a.run("apriCodice(null)");
  assert.equal(a.el("cod-utente").value, "");
  await digita(a, "1111");
  assert.equal(a.chiamate.length, 0, "senza nome utente non parte niente");
  assert.match(a.el("cod-msg").textContent, /nome utente/);
  a.el("cod-utente").value = "  Bea-X2Z ";
  await digita(a, "2468");
  assert.deepEqual(a.chiamate[0].corpo, { azione: "entra", nome_utente: "bea-x2z", pin: "2468" });
  assert.equal(JSON.stringify(a.sessioni), JSON.stringify([{ access_token: "AT", refresh_token: "RT" }]));
  assert.equal(a.run("profilo && profilo.id"), "id-bea");
  assert.deepEqual(JSON.parse(a.memoria["verifiche-profili"]).map((p) => [p.id, p.nome_utente]), [["id-bea", "bea-x2z"]]);
  assert.equal(JSON.parse(a.memoria["verifiche-ultimo"]), "id-bea");
  assert.equal(a.el("v-libreria").hidden, false);
});

test("Codice: un nome utente nuovo sostituisce quello salvato del profilo", async () => {
  const a = conSalvati(ambiente(() => ({ status: 200, dati: { ok: true, access_token: "AT", refresh_token: "RT", id: "id-leo", nome: "Leo", classe: "1", nome_utente: "leo-n3w" } })));
  await a.run("caricaProfili()");
  a.el("scelta-profilo").children[1].onclick();
  a.el("cod-utente").value = "leo-n3w";
  await digita(a, "2468");
  const copia = JSON.parse(a.memoria["verifiche-profili"]);
  assert.equal(copia.filter((p) => p.id === "id-leo").length, 1);
  assert.equal(copia.find((p) => p.id === "id-leo").nome_utente, "leo-n3w");
});

test("Codice: famiglia sospesa → messaggio, nessuna sessione", async () => {
  const a = conSalvati(ambiente(() => ({ status: 403, dati: { errore: "famiglia_sospesa" } })));
  await a.run("caricaProfili()");
  a.el("scelta-profilo").children[0].onclick();
  await digita(a, "2468");
  assert.equal(a.el("cod-msg").textContent, "Il profilo è in pausa. Chiedi al tuo genitore.");
  assert.equal(a.sessioni.length, 0);
  a.run("clearInterval(timerBlocco)");
});

test("Elimina profilo (issue #14): chiama il server e toglie nome, sessione e conteggio salvati sul telefono", async () => {
  const amb = ambiente(async (corpo) => (corpo.azione === "elimina" ? { status: 200, dati: { ok: true, foto: 2, resti: {} } } : { status: 200, dati: [] }));
  amb.memoria["verifiche-profili"] = JSON.stringify([{ id: "s1", nome: "Prova" }, { id: "s2", nome: "Ada" }]);
  amb.memoria["sb-verifiche-s1"] = "sessione";
  amb.memoria["sb-verifiche-s2"] = "sessione"; // Ada è entrata da questo telefono: resta
  amb.memoria["verifiche-ripassare-s1"] = "3";
  amb.memoria["verifiche-ultimo"] = JSON.stringify("s1");
  amb.run(`genitore = { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    from: () => ({ select: () => ({ order: async () => ({ data: [{ id: "s2", nome: "Ada" }] }) }) }) };`);
  await amb.run(`eliminaProfilo({ id: "s1", nome: "Prova" }, document.createElement("button"))`);
  const elimina = amb.chiamate.find((c) => c.corpo.azione === "elimina");
  assert.ok(elimina && /\/functions\/v1\/profili$/.test(elimina.url));
  assert.deepEqual(elimina.corpo, { azione: "elimina", studente_id: "s1" });
  assert.deepEqual(JSON.parse(amb.memoria["verifiche-profili"]).map((p) => p.id), ["s2"]);
  assert.equal(amb.memoria["sb-verifiche-s1"], undefined);
  assert.equal(amb.memoria["verifiche-ripassare-s1"], undefined);
  assert.equal(JSON.parse(amb.memoria["verifiche-ultimo"]), null);
  assert.match(amb.el("err-imp").innerHTML, /eliminato, con tutti i suoi argomenti e prove/);
});

test("Elimina profilo: se il server dice di no, i dati locali restano e compare l'errore", async () => {
  const amb = ambiente(async () => ({ status: 502, dati: { errore: "operazione non riuscita" } }));
  amb.memoria["verifiche-profili"] = JSON.stringify([{ id: "s1", nome: "Prova" }]);
  amb.run(`genitore = { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } };`);
  await amb.run(`eliminaProfilo({ id: "s1", nome: "Prova" }, document.createElement("button"))`);
  assert.deepEqual(JSON.parse(amb.memoria["verifiche-profili"]).map((p) => p.id), ["s1"]);
  assert.match(amb.el("err-imp").innerHTML, /Non sono riuscito a eliminare il profilo di Prova/);
});

test("Elimina profilo aperto su questo telefono: l'app smette di usarlo; un 404 vale come già eliminato", async () => {
  const amb = ambiente(async (corpo) => (corpo.azione === "elimina" ? { status: 404, dati: { errore: "profilo non trovato" } } : { status: 200, dati: [] }));
  amb.memoria["verifiche-profili"] = JSON.stringify([{ id: "s1", nome: "Prova" }]);
  amb.run(`genitore = { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    from: () => ({ select: () => ({ order: async () => ({ data: [] }) }) }) };
    profilo = { id: "s1", nome: "Prova" }; sb = { finto: true }; argomenti = [{ id: "a" }];
    clients["sb-verifiche-s1"] = { auth: { signOut: async () => ({}) } };`);
  await amb.run(`eliminaProfilo({ id: "s1", nome: "Prova" }, document.createElement("button"))`);
  assert.equal(amb.run("profilo"), null);
  assert.equal(amb.run("sb"), null);
  assert.equal(amb.run("argomenti.length"), 0);
  assert.equal(amb.run(`"sb-verifiche-s1" in clients`), false);
  assert.deepEqual(JSON.parse(amb.memoria["verifiche-profili"]), []);
  assert.match(amb.el("err-imp").innerHTML, /eliminato/);
});

test("verifica: risposta aperta e scelte hanno come nome la domanda", () => {
  const amb = ambiente(async () => ({ status: 200, dati: [] }));
  amb.run(`domande = [{ id: "d1", tipo: "aperta", testo: "Che cos'è la peste?" }, { id: "d2", tipo: "chiusa", testo: "Quando?", opzioni: ["1347", "1492"], corretta: 0 }];
    idx = 0; risposte = {}; mostraDomanda();`);
  const ta = amb.el("q-corpo").children[0];
  assert.equal(ta.tagName, "textarea");
  assert.equal(ta.attributi["aria-labelledby"], "q-testo");
  amb.run("idx = 1; mostraDomanda();");
  const box = amb.el("q-corpo").children[0];
  assert.equal(box.attributi.role, "radiogroup");
  assert.equal(box.attributi["aria-labelledby"], "q-testo");
});

test("peso dei concetti: il lettore di schermo sente quale peso è scelto", () => {
  const amb = ambiente(async () => ({ status: 200, dati: [] }));
  amb.run(`corrente = { titolo: "Peste", concetti: [{ id: "c1", titolo: "Contagio", descrizione: "", peso: 2 }] }; mostraConcetti();`);
  const pesi = () => amb.el("lista-concetti").children[0].children[0].children[1].children;
  assert.deepEqual(pesi().map((b) => b.attributi["aria-pressed"]), ["false", "true", "false"]);
  pesi()[2].onclick();
  assert.deepEqual(pesi().map((b) => b.attributi["aria-pressed"]), ["false", "false", "true"]);
});
