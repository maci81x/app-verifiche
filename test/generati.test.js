// Esercizi generati: entrano solo se il ricalcolo torna (issue #5, fetta #7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { coincide } from "../supabase/functions/_shared/calcolo.js";
import {
  numeriIn, eserciziVerificati, motivoScarto, pulisciFigura, FORME, MAX_ESERCIZI, quantiDaChiedere,
} from "../supabase/functions/_shared/generati.js";
import { promptEserciziGenera } from "../supabase/functions/_shared/prompt.js";

const TIPI = { t1: { id: "uuid-frazioni", titolo: "Espressioni con le frazioni" }, t2: { id: "uuid-pitagora", titolo: "Teorema di Pitagora" } };

const buono = (extra = {}) => ({
  tipo: "t2",
  testo: "Calcola l'ipotenusa di un triangolo rettangolo con i cateti di 9 cm e 12 cm.",
  dati: "cateto 9 cm; cateto 12 cm",
  figura: { forma: "triangolo_rettangolo", misure: [{ nome: "cateto1", valore: "12 cm" }, { nome: "cateto2", valore: "9 cm" }, { nome: "ipotenusa", valore: "?" }] },
  passaggi: [{ testo: "Applico il teorema di Pitagora", formula: "i = \\sqrt{9^2 + 12^2}" }, { testo: "Calcolo", formula: "\\sqrt{225} = 15" }],
  risultato: { valore: "15", unita: "cm" },
  verifica: "sqrt(9^2 + 12^2)",
  ...extra,
});

test("un esercizio il cui ricalcolo torna entra, con il tipo vero e la figura pulita", () => {
  const r = eserciziVerificati([buono()], TIPI, 5);
  assert.equal(r.scartati, 0);
  assert.equal(r.esercizi.length, 1);
  const e = r.esercizi[0];
  assert.equal(e.tipo_id, "uuid-pitagora");
  assert.equal(e.tipo, "Teorema di Pitagora");
  assert.deepEqual(e.risultato, { valore: "15", unita: "cm" });
  assert.equal(e.figura.forma, "triangolo_rettangolo");
  assert.equal(e.passaggi.length, 2);
});

test("risultato non verificato → scartato e contato", () => {
  const casi = [
    buono({ risultato: { valore: "16", unita: "cm" } }),          // il conto non torna
    buono({ verifica: "sqrt(9^2 + 12^2" }),                        // espressione rotta
    buono({ verifica: "15" }),                                     // non ricalcola niente
    buono({ verifica: "sqrt(5^2 + 200)" }),                        // numeri che non sono nei dati
    buono({ risultato: { valore: "quindici", unita: "cm" } }),     // risultato non numerico
    buono({ tipo: "t9" }),                                         // tipo inesistente
    buono({ testo: "  " }),                                        // niente consegna
    null,
  ];
  const r = eserciziVerificati(casi, TIPI, 10);
  assert.equal(r.esercizi.length, 0);
  assert.equal(r.scartati, casi.length);
  assert.equal(motivoScarto(buono({ risultato: { valore: "16", unita: "cm" } }), TIPI), "risultato");
  assert.equal(motivoScarto(buono({ verifica: "15" }), TIPI), "verifica");
  assert.equal(motivoScarto(buono(), TIPI), null);
});

test("frazioni e decimali: frazione equivalente sì, arrotondamento sbagliato no", () => {
  const fr = (valore, verifica) => ({
    tipo: "t1", testo: "Calcola: 3/4 + (2/5 − 1/10)", dati: "", figura: { forma: "nessuna", misure: [] },
    passaggi: [{ testo: "Faccio la sottrazione in parentesi", formula: "\\frac{3}{4}+\\frac{3}{10}" }, { testo: "Sommo", formula: "\\frac{21}{20} = 1{,}05" }],
    risultato: { valore, unita: "" }, verifica,
  });
  const r = eserciziVerificati([fr("21/20", "3/4 + (2/5 - 1/10)"), fr("1,05", "3/4 + (2/5 - 1/10)"), fr("1,2", "3/4 + (2/5 - 1/10)")], TIPI, 10);
  assert.equal(r.esercizi.length, 2);
  assert.equal(r.scartati, 1);
  assert.equal(r.esercizi[0].figura, null, "forma nessuna = niente figura");
});

test("se ne tengono al massimo quanti ne servono; gli eccedenti non contano come scartati", () => {
  const r = eserciziVerificati(Array.from({ length: 8 }, () => buono()), TIPI, 5);
  assert.equal(r.esercizi.length, 5);
  assert.equal(r.scartati, 0);
  assert.ok(quantiDaChiedere(5) > 5 && quantiDaChiedere(10) <= MAX_ESERCIZI + 5);
});

