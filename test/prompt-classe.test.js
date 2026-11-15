// Issue #28: la classe del profilo (e il programma) in tutti i prompt che spiegano, chiedono o correggono.
// Le trascrizioni no: copiano il quaderno parola per parola, la classe non c'entra.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "../supabase/functions/_shared/prompt.js";

const ARG = { titolo: "Le frazioni", materia: "Matematica", trascrizione: "La frazione 1/2 + 1/3 si calcola con il mcm dei denominatori.",
  concetti: [{ titolo: "Somma di frazioni", descrizione: "", ancora: "si calcola con il mcm", ordine: 1 }] };
const COMPITO = { testo: "Calcola 1/2 + 1/3.", materia: "matematica", passi: [{ titolo: "mcm", spiegazione: "", calcolo: "1/2 + 1/3 = 5/6" }], risultato: { valore: "5/6", unita: "" } };
const prompt = (classe) => ({
  concetti: P.promptConcetti("Matematica", "Frazioni", ARG.trascrizione, 1, classe),
  concettiNuovi: P.promptConcettiNuovi(["Somma"], ARG.trascrizione, 1, { classe, materia: "Matematica" }),
  domande: P.promptDomande({ livello: "medio", tipo: "miste", modalita: "scritta", ripasso: false, contesto: [], gia: [], materiale: [ARG], quante: null, soloConcetto: false, classe }),
  correzione: P.promptCorrezione("scritta", [{ id: "d1", domanda: "Come si sommano 1/2 e 1/3?" }], classe, "Matematica"),
  mappa: P.promptMappa(ARG, 10, classe),
  sintesi: P.promptSintesi(ARG, classe),
  ricercaSpiegazione: P.promptRicercaSpiegazione({ materia: "Matematica", argomento: "Frazioni", classe, concetto: { titolo: "Somma", descrizione: "", ancora: "mcm" } }),
  spiegazione: P.promptSpiegazione({ materia: "Matematica", argomento: "Frazioni", classe, concetto: { titolo: "Somma", descrizione: "", ancora: "mcm" }, fonti: [] }),
  ricercaArricchisci: P.promptRicercaArricchisci({ materia: "Matematica", argomento: "Frazioni", classe, agganci: [{ breve: "n1", titolo: "Somma" }] }),
  arricchisci: P.promptArricchisci({ materia: "Matematica", argomento: "Frazioni", classe, agganci: [{ breve: "n1", titolo: "Somma" }], fonti: [] }),
  eserciziTipi: P.promptEserciziTipi("Matematica", "Frazioni", ARG.trascrizione, [], classe),
  eserciziGenera: P.promptEserciziGenera({ materia: "Matematica", titolo: "Frazioni", classe, quanti: 3, tipi: [{ breve: "t1", titolo: "Somma di frazioni", ancora: "1/2 + 1/3", difficolta: 1, figura: false }] }),
  correzioneEsercizi: P.promptCorrezioneEsercizi({ classe, pacchetto: [{ id: "e1", testo: "Calcola 1/2 + 1/3", risposta: "2/5" }] }),
  compito: P.promptCompito({ classe, testo: COMPITO.testo }),
  compitoDomanda: P.promptCompitoDomanda({ classe, compito: COMPITO, cronologia: [], domanda: "Perché il mcm?" }),
  gemelli: P.promptGemelli({ classe, compito: COMPITO, tipi: ["vicino"] }),
});

test("la classe del profilo arriva in tutti i prompt, con il suo modo di scrivere", () => {
  const p1 = prompt("1"), p3 = prompt("3");
  for (const [nome, t] of Object.entries(p1)) {
    assert.match(t, /Classe: 1ª media/, nome);
    assert.match(t, /frasi molto corte/, nome);
    assert.match(p3[nome], /Classe: 3ª media/, nome);
  }
});

test("nei prompt che parlano di un esercizio di frazioni arrivano strategie ed errori tipici del programma", () => {
  const p = prompt("2");
  for (const nome of ["compito", "compitoDomanda", "eserciziGenera", "correzioneEsercizi", "spiegazione"])
    assert.match(p[nome], /Errori tipici da riconoscere per nome/, nome);
});

test("voce #17 nei prompt: niente «alunna» né «ragazza» (il modello copierebbe il genere)", () => {
  assert.doesNotMatch(readFileSync(new URL("../supabase/functions/_shared/prompt.js", import.meta.url), "utf8"), /\balunn[ae]\b|un'alunna|l'alunna|\bragazza\b/);
});
