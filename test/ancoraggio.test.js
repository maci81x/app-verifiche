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

test("la soglia è il 70% (issue #10; il prototipo aveva il 60%)", () => assert.equal(SOGLIA, 0.7));

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

test("il confine: 7 parole su 10 presenti (70%) passa, 6 su 10 (60%) no", () => {
  const fonte = normalizza("alfa beta gamma delta epsilon zeta theta iota kappa lambda");
  assert.equal(ancoraRegge("alfa beta gamma delta epsilon zeta theta xxxx yyyy wwww", fonte), true);
  assert.equal(ancoraRegge("alfa beta gamma delta epsilon zeta xxxx yyyy wwww qqqq", fonte), false);
});

test("un'ancora fatta di parole vere prese qua e là nella fonte viene scartata", () => {
  // Tutte le parole ci sono, ma sparse per tutto il materiale.
  assert.equal(ancoraRegge("Svevia sonetto palermitana quartine imperatore terzine", FONTE), false);
  assert.equal(ancorata({ concetto_id: "c1", ancora: "poeti corte Sicilia sonetto endecasillabi terzine" }, INDICE, FONTE), false);
});

test("le parole si confrontano intere, non dentro altre parole", () => {
  // «poeti» sta dentro «poetica», «sono» dentro «sonetto», «corte» dentro «cortese»: non contano.
  const fonte = normalizza("La poetica cortese del sonetto");
  assert.equal(ancoraRegge("poeti corte sono", fonte), false);
  assert.equal(ancoraRegge("poetica cortese sonetto", fonte), true);
});

test("le parole devono comparire nello stesso ordine dell'ancora", () => {
  assert.equal(ancoraRegge("endecasillabi versi composto sonetto", FONTE), false);
  assert.equal(ancoraRegge("sonetto composto versi endecasillabi", FONTE), true);
});

test("la finestra: abbastanza larga per poche parole in mezzo, non per mezza pagina", () => {
  // «Federico II di Svevia»: due parole in mezzo, finestra di 22 caratteri, regge.
  assert.equal(ancoraRegge("Federico Svevia", FONTE), true);
  // «corte ... imperatore»: in mezzo c'è mezza frase, troppo lontano.
  assert.equal(ancoraRegge("corte imperatore", FONTE), false);
});

test("la fonte comprende anche titoli, descrizioni e ancore dei concetti", () => {
  // "Svevia" è nella trascrizione, "Federico" anche nella descrizione di c1
  assert.equal(ancoraRegge("Federico Svevia", FONTE), true);
  assert.equal(ancoraRegge("Federico Barbarossa", FONTE), false); // 1 su 2 = 50%
});
