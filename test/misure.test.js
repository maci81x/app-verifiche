// Ricalcolo dalle figure (issue #10): la formula si ricontrolla sulle misure disegnate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { attesiDallaFigura, figuraNonTorna, valoreMisura, GRANDEZZE } from "../supabase/functions/_shared/misure.js";
import { motivoScarto, eserciziVerificati } from "../supabase/functions/_shared/generati.js";

const fig = (forma, misure) => ({ forma, misure: Object.entries(misure).map(([nome, valore]) => ({ nome, valore })) });
const TIPI = { t1: { id: "uuid-area", titolo: "Area del triangolo" } };

// Il caso dell'issue: area del triangolo calcolata senza il /2. La verifica torna con se
// stessa (8*5 = 40), la formula no.
const triangolo = (valore, verifica, grandezza = "area") => ({
  tipo: "t1",
  testo: "Calcola l'area di un triangolo con base 8 cm e altezza 5 cm.",
  dati: "base 8 cm; altezza 5 cm",
  figura: fig("triangolo", { base: "8 cm", altezza: "5 cm" }),
  passaggi: [{ testo: "Base per altezza", formula: verifica.replace("*", "\\cdot") }, { testo: "Risultato", formula: "= " + valore }],
  grandezza,
  risultato: { valore, unita: "cm²" },
  verifica,
});

test("area del triangolo senza il /2: la verifica torna ma la formula no, scartato", () => {
  assert.equal(motivoScarto(triangolo("40", "8*5"), TIPI), "formula");
  assert.equal(motivoScarto(triangolo("20", "8*5/2"), TIPI), null);
  const r = eserciziVerificati([triangolo("40", "8*5"), triangolo("20", "8*5/2")], TIPI, 5);
  assert.equal(r.esercizi.length, 1);
  assert.equal(r.scartati, 1);
});

test("grandezza «altro» o assente: decide solo la verifica, come prima", () => {
  assert.equal(motivoScarto(triangolo("40", "8*5", "altro"), TIPI), null);
  const { grandezza, ...senza } = triangolo("20", "8*5/2");
  assert.equal(motivoScarto(senza, TIPI), null);
  assert.equal(motivoScarto(triangolo("40", "8*5", "inventata"), TIPI), null);
});

test("le misure si leggono con unità, virgola e migliaia; «?» e più numeri non valgono", () => {
  const f = fig("rettangolo", { base: "7,5 cm", altezza: "?", diagonale: "1.200 m" });
  assert.equal(valoreMisura(f, "base"), 7.5);
  assert.equal(valoreMisura(f, "altezza"), null);
  assert.equal(valoreMisura(f, "diagonale"), 1200);
  assert.equal(valoreMisura(fig("rettangolo", { base: "3 o 4" }), "base"), null);
  assert.equal(valoreMisura(f, "lato"), null);
});

test("formule giuste per le forme standard", () => {
  const casi = [
    ["triangolo", { base: "10", altezza: "6" }, "area", 30],
    ["triangolo", { base: "10", lato_sinistro: "7", lato_destro: "8" }, "perimetro", 25],
    ["triangolo_rettangolo", { cateto1: "6", cateto2: "8" }, "area", 24],
    ["triangolo_rettangolo", { cateto1: "6", cateto2: "8" }, "perimetro", 24],
    ["rettangolo", { base: "12", altezza: "5" }, "area", 60],
    ["rettangolo", { base: "12", altezza: "5" }, "perimetro", 34],
    ["quadrato", { lato: "9" }, "area", 81],
    ["quadrato", { lato: "9" }, "perimetro", 36],
    ["parallelogramma", { base: "10", altezza: "4", lato: "5" }, "area", 40],
    ["parallelogramma", { base: "10", altezza: "4", lato: "5" }, "perimetro", 30],
    ["rombo", { diagonale_maggiore: "16", diagonale_minore: "12" }, "area", 96],
    ["rombo", { diagonale_maggiore: "16", diagonale_minore: "12" }, "perimetro", 40],
    ["trapezio", { base_maggiore: "12", base_minore: "8", altezza: "5" }, "area", 50],
    ["cubo", { spigolo: "3" }, "volume", 27],
    ["parallelepipedo", { lunghezza: "4", larghezza: "3", altezza: "2" }, "volume", 24],
  ];
  for (const [forma, misure, grandezza, atteso] of casi)
    assert.deepEqual(attesiDallaFigura(fig(forma, misure), grandezza), [atteso], forma + " " + grandezza);
});

