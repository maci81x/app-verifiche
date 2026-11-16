// Issue #24, la parte dell'app: linea del tempo, vocaboli e «Parla tu», schema da completare (senza browser).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "compito.js", "piano.js", "strumenti.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));
const J = JSON.stringify;

test("strumento della materia: storia, lingue, geografia e scienze; le altre niente", () => {
  assert.equal(json(`strumentoDi("Storia")`).tipo, "date");
  assert.equal(json(`strumentoDi("Inglese")`).tipo, "vocaboli");
  assert.equal(json(`strumentoDi("Francese")`).tipo, "vocaboli");
  assert.equal(json(`strumentoDi("Tedesco")`).tipo, "vocaboli");
  assert.equal(json(`strumentoDi("Geografia")`).tipo, "schema");
  assert.equal(json(`strumentoDi("Scienze")`).tipo, "schema");
  assert.equal(json(`strumentoDi("Matematica")`), null);
  assert.equal(json(`strumentoDi("Italiano")`), null);
});

const EV = [{ evento: "Colombo", anno: 1492 }, { evento: "Roma fondata", anno: -753 }, { evento: "Stampa", anno: 1450 }, { evento: "Fine Impero", anno: 476 }];

test("linea del tempo: in ordine dal più antico, a.C. prima di d.C.", () => {
  assert.deepEqual(json(`ordinaEventi(${J(EV)})`).map((e) => e.anno), [-753, 476, 1450, 1492]);
  assert.deepEqual(EV.map((e) => e.anno), [1492, -753, 1450, 476]); // l'originale non cambia
});

test("metti in ordine: ogni posto è giusto se ha l'anno che ci va; stesso anno, tutti e due giusti", () => {
  const r = json(`controllaOrdine(${J([EV[1], EV[3], EV[0], EV[2]])})`);
  assert.deepEqual(r.giusti, [true, true, false, false]);
  assert.equal(r.quanti, 2);
  assert.equal(r.tutto, false);
  assert.equal(json(`controllaOrdine(ordinaEventi(${J(EV)}))`).tutto, true);
  const pari = [{ evento: "A", anno: 1492 }, { evento: "B", anno: 1492 }, { evento: "C", anno: 1000 }];
  assert.deepEqual(json(`controllaOrdine(${J([pari[2], pari[1], pari[0]])})`).giusti, [true, true, true]);
});

test("spostare un evento (frecce su/giù e trascinamento) e mescolare senza lasciarli già in ordine", () => {
  assert.deepEqual(json(`sposta([1, 2, 3, 4], 0, 2)`), [2, 3, 1, 4]);
  assert.deepEqual(json(`sposta([1, 2, 3, 4], 3, 2)`), [1, 2, 4, 3]);
  assert.deepEqual(json(`sposta([1, 2, 3], 0, -1)`), [1, 2, 3]); // fuori: niente
  assert.deepEqual(json(`sposta([1, 2, 3], 2, 3)`), [1, 2, 3]);
  for (let k = 0; k < 20; k++) {
    const m = json(`mescolaEventi(${J(EV)})`);
    assert.equal(m.length, 4);
    assert.equal(json(`controllaOrdine(${J(m)})`).tutto, false);
  }
});

test("parla tu: confronto tollerante (maiuscole, punteggiatura, accenti, contrazioni, una lettera)", () => {
  const ok = (a, d) => json(`confrontaFrase(${J(a)}, ${J(d)})`).giusta;
  assert.equal(ok("I have got a dog.", "i have got a dog"), true);
  assert.equal(ok("I'm happy.", "I am happy"), true);
  assert.equal(ok("¿Dónde está la estación?", "donde esta la estacion"), true);
  assert.equal(ok("My favourite colour is blue", "my favorite color is blue"), true);
  assert.equal(ok("I have got a dog", "I have a dog"), true);        // una parola su cinque: ci sta
  assert.equal(ok("I have got a dog", "I have a cat"), false);
  assert.equal(ok("Je m'appelle Marie", "je mappelle marie"), true);
  assert.equal(ok("The cat", "the dog"), false);
  assert.equal(ok("Hello", ""), false);
  const r = json(`confrontaFrase("I have got a black dog", "I have a dog")`);
  assert.deepEqual(r.mancanti, ["got", "black"]);
  assert.deepEqual(r.parole.map((p) => p.ok), [true, true, false, true, false, true]);
});

test("parla tu: correzione gentile, con le parole vere e senza «sbagliato»", () => {
  const c = (a, d) => run(`correzioneGentile(confrontaFrase(${J(a)}, ${J(d)}))`);
  assert.equal(c("I have got a dog", "I have got a dog"), "Detta bene.");
  assert.equal(c("I have got a dog", "I have a dog"), "Ci sei. Occhio a «got».");
  assert.equal(c("I have got a black dog", "I have a dog"), "Non ancora: mancano «got» e «black». Riascoltala e riprova.");
  assert.equal(c("The cat is black", "the dog"), "Non ancora: mancano «cat», «is» e «black». Riascoltala e riprova.");
  assert.equal(c("Hello", ""), "Non ho sentito niente. Tocca Parla tu e dilla ad alta voce.");
  for (const x of [c("I have got a dog", "I have a dog"), c("The cat", "the dog")]) assert.doesNotMatch(x, /sbagliat|brav[ao]\b|pront[ao]\b/i);
});

