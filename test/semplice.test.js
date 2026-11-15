// Issue #26: semplice per ragazz* (Oggi, tre scelte, preparazione, verifica in linea, mappa a filetti).
// Logica pura caricata senza browser, come in app.test.js.   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval });
for (const f of ["semaforo.js", "app.js", "libreria.js", "stampa.js", "aiuto.js", "mappa-card.js"]) {
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
}
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));
const arg = (materia, stati) => ({ id: materia + stati.join(""), materia, titolo: "T " + materia, concetti: stati.map((s, i) => ({ id: materia + i, stato: s })) });

test("Oggi: la frase viene dai dati", () => {
  assert.equal(run(`fraseOggi([])`), "Fotografa i tuoi appunti: da lì parte tutto.");
  assert.equal(run(`fraseOggi(${JSON.stringify([arg("storia", ["rosso", "verde"])])})`), "Hai 1 punto da ripassare in storia.");
  assert.equal(run(`fraseOggi(${JSON.stringify([arg("storia", ["rosso", "rosso"])])})`), "Hai 2 punti da ripassare in storia.");
  assert.equal(run(`fraseOggi(${JSON.stringify([arg("storia", ["rosso"]), arg("scienze", ["rosso", "giallo"])])})`), "Hai 2 punti da ripassare, in storia e scienze.");
  assert.equal(run(`fraseOggi(${JSON.stringify([arg("storia", ["giallo", "verde"])])})`), "Hai 1 punto segnato Quasi: basta un ripasso veloce.");
  assert.equal(run(`fraseOggi(${JSON.stringify([arg("storia", ["mai", "mai"])])})`), "Hai 2 punti ancora da provare: comincia da lì.");
  assert.equal(run(`fraseOggi(${JSON.stringify([arg("storia", ["verde", "verde"])])})`), "Tutto verde: oggi puoi fotografare qualcosa di nuovo.");
});

test("preparazione: le scelte valide restano, quelle strane tornano al valore di partenza", () => {
  assert.deepEqual(json(`scelteValide({ livello: "difficile", tipo: "boh", modalita: "orale" })`), { livello: "difficile", tipo: "miste", modalita: "orale" });
  assert.deepEqual(json(`scelteValide(null)`), { livello: "medio", tipo: "miste", modalita: "scritta" });
  assert.equal(run(`chiaveScelte("p1")`), "verifiche-scelte-p1");
});

test("preparazione: le scelte si ricordano sul telefono e tornano la volta dopo", () => {
  const memoria = {};
  ctx.localStorage = { getItem: (k) => (k in memoria ? memoria[k] : null), setItem: (k, v) => { memoria[k] = String(v); } };
  run(`ricordaScelte("p1", { livello: "semplice", tipo: "chiuse", modalita: "scritta" })`);
  assert.deepEqual(json(`scelteRicordate("p1")`), { livello: "semplice", tipo: "chiuse", modalita: "scritta" });
  assert.deepEqual(json(`scelteRicordate("p2")`), { livello: "medio", tipo: "miste", modalita: "scritta" });
  delete ctx.localStorage;
});

test("argomento: tre scelte, la consigliata per prima", () => {
  const conRossi = json(`ordineScelte(${JSON.stringify(arg("storia", ["rosso", "verde"]))})`);
  assert.deepEqual(conRossi.map((s) => s.chiave), ["ripassa", "verifica", "interroga"]);
  assert.deepEqual(conRossi.map((s) => s.consigliata), [true, false, false]);
  const nuovo = json(`ordineScelte(${JSON.stringify(arg("storia", ["mai", "mai"]))})`);
  assert.deepEqual(nuovo.map((s) => s.chiave), ["verifica", "interroga", "ripassa"]);
  assert.equal(nuovo[0].consigliata, true);
  const quasi = json(`ordineScelte(${JSON.stringify(arg("storia", ["giallo", "verde"]))})`);
  assert.deepEqual(quasi.map((s) => s.chiave), ["verifica", "interroga", "ripassa"]);
  assert.ok(conRossi.every((s) => s.titolo && s.spiega));
});

test("argomento: riga di stato con le parole del semaforo", () => {
  assert.equal(run(`rigaStatoArgomento(${JSON.stringify(arg("storia", ["verde", "verde", "giallo", "rosso", "mai"]))})`),
    "5 punti: 2 li sai, 1 quasi, 1 da ripassare, 1 ancora da provare");
  assert.equal(run(`rigaStatoArgomento(${JSON.stringify(arg("storia", ["verde"]))})`), "1 punto: 1 lo sai");
});

