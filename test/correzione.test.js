// Correzione degli esercizi di matematica (issue #5, fetta #8): il risultato lo giudica
// un calcolo, il modello spiega solo i passaggi.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leggiRisposta, unitaUguali, confrontaRisultato, PUNTI, analisiPulita, primoErroreRegge,
} from "../supabase/functions/_shared/correzione.js";
import * as MOD from "../supabase/functions/_shared/correzione.js";
import { promptCorrezioneEsercizi } from "../supabase/functions/_shared/prompt.js";

test("leggiRisposta: numero, frazione, unità e scritture da quaderno", () => {
  const l = (s) => JSON.parse(JSON.stringify(leggiRisposta(s)));
  assert.deepEqual(l("15 cm"), { numero: "15", unita: "cm" });
  assert.deepEqual(l("15cm"), { numero: "15", unita: "cm" });
  assert.deepEqual(l("x = 5"), { numero: "5", unita: "" });
  assert.deepEqual(l("= 21/20"), { numero: "21/20", unita: "" });
  assert.deepEqual(l("−3"), { numero: "-3", unita: "" });
  assert.deepEqual(l("113,04 cm²"), { numero: "113,04", unita: "cm²" });
  assert.deepEqual(l("2.500 €"), { numero: "2500", unita: "€", alternativa: "2.500" }, "il punto delle migliaia all'italiana");
  assert.deepEqual(l("0.125"), { numero: "0.125", unita: "" }, "con lo zero davanti è un decimale");
  assert.deepEqual(l("€ 15"), { numero: "15", unita: "€" });
  assert.deepEqual(l("15 cm."), { numero: "15", unita: "cm" });
  assert.deepEqual(l("Area = 15"), { numero: "15", unita: "" });
  assert.deepEqual(l("circa 15"), { numero: "15", unita: "" });
  assert.deepEqual(l("– 5"), { numero: "-5", unita: "" });
  assert.deepEqual(l("1 500 m"), { numero: "1500", unita: "m" });
  assert.deepEqual(l("Risultato: 7,5 m"), { numero: "7,5", unita: "m" });
  assert.equal(leggiRisposta("non lo so"), null);
  assert.equal(leggiRisposta(""), null);
});

test("unità: cm², cm^2, cm2 e cmq sono la stessa cosa; cm e cm² no", () => {
  assert.equal(unitaUguali("cm²", "cm^2"), true);
  assert.equal(unitaUguali("cm2", "cmq"), true);
  assert.equal(unitaUguali("M³", "mc"), true);
  assert.equal(unitaUguali(" cm ", "cm"), true);
  assert.equal(unitaUguali("cm", "cm²"), false);
  assert.equal(unitaUguali("cm", "mm"), false);
  assert.equal(unitaUguali("metri", "m"), true);
  assert.equal(unitaUguali("centimetri quadrati", "cm²"), true);
  assert.equal(unitaUguali("cc", "cm³"), true);
  assert.equal(unitaUguali("ore", "h"), true);
  assert.equal(unitaUguali("q", "2"), false, "il quintale non è un esponente");
});

test("confronto del risultato: decimali, virgola, frazioni equivalenti, unità", () => {
  const atteso = (valore, unita = "") => ({ valore, unita });
  const c = (risposta, calcolato, a) => confrontaRisultato(risposta, calcolato, a).esito;
  assert.equal(c("15 cm", 15, atteso("15", "cm")), "giusto");
  assert.equal(c("15", 15, atteso("15", "cm")), "senza_unita");
  assert.equal(c("15 cm²", 15, atteso("15", "cm")), "unita_sbagliata");
  assert.equal(c("16 cm", 15, atteso("15", "cm")), "sbagliato");
  assert.equal(c("42/40", 1.05, atteso("21/20")), "giusto", "frazione equivalente");
  assert.equal(c("1,05", 1.05, atteso("21/20")), "giusto", "stesso valore scritto in decimale");
  assert.equal(c("3,33", 10 / 3, atteso("3,33")), "giusto");
  assert.equal(c("3,3", 10 / 3, atteso("3,33")), "sbagliato", "la precisione la chiede l'esercizio");
  assert.equal(c("1,5", 1.5, atteso("1,50")), "giusto", "meno cifre ma esatto va bene");
  assert.equal(c("0,0", 0.04, atteso("0,04")), "sbagliato");
  assert.equal(c("0.125", 0.125, atteso("0,125")), "giusto", "decimale col punto della calcolatrice");
  assert.equal(c("1.500 m", 1.5, atteso("1,5", "m")), "giusto", "punto ambiguo: vale la lettura che torna");
  assert.equal(c("1.500 m", 1500, atteso("1500", "m")), "giusto");
  assert.equal(c("15 metri", 15, atteso("15", "m")), "giusto");
  assert.equal(c("15 = 15", 15, atteso("15")), "non_numerica");
  assert.equal(c("5:3", 5, atteso("5")), "non_numerica");
  assert.equal(c("€ 15", 15, atteso("15", "€")), "giusto");
  assert.equal(c("3", 10 / 3, atteso("3,33")), "sbagliato", "un intero deve essere esatto");
  assert.equal(c("-3", -3, atteso("−3")), "giusto");
  assert.equal(c("2.500 €", 2500, atteso("2500", "€")), "giusto");
  assert.equal(c("boh", 15, atteso("15")), "non_numerica");
  assert.equal(c("  ", 15, atteso("15")), "vuota");
  assert.equal(c("x = 5", 5, atteso("5")), "giusto");
  assert.deepEqual([PUNTI.giusto, PUNTI.senza_unita, PUNTI.unita_sbagliata, PUNTI.sbagliato, PUNTI.vuota], [10, 8, 5, 0, 0]);
  assert.equal(confrontaRisultato("15 cm", 15, atteso("15", "cm")).punti, 10);
});

