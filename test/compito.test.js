// Issue #27: «Aiutami con un compito». Logica del server (_shared/compito.js) e prompt.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { contoTorna, controllaCompito, stessoRisultato, pulisciCompito, pulisciRisposta, calcoliCheNonTornano, perClasse }
  from "../supabase/functions/_shared/compito.js";
import { promptCompito, promptCompitoDomanda, promptEserciziTipi, promptEserciziGenera, promptCorrezioneEsercizi }
  from "../supabase/functions/_shared/prompt.js";

const TESTO_PAOLO = "Paolo sta per sposarsi. Del suo stipendio di questo mese ha speso 1/6 per comprare gli anelli, 2/9 per il vestito elegante, 465 € come anticipo al ristorante. Gli rimangono ancora 305 €. Qual è lo stipendio di Paolo? [1260 €]";
const PAOLO = {
  esercizi: [], materia: "matematica", matematica: true, testo: TESTO_PAOLO,
  dati: ["1/6", "2/9", "465 €", "305 €"], cerca: "lo stipendio di Paolo", soluzione_libro: "1260 €",
  indizi: ["Somma le frazioni spese.", "Che frazione resta?", "Che cosa sono 465 € e 305 €?"],
  passi: [
    { titolo: "Frazioni spese", spiegazione: "Stesso denominatore, 18.", calcolo: "1/6 + 2/9 = 3/18 + 4/18 = 7/18", ancora: "" },
    { titolo: "Frazione che resta", spiegazione: "L'intero è 18/18.", calcolo: "18/18 - 7/18 = 11/18", ancora: "" },
    { titolo: "Cosa sono i due importi in euro", spiegazione: "Ristorante e avanzo.", calcolo: "465 + 305 = 770", ancora: "" },
    { titolo: "Collego frazione ed euro", spiegazione: "11/18 dello stipendio valgono 770 €.", calcolo: "", ancora: "" },
    { titolo: "Trovo 1/18", spiegazione: "Divido per 11.", calcolo: "770 : 11 = 70", ancora: "" },
    { titolo: "Trovo l'intero", spiegazione: "Moltiplico per 18.", calcolo: "70 × 18 = 1260", ancora: "" },
  ],
  risultato: { valore: "1260", unita: "€" },
  verifica: { spiegazione: "Rimetto 1260 € nel testo.", calcolo: "210 + 280 + 465 + 305 = 1260" },
  trucco: "I 465 € e i 305 € non sono frazioni: si sommano e valgono la frazione che resta.",
  domande_pronte: ["Come trovo lo stesso denominatore?", "Perché sommo 465 e 305?", "Me lo spieghi con un disegno?"],
};
const copia = (o) => JSON.parse(JSON.stringify(o));

test("conto che torna: ogni uguale si ricalcola, euro e unità non contano", () => {
  assert.equal(contoTorna("1/6 + 2/9 = 3/18 + 4/18 = 7/18"), true);
  assert.equal(contoTorna("70 × 18 = 1260"), true);
  assert.equal(contoTorna("465 € + 305 € = 770 €"), true);
  assert.equal(contoTorna("770 : 11 = 70"), true);
  assert.equal(contoTorna("70 × 18 = 1270"), false);
  assert.equal(contoTorna("3/18 + 4/18 = 7/36"), false);
  assert.equal(contoTorna("70 × 18"), false); // senza uguale non c'è niente da controllare
  assert.equal(contoTorna("x + 3 = 5"), false); // solo numeri
  assert.equal(contoTorna("12 × 5 = 60 cm²"), true);
});

test("compito di Paolo: passi, risultato e verifica tornano", () => {
  assert.deepEqual(controllaCompito(PAOLO), { ok: true });
});

test("un passo con un conto sbagliato viene rifiutato e si sa quale", () => {
  const c = copia(PAOLO); c.passi[4].calcolo = "770 : 11 = 77";
  assert.deepEqual(controllaCompito(c), { ok: false, motivo: "passo", passo: 5 });
});

test("il risultato deve essere quello dell'ultimo conto, la verifica deve rimetterlo nei dati", () => {
  const r = copia(PAOLO); r.risultato.valore = "1250";
  assert.equal(controllaCompito(r).motivo, "risultato");
  const v = copia(PAOLO); v.verifica.calcolo = "210 + 280 + 465 + 305 = 1250";
  assert.equal(controllaCompito(v).motivo, "verifica");
  const fuori = copia(PAOLO); fuori.verifica.calcolo = "1260 = 1260";
  assert.equal(controllaCompito(fuori).motivo, "verifica"); // non usa nessun dato del testo
  const senza = copia(PAOLO); senza.passi.forEach((p) => { p.calcolo = ""; });
  assert.equal(controllaCompito(senza).motivo, "passo");
});

test("soluzione del libro: frazioni equivalenti e scritture diverse dello stesso numero", () => {
  assert.equal(stessoRisultato("1.260,00 €", { valore: "1260", unita: "€" }), true);
  assert.equal(stessoRisultato("[1260 €]", { valore: "1260", unita: "€" }), true);
  assert.equal(stessoRisultato("3/4", { valore: "6/8", unita: "" }), true);
  assert.equal(stessoRisultato("0,75", { valore: "3/4", unita: "" }), true);
  assert.equal(stessoRisultato("1250 €", { valore: "1260", unita: "€" }), false);
  assert.equal(stessoRisultato("", { valore: "1260", unita: "€" }), null); // niente da confrontare
  const d = copia(PAOLO); d.soluzione_libro = "1250 €";
  assert.deepEqual(controllaCompito(d), { ok: false, motivo: "libro" });
});

