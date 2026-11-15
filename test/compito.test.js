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
  const r = pulisciRisposta({ risposta: "Pensa a 18 fette.", calcoli: ["770 : 11 = 70", "  "], figura: { tipo: "barra_frazioni", parti: 18, colorate: 11, etichetta: "11/18" }, prova_tu: "Se 11 fette valgono 770 €, quanto vale 1 fetta?" });
  assert.deepEqual(r.calcoli, ["770 : 11 = 70"]);
  assert.deepEqual(r.figura, { tipo: "barra_frazioni", parti: 18, colorate: 11, etichetta: "11/18" });
  assert.match(r.prova_tu, /1 fetta/);
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