const PASSAGGI = "9^2 = 18\n12^2 = 144\n18 + 144 = 162\n√162 = 12,7";

test("primo errore: deve stare nei passaggi scritti dalla ragazza", () => {
  assert.equal(primoErroreRegge("9^2 = 18", PASSAGGI), true);
  assert.equal(primoErroreRegge("9² = 18", PASSAGGI), true, "esponente in apice");
  assert.equal(primoErroreRegge("9^2 = 81", PASSAGGI), false, "un passaggio che non ha scritto lei");
  assert.equal(primoErroreRegge("", PASSAGGI), false);
  assert.equal(primoErroreRegge("3 × 4 = 13", "3 x 4 = 13\n13 + 1 = 14"), true, "la x fra due numeri è un per");
});

test("analisi del modello pulita: tipo di errore ammesso, primo errore ancorato, testi corti", () => {
  const a = analisiPulita({ primo_errore: "9^2 = 18", tipo_errore: "calcolo", spiegazione: "Hai fatto 9 per 2.", esempio: "5^2 = 25" }, PASSAGGI);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), { primo_errore: "9^2 = 18", tipo_errore: "calcolo", spiegazione: "Hai fatto 9 per 2.", esempio: "5^2 = 25" });
  const b = analisiPulita({ primo_errore: "inventato 7 + 7 = 15", tipo_errore: "boh", spiegazione: "x".repeat(5000), esempio: "" }, PASSAGGI);
  assert.equal(b.primo_errore, "", "un errore che non è nei suoi passaggi non si cita");
  assert.equal(b.tipo_errore, "altro");
  assert.ok(b.spiegazione.length <= 1500);
  assert.equal(analisiPulita(null, PASSAGGI), null);
});

test("prompt di correzione: il giudizio sul risultato è dato, il modello cerca il primo passaggio sbagliato", () => {
  const p = promptCorrezioneEsercizi({ classe: "2A", pacchetto: [{
    id: "e1", testo: "Calcola l'ipotenusa con i cateti di 9 cm e 12 cm.", soluzione: ["9^2 + 12^2 = 225", "√225 = 15"],
    risultato: "15 cm", risposta: "12,7 cm", esito: "sbagliato", passaggi: PASSAGGI,
  }] });
  assert.match(p, /12 anni \(seconda media\)/);
  assert.match(p, /non cambiarlo|non lo decidi tu/i);
  assert.match(p, /primo passaggio sbagliato/);
  assert.match(p, /copiato/);
  assert.match(p, /9\^2 = 18/);
  assert.match(p, /"sbagliato"/);
});

test("pacchetto: il risultato si giudica sul valore preciso della verifica, i passaggi vanno al modello", () => {
  const { correggiPacchetto, conAnalisi } = MOD;
  const es = { id: "e1", testo: "Ipotenusa con cateti 9 cm e 12 cm", passaggi: [{ testo: "Pitagora", formula: "\\sqrt{225}" }],
    risultato: { valore: "15", unita: "cm" }, verifica: "sqrt(9^2 + 12^2)" };
  const { correzioni, daAnalizzare } = correggiPacchetto([
    { ...es, risposta: "12,7 cm", svolgimento: PASSAGGI },
    { ...es, id: "e2", risposta: "15 cm", svolgimento: "" },
    { ...es, id: "e3", risposta: "", svolgimento: "", verifica: "boh", risultato: { valore: "boh" } }, // non verificabile: fuori
    { ...es, id: "" },
  ]);
  assert.deepEqual(correzioni.map((c) => [c.id, c.esito, c.punti]), [["e1", "sbagliato", 0], ["e2", "giusto", 10]]);
  assert.deepEqual(daAnalizzare.map((x) => x.id), ["e1"]);
  assert.deepEqual(daAnalizzare[0].soluzione, ["Pitagora: \\sqrt{225}"]);
  assert.equal(daAnalizzare[0].risultato, "15 cm");
  const finali = conAnalisi(correzioni, [
    { id: "e1", primo_errore: "9^2 = 18", tipo_errore: "calcolo", spiegazione: "9² è 9×9.", esempio: "4² = 16", esito: "giusto" },
    { id: "e2", primo_errore: "x", tipo_errore: "formula", spiegazione: "non richiesta", esempio: "" },
  ], daAnalizzare);
  assert.equal(finali[0].primo_errore, "9^2 = 18");
  assert.equal(finali[0].esito, "sbagliato", "il modello non cambia il giudizio sul risultato");
  assert.equal(finali[0].punti, 0);
  assert.equal(finali[1].spiegazione, "", "niente analisi per chi non ha scritto passaggi");
  assert.equal(correggiPacchetto(Array.from({ length: 30 }, (_, i) => ({ ...es, id: "e" + i, risposta: "15 cm" }))).correzioni.length, MOD.MAX_PACCHETTO);
});