test("parsing di compito: più esercizi = solo l'elenco; uno = scheda pulita", () => {
  assert.deepEqual(pulisciCompito({ ...copia(PAOLO), esercizi: [{ id: "274", inizio: "Paolo sta per sposarsi" }, { id: "275", inizio: "Un treno parte" }] }),
    { esercizi: [{ id: "274", inizio: "Paolo sta per sposarsi" }, { id: "275", inizio: "Un treno parte" }] });
  const c = pulisciCompito({ ...copia(PAOLO), indizi: ["a", "b", "c", "d", "e", "f", "g"], domande_pronte: ["1", "2", "3", "4"], extra: "x" });
  assert.equal(c.indizi.length, 5);
  assert.equal(c.domande_pronte.length, 3);
  assert.equal(c.matematica, true);
  assert.equal(c.passi[3].calcolo, "");
  assert.ok(!("extra" in c));
  assert.equal(pulisciCompito({ esercizi: [], testo: "", passi: [] }), null); // niente testo: niente scheda
});

test("parsing di compito_domanda: calcoli controllati, figura della barra nei limiti, prova tu", () => {
  const r = pulisciRisposta({ risposta: "Pensa a 18 fette.", calcoli: ["770 : 11 = 70", "  "], figura: { tipo: "barra_frazioni", parti: 18, colorate: 11, etichetta: "11/18" }, prova_tu: { testo: "Se 11 fette valgono 770 €, quanto vale 1 fetta?", risultato: { valore: "70", unita: "€" }, calcolo: "770 : 11 = 70", passo: 5, spiegazione: "" } });
  assert.deepEqual(r.calcoli, ["770 : 11 = 70"]);
  assert.deepEqual(r.figura, { tipo: "barra_frazioni", parti: 18, colorate: 11, etichetta: "11/18" });
  assert.match(r.prova_tu.testo, /1 fetta/);
  assert.equal(pulisciRisposta({ risposta: "x", calcoli: [], figura: { tipo: "barra_frazioni", parti: 99, colorate: 3, etichetta: "" }, prova_tu: "" }).figura, null);
  assert.equal(pulisciRisposta({ risposta: "x", calcoli: [], figura: { tipo: "nessuna", parti: 0, colorate: 0, etichetta: "" }, prova_tu: "" }).figura, null);
  assert.deepEqual(calcoliCheNonTornano({ calcoli: ["770 : 11 = 70", "70 × 18 = 1200"] }), ["70 × 18 = 1200"]);
  assert.equal(pulisciRisposta({ risposta: "" }), null);
});

test("classe del profilo nei prompt, forme neutre, niente alunna né ragazza", () => {
  assert.equal(perClasse("2"), "2ª media");
  assert.equal(perClasse("3ª media"), "3ª media");
  assert.equal(perClasse("5 elementare"), "scuola elementare");
  assert.equal(perClasse(null), "scuola media");
  const prompt = [
    promptCompito({ classe: "1", testo: TESTO_PAOLO }),
    promptCompitoDomanda({ classe: "2", compito: PAOLO, cronologia: [{ chi: "io", testo: "Perché 18?" }], domanda: "Il punto 5 me lo spieghi?" }),
    promptEserciziTipi("matematica", "frazioni", "testo"),
    promptEserciziGenera({ materia: "matematica", titolo: "frazioni", classe: "3", quanti: 5, tipi: [{ breve: "t1", titolo: "Problemi", ancora: "x", difficolta: 2, figura: false }] }),
    promptCorrezioneEsercizi({ classe: "2", pacchetto: [] }),
  ];
  for (const p of prompt) assert.doesNotMatch(p, /alunna|ragazza|ragazze|seconda media/i);
  assert.match(prompt[0], /1ª media/);
  assert.match(prompt[1], /2ª media/);
  assert.match(prompt[3], /3ª media/);
  assert.match(prompt[1], /forme neutre/i);
  assert.match(prompt[1], /Il punto 5 me lo spieghi\?/);
});

test("i problemi a parole ora si riconoscono e si generano", () => {
  assert.doesNotMatch(promptEserciziTipi("matematica", "frazioni", "testo"), /Niente problemi con testo lungo/);
  assert.doesNotMatch(promptEserciziGenera({ materia: "m", titolo: "t", classe: "2", quanti: 5, tipi: [] }), /Niente problemi con testo lungo/);
});

// ------------------------------------------------------------------ rilievi della revisione (#27)
import { indiziSenzaRisultato, eMatematica } from "../supabase/functions/_shared/compito.js";

test("la verifica deve usare davvero i dati del testo (almeno due, non le cifre delle frazioni)", () => {
  for (const finta of ["1260 × 1 = 1260", "630 × 2 = 1260", "1260 : 6 × 6 = 1260", "465 + 795 = 1260"]) {
    const c = copia(PAOLO); c.verifica.calcolo = finta;
    assert.equal(controllaCompito(c).motivo, "verifica", finta);
  }
  const frazioni = { ...copia(PAOLO), testo: "Calcola 1/2 + 1/3.", dati: ["1/2", "1/3"], soluzione_libro: "",
    passi: [{ titolo: "Somma", spiegazione: "", calcolo: "1/2 + 1/3 = 3/6 + 2/6 = 5/6", ancora: "" }],
    risultato: { valore: "5/6", unita: "" }, verifica: { spiegazione: "", calcolo: "5/6 - 1/3 = 1/2" } };
  frazioni.verifica.calcolo = "1/2 + 1/3 = 5/6"; // la verifica finisce con il risultato
  assert.deepEqual(controllaCompito(frazioni), { ok: true }); // senza altri dati basta una frazione del testo
});