test("verifica in linea: una chiusa si corregge subito, senza modello", () => {
  const d = { opzioni: ["1347", "1492"], corretta: 0 };
  assert.deepEqual(json(`esitoChiusa(${JSON.stringify(d)}, 0)`), { punti: 10, commento: "Giusta." });
  assert.deepEqual(json(`esitoChiusa(${JSON.stringify(d)}, 1)`), { punti: 0, commento: "La risposta giusta era: 1347" });
  assert.deepEqual(json(`esitoChiusa(${JSON.stringify(d)}, null)`), { punti: 0, commento: "La risposta giusta era: 1347" });
});

test("verifica in linea: il riquadro della correzione dice l'esito e mostra la frase del quaderno", () => {
  const html = run(`htmlCorrezioneInLinea({ tipo: "chiusa", ancora: "nel 1347 <arrivò>" }, { punti: 0, commento: "La risposta giusta era: 1347" })`);
  assert.match(html, /data-s="rosso"/);
  assert.match(html, /✕<\/i> Non ancora/);
  assert.match(html, /Sul tuo quaderno[\s\S]*<mark class="evidenzia">nel 1347 &lt;arrivò&gt;<\/mark>/);
  assert.match(run(`htmlCorrezioneInLinea({ tipo: "chiusa", ancora: "x" }, { punti: 10, commento: "Giusta." })`), /●<\/i> Giusta/);
  assert.match(run(`htmlCorrezioneInLinea({ tipo: "aperta", ancora: "" }, { punti: 6, commento: "Manca la data." })`), /▲<\/i> Quasi[\s\S]*Manca la data\./);
  assert.doesNotMatch(run(`htmlCorrezioneInLinea({ tipo: "aperta", ancora: "" }, { punti: 6, commento: "c" })`), /Sul tuo quaderno/);
});

test("esito: la frase si evidenzia con la passata solo per i punti passati da ✕ a ●", () => {
  assert.deepEqual(json(`appenaSaputi({ a: "rosso", b: "rosso", c: "giallo" }, [{ concetto_id: "a", stato: "verde" }, { concetto_id: "b", stato: "giallo" }, { concetto_id: "c", stato: "verde" }])`), ["a"]);
});

test("mappa a filetti: un pulsante per riquadro, figli rientrati, semaforo a destra, web tratteggiato", () => {
  const albero = { titolo: "La peste", nodi: [
    { id: "c1", titolo: "Arrivo <1347>", ancora: "nel 1347", fonte: "appunti", figli: [
      { id: "c1-1", titolo: "Navi genovesi", ancora: "navi", fonte: "appunti", figli: [] },
      { id: "web-1", titolo: "Caffa", testo: "t", url: "https://x.it", fonte: "web", figli: [] }] },
    { id: "c2", titolo: "Senza frase", ancora: "", fonte: "appunti", figli: [] }] };
  const html = run(`htmlAlberoMappa(${JSON.stringify(albero)}, { c1: "rosso" })`);
  assert.match(html, /<button type="button" class="m-nodo" data-id="c1" data-l="1" data-s="rosso" aria-pressed="false"[^>]*>/);
  assert.doesNotMatch(html, /role="button"/); // è già un pulsante
  assert.match(html, /Arrivo &lt;1347&gt;/);
  assert.match(html, /data-id="c1-1" data-l="2" data-s="rosso"/);
  assert.match(html, /data-id="web-1" data-l="2" data-s="web" data-fonte="web"/);
  assert.match(html, /<ul class="m-figli">/);
  assert.match(html, /✕<\/i> Da ripassare/);
  assert.match(html, /<div class="m-nodo" data-id="c2" data-l="1" data-s="mai"/); // senza frase: non si apre
});

test("verifica in linea: se la correzione dell'aperta non arriva si va avanti lo stesso, con 5 punti e il perché", () => {
  assert.deepEqual(json(`esitoAperta({ risposta_attesa: "x" }, "la mia risposta", null)`),
    { punti: 5, commento: "Non sono riuscito a correggere questa risposta. Confrontala tu con quello che ci voleva.", rubrica: null });
  assert.deepEqual(json(`esitoAperta({ risposta_attesa: "Nel 1347" }, "", null)`), { punti: 0, commento: "Ci voleva: Nel 1347" });
});
