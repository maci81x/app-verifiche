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