test("unità: una sola per catena; le equivalenze si scrivono come conti", () => {
  assert.equal(contoTorna("1 km + 500 m = 501 m"), false);
  assert.equal(contoTorna("1,5 m = 150 cm"), false);
  assert.equal(contoTorna("1,5 × 100 = 150"), true);
  assert.equal(contoTorna("5 cm2 + 3 cm2 = 8 cm2"), true);
  assert.equal(contoTorna("5 cm² + 3 cm² = 8 cm²"), true);
});

test("scritture comuni: x come per, arrotondamenti confrontati con il valore esatto", () => {
  assert.equal(contoTorna("70 x 18 = 1260"), true);
  assert.equal(contoTorna("3,14 × 5 × 5 = 78,5"), true);
  assert.equal(contoTorna("1,44 = 1,4 = 1,35"), false);
  assert.equal(contoTorna("10 : 3 = 3,33"), true);
});

test("il ricalcolo non dipende solo da quello che dice il modello", () => {
  assert.equal(eMatematica({ matematica: false, materia: "geometria", passi: [] }), true);
  assert.equal(eMatematica({ matematica: false, materia: "", passi: [{ calcolo: "2 + 2 = 4" }] }), true);
  assert.equal(eMatematica({ matematica: false, materia: "storia", passi: [{ calcolo: "" }] }), false);
});

test("nessun indizio dice già il risultato", () => {
  const c = { ...copia(PAOLO), indizi: ["Somma le frazioni.", "Alla fine viene 1260 €.", "Pensa a 1.260 euro."] };
  assert.deepEqual(indiziSenzaRisultato(c), ["Somma le frazioni."]);
});

// ------------------------------------------------------------------ nucleo: strategia, verifica con ✓, Prova tu, limite (#27)
import { pulisciProvaTu, correggiProvaTu, contaAiuti, giornoRoma, MAX_AIUTI_GIORNO } from "../supabase/functions/_shared/compito.js";

const TESTO_LINDA = "Linda fa a casa dei panini e li va a vendere al mercato. Nella prima ora vende 1/4 dei panini più 4 panini. Nella seconda ora vende 1/4 dei panini rimasti più altri 4 panini. A questo punto le rimangono 20 panini. Quanti panini aveva preparato? [48]";
const LINDA = {
  esercizi: [], materia: "matematica", matematica: true, testo: TESTO_LINDA, dati: ["1/4", "4", "20"], cerca: "quanti panini aveva preparato Linda",
  soluzione_libro: "48", strategia: { nome: "Andare a ritroso", perche: "Conosciamo la fine (20 panini): si parte da lì e si torna indietro." },
  indizi: ["Parti dalla fine: quanti panini restano?", "Prima di vendere gli ultimi 4, quanti ne aveva?"],
  passi: [
    { titolo: "Punto di partenza", spiegazione: "Alla fine restano 20 panini.", calcolo: "", ancora: "" },
    { titolo: "Torno indietro nella seconda ora", spiegazione: "Rimetto i 4 panini venduti in più.", calcolo: "20 + 4 = 24", ancora: "" },
    { titolo: "24 sono i 3/4", spiegazione: "Aveva tolto 1/4, quindi 24 sono i 3/4 di quelli di allora.", calcolo: "24 : 3 = 8", ancora: "" },
    { titolo: "L'intero della seconda ora", spiegazione: "Un quarto è 8, l'intero sono 4 quarti.", calcolo: "8 × 4 = 32", ancora: "" },
    { titolo: "Torno indietro nella prima ora", spiegazione: "Rimetto i 4 panini.", calcolo: "32 + 4 = 36", ancora: "" },
    { titolo: "36 sono i 3/4", spiegazione: "Divido per 3 e moltiplico per 4.", calcolo: "36 : 3 × 4 = 48", ancora: "" },
  ],
  risultato: { valore: "48", unita: "panini" },
  verifica: { spiegazione: "Vado avanti con 48 panini.", controlli: [
    { testo: "Prima ora: vende 12 + 4 = 16, restano 32", calcolo: "48 - (48 : 4 + 4) = 32" },
    { testo: "Seconda ora: vende 8 + 4 = 12, restano 20", calcolo: "32 - (32 : 4 + 4) = 20" }] },
  trucco: "Quando torni indietro fai le operazioni al contrario e in ordine inverso.",
  domande_pronte: ["Perché parto dalla fine?", "Perché divido per 3?", "Me lo spieghi con un disegno?"],
};

