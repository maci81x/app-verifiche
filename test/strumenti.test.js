// Issue #24, la parte del server: date, vocaboli e schemi estratti dagli appunti, solo se ancorati.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { annoDi, inTrascrizione, linguaDi, dateAncorate, vocaboliAncorati, schemaAncorato, promptStrumento, TIPI_STRUMENTO }
  from "../supabase/functions/_shared/strumenti.js";

test("anno di una data scritta: a.C./d.C., secoli romani e arabi, giorno e mese", () => {
  assert.equal(annoDi("1492"), 1492);
  assert.equal(annoDi("476 d.C."), 476);
  assert.equal(annoDi("753 a.C."), -753);
  assert.equal(annoDi("753 a. C."), -753);
  assert.equal(annoDi("44 avanti Cristo"), -44);
  assert.equal(annoDi("XV secolo"), 1450);
  assert.equal(annoDi("sec. XV"), 1450);
  assert.equal(annoDi("nel XV sec."), 1450);
  assert.equal(annoDi("V secolo a.C."), -450);
  assert.equal(annoDi("15° secolo"), 1450);
  assert.equal(annoDi("12 ottobre 1492"), 1492);
  assert.equal(annoDi("1° gennaio 1948"), 1948);
  assert.equal(annoDi("1347-1351"), 1347);
  assert.equal(annoDi("tanto tempo fa"), null);
  assert.equal(annoDi(""), null);
  // l'ordine che conta: 753 a.C. < V sec. a.C. < 476 d.C. < XV secolo < 1492
  const v = ["1492", "XV secolo", "476 d.C.", "V secolo a.C.", "753 a.C."].map(annoDi);
  assert.deepEqual([...v].sort((a, b) => a - b), [-753, -450, 476, 1450, 1492]);
});

test("pezzo nella trascrizione: sottostringa vera, a parole intere, maiuscole e spazi a parte", () => {
  const t = "Nel 476 d.C.  cadde l'Impero romano d'Occidente. The cat is on the table.";
  assert.equal(inTrascrizione("476 d.C.", t), true);
  assert.equal(inTrascrizione("476 D.C.", t), true);
  assert.equal(inTrascrizione("477 d.C.", t), false);
  assert.equal(inTrascrizione("47", t), false);       // dentro un numero non vale
  assert.equal(inTrascrizione("cat", t), true);
  assert.equal(inTrascrizione("ca", t), false);
  assert.equal(inTrascrizione("table", t), true);
  assert.equal(inTrascrizione("", t), false);
});

test("lingua: dalla materia, se no quella rilevata; altrimenti nessuna", () => {
  assert.equal(linguaDi("Inglese", null), "en-GB");
  assert.equal(linguaDi("spagnolo", "en-GB"), "es-ES");
  assert.equal(linguaDi("Francese", null), "fr-FR");
  assert.equal(linguaDi("Tedesco", null), "de-DE");
  assert.equal(linguaDi("Lingue", "de-DE"), "de-DE");
  assert.equal(linguaDi("Lingue", "altra"), null);
  assert.equal(linguaDi("Storia", "it-IT"), null);
});

const STORIA = { materia: "Storia", titolo: "Il Medioevo", concetti: [],
  trascrizione: "Nel 476 d.C. cade l'Impero romano d'Occidente: comincia il Medioevo. Nel 1492 Cristoforo Colombo arriva in America. Nel XV secolo nasce la stampa a caratteri mobili." };

test("date: solo quelle scritte negli appunti, con la frase che le contiene ancorata", () => {
  const r = dateAncorate({ eventi: [
    { data: "476 d.C.", evento: "Cade l'Impero romano d'Occidente", ancora: "Nel 476 d.C. cade l'Impero romano d'Occidente" },
    { data: "1492", evento: "Colombo arriva in America", ancora: "Nel 1492 Cristoforo Colombo arriva in America" },
    { data: "XV secolo", evento: "Nasce la stampa", ancora: "Nel XV secolo nasce la stampa a caratteri mobili" },
    { data: "1453", evento: "Cade Costantinopoli", ancora: "Nel 1453 cade Costantinopoli" },              // non scritta
    { data: "1493", evento: "Colombo arriva in America", ancora: "Nel 1492 Cristoforo Colombo arriva in America" }, // data sbagliata
    { data: "1492", evento: "Colombo arriva in America", ancora: "Nel 1492 Cristoforo Colombo arriva in America" }, // doppione
    { data: "1492", evento: "Colombo in India", ancora: "Nel 1492 Colombo arrivò in India con tre caravelle" },  // ancora che non regge
  ] }, STORIA);
  assert.deepEqual(r.eventi.map((e) => [e.data, e.anno]), [["476 d.C.", 476], ["1492", 1492], ["XV secolo", 1450]]);
  assert.equal(r.eventi[0].ancora, "Nel 476 d.C. cade l'Impero romano d'Occidente");
  assert.equal(r.scartati, 4);
  assert.deepEqual(dateAncorate(null, STORIA), { eventi: [], scartati: 0 });
});

const INGLESE = { materia: "Inglese", titolo: "Animals", concetti: [],
  trascrizione: "Vocabulary: dog = cane, cat = gatto, horse = cavallo.\nI have got a dog. My cat is black." };