test("figura: solo forme previste e misure con il loro nome, testi corti", () => {
  assert.equal(pulisciFigura(null), null);
  assert.equal(pulisciFigura({ forma: "esagono", misure: [{ nome: "lato", valore: "3 cm" }] }), null);
  assert.equal(pulisciFigura({ forma: "rettangolo", misure: [] }), null, "senza misure non serve");
  const f = pulisciFigura({
    forma: "rettangolo",
    misure: [{ nome: "base", valore: "12 cm" }, { nome: "raggio", valore: "3 cm" }, { nome: "base", valore: "13 cm" }, { nome: "altezza", valore: "x".repeat(80) }],
  });
  assert.deepEqual(f.misure.map((m) => m.nome), ["base", "altezza"]);
  assert.equal(f.misure[0].valore, "12 cm");
  assert.ok(f.misure[1].valore.length <= 24);
  for (const forma of Object.keys(FORME)) assert.ok(FORME[forma].length >= 1, forma);
});

test("prompt di generazione: tipi con id breve, numero, regole della verifica e nomi delle misure", () => {
  const p = promptEserciziGenera({
    materia: "matematica", titolo: "Pitagora", quanti: 7, classe: "3B",
    tipi: [{ breve: "t1", titolo: "Teorema di Pitagora", ancora: "cateti 6 cm e 8 cm", difficolta: 2, figura: true }],
  });
  assert.match(p, /7 esercizi/);
  assert.match(p, /"t1"/);
  assert.match(p, /cateti 6 cm e 8 cm/);
  assert.match(p, /verifica/);
  assert.match(p, /niente eval|solo numeri/i);
  assert.match(p, /triangolo_rettangolo: cateto1, cateto2, ipotenusa/);
  assert.match(p, /13 anni \(terza media\)/);
});

test("revisione: il risultato non può essere un'espressione, la verifica non può fingere un ricalcolo", () => {
  const m = (extra) => motivoScarto(buono(extra), TIPI);
  assert.equal(m({ risultato: { valore: "√225", unita: "cm" }, verifica: "sqrt(9^2 + 12^2)" }), "risultato");
  assert.equal(m({ risultato: { valore: "3*5", unita: "cm" } }), "risultato");
  assert.equal(m({ verifica: "15*1" }), "verifica", "×1 non ricalcola niente");
  assert.equal(m({ verifica: "12 + 3 + 0" }), "verifica");
  assert.equal(m({ verifica: "12 + 3" }), "verifica", "3 è una costante: usa un solo numero dei dati");
  assert.equal(m({ verifica: "12-12+100/2-4-4" }), "verifica");
  assert.equal(m({ passaggi: [{ testo: "Applico Pitagora", formula: "\\sqrt{9^2+12^2} = 16" }] }), "passaggi", "lo svolgimento arriva a un altro numero");
  assert.equal(m({ tipo: "constructor" }), "tipo");
  assert.equal(m({ tipo: "__proto__" }), "tipo");
});

test("revisione: forme dal prototipo, misure della figura che non stanno nei dati", () => {
  assert.equal(pulisciFigura({ forma: "constructor", misure: [{ nome: "x", valore: "1" }] }), null);
  assert.equal(pulisciFigura({ forma: "toString", misure: [] }), null);
  const f = pulisciFigura({ forma: "rettangolo", misure: [{ nome: "base", valore: "12 cm" }, { nome: "altezza", valore: "5 cm" }, { nome: "diagonale", valore: "?" }] },
    "Un rettangolo ha la base di 12 cm e la diagonale di 13 cm.");
  assert.deepEqual(f.misure.map((x) => x.nome), ["base", "diagonale"], "5 cm non è nei dati: la misura sparisce");
});

test("revisione: migliaia all'italiana nella consegna, decimali col punto nella verifica, arrotondamento a metà", () => {
  assert.deepEqual(numeriIn("un campo di 1.500 m e 7,5 m", true), [1500, 7.5]);
  assert.deepEqual(numeriIn("0.125 * 1500"), [0.125, 1500]);
  assert.equal(coincide(0.35, "0,4"), true);
  assert.equal(coincide(0.35, "0,3"), false, "a metà si arrotonda per eccesso");
  assert.equal(coincide(-0.35, "-0,4"), true);
  assert.equal(coincide(1.05, "1,1"), true);
});
