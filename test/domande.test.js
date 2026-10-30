// Scelta dei concetti e filtro delle domande che girano nella Edge Function.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { debolezza, preparaPool, tieniAncorate } from "../supabase/functions/_shared/domande.js";
import { promptDomande } from "../supabase/functions/_shared/prompt.js";

const ARG = {
  id: "uuid-arg", titolo: "La Scuola poetica siciliana", materia: "italiano",
  trascrizione: "Il sonetto è composto di 14 versi endecasillabi suddivisi in due quartine e due terzine. " +
    "La parola sonetto deriva dal provenzale sonet, che significa suono.",
  concetti: [
    { id: "uuid-c1", titolo: "Struttura del sonetto", descrizione: "14 endecasillabi", ancora: "14 versi endecasillabi", peso: 3, media: null },
    { id: "uuid-c2", titolo: "Origine della parola", descrizione: "sonet = suono", ancora: "deriva dal provenzale sonet", peso: 2, media: 9 },
  ],
};

test("debolezza come nel prototipo: mai verificato vale 6, poi 10 meno la media", () => {
  assert.equal(debolezza({ media: null }), 6);
  assert.equal(debolezza({ media: 7.5 }), 2.5);
});

test("al modello i concetti arrivano con id brevi e l'andamento", () => {
  const { contesto, indice } = preparaPool([ARG], false);
  assert.deepEqual(contesto.map((c) => [c.id, c.andamento]), [["c1", "mai verificato"], ["c2", "ultima volta 9.0/10"]]);
  assert.equal(indice.c1.c.id, "uuid-c1");
});

test("nel ripasso restano i 12 concetti più deboli, pesati per importanza", () => {
  const molti = { ...ARG, concetti: Array.from({ length: 20 }, (_, i) => ({ id: "k" + i, titolo: "t", descrizione: "", ancora: "a", peso: 1, media: i % 10 })) };
  const { pool } = preparaPool([molti], true);
  assert.equal(pool.length, 12);
  assert.ok(pool.every((p, i) => i === 0 || pool[i - 1].score >= p.score));
});

test("passano solo le domande ancorate e ben formate, ricollegate al concetto vero", () => {
  const { indice } = preparaPool([ARG], false);
  const r = tieniAncorate([
    { concetto_id: "c1", tipo: "chiusa", testo: "Quanti versi ha il sonetto?", opzioni: ["12", "14", "16", "11"], corretta: 1,
      ancora: "Il sonetto è composto di 14 versi endecasillabi" },
    { concetto_id: "c2", tipo: "aperta", testo: "Da dove viene la parola sonetto?", risposta_attesa: "Dal provenzale sonet, suono",
      elementi: ["provenzale", "suono"], ancora: "La parola sonetto deriva dal provenzale sonet" },
    // vera ma non nel materiale
    { concetto_id: "c1", tipo: "aperta", testo: "Chi inventò il sonetto?", risposta_attesa: "Jacopo da Lentini",
      ancora: "Jacopo da Lentini notaio inventò il sonetto alla corte" },
    // concetto inesistente
    { concetto_id: "c9", tipo: "chiusa", testo: "x", opzioni: ["a", "b", "c", "d"], corretta: 0, ancora: "14 versi endecasillabi" },
    // chiusa con la corretta fuori dalle opzioni
    { concetto_id: "c1", tipo: "chiusa", testo: "x", opzioni: ["a", "b", "c", "d"], corretta: 4, ancora: "14 versi endecasillabi" },
  ], indice, [ARG]);
  assert.equal(r.scartate, 3);
  assert.deepEqual(r.domande.map((d) => [d.id, d.tipo, d.concetto_id, d.argomento_id]), [
    ["d1", "chiusa", "uuid-c1", "uuid-arg"], ["d2", "aperta", "uuid-c2", "uuid-arg"],
  ]);
  assert.equal(r.domande[0].concetto_titolo, "Struttura del sonetto");
});

test("il prompt delle domande cambia con livello, tipo e modalità come nel prototipo", () => {
  const base = { contesto: [], gia: [], materiale: [{ titolo: "x", trascrizione: "y" }], ripasso: false };
  const orale = promptDomande({ ...base, livello: "medio", tipo: "miste", modalita: "orale" });
  assert.match(orale, /8 domande: quattro chiuse a quattro opzioni e quattro aperte brevi/);
  assert.match(orale, /interrogazione orale/);
  const scritta = promptDomande({ ...base, livello: "difficile", tipo: "aperte", modalita: "scritta", gia: ["Q1"] });
  assert.match(scritta, /6 domande: tutte aperte/);
  assert.match(scritta, /verifica scritta/);
  assert.match(scritta, /non riproporle uguali[\s\S]*"Q1"/);
});

test("verifica da stampare: il numero di domande si sceglie (10, 15, 20); senza scelta il prompt resta quello del prototipo", () => {
  const base = { contesto: [], gia: [], materiale: [ARG], livello: "medio", modalita: "scritta" };
  const miste = promptDomande({ ...base, tipo: "miste", quante: 15 });
  assert.match(miste, /15 domande: otto chiuse a quattro opzioni e sette aperte brevi\./);
  assert.match(promptDomande({ ...base, tipo: "chiuse", quante: 20 }), /20 domande: tutte a scelta multipla/);
  assert.match(promptDomande({ ...base, tipo: "aperte", quante: 10 }), /10 domande: tutte aperte/);
  // senza quante, o con un numero non previsto, lo stesso testo di prima
  const prima = promptDomande({ ...base, tipo: "miste" });
  assert.match(prima, /8 domande: quattro chiuse a quattro opzioni e quattro aperte brevi/);
  assert.equal(promptDomande({ ...base, tipo: "miste", quante: 13 }), prima);
});