test("vocaboli: coppie scritte negli appunti (parola e traduzione), frasi copiate, lingua dalla materia", () => {
  const r = vocaboliAncorati({ lingua: "en-GB", vocaboli: [
    { parola: "dog", traduzione: "cane" }, { parola: "cat", traduzione: "gatto" }, { parola: "horse", traduzione: "cavallo" },
    { parola: "cow", traduzione: "mucca" },           // non c'è
    { parola: "horse", traduzione: "pony" },          // traduzione non scritta
    { parola: "dog", traduzione: "cane" },            // doppione
  ], frasi: ["I have got a dog.", "My cat is black.", "I have got a cat.", "Hi"] }, INGLESE);
  assert.equal(r.lingua, "en-GB");
  assert.deepEqual(r.vocaboli, [{ parola: "dog", traduzione: "cane" }, { parola: "cat", traduzione: "gatto" }, { parola: "horse", traduzione: "cavallo" }]);
  assert.deepEqual(r.frasi, ["I have got a dog.", "My cat is black."]);
  assert.equal(r.scartati, 5);
  assert.equal(vocaboliAncorati({ lingua: "altra", vocaboli: [], frasi: [] }, { ...INGLESE, materia: "Storia" }).lingua, null);
});

const SCIENZE = { materia: "Scienze", titolo: "Il fiore", concetti: [],
  trascrizione: "Le parti del fiore. Il calice è formato dai sepali. La corolla è formata dai petali. Lo stame produce il polline. Il pistillo contiene l'ovario." };

test("schema: termini scritti negli appunti, ognuno con la sua frase; da 3 a 8, se no niente schema", () => {
  const r = schemaAncorato({ titolo: "Le parti del fiore", forma: "parti", etichette: [
    { termine: "calice", ancora: "Il calice è formato dai sepali" },
    { termine: "corolla", ancora: "La corolla è formata dai petali" },
    { termine: "stame", ancora: "Lo stame produce il polline" },
    { termine: "pistillo", ancora: "Il pistillo contiene l'ovario" },
    { termine: "ricettacolo", ancora: "Il ricettacolo sostiene il fiore" },  // non c'è
    { termine: "stame", ancora: "Il pistillo contiene l'ovario" },          // termine non nella sua frase
  ] }, SCIENZE);
  assert.equal(r.forma, "parti");
  assert.equal(r.titolo, "Le parti del fiore");
  assert.deepEqual(r.etichette.map((e) => e.termine), ["calice", "corolla", "stame", "pistillo"]);
  assert.equal(r.scartati, 2);
  assert.equal(schemaAncorato({ titolo: "x", forma: "boh", etichette: r.etichette }, SCIENZE).forma, "parti");
  assert.equal(schemaAncorato({ titolo: "x", forma: "ciclo", etichette: r.etichette.slice(0, 2) }, SCIENZE).etichette.length, 0);
});

test("prompt degli strumenti: chiede di copiare dal materiale, niente aggiunte, voce neutra", () => {
  assert.deepEqual(TIPI_STRUMENTO, ["date", "vocaboli", "schema"]);
  for (const tipo of TIPI_STRUMENTO) {
    const p = promptStrumento(tipo, STORIA);
    assert.match(p, /copia|copiat/i);
    assert.match(p, /Nel 476 d\.C\./);
    assert.doesNotMatch(p, /\balunn[ae]\b|ragazza/);
  }
});

test("revisione: giorno e mese non sono l'anno; «prima di Cristo» e «av. Cr.»", () => {
  assert.equal(annoDi("24 agosto 79 d.C."), 79);
  assert.equal(annoDi("15 marzo 44 a.C."), -44);
  assert.equal(annoDi("1° gennaio 1948"), 1948);
  assert.equal(annoDi("509 prima di Cristo"), -509);
  assert.equal(annoDi("509 av. Cr."), -509);
  assert.equal(annoDi("12 ottobre 1492"), 1492);
});

test("revisione: parola e traduzione vicine (stessa riga o entro 80 caratteri), niente traduzioni di 1-2 lettere", () => {
  const a = { materia: "Inglese", titolo: "x", concetti: [],
    trascrizione: "dog = cane\ncat - gatto\nI have a horse.\n" + "x".repeat(100) + "\nIl cavallo corre.\nsun = il\nmela: apple" };
  const r = vocaboliAncorati({ lingua: "en-GB", vocaboli: [
    { parola: "dog", traduzione: "cane" }, { parola: "cat", traduzione: "gatto" },
    { parola: "horse", traduzione: "cavallo" },   // lontane e su righe diverse
    { parola: "sun", traduzione: "il" },          // traduzione di 2 lettere
    { parola: "apple", traduzione: "mela" },      // ordine inverso, stessa riga
  ], frasi: [] }, a);
  assert.deepEqual(r.vocaboli.map((v) => v.parola), ["dog", "cat", "apple"]);
  assert.equal(r.scartati, 2);
});

test("revisione: l'evento deve reggere sulla sua frase (parole in comune), se no si scarta", () => {
  const r = dateAncorate({ eventi: [
    { data: "1492", evento: "Colombo arriva in America", ancora: "Nel 1492 Cristoforo Colombo arriva in America" },
    { data: "1492", evento: "Cade Costantinopoli", ancora: "Nel 1492 Cristoforo Colombo arriva in America" },
    { data: "476 d.C.", evento: "Fine dell'Impero d'Occidente", ancora: "Nel 476 d.C. cade l'Impero romano d'Occidente" },
  ] }, STORIA);
  assert.deepEqual(r.eventi.map((e) => e.evento), ["Colombo arriva in America", "Fine dell'Impero d'Occidente"]);
  assert.equal(r.scartati, 1);
});