test("Linda: andare a ritroso, verifica andando avanti con un controllo per ora", () => {
  assert.deepEqual(controllaCompito(LINDA), { ok: true });
  const finta = copia(LINDA); finta.verifica.controlli = [{ testo: "", calcolo: "48 - 28 = 20" }];
  assert.equal(controllaCompito(finta).motivo, "verifica"); // non rimette i dati del testo
  const rotta = copia(LINDA); rotta.verifica.controlli[1].calcolo = "32 - (32 : 4 + 4) = 21";
  assert.equal(controllaCompito(rotta).motivo, "verifica");
  const c = pulisciCompito(LINDA);
  assert.deepEqual(c.strategia, LINDA.strategia);
  assert.equal(c.verifica.controlli.length, 2);
  // la vecchia forma con un calcolo solo diventa un controllo
  assert.deepEqual(pulisciCompito(PAOLO).verifica.controlli, [{ testo: "", calcolo: "210 + 280 + 465 + 305 = 1260" }]);
});

test("Prova tu: tenuto solo se il suo conto torna; la risposta si corregge con correzione.js", () => {
  const p = { testo: "Se 11 fette valgono 770 €, quanto vale 1 fetta?", risultato: { valore: "70", unita: "€" }, calcolo: "770 : 11 = 70", passo: 5, spiegazione: "Dividi 770 per 11." };
  assert.deepEqual(pulisciProvaTu(p), p);
  assert.equal(pulisciProvaTu({ ...p, calcolo: "770 : 11 = 77" }), null);
  assert.equal(pulisciProvaTu({ ...p, risultato: { valore: "77", unita: "€" } }), null);
  assert.equal(pulisciProvaTu({ ...p, testo: "" }), null);
  assert.equal(correggiProvaTu("70 €", p.risultato).giusto, true);
  assert.equal(correggiProvaTu("70", p.risultato).esito, "senza_unita");
  assert.equal(correggiProvaTu("77 €", p.risultato).giusto, false);
  assert.equal(correggiProvaTu("6/8", { valore: "3/4", unita: "" }).giusto, true);
  assert.equal(correggiProvaTu("", p.risultato).esito, "vuota");
  assert.equal(pulisciCompito({ ...copia(PAOLO), prova_tu: p }).prova_tu.passo, 5);
  assert.equal(pulisciRisposta({ risposta: "x", calcoli: [], figura: null, prova_tu: { ...p, calcolo: "1 + 1 = 3" } }).prova_tu, null);
});

test("limite di 30 aiuti al giorno per profilo, si riparte il giorno dopo", () => {
  assert.equal(MAX_AIUTI_GIORNO, 30);
  assert.equal(giornoRoma(new Date("2026-11-15T23:30:00Z")), "2026-11-16"); // a Roma è già domani
  assert.deepEqual(contaAiuti({ ruolo: "studente" }, "2026-11-15"), { permesso: true, aiuti: { giorno: "2026-11-15", n: 1 } });
  assert.deepEqual(contaAiuti({ aiuti: { giorno: "2026-11-15", n: 29 } }, "2026-11-15"), { permesso: true, aiuti: { giorno: "2026-11-15", n: 30 } });
  assert.deepEqual(contaAiuti({ aiuti: { giorno: "2026-11-15", n: 30 } }, "2026-11-15"), { permesso: false, aiuti: { giorno: "2026-11-15", n: 30 } });
  assert.deepEqual(contaAiuti({ aiuti: { giorno: "2026-11-14", n: 30 } }, "2026-11-15"), { permesso: true, aiuti: { giorno: "2026-11-15", n: 1 } });
});

test("il prompt chiede la strategia con un nome, il perché di ogni passo, i controlli con ✓, il Prova tu", () => {
  const p = promptCompito({ classe: "2", testo: TESTO_LINDA });
  assert.match(p, /strategia/i);
  assert.match(p, /andare a ritroso/i);
  assert.match(p, /perché/i);
  assert.match(p, /controlli/);
  assert.match(p, /prova_tu/);
  assert.match(p, /trucco da ricordare/i);
});

test("verifiche finte trovate dalla revisione: rifiutate", () => {
  const finteLinda = [["48 × 0 + 4 + 16 = 20"], ["48 - 48 + 4 + 16 = 20"], ["48 : 4 = 12", "4 × 5 = 20"]];
  for (const cc of finteLinda) {
    const c = copia(LINDA); c.verifica.controlli = cc.map((calcolo) => ({ testo: "", calcolo }));
    assert.equal(controllaCompito(c).motivo, "verifica", cc.join(" | "));
  }
  const fintePaolo = [["465 + 305 = 770", "1260 = 1260"], ["1260 - 465 - 305 + 465 + 305 = 1260"]];
  for (const cc of fintePaolo) {
    const c = copia(PAOLO); c.verifica = { spiegazione: "", controlli: cc.map((calcolo) => ({ testo: "", calcolo })) };
    assert.equal(controllaCompito(c).motivo, "verifica", cc.join(" | "));
  }
  assert.deepEqual(controllaCompito(LINDA), { ok: true });
  assert.deepEqual(controllaCompito(PAOLO), { ok: true });
});

test("in avanti va bene anche una catena con più uguali nel primo controllo", () => {
  const c = copia(LINDA);
  c.verifica.controlli = [{ testo: "", calcolo: "48 - (48 : 4 + 4) = 48 - 16 = 32" }, { testo: "", calcolo: "32 - (32 : 4 + 4) = 20" }];
  assert.deepEqual(controllaCompito(c), { ok: true });
});

