// Issue #28: poesia a memoria e INVALSI per la terza, la parte del server (_shared/poesia.js, _shared/invalsi.js).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pulisciPoesia, promptPoesia } from "../supabase/functions/_shared/poesia.js";
import { pulisciInvalsi, promptInvalsi, AMBITI_INVALSI, FORMATI_INVALSI } from "../supabase/functions/_shared/invalsi.js";

test("poesia: strofe di versi, titolo e autore; vuota → null; righe vuote tolte", () => {
  const p = pulisciPoesia({ titolo: " San Martino ", autore: "Giosuè Carducci", strofe: [["La nebbia a gl'irti colli", "piovigginando sale,", " "], [], ["e sotto il maestrale", "urla e biancheggia il mar;"]] });
  assert.deepEqual(p, { titolo: "San Martino", autore: "Giosuè Carducci", strofe: [["La nebbia a gl'irti colli", "piovigginando sale,"], ["e sotto il maestrale", "urla e biancheggia il mar;"]] });
  assert.equal(pulisciPoesia({ titolo: "x", autore: "", strofe: [[" "]] }), null);
  assert.equal(pulisciPoesia(null), null);
  assert.ok(pulisciPoesia({ titolo: "", autore: "", strofe: Array.from({ length: 50 }, () => ["verso uno", "verso due"]) }).strofe.length <= 20);
});

test("prompt della poesia: parola per parola, niente correzioni né completamenti", () => {
  const t = promptPoesia();
  assert.match(t, /parola per parola/);
  assert.match(t, /non correggere/i);
  assert.match(t, /\[\?\]/);
});

const MC = (x) => ({ ambito: "Numeri", formato: "scelta_multipla", testo: "Quanto fa 3/4 di 120?", opzioni: ["80", "90", "100", "30"], corretta: 1, risposta: "", calcolo: "120 : 4 × 3 = 90", spiegazione: "Un quarto di 120 è 30, tre quarti 90.", ...x });

test("INVALSI di matematica: formati e ambiti della prova, risposta ricalcolata; quelle che non tornano si scartano", () => {
  assert.deepEqual(FORMATI_INVALSI, ["scelta_multipla", "vero_falso", "completamento", "risposta_breve"]);
  assert.deepEqual(AMBITI_INVALSI.matematica, ["Numeri", "Spazio e figure", "Relazioni e funzioni", "Dati e previsioni"]);
  const r = pulisciInvalsi({ brano: null, domande: [
    MC(),
    MC({ corretta: 0 }),                                    // la corretta è 80, il calcolo dice 90
    MC({ calcolo: "120 : 4 × 3 = 80" }),                    // il conto non torna
    MC({ ambito: "Geometria" }),                            // ambito che la prova non ha
    { ambito: "Spazio e figure", formato: "risposta_breve", testo: "Un quadrato ha il lato di 7 cm. Quanto misura l'area?", opzioni: [], corretta: 0, risposta: "49 cm²", calcolo: "7 × 7 = 49", spiegazione: "" },
    { ambito: "Dati e previsioni", formato: "vero_falso", testo: "La media di 4, 6 e 8 è 6.", opzioni: ["x", "y"], corretta: 0, risposta: "", calcolo: "(4 + 6 + 8) : 3 = 6", spiegazione: "" },
    { ambito: "Relazioni e funzioni", formato: "completamento", testo: "Se 2x + 3 = 11, allora x = ___", opzioni: [], corretta: 0, risposta: "4", calcolo: "(11 − 3) : 2 = 4", spiegazione: "" },
    { ambito: "Numeri", formato: "risposta_breve", testo: "Quanto fa 2 + 2?", opzioni: [], corretta: 0, risposta: "4", calcolo: "", spiegazione: "" }, // senza calcolo
  ] }, "matematica", 10);
  assert.equal(r.domande.length, 4);
  assert.equal(r.scartate, 4);
  assert.deepEqual(r.domande.map((d) => d.formato), ["scelta_multipla", "risposta_breve", "vero_falso", "completamento"]);
  assert.deepEqual(r.domande[2].opzioni, ["Vero", "Falso"]);
  assert.equal(pulisciInvalsi({ domande: [MC(), MC(), MC()] }, "matematica", 2).domande.length, 2);
});

test("INVALSI di italiano e inglese: un brano (da ascoltare per il listening), niente calcolo richiesto", () => {
  const r = pulisciInvalsi({ brano: { titolo: "At the station", testo: "Tom is waiting for the 8 o'clock train.", ascolto: true }, domande: [
    { ambito: "Listening", formato: "scelta_multipla", testo: "What time is the train?", opzioni: ["7", "8", "9", "10"], corretta: 1, risposta: "", calcolo: "", spiegazione: "" },
    { ambito: "Riflessione sulla lingua", formato: "vero_falso", testo: "x", opzioni: [], corretta: 0, risposta: "", calcolo: "", spiegazione: "" },
  ] }, "inglese", 5);
  assert.equal(r.domande.length, 1);
  assert.deepEqual(r.brano, { titolo: "At the station", testo: "Tom is waiting for the 8 o'clock train.", ascolto: true });
  assert.equal(pulisciInvalsi({ brano: null, domande: [{ ambito: "Comprensione del testo", formato: "scelta_multipla", testo: "Chi parla?", opzioni: ["a", "b", "c", "d"], corretta: 2, risposta: "", calcolo: "", spiegazione: "" }] }, "italiano", 5).domande.length, 0, "italiano senza brano");
});

test("prompt INVALSI: formati, ambiti, terza media, numero di domande", () => {
  const t = promptInvalsi({ materia: "matematica", quante: 5, classe: "3" });
  assert.match(t, /Classe: 3ª media/);
  for (const f of FORMATI_INVALSI) assert.match(t, new RegExp(f));
  for (const a of AMBITI_INVALSI.matematica) assert.match(t, new RegExp(a));
  assert.match(t, /\b7\b/); // ne chiede qualcuna in più, per gli scarti
  assert.match(promptInvalsi({ materia: "inglese", quante: 5, classe: "3" }), /Listening/);
});
