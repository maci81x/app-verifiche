// Smistamento delle foto del giorno e date del diario (issue #19).   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { risolviData, lettaDavvero, smistamento, oggiValido, tipoDaFrase } from "../supabase/functions/_shared/smista.js";

// Domenica 15 novembre 2026.
const OGGI = "2026-11-15";
// Mercoledì 18 novembre 2026: «venerdì» e «venerdì prossimo» sono giorni diversi.
const MERCOLEDI = "2026-11-18";

test("oggi deve essere una data vera", () => {
  assert.ok(oggiValido(OGGI));
  assert.equal(oggiValido("2026-02-30"), null);
  assert.equal(oggiValido("15/11/2026"), null);
});

test("giorno della settimana: il prossimo dopo oggi", () => {
  assert.equal(risolviData("Verifica di matematica giovedì", OGGI), "2026-11-19");
  assert.equal(risolviData("interrogazione lunedi", OGGI), "2026-11-16"); // senza accento
  assert.equal(risolviData("verifica venerdì", MERCOLEDI), "2026-11-20");
  // Oggi è mercoledì: «mercoledì» è quello della settimana dopo, non oggi.
  assert.equal(risolviData("verifica mercoledì", MERCOLEDI), "2026-11-25");
});

test("«prossimo»: il giorno della settimana dopo", () => {
  assert.equal(risolviData("verifica venerdì prossimo", MERCOLEDI), "2026-11-27");
  assert.equal(risolviData("la prossima settimana interrogazione martedì", MERCOLEDI), "2026-11-24");
  // Di domenica la settimana dopo comincia domani.
  assert.equal(risolviData("lunedì prossimo verifica", OGGI), "2026-11-16");
});

test("giorno e numero: «giovedì 19» deve cadere davvero di giovedì", () => {
  assert.equal(risolviData("Verifica di matematica giovedì 19", OGGI), "2026-11-19");
  assert.equal(risolviData("verifica giovedì 3", OGGI), "2026-12-03"); // il 3 di questo mese è passato
  assert.equal(risolviData("verifica venerdì 19", OGGI), null);      // il 19 è giovedì: letta male
});

test("date scritte: giorno/mese, giorno e nome del mese", () => {
  assert.equal(risolviData("compito in classe il 24/11", OGGI), "2026-11-24");
  assert.equal(risolviData("verifica 3.12.2026", OGGI), "2026-12-03");
  assert.equal(risolviData("interrogazione 9 dicembre", OGGI), "2026-12-09");
  assert.equal(risolviData("verifica 12 gen.", "2026-12-20"), "2027-01-12"); // da dicembre, gennaio è l'anno dopo
  assert.equal(risolviData("verifica 31/02", OGGI), null);
});

test("domani e dopodomani", () => {
  assert.equal(risolviData("domani interrogazione di storia", OGGI), "2026-11-16");
  assert.equal(risolviData("dopodomani verifica", OGGI), "2026-11-17");
});

test("niente data, o data ambigua o passata: null", () => {
  assert.equal(risolviData("verifica di storia la settimana prossima", OGGI), null);
  assert.equal(risolviData("studiare pag. 4-5 per la verifica", OGGI), null); // pagine, non il 4 maggio
  assert.equal(risolviData("verifica giovedì ore 10.30", OGGI), "2026-11-19"); // l'orario non è una data
  assert.equal(risolviData("verifica giovedì o venerdì", OGGI), null);
  assert.equal(risolviData("verifica 3/11/2026", OGGI), null); // già passata
});

test("la frase letta deve stare nella trascrizione, a parole intere", () => {
  const tr = ["Diario. Mat: Verifica di matematica giovedì 19! Storia: studiare pag. 40"];
  assert.equal(lettaDavvero("verifica di matematica Giovedì 19", tr), true);
  assert.equal(lettaDavvero("Verifica di matematica giovedì 20", tr), false);
  assert.equal(lettaDavvero("Verifica di matematica giovedì 1", tr), false); // «19» non regge «1»
  assert.equal(lettaDavvero("", tr), false);
});

const ARGOMENTI = [
  { id: "a0000000-0000-4000-8000-000000000001", materia: "Storia", titolo: "La Rivoluzione francese" },
  { id: "a0000000-0000-4000-8000-000000000002", materia: "Matematica", titolo: "Le frazioni" },
];
const TRASCRIZIONI = [
  "La presa della Bastiglia avvenne il 14 luglio 1789.",
  "Il cuore ha quattro cavità: due atri e due ventricoli.",
  "Diario 16-20 novembre. Verifica di matematica giovedì 19. Interrogazione di storia lunedì prossimo.",
];