const VOC = [{ parola: "dog", traduzione: "cane" }, { parola: "cat", traduzione: "gatto" }, { parola: "horse", traduzione: "cavallo" }];

test("flashcard: oggi le carte nuove e quelle scadute (la più vecchia prima); le altre aspettano", () => {
  const st = { "a1|dog": { prossima: "2026-11-20" }, "a1|cat": { prossima: "2026-11-10" } };
  assert.deepEqual(json(`carteDiOggi(${J(VOC)}, ${J(st)}, "a1", "2026-11-16")`).map((v) => v.parola), ["cat", "horse"]);
  assert.deepEqual(json(`carteDiOggi(${J(VOC)}, {}, "a1", "2026-11-16")`).map((v) => v.parola), ["dog", "cat", "horse"]);
  assert.equal(run(`chiaveCarta("a1", "Dog ")`), "a1|dog");
});

test("flashcard: lo stato si calcola con le regole di piano.js (nuovoStatoRipasso)", () => {
  const s = json(`statoCarta(null, "si", "2026-11-16")`);
  assert.equal(s.prossima, "2026-11-19");  // intervallo 1 × facilità 2.5 → 3 giorni
  assert.equal(json(`statoCarta(${J(s)}, "no", "2026-11-19")`).prossima, "2026-11-20");
  assert.equal(json(`statoCarta(null, "quasi", "2026-11-16")`).ultimo_esito, 6);
});

test("vocaboli e concetti: un vocabolo va col concetto la cui frase lo contiene (per ripasso_stato)", () => {
  const C = [{ id: "c1", ancora: "Animals: dog, cat" }, { id: "c2", ancora: "A horse is big" }];
  assert.equal(run(`concettoDelVocabolo("horse", ${J(C)})`), "c2");
  assert.equal(run(`concettoDelVocabolo("Dog", ${J(C)})`), "c1");
  assert.equal(run(`concettoDelVocabolo("ca", ${J(C)})`), null); // non dentro «cat»
  assert.deepEqual(json(`mediePerConcetto([{ concetto_id: "c1", esito: 10 }, { concetto_id: "c1", esito: 2 }, { concetto_id: null, esito: 10 }])`),
    [{ concetto_id: "c1", media: 6 }]);
});

test("schema: frase del quaderno col termine coperto, posti dentro il disegno, controllo per posto", () => {
  assert.equal(run(`mascheraTermine("Il calice è formato dai sepali", "calice")`), "Il ____ è formato dai sepali");
  assert.equal(run(`mascheraTermine("La Corolla, cioè i petali", "corolla")`), "La ____, cioè i petali");
  for (const forma of ["ciclo", "strati", "parti"]) for (const n of [3, 5, 8]) {
    const p = json(`posizioniSchema(${J(forma)}, ${n})`);
    assert.equal(p.length, n);
    for (const q of p) { assert.ok(q.x >= 20 && q.x <= 320, forma + " x " + q.x); assert.ok(q.y >= 20 && q.y <= 320, forma + " y " + q.y); }
  }
  const s = json(`posizioniSchema("strati", 4)`);
  assert.ok(s.every((q, i) => i === 0 || q.y > s[i - 1].y)); // dall'alto in basso
  const ET = [{ termine: "calice" }, { termine: "corolla" }, { termine: "stame" }];
  const r = json(`controllaSchema(["calice", "stame", null], ${J(ET)})`);
  assert.deepEqual(r.giusti, [true, false, false]);
  assert.equal(r.quanti, 1);
  const svg = run(`svgSchema({ forma: "ciclo", etichette: ${J(ET)} }, ["<b>", null, null])`);
  assert.equal((svg.match(/data-posto="/g) || []).length, 3);
  assert.doesNotMatch(svg, /<b>/);
});

test("messaggi del microfono nella lingua giusta (riusano quelli dell'interrogazione)", () => {
  assert.match(run(`messaggioVoce("language-not-supported", "en-GB")`), /l'inglese/);
  assert.match(run(`messaggioVoce("language-not-supported")`), /l'italiano/);
  assert.match(run(`messaggioVoce("not-allowed", "es-ES")`), /microfono/i);
});

test("revisione: una lettera di differenza solo per parole lunghe (almeno 6 lettere)", () => {
  const ok = (a, d) => json(`confrontaFrase(${J(a)}, ${J(d)})`).parole.every((p) => p.ok);
  assert.equal(ok("casa", "cosa"), false);
  assert.equal(ok("pero", "perro"), false);
  assert.equal(ok("hola", "hora"), false);
  assert.equal(ok("colour", "color"), true);
  assert.equal(ok("favourite", "favorite"), true);
  // una parola attesa che diventa due (I'm → i am): giusta solo se ci sono tutte e due
  assert.deepEqual(json(`confrontaFrase("I'm happy", "am happy")`).parole.map((p) => p.ok), [false, true]);
});

test("revisione: «educazione fisica» è motoria, non scienze", () => {
  assert.equal(run(`slugMateria("Educazione fisica")[0]`), "motoria");
  assert.equal(run(`slugMateria("Fisica")[0]`), "scienze");
  assert.equal(json(`strumentoDi("Educazione fisica")`), null);
});
