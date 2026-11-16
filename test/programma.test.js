// Issue #28: la mappa del programma delle medie (supabase/functions/_shared/programma.js), solo dati.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROGRAMMA, MATERIE } from "../supabase/functions/_shared/programma.js";

const tutti = [];
for (const classe of [1, 2, 3]) for (const materia of MATERIE) for (const a of PROGRAMMA[classe]?.[materia] || []) tutti.push({ classe, materia, a });
const perId = new Map(tutti.map((x) => [x.a.id, x]));
const pieno = (s) => typeof s === "string" && s.trim().length > 0;

test("tutte le classi e tutte le materie del ticket", () => {
  assert.deepEqual(MATERIE, ["matematica", "italiano", "storia", "geografia", "scienze", "inglese"]);
  for (const classe of [1, 2, 3]) for (const materia of MATERIE)
    assert.ok((PROGRAMMA[classe][materia] || []).length >= 3, classe + "ª " + materia + ": almeno 3 argomenti");
});

test("ogni argomento: id unico, titolo, almeno una strategia e un errore tipico completi, parole chiave", () => {
  assert.equal(perId.size, tutti.length, "id ripetuti");
  const errori = new Set();
  for (const { classe, materia, a } of tutti) {
    const dove = classe + "ª " + materia + " " + a.id;
    assert.match(a.id, /^[a-z]{2}[123]-[a-z0-9-]+$/, dove);
    assert.equal(a.id.slice(2, 3), String(classe), dove + ": la cifra dell'id è la classe");
    assert.ok(pieno(a.titolo), dove);
    assert.ok(Array.isArray(a.prerequisiti), dove);
    assert.ok(a.strategie.length >= 1, dove + ": strategia");
    for (const s of a.strategie) {
      assert.ok(pieno(s.nome) && pieno(s.quando), dove + ": strategia senza nome o quando");
      assert.ok(Array.isArray(s.passi) && s.passi.length >= 2 && s.passi.every(pieno), dove + ": passi della strategia");
    }
    assert.ok(a.errori_tipici.length >= 1, dove + ": errore tipico");
    for (const e of a.errori_tipici) {
      assert.match(e.id, /^[a-z0-9-]+$/, dove);
      assert.ok(!errori.has(e.id), dove + ": id di errore ripetuto " + e.id);
      errori.add(e.id);
      for (const k of ["errore", "esempio", "come_riconoscerlo", "spiegazione"]) assert.ok(pieno(e[k]), dove + " " + e.id + ": " + k);
    }
    assert.ok(Array.isArray(a.parole_chiave) && a.parole_chiave.length >= 2 && a.parole_chiave.every(pieno), dove + ": parole chiave");
  }
});

test("i prerequisiti esistono, sono della stessa materia e di una classe uguale o precedente, senza cicli", () => {
  for (const { classe, materia, a } of tutti) for (const p of a.prerequisiti) {
    const x = perId.get(p);
    assert.ok(x, a.id + ": prerequisito inesistente " + p);
    assert.ok(x.classe <= classe, a.id + ": prerequisito " + p + " di una classe dopo");
    assert.equal(x.materia, materia, a.id + ": prerequisito " + p + " di un'altra materia");
    assert.notEqual(p, a.id);
  }
  const visita = (id, strada = new Set()) => {
    assert.ok(!strada.has(id), "ciclo di prerequisiti in " + [...strada, id].join(" → "));
    for (const p of perId.get(id).a.prerequisiti) visita(p, new Set([...strada, id]));
  };
  for (const { a } of tutti) visita(a.id);
});

test("gli argomenti chiave del ticket ci sono, dove li usa il codice", () => {
  const titoli = (c, m) => PROGRAMMA[c][m].map((a) => a.titolo.toLowerCase()).join(" | ");
  for (const [c, m, re] of [
    [1, "matematica", /mcd/], [1, "matematica", /frazion/], [1, "matematica", /potenz/],
    [2, "matematica", /frazion/], [2, "matematica", /pitagora/], [2, "matematica", /proporzion/], [2, "matematica", /radice/], [2, "matematica", /percentual/],
    [3, "matematica", /relativi/], [3, "matematica", /equazion/], [3, "matematica", /solidi/], [3, "matematica", /letterale/],
    [1, "italiano", /analisi grammaticale/], [1, "italiano", /epica/], [2, "italiano", /analisi logica/], [3, "italiano", /analisi del periodo/],
    [2, "italiano", /poesia/], [3, "storia", /guerr/], [2, "geografia", /europa/], [3, "inglese", /invalsi/],
  ]) assert.match(titoli(c, m), re, c + "ª " + m);
  // id che il codice usa: errori tipici riconosciuti per nome e prerequisito delle equazioni
  const f2 = perId.get("ma2-frazioni-operazioni");
  assert.ok(f2, "ma2-frazioni-operazioni");
  const somma = f2.a.errori_tipici.find((e) => e.id === "frazioni-somma-denominatori");
  assert.ok(somma, "frazioni-somma-denominatori");
  assert.match(somma.esempio, /1\/2 \+ 1\/3 = 2\/5/);
  assert.ok(perId.get("ma3-equazioni").a.prerequisiti.includes("ma2-frazioni-operazioni"));
  assert.ok(perId.get("ma3-equazioni").a.strategie.some((s) => /chiamo x/i.test(s.nome)));
  const problemi = perId.get("ma2-problemi-frazioni").a.strategie.map((s) => s.nome.toLowerCase()).join(" | ");
  assert.match(problemi, /dalla parte all'intero/);
  assert.match(problemi, /ritroso/);
  const errori = tutti.flatMap((x) => x.a.errori_tipici.map((e) => e.id));
  for (const id of ["area-perimetro", "unita-quadrato-cubo", "meno-per-meno", "parentesi-segni", "pitagora-cateto-somma", "percentuale-totale-sbagliato"])
    assert.ok(errori.includes(id), "errore tipico " + id);
});

test("voce del ticket #17: niente forme di genere e niente «sbagliato» nelle spiegazioni", () => {
  const testi = tutti.flatMap(({ a }) => [...a.errori_tipici.map((e) => e.spiegazione + " " + e.come_riconoscerlo), ...a.strategie.map((s) => s.passi.join(" "))]);
  for (const t of testi) {
    assert.doesNotMatch(t, /\b(sicura|pronta|stanca|brava|bravo|sicuro|pronto|attento|attenta)\b/i, t);
    assert.doesNotMatch(t, /\bsbagliat[oaie]\b/i, t);
  }
});
