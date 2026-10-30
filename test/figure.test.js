// Figure SVG e formule degli esercizi di matematica (issue #5, fetta #7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { FORME } from "../supabase/functions/_shared/generati.js";

const ctx = vm.createContext({ Math, JSON, Number, String, Object, Array });
vm.runInContext(readFileSync(new URL("../figure.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../formule.js", import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const svg = (figura) => run(`svgFigura(${JSON.stringify(figura)})`);

const tutte = (forma) => ({ forma, misure: FORME[forma].map((nome, i) => ({ nome, valore: i === 0 ? "?" : (4 + i * 3) + " cm" })) });

// Tutte le coordinate di un SVG, per controllare che stiano dentro il viewBox.
function coordinate(s) {
  const [, , w, h] = /viewBox="([^"]+)"/.exec(s)[1].split(" ").map(Number);
  const punti = [];
  for (const m of s.matchAll(/\b(x|x1|x2|cx)="(-?[\d.]+)"/g)) punti.push(["x", +m[2]]);
  for (const m of s.matchAll(/\b(y|y1|y2|cy)="(-?[\d.]+)"/g)) punti.push(["y", +m[2]]);
  for (const m of s.matchAll(/points="([^"]+)"/g))
    for (const c of m[1].trim().split(/\s+/)) { const [x, y] = c.split(",").map(Number); punti.push(["x", x], ["y", y]); }
  for (const m of s.matchAll(/<(?:circle|ellipse)[^>]*>/g)) {
    const a = (n) => +(new RegExp(`\\b${n}="(-?[\\d.]+)"`).exec(m[0]) || [, NaN])[1];
    const rx = a("r") || a("rx"), ry = a("r") || a("ry");
    punti.push(["x", a("cx") - rx], ["x", a("cx") + rx], ["y", a("cy") - ry], ["y", a("cy") + ry]);
  }
  return { w, h, punti };
}

test("le forme del client sono quelle del server, con gli stessi nomi delle misure", () => {
  assert.deepEqual(JSON.parse(run("JSON.stringify(FORME_FIGURE)")), FORME);
});

test("ogni forma prevista produce un SVG che sta dentro il suo viewBox, con un'etichetta per misura", () => {
  for (const forma of Object.keys(FORME)) {
    const s = svg(tutte(forma));
    assert.match(s, /^<svg [^>]*viewBox="0 0 \d+ \d+"/, forma);
    const { w, h, punti } = coordinate(s);
    assert.ok(punti.length > 4, forma + ": niente disegno");
    for (const [asse, v] of punti) assert.ok(v >= 0 && v <= (asse === "x" ? w : h), `${forma}: ${asse}=${v} fuori dal viewBox ${w}×${h}`);
    assert.equal((s.match(/<text/g) || []).length, FORME[forma].length, forma + ": etichette");
    assert.match(s, /\?<\/text>/, forma + ": la misura da trovare resta un punto di domanda");
  }
});

test("proporzioni: un rettangolo largo resta largo, misure strane non rompono il disegno", () => {
  const largo = coordinate(svg({ forma: "rettangolo", misure: [{ nome: "base", valore: "20 cm" }, { nome: "altezza", valore: "5 cm" }] }));
  const xs = largo.punti.filter(([a]) => a === "x").map(([, v]) => v);
  const ys = largo.punti.filter(([a]) => a === "y").map(([, v]) => v);
  assert.ok(Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys));
  for (const valore of ["0 cm", "-3", "1e9", "?", ""]) {
    const s = svg({ forma: "rettangolo", misure: [{ nome: "base", valore }, { nome: "altezza", valore: "4" }] });
    for (const [asse, v] of coordinate(s).punti) assert.ok(Number.isFinite(v) && v >= 0 && v <= (asse === "x" ? 240 : 180), valore);
  }
});

test("forme sconosciute o senza misure: niente figura; le etichette sono testo, non HTML", () => {
  assert.equal(svg(null), "");
  assert.equal(svg({ forma: "esagono", misure: [{ nome: "lato", valore: "3" }] }), "");
  const s = svg({ forma: "quadrato", misure: [{ nome: "lato", valore: "<b>5</b>" }] });
  assert.doesNotMatch(s, /<b>/);
  assert.match(s, /&lt;b&gt;5/);
});

test("formule: senza KaTeX il LaTeX diventa testo leggibile", () => {
  const t = (s) => run(`latexATesto(${JSON.stringify(s)})`);
  assert.equal(t("\\frac{3}{4} + \\frac{1}{2}"), "3/4 + 1/2");
  assert.equal(t("\\frac{a+1}{2}"), "(a+1)/2");
  assert.equal(t("\\sqrt{36} = 6"), "√36 = 6");
  assert.equal(t("\\sqrt{9^{2} + 12^{2}}"), "√(9² + 12²)");
  assert.equal(t("3 \\cdot 4 \\times 2 \\div 6"), "3 · 4 × 2 : 6");
  assert.equal(t("\\left( 2 + 3 \\right)^{2}"), "(2 + 3)²");
  assert.equal(t("A = \\pi r^2"), "A = π r²");
  assert.equal(t("x^{10}"), "x^10");
  assert.equal(t("12\\,\\text{cm}^2"), "12 cm²");
  assert.equal(t("a \\geq b \\neq c"), "a ≥ b ≠ c");
});