test("verifica da stampare: con le miste resta la proporzione chiuse/aperte del livello, riscalata, e il suo taglio", () => {
  const base = { contesto: [], gia: [], materiale: [ARG], modalita: "scritta", tipo: "miste" };
  const p = (livello, quante) => promptDomande({ ...base, livello, quante });
  // semplice: 5 chiuse e 2 aperte su 7 → circa 70% chiuse
  assert.match(p("semplice", 10), /10 domande: sette chiuse a quattro opzioni e tre aperte brevissime\. Resta sul riconoscimento/);
  assert.match(p("semplice", 20), /20 domande: quattordici chiuse a quattro opzioni e sei aperte brevissime\./);
  // medio: metà e metà
  assert.match(p("medio", 10), /10 domande: cinque chiuse a quattro opzioni e cinque aperte brevi\. Chiedi di spiegare/);
  // difficile: 2 chiuse e 4 aperte su 6 → un terzo chiuse
  assert.match(p("difficile", 15), /15 domande: cinque chiuse difficili e dieci aperte lunghe\. Chiedi cause e conseguenze/);
  assert.match(p("difficile", 20), /20 domande: sette chiuse difficili e tredici aperte lunghe\./);
});

test("il web non entra mai nella verifica: un concetto con fonte web non produce domande", () => {
  const web = { id: "uuid-w1", titolo: "La peste in Cina", descrizione: "dal web", ancora: "La peste partì dalla Cina", peso: 3, media: null, fonte: "web" };
  const arg = { ...ARG, concetti: [...ARG.concetti, web] };
  for (const ripasso of [false, true]) {
    const { pool, contesto } = preparaPool([arg], ripasso);
    assert.ok(!pool.some((p) => p.c.fonte === "web"), "un concetto dal web è finito fra quelli da chiedere");
    assert.ok(!contesto.some((c) => c.titolo === "La peste in Cina"));
    assert.equal(pool.length, 2);
  }
  // Anche se il modello inventasse una domanda su quel concetto, non passa.
  const { indice } = preparaPool([arg], false);
  const r = tieniAncorate([{ id: "d1", concetto_id: "c3", tipo: "aperta", testo: "Da dove partì la peste?", risposta_attesa: "Dalla Cina", elementi: [], ancora: "La peste partì dalla Cina" }], indice, [arg]);
  assert.equal(r.domande.length, 0);
});

test("domande e mappa leggono il materiale fino a 120.000 caratteri, non più 16.000 (issue #10)", async () => {
  const { promptDomande, promptMappa, MAX_MATERIALE } = await import("../supabase/functions/_shared/prompt.js");
  assert.equal(MAX_MATERIALE, 120_000);
  const lungo = "a".repeat(100_000) + " FINE-CAPITOLO " + "b".repeat(30_000);
  const pd = promptDomande({ livello: "medio", tipo: "miste", modalita: "scritta", ripasso: false, contesto: [], gia: [],
    materiale: [{ titolo: "Capitolo", trascrizione: lungo }] });
  assert.match(pd, /FINE-CAPITOLO/);
  assert.ok(!pd.includes("b".repeat(30_000)), "oltre 120.000 si taglia");
  const pm = promptMappa({ titolo: "Capitolo", materia: "storia", trascrizione: lungo, concetti: [] }, 10);
  assert.match(pm, /FINE-CAPITOLO/);
});

test("prova lampo su un concetto (issue #11): tre domande sullo stesso concetto, nel tipo scelto", async () => {
  const { promptDomande, DOMANDE_PER_CONCETTO } = await import("../supabase/functions/_shared/prompt.js");
  assert.equal(DOMANDE_PER_CONCETTO, 3);
  const base = { livello: "medio", modalita: "scritta", ripasso: false, contesto: [], gia: [], materiale: [{ titolo: "x", trascrizione: "y" }], soloConcetto: true };
  assert.match(promptDomande({ ...base, tipo: "miste" }), /Prova lampo su un concetto solo: tre domande sullo stesso concetto: due chiuse a quattro opzioni e una aperta breve/);
  assert.match(promptDomande({ ...base, tipo: "chiuse" }), /tutte a scelta multipla/);
  assert.doesNotMatch(promptDomande({ ...base, tipo: "miste" }), /^\d+ domande:/m);
});

test("prova lampo: per le miste due chiuse e una aperta scelte per tipo, id rinumerati", async () => {
  const { sceltaLampo, MIN_LAMPO } = await import("../supabase/functions/_shared/domande.js");
  assert.equal(MIN_LAMPO, 2);
  const d = (id, tipo) => ({ id, tipo });
  const scelte = sceltaLampo([d("d1", "chiusa"), d("d2", "chiusa"), d("d3", "chiusa"), d("d4", "aperta")], "miste");
  assert.deepEqual(scelte.map((x) => x.tipo), ["chiusa", "chiusa", "aperta"]);
  assert.deepEqual(scelte.map((x) => x.id), ["d1", "d2", "d3"]);
  assert.equal(sceltaLampo([d("d1", "aperta"), d("d2", "aperta"), d("d3", "chiusa")], "miste").length, 3);
  assert.deepEqual(sceltaLampo([d("d1", "chiusa"), d("d2", "chiusa"), d("d3", "chiusa"), d("d4", "chiusa")], "chiuse").map((x) => x.id), ["d1", "d2", "d3"]);
});
