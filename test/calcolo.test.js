// Valutatore aritmetico scritto a mano (issue #5, fetta #7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { valuta, ErroreCalcolo, decimaliDichiarati, coincide } from "../supabase/functions/_shared/calcolo.js";

const vicino = (espr, atteso) => assert.ok(Math.abs(valuta(espr) - atteso) < 1e-9, `${espr} = ${valuta(espr)}, atteso ${atteso}`);

test("precedenze: prima potenze, poi per e diviso, poi più e meno, da sinistra a destra", () => {
  vicino("2 + 3 * 4", 14);
  vicino("10 - 4 - 3", 3);
  vicino("24 / 4 / 2", 3);
  vicino("2 * 3^2", 18);
  vicino("2^3^2", 512); // le potenze si leggono da destra
  vicino("-2^2", -4);
  vicino("(-2)^2", 4);
  vicino("2^-1", 0.5);
});

test("simboli della scuola: × · ÷ : − e parentesi tonde, quadre e graffe", () => {
  vicino("{[3 × (2 + 1)] − 4} : 5", 1);
  vicino("12 ÷ 4 · 3", 9);
  vicino("7 − 10", -3);
  vicino("[(2^3 + 5^2) : 11]", 3);
});

test("frazioni, decimali con la virgola o il punto, radici", () => {
  vicino("3/4 + (2/5 - 1/10)", 1.05);
  vicino("[3/4 + (2/5 − 1/10)] × 2", 2.1);
  vicino("7,5 * 2", 15);
  vicino("0.25 + 0,75", 1);
  vicino("√16 + 9", 13);
  vicino("√(36 + 64)", 10);
  vicino("sqrt(6^2 + 8^2)", 10);
  vicino("3,14 * 5^2", 78.5);
  vicino("2(3 + 4)", 14); // moltiplicazione sottintesa davanti alla parentesi
  vicino("(1 + 1)(2 + 3)", 10);
  vicino("2√9", 6);
  vicino("2³ + 5²", 33);
});

test("errori: divisione per zero, parentesi sbagliate, simboli sconosciuti, espressioni vuote", () => {
  const casi = ["5 / 0", "3 : (2 - 2)", "(2 + 3", "2 + 3)", "[2 + 3)", "2 + x", "3 % 2", "2 +", "", "   ", "√-4", "2 ** 3",
    "1,2,3", "eval(1)", "Math.PI", "2 ^ 400", "((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((1))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))"];
  for (const c of casi) assert.throws(() => valuta(c), ErroreCalcolo, `doveva fallire: ${JSON.stringify(c)}`);
  assert.throws(() => valuta(null), ErroreCalcolo);
  assert.throws(() => valuta("1+".repeat(400) + "1"), ErroreCalcolo, "troppo lunga");
});

test("il modulo non usa eval né Function", () => {
  const sorgente = readFileSync(new URL("../supabase/functions/_shared/calcolo.js", import.meta.url), "utf8")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(sorgente, /\beval\s*\(|\bFunction\s*\(|new\s+Function/);
});

test("decimali dichiarati: quanti ne ha il risultato scritto dal modello", () => {
  assert.equal(decimaliDichiarati("25"), 0);
  assert.equal(decimaliDichiarati("7,5"), 1);
  assert.equal(decimaliDichiarati("113.04"), 2);
  assert.equal(decimaliDichiarati("3/4"), null);
});

test("coincide: esatto per gli interi e le frazioni, arrotondamento per i decimali", () => {
  assert.equal(coincide(25, "25"), true);
  assert.equal(coincide(25.4, "25"), false, "un intero dichiarato deve tornare esatto");
  assert.equal(coincide(10 / 3, "3,33"), true);
  assert.equal(coincide(10 / 3, "3,3"), true);
  assert.equal(coincide(10 / 3, "3,4"), false);
  assert.equal(coincide(0.75, "3/4"), true);
  assert.equal(coincide(0.75, "2/3"), false);
  assert.equal(coincide(-3, "−3"), true);
  assert.equal(coincide(5, "cinque"), false);
  assert.equal(coincide(5, ""), false);
});