test("smistamento: una riga per foto, id brevi tradotti, materie come in libreria", () => {
  const r = smistamento({
    foto: [
      { foto: 1, materia: "storia", argomento: "a1", nuovo_titolo: "", confidenza: 0.934 },
      { foto: 2, materia: "scienze", argomento: "nuovo", nuovo_titolo: " Il cuore ", confidenza: 1.4 },
      { foto: 3, materia: "", argomento: "nessuno", nuovo_titolo: "", confidenza: 0.8 },
    ],
    scadenze: [],
  }, TRASCRIZIONI, ARGOMENTI, OGGI);
  assert.deepEqual(r.foto, [
    { materia: "Storia", argomento_id: ARGOMENTI[0].id, nuovo_titolo: null, confidenza: 0.93 },
    { materia: "scienze", argomento_id: null, nuovo_titolo: "Il cuore", confidenza: 1 },
    { materia: "", argomento_id: null, nuovo_titolo: null, confidenza: 0.8 },
  ]);
});

test("smistamento: id inventato, foto mancante o ripetuta non passano", () => {
  const r = smistamento({
    foto: [
      { foto: 1, materia: "Storia", argomento: "a9", nuovo_titolo: "", confidenza: 0.9 },
      { foto: 1, materia: "Storia", argomento: "a1", nuovo_titolo: "", confidenza: 0.9 },
      { foto: 7, materia: "Storia", argomento: "a1", nuovo_titolo: "", confidenza: 0.9 },
      { foto: 2, materia: "matematica", argomento: "nuovo", nuovo_titolo: "", confidenza: 0.5 },
    ],
    scadenze: [],
  }, TRASCRIZIONI, ARGOMENTI, OGGI);
  const vuota = { materia: "", argomento_id: null, nuovo_titolo: null, confidenza: 0 };
  assert.deepEqual(r.foto, [{ ...vuota, confidenza: 0.9 }, { ...vuota, confidenza: 0.5 }, vuota]);
});

test("scadenze: date lette davvero tenute, inventate scartate", () => {
  const r = smistamento({
    foto: [],
    scadenze: [
      { foto: 3, materia: "matematica", tipo: "scritta", testo_letto: "Verifica di matematica giovedì 19" },
      { foto: 3, materia: "Storia", tipo: "orale", testo_letto: "Interrogazione di storia lunedì prossimo" },
      // La stessa, ripetuta: una sola.
      { foto: 3, materia: "Matematica", tipo: "scritta", testo_letto: "Verifica di matematica giovedì 19" },
      // Data non scritta così sul diario.
      { foto: 3, materia: "Matematica", tipo: "scritta", testo_letto: "Verifica di matematica venerdì 20" },
      // Frase vera ma senza giorno.
      { foto: 1, materia: "Storia", tipo: "scritta", testo_letto: "La presa della Bastiglia" },
      // Tipo non ammesso.
      { foto: 3, materia: "Matematica", tipo: "pratica", testo_letto: "Verifica di matematica giovedì 19" },
    ],
  }, TRASCRIZIONI, ARGOMENTI, OGGI);
  assert.deepEqual(r.scadenze, [
    { materia: "Matematica", tipo: "scritta", data: "2026-11-19", testo_letto: "Verifica di matematica giovedì 19" },
    { materia: "Storia", tipo: "orale", data: "2026-11-16", testo_letto: "Interrogazione di storia lunedì prossimo" },
  ]);
  assert.equal(r.scartate, 4);
});

test("risposta vuota o rotta del modello: righe vuote, nessuna scadenza", () => {
  const r = smistamento(null, TRASCRIZIONI, ARGOMENTI, OGGI);
  assert.equal(r.foto.length, 3);
  assert.deepEqual(r.scadenze, []);
});

/* ---------------------------------------------------------------- prompt */
import { promptSmista } from "../supabase/functions/_shared/prompt.js";