import { rimborsoAiuti } from "../supabase/functions/_shared/compito.js";
test("aiuto prenotato prima del modello e restituito se la risposta non riesce", () => {
  assert.deepEqual(rimborsoAiuti({ aiuti: { giorno: "2026-11-15", n: 5 } }, "2026-11-15"), { giorno: "2026-11-15", n: 4 });
  assert.deepEqual(rimborsoAiuti({ aiuti: { giorno: "2026-11-15", n: 0 } }, "2026-11-15"), { giorno: "2026-11-15", n: 0 });
  assert.equal(rimborsoAiuti({ aiuti: { giorno: "2026-11-14", n: 5 } }, "2026-11-15"), null); // giorno nuovo: niente da restituire
});

test("geometria: si verifica che le misure trovate diano i dati, poi il risultato", () => {
  const G = { ...copia(PAOLO), materia: "geometria", soluzione_libro: "147 cm²",
    testo: "Un rettangolo ha il perimetro di 56 cm e la base è il triplo dell'altezza. Calcola l'area del rettangolo. [147 cm²]", dati: ["56 cm", "il triplo"],
    passi: [
      { titolo: "Semiperimetro", spiegazione: "", calcolo: "56 : 2 = 28", ancora: "" },
      { titolo: "Altezza", spiegazione: "", calcolo: "28 : 4 = 7", ancora: "" },
      { titolo: "Base", spiegazione: "", calcolo: "7 × 3 = 21", ancora: "" },
      { titolo: "Area", spiegazione: "", calcolo: "21 × 7 = 147", ancora: "" }],
    risultato: { valore: "147", unita: "cm²" },
    verifica: { spiegazione: "", controlli: [
      { testo: "Il perimetro torna", calcolo: "2 × (21 + 7) = 56" },
      { testo: "La base è il triplo dell'altezza", calcolo: "7 × 3 = 21" },
      { testo: "L'area", calcolo: "21 × 7 = 147" }] } };
  assert.deepEqual(controllaCompito(G), { ok: true });
  const finta = copia(G); finta.verifica.controlli = [{ testo: "", calcolo: "21 × 7 = 147" }];
  assert.equal(controllaCompito(finta).motivo, "verifica"); // l'area da sola non controlla niente
  const scollegata = copia(G); scollegata.verifica.controlli = [{ testo: "", calcolo: "2 × (20 + 8) = 56" }, { testo: "", calcolo: "21 × 7 = 147" }];
  assert.equal(controllaCompito(scollegata).motivo, "verifica"); // le misure del controllo non sono quelle dell'area
});

test("revisione finale: la forma della geometria non fa passare risultati sbagliati", () => {
  const ctl = (xs) => ({ spiegazione: "", controlli: xs.map((calcolo) => ({ testo: "", calcolo })) });
  // Linda con un risultato sbagliato (52) e senza libro: rifiutata.
  const linda52 = { ...copia(LINDA), soluzione_libro: "", testo: TESTO_LINDA.replace(" [48]", ""),
    passi: [{ titolo: "", spiegazione: "", calcolo: "20 + 4 + 4 = 28", ancora: "" }, { titolo: "", spiegazione: "", calcolo: "28 + 24 = 52", ancora: "" }],
    risultato: { valore: "52", unita: "panini" }, verifica: ctl(["28 - 4 - 4 = 20", "28 + 24 = 52"]) };
  assert.equal(controllaCompito(linda52).motivo, "verifica");
  // Rettangolo con un'area sbagliata (196): «il triplo» è un dato e va rispettato.
  const R = "Un rettangolo ha il perimetro di 56 cm e la base è il triplo dell'altezza. Calcola l'area del rettangolo.";
  const ret196 = { ...copia(PAOLO), materia: "geometria", soluzione_libro: "", testo: R,
    passi: [{ titolo: "", spiegazione: "", calcolo: "56 : 4 = 14", ancora: "" }, { titolo: "", spiegazione: "", calcolo: "14 × 14 = 196", ancora: "" }],
    risultato: { valore: "196", unita: "cm²" }, verifica: ctl(["2 × (14 + 14) = 56", "14 × 14 = 196"]) };
  assert.equal(controllaCompito(ret196).motivo, "verifica");
  // Finte con le misure non collegate, in tutte le materie.
  for (const [base, xs] of [[PAOLO, ["770 - 305 = 465", "770 + 490 = 1260"]], [PAOLO, ["305 + 160 = 465", "305 + 955 = 1260"]],
    [LINDA, ["4 × 5 = 20", "12 × 4 = 48"]], [LINDA, ["12 + 8 = 20", "12 × 4 = 48"]], [LINDA, ["4 + 16 = 20", "16 × 3 = 48"]]]) {
    const c = copia(base); c.verifica = ctl(xs);
    assert.equal(controllaCompito(c).motivo, "verifica", xs.join(" | "));
  }
  const geo = { ...copia(PAOLO), materia: "geometria", soluzione_libro: "147 cm²", testo: R + " [147 cm²]",
    passi: [{ titolo: "", spiegazione: "", calcolo: "56 : 2 = 28", ancora: "" }, { titolo: "", spiegazione: "", calcolo: "28 : 4 = 7", ancora: "" },
      { titolo: "", spiegazione: "", calcolo: "7 × 3 = 21", ancora: "" }, { titolo: "", spiegazione: "", calcolo: "21 × 7 = 147", ancora: "" }],
    risultato: { valore: "147", unita: "cm²" } };
  for (const xs of [["7 × 8 = 56", "21 × 7 = 147"], ["49 + 7 = 56", "7 × 21 = 147"]]) {
    const c = copia(geo); c.verifica = ctl(xs);
    assert.equal(controllaCompito(c).motivo, "verifica", xs.join(" | "));
  }
  // La verifica vera del modello sul rettangolo (prova del 15 novembre) passa.
  const vera = copia(geo); vera.verifica = ctl(["21 : 7 = 3", "(21 + 7) × 2 = 56", "21 × 7 = 147"]);
  assert.deepEqual(controllaCompito(vera), { ok: true });
});

