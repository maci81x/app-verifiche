// Issue #33: un doppio tocco su «Avanti» all'ultima domanda salvava la stessa verifica due volte.
//   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// DOM finto: ogni id è un oggetto con le proprietà che correggi() tocca.
const el = () => ({ disabled: false, hidden: false, textContent: "", innerHTML: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
  scrollIntoView() {}, focus() {}, addEventListener() {}, querySelectorAll: () => [], setAttribute() {} });
const elementi = {};
// senza v-libreria l'app non parte da sola
const document = { getElementById: (id) => (id === "v-libreria" ? null : (elementi[id] ??= el())), querySelectorAll: () => [], querySelector: () => null, body: { dataset: {} }, addEventListener() {} };
const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, document, window: {}, crypto: globalThis.crypto });
for (const f of ["soldi.js", "semaforo.js", "app.js"]) vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (e) => vm.runInContext(e, ctx);
const pausa = () => new Promise((r) => setTimeout(r, 20));

function prepara() {
  run(`
    salvate = 0; esiti = 0;
    mostraEsito = async (per) => { esiti++; await new Promise((r) => setTimeout(r, 10)); salvate++; };
    fermaVoce = () => {}; attesa = () => {}; errore = () => {};
    domande = [{ id: "d1", tipo: "chiusa", corretta: 0, concetto_id: "c1", peso: 1 }];
    nuovaProva(); idx = 0; risposte = { d1: { scelta: 0 } }; corrette = { d1: { punti: 10, commento: "" } };
  `);
}

test("due avanza() di fila all'ultima domanda: una sola consegna e un solo salvataggio", async () => {
  run("var salvate = 0, esiti = 0;");
  prepara();
  run("avanza(); avanza();");
  await pausa();
  assert.equal(run("esiti"), 1);
  assert.equal(run("salvate"), 1);
});

test("il pulsante resta disattivato finché il salvataggio non è finito", async () => {
  prepara();
  run(`mostraEsito = async () => { durante = document.getElementById("btn-avanti").disabled; }`);
  run("var durante = null; avanza();");
  await pausa();
  assert.equal(run("durante"), true);
});

test("se la correzione delle aperte non riesce, si può ritoccare e consegnare (una volta)", async () => {
  prepara();
  run(`
    domande = [{ id: "d2", tipo: "aperta", concetto_id: "c1", peso: 1, risposta_attesa: "x" }];
    risposte = { d2: { testo: "una risposta" } }; corrette = {};
    var tentativi = 0;
    conRiprova = async () => { tentativi++; if (tentativi === 1) throw new Error("rete"); return { valutazioni: [] }; };
    messaggioModello = () => "";
  `);
  run("avanza();"); await pausa();
  assert.equal(run("esiti"), 0, "con l'errore non si consegna");
  run("avanza(); avanza();"); await pausa();
  assert.equal(run("esiti"), 1, "al nuovo tocco si consegna una volta sola");
});

test("ogni prova ha il suo id: il salvataggio lo usa, e un secondo insert uguale non crea una seconda riga", () => {
  prepara();
  const a = run("idProva");
  run("nuovaProva()");
  assert.match(a, /^[0-9a-f-]{36}$/);
  assert.notEqual(run("idProva"), a);
  const s = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const salva = s.slice(s.indexOf("async function salvaProva"));
  assert.match(salva.slice(0, 600), /insert\(\{\s*id: idProva,/);
  assert.match(salva.slice(0, 900), /error\.code === "23505"/);
});
