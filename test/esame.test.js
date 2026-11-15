// Issue #28 (resto): scaletta del colloquio dell'esame di terza media dagli argomenti salvati (_shared/esame.js).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { promptEsame, pulisciEsame, argomentiPerEsame } from "../supabase/functions/_shared/esame.js";

const ARG = [
  { id: "u-1", titolo: "La Prima guerra mondiale", materia: "Storia", concetti: [{ titolo: "Trincee" }, { titolo: "Caporetto" }] },
  { id: "u-2", titolo: "Ungaretti", materia: "Italiano", concetti: [{ titolo: "Il porto sepolto" }, { titolo: "Veglia" }] },
  { id: "u-3", titolo: "Il sistema nervoso", materia: "Scienze", concetti: [{ titolo: "Neurone" }] },
  { id: "u-4", titolo: "Present perfect", materia: "Inglese", concetti: [] },
];

test("argomenti per l'esame: id brevi al posto degli id veri, concetti per titolo; servono almeno due materie", () => {
  const a = argomentiPerEsame(ARG);
  assert.deepEqual(a.map((x) => x.breve), ["a1", "a2", "a3", "a4"]);
  assert.deepEqual(a[0].concetti, ["Trincee", "Caporetto"]);
  assert.equal(argomentiPerEsame([ARG[0], { ...ARG[0], id: "u-9" }]), null); // una materia sola
  assert.equal(argomentiPerEsame([ARG[0]]), null);
});

test("prompt dell'esame: terza media, argomenti con gli id brevi, collegamenti fra materie, niente fatti inventati", () => {
  const t = promptEsame({ classe: "3", argomenti: argomentiPerEsame(ARG) });
  assert.match(t, /Classe: 3ª media/);
  assert.match(t, /a2: Ungaretti \(Italiano\)/);
  assert.match(t, /collegament/i);
  assert.match(t, /solo gli argomenti dell'elenco/i);
});

test("scaletta pulita: partenza e tappe solo fra gli argomenti salvati, concetti veri, almeno due materie, niente doppioni", () => {
  const a = argomentiPerEsame(ARG);
  const r = pulisciEsame({
    titolo: "La guerra e le parole", partenza: { argomento: "a1", apertura: "Parto dalle trincee." },
    tappe: [
      { argomento: "a2", collegamento: "Ungaretti scrive al fronte.", concetti: ["Il porto sepolto", "Inventato"] },
      { argomento: "a2", collegamento: "di nuovo", concetti: [] },          // doppione
      { argomento: "a9", collegamento: "non esiste", concetti: [] },        // non salvato
      { argomento: "a3", collegamento: "La paura passa dal sistema nervoso.", concetti: ["Neurone"] },
    ],
    domande: [{ argomento: "a1", testo: "Perché Caporetto?" }, { argomento: "a7", testo: "x" }],
    consigli: ["Parla piano.", ""],
  }, a);
  assert.equal(r.partenza.argomento.id, "u-1");
  assert.equal(r.partenza.argomento.titolo, "La Prima guerra mondiale");
  assert.deepEqual(r.tappe.map((t) => t.argomento.id), ["u-2", "u-3"]);
  assert.deepEqual(r.tappe[0].concetti, ["Il porto sepolto"]);
  assert.deepEqual(r.domande.map((d) => d.argomento.id), ["u-1"]);
  assert.deepEqual(r.consigli, ["Parla piano."]);
  assert.equal(r.scartate, 2);
  // partenza non salvata, o tutto in una materia: niente scaletta
  assert.equal(pulisciEsame({ titolo: "", partenza: { argomento: "a9", apertura: "" }, tappe: [{ argomento: "a2", collegamento: "c", concetti: [] }], domande: [], consigli: [] }, a), null);
  assert.equal(pulisciEsame({ titolo: "", partenza: { argomento: "a1", apertura: "" }, tappe: [], domande: [], consigli: [] }, a), null);
});