test("cerchio e cilindro: va bene sia π = 3,14 sia π vero", () => {
  const c = fig("cerchio", { raggio: "5 cm" });
  assert.equal(figuraNonTorna(c, "area", "78,5", "cm²"), null);
  assert.equal(figuraNonTorna(c, "area", "78,54", "cm²"), null);
  assert.equal(figuraNonTorna(c, "perimetro", "31,4", "cm"), null);
  assert.equal(figuraNonTorna(c, "area", "31,4", "cm²"), "formula", "2πr non è l'area");
  assert.equal(figuraNonTorna(fig("cilindro", { raggio: "2", altezza: "10" }), "volume", "125,6", "cm³"), null);
});

test("misura mancante: Pitagora nei due versi, diagonale, raggio", () => {
  const ip = fig("triangolo_rettangolo", { cateto1: "9 cm", cateto2: "12 cm", ipotenusa: "?" });
  assert.equal(figuraNonTorna(ip, "misura", "15", "cm"), null);
  assert.equal(figuraNonTorna(ip, "misura", "21", "cm"), "formula", "9 + 12 non è l'ipotenusa");
  const cat = fig("triangolo_rettangolo", { cateto1: "?", cateto2: "8", ipotenusa: "10" });
  assert.equal(figuraNonTorna(cat, "misura", "6", "cm"), null);
  assert.equal(figuraNonTorna(fig("rettangolo", { base: "5", altezza: "5", diagonale: "?" }), "misura", "7,07", "cm"), null);
  assert.equal(figuraNonTorna(fig("cerchio", { raggio: "?", diametro: "18" }), "misura", "9", "cm"), null);
  // Due misure con «?»: non si sa quale si cerca, decide la verifica.
  assert.equal(attesiDallaFigura(fig("triangolo_rettangolo", { cateto1: "?", cateto2: "?", ipotenusa: "10" }), "misura"), null);
});

test("figura incoerente (Pitagora, diametro) scartata anche se il risultato tornasse", () => {
  const storto = fig("triangolo_rettangolo", { cateto1: "6 cm", cateto2: "8 cm", ipotenusa: "11 cm" });
  assert.equal(figuraNonTorna(storto, "area", "24", "cm²"), "figura_incoerente");
  assert.equal(figuraNonTorna(fig("cerchio", { raggio: "4", diametro: "10" }), "altro", "5", ""), "figura_incoerente");
  assert.equal(figuraNonTorna(fig("triangolo_rettangolo", { cateto1: "6", cateto2: "8", ipotenusa: "10" }), "area", "24", "cm²"), null);
});

test("unità: un'area in cm o un perimetro in cm² sono sbagliati", () => {
  const r = fig("rettangolo", { base: "12", altezza: "5" });
  assert.equal(figuraNonTorna(r, "area", "60", "cm"), "unita");
  assert.equal(figuraNonTorna(r, "perimetro", "34", "cm²"), "unita");
  assert.equal(figuraNonTorna(r, "area", "60", "cm²"), null);
  assert.equal(figuraNonTorna(r, "area", "60", ""), null);
});

test("misure che non bastano o forme sconosciute: niente ricalcolo", () => {
  assert.equal(attesiDallaFigura(fig("triangolo", { base: "8", altezza: "?" }), "area"), null);
  assert.equal(attesiDallaFigura(fig("trapezio", { base_maggiore: "8", base_minore: "4", altezza: "3", lato_obliquo: "5" }), "perimetro"), null);
  assert.equal(attesiDallaFigura({ forma: "constructor", misure: [] }, "area"), null);
  assert.equal(attesiDallaFigura(null, "area"), null);
  assert.equal(figuraNonTorna(null, "area", "5", ""), null);
  assert.deepEqual(GRANDEZZE, ["area", "perimetro", "volume", "misura", "altro"]);
});
