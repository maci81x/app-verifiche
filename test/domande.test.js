// Scelta dei concetti e filtro delle domande che girano nella Edge Function.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { debolezza, preparaPool, tieniAncorate } from "../supabase/functions/_shared/domande.js";
import { promptDomande } from "../supabase/functions/_shared/prompt.js";

const ARG = {
  id: "uuid-arg", titolo: "La Scuola poetica siciliana", materia: "italiano",
  trascrizione: "Il sonetto è composto di 14 versi endecasillabi suddivisi in due quartine e due terzine. " +
    "La parola sonetto deriva dal provenzale sonet, che significa suono.",
  concetti: [
    { id: "uuid-c1", titolo: "Struttura del sonetto", descrizione: "14 endecasillabi", ancora: "14 versi endecasillabi", peso: 3, media: null },
    { id: "uuid-c2", titolo: "Origine della parola", descrizione: "sonet = suono", ancora: "deriva dal provenzale sonet", peso: 2, media: 9 },
  ],
};

test("debolezza come nel prototipo: mai verificato vale 6, poi 10 meno la media", () => {
  assert.equal(debolezza({ media: null }), 6);
  assert.equal(debolezza({ media: 7.5 }), 2.5);
});

test("al modello i concetti arrivano con id brevi e l'andamento", () => {
  const { contesto, indice } = preparaPool([ARG], false);
  assert.deepEqual(contesto.map((c) => [c.id, c.andamento]), [["c1", "mai verificato"], ["c2", "ultima volta 9.0/10"]]);
  assert.equal(indice.c1.c.id, "uuid-c1");
});

test("nel ripasso restano i 12 concetti più deboli, pesati per importanza", () => {
  const molti = { ...ARG, concetti: Array.from({ length: 20 }, (_, i) => ({ id: "k" + i, titolo: "t", descrizione: "", ancora: "a", peso: 1, media: i % 10 })) };
  const { pool } = preparaPool([molti], true);
  assert.equal(pool.length, 12);
  assert.ok(pool.every((p, i) => i === 0 || pool[i - 1].score >= p.score));
});

test("passano solo le domande ancorate e ben formate, ricollegate al concetto vero", () => {
  const { indice } = preparaPool([ARG], false);
  const r = tieniAncorate([
    { concetto_id: "c1", tipo: "chiusa", testo: "Quanti versi ha il sonetto?", opzioni: ["12", "14", "16", "11"], corretta: 1,
      ancora: "Il sonetto è composto di 14 versi endecasillabi" },
    { concetto_id: "c2", tipo: "aperta", testo: "Da dove viene la parola sonetto?", risposta_attesa: "Dal provenzale sonet, suono",
      elementi: ["provenzale", "suono"], ancora: "La parola sonetto deriva dal provenzale sonet" },
    // vera ma non nel materiale
    { concetto_id: "c1", tipo: "aperta", testo: "Chi inventò il sonetto?", risposta_attesa: "Jacopo da Lentini",
      ancora: "Jacopo da Lentini notaio inventò il sonetto alla corte" },
    // concetto inesistente
    { concetto_id: "c9", tipo: "chiusa", testo: "x", opzioni: ["a", "b", "c", "d"], corretta: 0, ancora: "14 versi endecasillabi" },
    // chiusa con la corretta fuori dalle opzioni
    { concetto_id: "c1", tipo: "chiusa", testo: "x", opzioni: ["a", "b", "c", "d"], corretta: 4, ancora: "14 versi endecasillabi" },
  ], indice, [ARG]);
  assert.equal(r.scartate, 3);
  assert.deepEqual(r.domande.map((d) => [d.id, d.tipo, d.concetto_id, d.argomento_id]), [
    ["d1", "chiusa", "uuid-c1", "uuid-arg"], ["d2", "aperta", "uuid-c2", "uuid-arg"],
  ]);
  assert.equal(r.domande[0].concetto_titolo, "Struttura del sonetto");
});

test("il prompt delle domande cambia con livello, tipo e modalità come nel prototipo", () => {
  const base = { contesto: [], gia: [], materiale: [{ titolo: "x", trascrizione: "y" }], ripasso: false };
  const orale = promptDomande({ ...base, livello: "medio", tipo: "miste", modalita: "orale" });
  assert.match(orale, /8 domande: quattro chiuse a quattro opzioni e quattro aperte brevi/);
  assert.match(orale, /interrogazione orale/);
  const scritta = promptDomande({ ...base, livello: "difficile", tipo: "aperte", modalita: "scritta", gia: ["Q1"] });
  assert.match(scritta, /6 domande: tutte aperte/);
  assert.match(scritta, /verifica scritta/);
  assert.match(scritta, /non riproporle uguali[\s\S]*"Q1"/);
});
