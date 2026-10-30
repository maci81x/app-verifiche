// Tipi di esercizio di matematica: ancoraggio e pulizia (issue #5, fetta #6).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ancoraEsercizioRegge, segni, tipiAncorati, MAX_TIPI } from "../supabase/functions/_shared/esercizi.js";
import { promptEserciziTipi } from "../supabase/functions/_shared/prompt.js";

const PAGINA = `Esercizi pag. 112
Calcola il valore delle seguenti espressioni:
45) [3/4 + (2/5 − 1/10)] × 2 =
46) (2^3 + 5^2) : 11 =
Problemi
52) Un rettangolo ha la base di 12 cm e l'altezza di 7,5 cm. Calcola perimetro e area.
53) Calcola l'ipotenusa di un triangolo rettangolo con i cateti di 6 cm e 8 cm.`;

test("segni: numeri con la virgola o il punto e parole lunghe, simboli esclusi", () => {
  assert.deepEqual(segni("7,5 cm × 2"), ["7.5", "2"]);
  assert.deepEqual(segni("Calcola l'area"), ["calcola", "area"]);
});

test("l'ancora regge se l'esercizio è nella trascrizione, anche con simboli scritti diversi", () => {
  assert.equal(ancoraEsercizioRegge("[3/4 + (2/5 - 1/10)] * 2", PAGINA), true);
  assert.equal(ancoraEsercizioRegge("(2³ + 5²) ÷ 11", PAGINA), true, "esponenti in apice come ^");
  assert.equal(ancoraEsercizioRegge("(2^3 + 5^2) ÷ 11 =", PAGINA), true);
  assert.equal(ancoraEsercizioRegge("rettangolo base 12 cm altezza 7,5 cm perimetro area", PAGINA), true);
  assert.equal(ancoraEsercizioRegge("cateti di 6 cm e 8 cm, calcola l'ipotenusa", PAGINA), true);
});

test("l'ancora non regge se è inventata, troppo corta o fatta di numeri sparsi nella pagina", () => {
  assert.equal(ancoraEsercizioRegge("Risolvi l'equazione 3x + 7 = 22", PAGINA), false);
  assert.equal(ancoraEsercizioRegge("2 + 5", PAGINA), false, "meno di tre segni");
  assert.equal(ancoraEsercizioRegge("", PAGINA), false);
  // 112, 45, 11 e 8 ci sono, ma lontanissimi fra loro.
  assert.equal(ancoraEsercizioRegge("112 + 45 - 11 + 8", PAGINA), false);
});

test("tipi: tiene gli ancorati, scarta e conta gli altri, niente doppioni né titoli già salvati", () => {
  const grezzi = [
    { titolo: "Espressioni con le frazioni", ancora: "[3/4 + (2/5 − 1/10)] × 2", difficolta: 2, figura: false },
    { titolo: "Teorema di Pitagora", ancora: "ipotenusa di un triangolo rettangolo con i cateti di 6 cm e 8 cm", difficolta: 5, figura: true },
    { titolo: "Equazioni di primo grado", ancora: "3x + 7 = 22 risolvi", difficolta: 2, figura: false },
    { titolo: "espressioni con le frazioni ", ancora: "[3/4 + (2/5 − 1/10)] × 2", difficolta: 1, figura: false },
    { titolo: "Potenze", ancora: "(2^3 + 5^2) : 11", difficolta: 0, figura: "sì" },
    { titolo: "", ancora: "45) [3/4 + (2/5 − 1/10)] × 2" },
    { titolo: "Perimetro e area del rettangolo", ancora: "base di 12 cm e l'altezza di 7,5 cm" },
  ];
  const r = tipiAncorati(grezzi, PAGINA, ["Perimetro e area del rettangolo"]);
  assert.deepEqual(r.tipi.map((t) => t.titolo), ["Espressioni con le frazioni", "Teorema di Pitagora", "Potenze"]);
  assert.equal(r.scartati, 4);
  assert.equal(r.tipi[1].difficolta, 3, "difficoltà portata fra 1 e 3");
  assert.equal(r.tipi[2].difficolta, 2, "difficoltà mancante o zero vale 2");
  assert.equal(r.tipi[1].figura, true);
  assert.equal(r.tipi[2].figura, false, "solo true vale come figura");
});

test("tipi: al massimo " + MAX_TIPI + ", e una risposta vuota non rompe niente", () => {
  const molti = Array.from({ length: 20 }, (_, i) => ({ titolo: "Tipo " + i, ancora: "[3/4 + (2/5 − 1/10)] × 2" }));
  const r = tipiAncorati(molti, PAGINA);
  assert.equal(r.tipi.length, MAX_TIPI);
  assert.equal(r.scartati, 20 - MAX_TIPI);
  assert.deepEqual(tipiAncorati(null, PAGINA), { tipi: [], scartati: 0 });
});

test("prompt dei tipi: chiede l'esercizio vero come ancora, la figura e non ripete i tipi già salvati", () => {
  const p = promptEserciziTipi("matematica", "Frazioni", PAGINA, ["Potenze"]);
  assert.match(p, /copiat[oa] carattere per carattere/);
  assert.match(p, /figura/);
  assert.match(p, /\["Potenze"\]/);
  assert.match(p, /Calcola il valore delle seguenti espressioni/);
  assert.doesNotMatch(promptEserciziTipi("matematica", "Frazioni", PAGINA, []), /già salvati/);
});