test("prompt di smista: oggi, id brevi, foto numerate, frase copiata parola per parola, niente date dedotte", () => {
  const p = promptSmista({
    oggi: OGGI,
    trascrizioni: ["Pagina di storia", "Verifica di matematica giovedì 19"],
    argomenti: [{ breve: "a1", materia: "Storia", titolo: "La Rivoluzione francese" }],
  });
  assert.match(p, /Oggi è 2026-11-15\./);
  assert.match(p, /"breve":"a1"/);
  assert.doesNotMatch(p, /a0000000-/); // gli uuid non arrivano al modello
  assert.match(p, /Foto 1:\nPagina di storia/);
  assert.match(p, /Foto 2:\nVerifica di matematica giovedì 19/);
  assert.match(p, /argomento = "nuovo"/);
  assert.match(p, /argomento = "nessuno"/);
  assert.match(p, /copiata parola per parola dalla trascrizione/);
  assert.match(p, /Non dedurre una data, non completarla e non correggerla/);
  // La data la calcola smista.js, non il modello: nello schema di risposta non c'è.
  assert.doesNotMatch(p.slice(p.lastIndexOf("Rispondi solo con JSON")), /"data"/);
  // Voce di #17: nessun genere per chi studia.
  assert.doesNotMatch(p, /\balunn[ae]\b|un'alunna|\bragazza\b/);
});

test("testo_letto: la frase copiata deve essere una sottostringa vera, non una parafrasi", () => {
  const tr = ["Lunedì: compiti pag. 12. Interrogazione di storia lunedì prossimo, ripassare cap. 3."];
  assert.equal(lettaDavvero("Interrogazione di storia lunedì prossimo", tr), true);
  assert.equal(lettaDavvero("interrogazione di storia, lunedì prossimo", tr), true); // punteggiatura e maiuscole non contano
  assert.equal(lettaDavvero("Interrogazione storia lunedì prossimo", tr), false);   // parola saltata
  assert.equal(lettaDavvero("Interrogazione di storia martedì prossimo", tr), false); // giorno cambiato
  assert.equal(lettaDavvero("Interrogazione di storia lunedì prossimo", ["Interrogazione di storia", "lunedì prossimo"]), false); // fra due foto no
  // Nello smistamento la frase non letta fa scartare la scadenza anche se la data sarebbe valida.
  const r = smistamento({ foto: [], scadenze: [{ foto: 1, materia: "Storia", tipo: "orale", testo_letto: "Interrogazione di storia giovedì 19" }] }, tr, [], OGGI);
  assert.deepEqual(r.scadenze, []);
  assert.equal(r.scartate, 1);
});

/* ---------------------------------------------------------------- revisione #19 */
const LUNEDI = "2026-11-16";

test("«prossimo/a» conta solo vicino al giorno o alla settimana", () => {
  assert.equal(risolviData("Prossima verifica di storia giovedì", LUNEDI), "2026-11-19");
  assert.equal(risolviData("prossimo compito in classe venerdì", LUNEDI), "2026-11-20");
  assert.equal(risolviData("verifica giovedì prossimo", LUNEDI), "2026-11-26");
  assert.equal(risolviData("prossimo giovedì verifica", LUNEDI), "2026-11-26");
  assert.equal(risolviData("la prossima settimana interrogazione martedì", LUNEDI), "2026-11-24");
});

test("il mese solo dalla parola intera o dall'abbreviazione", () => {
  assert.equal(risolviData("verifica fra 2 settimane", LUNEDI), null);
  assert.equal(risolviData("interrogazione 3 martedì", LUNEDI), "2026-11-17"); // il giorno, non marzo
  assert.equal(risolviData("verifica: 1 genitore deve firmare", LUNEDI), null);
  assert.equal(risolviData("verifica 5 ottimo", LUNEDI), null);
  assert.equal(risolviData("verifica 3 dic", LUNEDI), "2026-12-03");
  assert.equal(risolviData("verifica 3 dicembre", LUNEDI), "2026-12-03");
  assert.equal(risolviData("verifica 9 nov.", "2026-11-01"), "2026-11-09");
});

test("data senza anno già passata: scartata, tranne gennaio e febbraio visti da dicembre", () => {
  assert.equal(risolviData("verifica 12 gen.", OGGI), null);           // novembre: gennaio è passato
  assert.equal(risolviData("verifica il 10/11", LUNEDI), null);
  assert.equal(risolviData("verifica 12 gen.", "2026-12-10"), "2027-01-12");
  assert.equal(risolviData("verifica 3/2", "2026-12-10"), "2027-02-03");
  assert.equal(risolviData("verifica 3/3", "2026-12-10"), null);
});

test("la frase letta deve dire verifica o interrogazione, non solo il giorno", () => {
  const tr = ["Giovedì 19. Domani. Oggi. Verifica di storia giovedì 19. Test di inglese venerdì. Orale di geografia lunedì."];
  assert.equal(lettaDavvero("Giovedì 19", tr), false);
  assert.equal(lettaDavvero("Domani", tr), false);
  assert.equal(lettaDavvero("Oggi", tr), false);
  assert.equal(lettaDavvero("Verifica di storia giovedì 19", tr), true);
  assert.equal(tipoDaFrase("Verifica di storia giovedì 19"), "scritta");
  assert.equal(tipoDaFrase("compito in classe di matematica"), "scritta");
  assert.equal(tipoDaFrase("Test di inglese venerdì"), "scritta");
  assert.equal(tipoDaFrase("Interrogazione di storia"), "orale");
  assert.equal(tipoDaFrase("Orale di geografia lunedì"), "orale");
  assert.equal(tipoDaFrase("Giovedì 19"), null);
});

test("il tipo deve essere coerente con la parola della frase", () => {
  const tr = ["Interrogazione di storia giovedì 19. Verifica di matematica venerdì 20."];
  const r = smistamento({ foto: [], scadenze: [
    { foto: 1, materia: "Storia", tipo: "scritta", testo_letto: "Interrogazione di storia giovedì 19" },
    { foto: 1, materia: "Matematica", tipo: "orale", testo_letto: "Verifica di matematica venerdì 20" },
    { foto: 1, materia: "Storia", tipo: "orale", testo_letto: "Interrogazione di storia giovedì 19" },
  ] }, tr, [], LUNEDI);
  assert.deepEqual(r.scadenze, [{ materia: "Storia", tipo: "orale", data: "2026-11-19", testo_letto: "Interrogazione di storia giovedì 19" }]);
  assert.equal(r.scartate, 2);
});
