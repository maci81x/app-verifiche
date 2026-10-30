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
  assert.equal(ancoraRegge("alfa beta gamma delta epsilon zeta theta qqqa qqqb qqqd", fonte), true);
  assert.equal(ancoraRegge("alfa beta gamma delta epsilon zeta qqqa qqqb qqqd qqqe", fonte), false);
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
  assert.equal(ancoraRegge("sonetto composto 14 versi endecasillabi", FONTE), true);
});

test("la finestra: abbastanza larga per poche parole in mezzo, non per mezza pagina", () => {
  // «corte palermitana di Federico»: una parola in mezzo, regge.
  assert.equal(ancoraRegge("corte palermitana Federico", FONTE), true);
  // «corte ... imperatore»: in mezzo c'è mezza frase, troppo lontano.
  assert.equal(ancoraRegge("corte imperatore", FONTE), false);
});

test("la fonte è solo testo degli appunti: trascrizione e ancore, non titoli e descrizioni scritti dal modello", () => {
  assert.equal(ancoraRegge("Federico II di Svevia", FONTE), true);
  assert.equal(ancoraRegge("Federico Barbarossa", FONTE), false); // 1 su 2 = 50%
  const conDescrizione = fonteDi([{ trascrizione: "La peste arrivò nel 1347.", concetti: [
    { ancora: "La peste arrivò nel 1347", titolo: "Il contagio", descrizione: "Trasmessa dalle pulci dei ratti neri" }] }]);
  assert.doesNotMatch(conDescrizione, /pulci|contagio/);
  assert.equal(ancoraRegge("Trasmessa dalle pulci dei ratti neri", conDescrizione), false);
});

// Un paragrafo vero di libro, per i fatti cambiati (revisione della issue #10).
const RIVOLUZIONE = normalizza(
  "Il 14 luglio 1789 il popolo di Parigi assaltò la Bastiglia, la prigione simbolo del potere del re. " +
  "Nel 1791 il re tentò di fuggire con la famiglia, ma fu riconosciuto e arrestato a Varennes. " +
  "La Rivoluzione francese cominciò nel 1789 e cambiò per sempre la storia d'Europa.");

test("un'ancora con un fatto cambiato non regge: numero, nome, mese, negazione", () => {
  assert.equal(ancoraRegge("Il 14 luglio 1789 il popolo di Parigi assaltò la Bastiglia", RIVOLUZIONE), true);
  assert.equal(ancoraRegge("La Rivoluzione francese cominciò nel 1799", RIVOLUZIONE), false, "anno cambiato");
  assert.equal(ancoraRegge("Il 14 luglio il popolo di Versailles assaltò la Bastiglia", RIVOLUZIONE), false, "nome cambiato");
  assert.equal(ancoraRegge("Il 14 agosto 1789 il popolo di Parigi assaltò la Bastiglia", RIVOLUZIONE), false, "mese cambiato");
  assert.equal(ancoraRegge("il re non fu riconosciuto e arrestato a Varennes", RIVOLUZIONE), false, "negazione aggiunta");
  assert.equal(ancoraRegge("Il 14 luglio il popolo di Parigi assaltò la Bastiglia", RIVOLUZIONE), false, "anno tolto dal mezzo");
});

test("negazione tolta: il tratto degli appunti dice «non», l'ancora no", () => {
  const fonte = normalizza("Il re non riuscì a fuggire dalla Francia e venne arrestato.");
  assert.equal(ancoraRegge("Il re non riuscì a fuggire dalla Francia", fonte), true);
  assert.equal(ancoraRegge("Il re riuscì a fuggire dalla Francia", fonte), false);
});

test("accenti composti in modo diverso (NFC/NFD) e ancore lunghissime", () => {
  const fonte = normalizza("Perché la città è così grande");
  assert.equal(ancoraRegge("Perche\u0301 la citta\u0300 e\u0300 così grande", fonte), true);
  assert.equal(ancoraRegge("città grande ".repeat(100), fonte), false);
});
