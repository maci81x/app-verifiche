// Pulizia dei concetti e prompt che girano nella Edge Function.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizzaConcetti, concettiAncorati } from "../supabase/functions/_shared/concetti.js";
import { quantiConcetti, promptConcetti, promptConcettiNuovi } from "../supabase/functions/_shared/prompt.js";

test("peso fra 1 e 3 (0 o mancante vale 2, come nel prototipo), scartati i concetti senza ancora", () => {
  const c = normalizzaConcetti([
    { titolo: " Peste nera ", descrizione: "arriva nel 1347", ancora: "nel 1347", peso: 7 },
    { titolo: "Senza ancora", ancora: "  " },
    { titolo: "Flagellanti", ancora: "i flagellanti", peso: 0, errore_appunti: "  " },
    { titolo: "Peso mancante", ancora: "x", errore_appunti: "negli appunti: 1348" },
    null,
  ], 5);
  assert.deepEqual(c.map((x) => [x.titolo, x.peso, x.ordine, x.errore_appunti]), [
    ["Peste nera", 3, 5, null], ["Flagellanti", 2, 6, null], ["Peso mancante", 2, 7, "negli appunti: 1348"],
  ]);
});

test("i concetti con un'ancora che non sta nel testo vengono scartati", () => {
  const testo = "Il sonetto è composto di 14 versi endecasillabi suddivisi in due quartine e due terzine.";
  const r = concettiAncorati([
    { titolo: "Struttura del sonetto", ancora: "14 versi endecasillabi suddivisi in due quartine", peso: 3 },
    { titolo: "Autore", ancora: "Amor è uno desio fu scritto da Jacopo da Lentini", peso: 2 },
    { titolo: "Vuoto", ancora: "" },
  ], testo);
  assert.deepEqual(r.concetti.map((c) => [c.titolo, c.ordine]), [["Struttura del sonetto", 0]]);
  assert.equal(r.non_ancorati, 1);
  assert.equal(r.senza_ancora, 1);
});

test("circa 4 concetti per pagina, minimo 4, massimo 40", () => {
  assert.deepEqual([0, 1, 4, 20, 50].map(quantiConcetti), [4, 4, 16, 40, 40]);
});

test("i prompt dicono quanti concetti, vietano il vero-ma-non-scritto e fanno vincere il libro", () => {
  for (const p of [promptConcetti("italiano", "Scuola siciliana", "testo", 4), promptConcettiNuovi(["a"], "testo", 4)]) {
    assert.match(p, /16/);
    assert.match(p, /vera ma non scritta/);
    assert.match(p, /vale il libro/);
    assert.match(p, /errore_appunti/);
  }
  assert.match(promptConcetti("italiano", "x", "t", 20), /circa 40/);
});