test("in avanti va bene anche un risultato frazionario", () => {
  const c = { ...copia(PAOLO), testo: "Marco mangia una parte della torta da 12 fette e gliene restano 9. Che frazione ha mangiato?", soluzione_libro: "",
    passi: [{ titolo: "", spiegazione: "", calcolo: "12 - 9 = 3", ancora: "" }, { titolo: "", spiegazione: "", calcolo: "3 : 12 = 1/4", ancora: "" }],
    risultato: { valore: "1/4", unita: "" }, verifica: { spiegazione: "", controlli: [{ testo: "", calcolo: "12 - 12 × 1/4 = 9" }] } };
  assert.deepEqual(controllaCompito(c), { ok: true });
});

test("Cosa sai: ogni dato con il suo significato (le stringhe vecchie restano valide)", () => {
  const c = pulisciCompito({ ...copia(PAOLO), dati: [{ valore: "1/6", significato: "la parte dello stipendio spesa per gli anelli" }, { valore: "465 €", significato: "l'anticipo al ristorante" }, { valore: "", significato: "x" }] });
  assert.deepEqual(c.dati, [{ valore: "1/6", significato: "la parte dello stipendio spesa per gli anelli" }, { valore: "465 €", significato: "l'anticipo al ristorante" }]);
  assert.deepEqual(pulisciCompito(copia(PAOLO)).dati[0], { valore: "1/6", significato: "" });
  assert.match(promptCompito({ classe: "2", testo: TESTO_PAOLO }), /significato/);
});

// ------------------------------------------------------------------ gemelli ed esercizi mirati (#27, aggiunte di Roby)
import { numeriAdatti, motivoGemello, pulisciGemelli, TIPI_GEMELLI } from "../supabase/functions/_shared/compito.js";
import { promptGemelli, promptEserciziGenera as genera } from "../supabase/functions/_shared/prompt.js";

const GIULIA = { tipo: "vicino", testo: "Giulia spende 1/5 della paghetta per un libro, 3/10 per il cinema, 6 € per una merenda e le restano 9 €. Quanto è la paghetta?",
  passi: [
    { titolo: "Frazioni spese", calcolo: "1/5 + 3/10 = 2/10 + 3/10 = 5/10" },
    { titolo: "Frazione che resta", calcolo: "10/10 - 5/10 = 5/10" },
    { titolo: "Cosa sono i due importi in euro", calcolo: "6 + 9 = 15" },
    { titolo: "Collego frazione ed euro", calcolo: "" },
    { titolo: "Trovo 1/10", calcolo: "15 : 5 = 3" },
    { titolo: "Trovo l'intero", calcolo: "3 × 10 = 30" }],
  risultato: { valore: "30", unita: "€" },
  verifica: { spiegazione: "", controlli: [{ testo: "Libro, cinema, merenda e avanzo fanno la paghetta", calcolo: "6 + 9 + 6 + 9 = 30" }] } };

test("gemelli: numeri intermedi interi o frazioni semplici, niente 7,333", () => {
  assert.equal(numeriAdatti("1/5 + 3/10 = 2/10 + 3/10 = 5/10"), true);
  assert.equal(numeriAdatti("36 : 3 × 4 = 48"), true);
  assert.equal(numeriAdatti("12,50 € + 7,50 € = 20 €"), true); // euro con i centesimi
  assert.equal(numeriAdatti("(10 + 5) / 2 × 3 = 22,5"), false);
  assert.equal(numeriAdatti("22/3 = 7,33"), false);
  assert.equal(numeriAdatti("100 / 7 = 100/7"), false);
  assert.equal(numeriAdatti("1 - 5/12 = 12/12 - 5/12 = 7/12"), true);
  assert.equal(numeriAdatti("22 : 3 = 7,33"), false);
  assert.equal(numeriAdatti("16 : 2 × 3 = 24"), true);
  assert.equal(numeriAdatti("29 : 2 = 14,5"), false);
  assert.equal(numeriAdatti("29 : 3 = 9,67"), false);
});

