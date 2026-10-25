// Il filtro di ancoraggio: nessuna domanda (e nessun concetto) arriva all'alunna
// se la sua ancora non regge sul materiale.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizza, fonteDi, ancoraRegge, ancorata, SOGLIA } from "../supabase/functions/_shared/ancoraggio.js";

// Testo vero, dalla pagina 24 del libro fotografata il 25 ottobre 2026.
const ARGOMENTO = {
  trascrizione:
    "Con il nome di Scuola poetica siciliana si indicano i poeti che, tra il 1230 e il 1250, composero le loro opere " +
    "alla corte palermitana di Federico II di Svevia, re di Sicilia, e poi imperatore del Sacro romano impero. " +
    "Il sonetto è composto di 14 versi endecasillabi (cioè di undici sillabe) suddivisi in due quartine e due terzine.",
  concetti: [
    { id: "c1", titolo: "Che cos'è la Scuola siciliana", descrizione: "Poeti alla corte di Federico II", ancora: "tra il 1230 e il 1250" },
    { id: "c2", titolo: "La struttura del sonetto", descrizione: "14 endecasillabi", ancora: "14 versi endecasillabi" },
  ],
};
const FONTE = fonteDi([ARGOMENTO]);
const INDICE = { c1: true, c2: true };

test("la soglia è il 60% del prototipo", () => assert.equal(SOGLIA, 0.6));

test("normalizza come il prototipo: minuscole, accenti italiani tenuti, punteggiatura via", () => {
  assert.equal(normalizza("  L'«Amor» è  UNO desio, che ven da CORE! "), "l amor è uno desio che ven da core");
});

test("una domanda con l'ancora copiata dal materiale passa", () => {
  const d = { concetto_id: "c2", ancora: "Il sonetto è composto di 14 versi endecasillabi" };
  assert.equal(ancorata(d, INDICE, FONTE), true);
});

test("una domanda su una cosa che nel materiale non c'è viene scartata", () => {
  // Vera, ma il materiale non parla di Dante.
  const d = { concetto_id: "c1", ancora: "Dante Alighieri citò i siciliani nel De vulgari eloquentia" };
  assert.equal(ancorata(d, INDICE, FONTE), false);
});

test("una domanda legata a un concetto che non esiste viene scartata anche se l'ancora regge", () => {
  const d = { concetto_id: "c99", ancora: "Il sonetto è composto di 14 versi endecasillabi" };
  assert.equal(ancorata(d, INDICE, FONTE), false);
});

test("un'ancora troppo corta per dire qualcosa non regge", () => {
  assert.equal(ancoraRegge("il sonetto", FONTE), false); // una sola parola di oltre tre lettere
  assert.equal(ancoraRegge("", FONTE), false);
});

test("il confine: 3 parole su 5 presenti (60%) passa, 2 su 5 (40%) no", () => {
  // parole lunghe: sonetto, versi, endecasillabi + due inventate
  assert.equal(ancoraRegge("sonetto versi endecasillabi zzzuno zzzdue", FONTE), true);
  assert.equal(ancoraRegge("sonetto versi zzzuno zzzdue zzztre", FONTE), false);
});

test("la fonte comprende anche titoli, descrizioni e ancore dei concetti", () => {
  // "Svevia" è nella trascrizione, "Federico" anche nella descrizione di c1
  assert.equal(ancoraRegge("Federico Svevia", FONTE), true);
  assert.equal(ancoraRegge("Federico Barbarossa", FONTE), false); // 1 su 2 = 50%
});