test("gemelli: stessi passi, contesto diverso, ogni conto ricalcolato; gli altri si scartano", () => {
  assert.equal(motivoGemello(GIULIA, PAOLO), null);
  const rotto = copia(GIULIA); rotto.passi[4].calcolo = "15 : 5 = 4";
  assert.equal(motivoGemello(rotto, PAOLO), "conto");
  const corto = copia(GIULIA); corto.passi = corto.passi.slice(0, 4);
  assert.equal(motivoGemello(corto, PAOLO), "passi");
  assert.equal(motivoGemello({ ...copia(GIULIA), tipo: "variante", passi: [...copia(GIULIA).passi, { titolo: "In più", calcolo: "30 - 9 = 21" }], risultato: { valore: "21", unita: "€" }, verifica: { spiegazione: "", controlli: [{ testo: "", calcolo: "6 + 9 + 6 = 21" }] } }, PAOLO), null); // la variante può avere un passo in più
  const strano = copia(GIULIA); strano.passi[4].calcolo = "16 : 3 = 5,33"; strano.passi[5].calcolo = "5,33 × 10 = 53,3"; strano.risultato.valore = "53,3";
  assert.equal(motivoGemello(strano, PAOLO), "numeri");
  assert.equal(motivoGemello({ ...copia(GIULIA), testo: PAOLO.testo }, PAOLO), "contesto");
  const fine = copia(GIULIA); fine.risultato.valore = "31";
  assert.equal(motivoGemello(fine, PAOLO), "risultato");
  const r = pulisciGemelli({ gemelli: [GIULIA, rotto, { ...copia(GIULIA), tipo: "lontano", testo: GIULIA.testo.replace("Giulia spende", "Marco usa").replace("paghetta", "mancia") }] }, PAOLO);
  assert.deepEqual(r.gemelli.map((g) => g.tipo), ["vicino", "lontano"]);
  assert.equal(r.scartati, 1);
  assert.deepEqual(r.mancano, ["variante"]);
  assert.deepEqual(TIPI_GEMELLI, ["vicino", "lontano", "variante"]);
});

test("prompt dei gemelli e degli esercizi mirati", () => {
  const p = promptGemelli({ classe: "2", compito: PAOLO, tipi: ["vicino", "lontano", "variante"] });
  for (const r of [/stessa strategia/i, /gemello vicino/i, /gemello lontano/i, /variante/i, /interi/i, /nomi/i]) assert.match(p, r);
  assert.doesNotMatch(p, /alunna|ragazza/);
  const m = genera({ materia: "matematica", titolo: "", classe: "2", quanti: 5, tipi: [{ breve: "t1", titolo: "x", ancora: "y", difficolta: 2, figura: false }],
    mirati: { concetto: "Lo stesso denominatore", calcolo: "1/6 + 2/9 = 3/18 + 4/18 = 7/18", testo: TESTO_PAOLO } });
  assert.match(m, /dal più facile al più difficile/i);
  assert.match(m, /Lo stesso denominatore/);
  assert.match(m, /problemi a parole/i);
});

test("revisione: il risultato del gemello si verifica sul suo testo", () => {
  const scollegato = { ...copia(GIULIA), testo: "Sara spende 1/4 dei soldi e le restano 10 €. Quanti soldi aveva?",
    passi: [{ titolo: "a", calcolo: "2 + 2 = 4" }, { titolo: "b", calcolo: "4 + 1 = 5" }, { titolo: "c", calcolo: "5 + 1 = 6" }, { titolo: "d", calcolo: "6 + 1 = 7" }, { titolo: "e", calcolo: "10 × 7 = 70" }],
    risultato: { valore: "70", unita: "€" }, verifica: { spiegazione: "", controlli: [{ testo: "", calcolo: "10 × 7 = 70" }] } };
  assert.equal(motivoGemello(scollegato, PAOLO), "verifica");
  assert.equal(motivoGemello({ ...copia(GIULIA), verifica: { spiegazione: "", controlli: [] } }, PAOLO), "verifica");
  assert.equal(motivoGemello(GIULIA, PAOLO), null);
});

/* ---- soluzione bloccata finché non si prova (decisione di Roby sulla #27) ---- */
import { rispostaColRisultato, rispondiSenzaRisultato } from "../supabase/functions/_shared/compito.js";

const BLOCCO = { testo: "Paolo spende 1/6 dello stipendio per gli anelli, 2/9 per il vestito, 465 € al ristorante e gli restano 305 €. Quanto guadagna?",
  indizi: ["Somma le frazioni spese.", "Gli euro valgono 1260 in tutto."], risultato: { valore: "1260", unita: "€" } };
const R = (x) => ({ risposta: "Somma 1/6 e 2/9 con lo stesso denominatore.", calcoli: [], figura: null, prova_tu: null, passo: 1, ...x });

test("risposta col risultato: nel testo, nei conti, nell'etichetta o nel Prova tu; anche scritto 1.260", () => {
  assert.equal(rispostaColRisultato(R({}), BLOCCO), false);
  assert.equal(rispostaColRisultato(R({ risposta: "Alla fine lo stipendio è 1.260 €." }), BLOCCO), true);
  assert.equal(rispostaColRisultato(R({ calcoli: ["770 : 11 × 18 = 1260"] }), BLOCCO), true);
  assert.equal(rispostaColRisultato(R({ figura: { tipo: "barra_frazioni", parti: 18, colorate: 18, etichetta: "1260 €" } }), BLOCCO), true);
  assert.equal(rispostaColRisultato(R({ prova_tu: { testo: "Quanto guadagna?", risultato: { valore: "1260", unita: "€" }, calcolo: "70 × 18 = 1260", passo: 6, spiegazione: "" } }), BLOCCO), true);
  // risultato a frazione: «5/12» scritto conta, «5» e «12» separati no
  const fr = { testo: "Anna mangia 1/4 della torta e Marco 1/6. Quanta ne mangiano?", risultato: { valore: "5/12", unita: "" } };
  assert.equal(rispostaColRisultato(R({ risposta: "In tutto 5/12 della torta." }), fr), true);
  assert.equal(rispostaColRisultato(R({ risposta: "Porta tutto in dodicesimi: 12 è il denominatore comune, 1/4 diventa 3/12." }), fr), false);
  // se il risultato è già un numero del testo non c'è niente da nascondere
  assert.equal(rispostaColRisultato(R({ risposta: "Restano 305 €." }), { ...BLOCCO, risultato: { valore: "305", unita: "€" } }), false);
});

test("domanda con soluzione bloccata: se la risposta contiene il risultato si rigenera chiedendo un indizio senza", async () => {
  const chieste = [];
  const genera = (risposte) => async (extra = "") => { chieste.push(extra); return risposte.shift(); };
  // prima col risultato, poi senza: si tiene la seconda
  let r = await rispondiSenzaRisultato(genera([R({ risposta: "Fa 1260 €." }), R({ risposta: "Pensa a quante parti restano." })]), BLOCCO);
  assert.equal(r.risposta, "Pensa a quante parti restano.");
  assert.equal(chieste.length, 2);
  assert.equal(chieste[0], "");
  assert.match(chieste[1], /non.*risultato/i);
  assert.match(chieste[1], /indizio/i);
  // senza risultato al primo colpo: una sola chiamata
  chieste.length = 0;
  r = await rispondiSenzaRisultato(genera([R({})]), BLOCCO);
  assert.equal(chieste.length, 1);
  // due volte col risultato: risposta di riserva con un indizio che non lo contiene
  r = await rispondiSenzaRisultato(genera([R({ risposta: "1260" }), R({ calcoli: ["70 × 18 = 1260"] })]), BLOCCO);
  assert.equal(rispostaColRisultato(r, BLOCCO), false);
  assert.match(r.risposta, /Somma le frazioni spese/);
  assert.doesNotMatch(r.risposta, /1260/);
  assert.deepEqual(r.calcoli, []);
  assert.equal(r.prova_tu, null);
  assert.equal(await rispondiSenzaRisultato(genera([null]), BLOCCO), null);
});

test("prompt della domanda: con la soluzione bloccata chiede di non dire il risultato", () => {
  const base = { classe: "2", compito: BLOCCO, cronologia: [], domanda: "Quanto guadagna?" };
  assert.doesNotMatch(promptCompitoDomanda(base), /non è ancora sbloccata/);
  assert.match(promptCompitoDomanda({ ...base, bloccata: true }), /non è ancora sbloccata/);
  assert.match(promptCompitoDomanda({ ...base, bloccata: true }), /1260/); // dice al modello quale numero non scrivere
});

test("risposta col risultato: i numeri delle frazioni del testo non spengono il controllo; la barra della figura conta", () => {
  const sei = { testo: "Luca ha speso 1/6 della paghetta e ha 30 €. Quanti sesti gli restano?", risultato: { valore: "5", unita: "sesti" } };
  assert.equal(rispostaColRisultato(R({ risposta: "Gliene restano 5." }), sei), true);
  const fr = { testo: "Anna mangia 1/4 della torta e Marco 1/6. Quanta ne mangiano?", indizi: ["In tutto 5/12.", "Porta tutto in dodicesimi."], risultato: { valore: "5/12", unita: "" } };
  assert.equal(rispostaColRisultato(R({ figura: { tipo: "barra_frazioni", parti: 12, colorate: 5, etichetta: "" } }), fr), true);
  assert.equal(rispostaColRisultato(R({ figura: { tipo: "barra_frazioni", parti: 12, colorate: 3, etichetta: "3/12" } }), fr), false);
});

test("risposta di riserva: l'indizio non porta il risultato nemmeno come frazione", async () => {
  const fr = { testo: "Anna mangia 1/4 della torta e Marco 1/6. Quanta ne mangiano?", indizi: ["In tutto 5/12.", "Porta tutto in dodicesimi."], risultato: { valore: "5/12", unita: "" } };
  const r = await rispondiSenzaRisultato(async () => R({ risposta: "Fa 5/12." }), fr);
  assert.match(r.risposta, /Porta tutto in dodicesimi/);
  assert.doesNotMatch(r.risposta, /5\/12/);
});

// ------------------------------------------------------------------ skill socratica: indizi e tutor
test("indizi a scalini: il primo è una domanda senza conti, l'ultimo è quasi la soluzione ma si ferma prima del risultato", () => {
  const p = promptCompito({ classe: "1", testo: TESTO_PAOLO });
  assert.match(p, /il primo indizio è una domanda[^;]*niente conti/i);
  assert.match(p, /l'ultimo indizio[^;]*quasi la soluzione[^;]*fermati prima del risultato/i);
  assert.match(p, /errore tipico[^;]*domanda/i);
});

test("tutor: con la soluzione bloccata risponde con una domanda o un indizio e chiude con cosa provare adesso", () => {
  const bloccata = promptCompitoDomanda({ classe: "2", compito: PAOLO, cronologia: [], domanda: "Quanto fa?", bloccata: true });
  assert.match(bloccata, /domanda o un indizio sul passo che serve/);
  assert.match(bloccata, /cosa provare adesso/);
  const aperta = promptCompitoDomanda({ classe: "2", compito: PAOLO, cronologia: [], domanda: "Perché 18?", bloccata: false });
  // l'errore nella domanda si riconosce e si chiama per nome; al massimo una domanda: la sera si è stanchi
  assert.match(aperta, /conto o un ragionamento sbagliato[^.]*errore tipico/);
  assert.match(aperta, /al massimo una domanda/i);
  assert.match(aperta, /prossimo passo/);
});
