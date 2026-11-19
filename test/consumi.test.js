// Costi nel pannello admin e nel pannello del genitore (issue #34): formato in dollari e somme di oggi e del mese.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { sommeConsumi, inizioFinestra } from "../supabase/functions/_shared/consumi.js";

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL("../soldi.js", import.meta.url), "utf8"), ctx);
const dollari = (x) => vm.runInContext(`dollari(${JSON.stringify(x)})`, ctx);

test("dollari: sotto 1 centesimo 4 decimali, altrimenti 2; zero è zero", () => {
  assert.equal(dollari(0.000668), "0,0007 $");
  assert.equal(dollari(0.000167), "0,0002 $");
  assert.equal(dollari(0.0049), "0,0049 $");
  assert.equal(dollari(0.01), "0,01 $");
  assert.equal(dollari(0.1112), "0,11 $");
  assert.equal(dollari(12.5), "12,50 $");
  assert.equal(dollari(12345.5), "12.345,50 $"); // in italiano i numeri di 4 cifre non si raggruppano
  assert.equal(dollari(0), "0,00 $");
  assert.equal(dollari(null), "0,00 $");
  assert.equal(dollari(0.00004), "0,0000 $"); // sotto il mezzo decimillesimo resta 0,0000 $: si vede comunque che è sotto il centesimo
});

const righe = [
  { studente_id: "s1", giorno: "2026-11-19", costo: 0.000167 },
  { studente_id: "s1", giorno: "2026-11-19", costo: 0.000167 },
  { studente_id: "s2", giorno: "2026-11-18", costo: 0.05 },
  { studente_id: "s1", giorno: "2026-10-31", costo: 1 },
];
const archivio = [{ famiglia_id: "f1", giorno: "2026-11-19", chiamate: 3, costo: 0.02 }];

test("sommeConsumi: righe per profilo e giorno, poi oggi e il mese corrente (archivio compreso)", () => {
  const r = sommeConsumi(righe, archivio, "2026-11-19");
  assert.deepEqual(r.oggi, { chiamate: 5, costo: 0.020334 });
  assert.deepEqual(r.mese, { chiamate: 6, costo: 0.070334 });
  assert.equal(r.righe.length, 4);
  assert.deepEqual(r.righe[0].giorno, "2026-11-19");
  const s1 = r.righe.find((x) => x.studente_id === "s1" && x.giorno === "2026-11-19");
  assert.deepEqual(s1, { studente_id: "s1", giorno: "2026-11-19", chiamate: 2, costo: 0.000334 });
  assert.ok(r.righe.some((x) => x.studente_id === "profilo eliminato" && x.chiamate === 3));
  assert.deepEqual(sommeConsumi([], [], "2026-11-19"), { righe: [], oggi: { chiamate: 0, costo: 0 }, mese: { chiamate: 0, costo: 0 } });
});

test("la finestra copre sempre l'inizio del mese, anche il 31", () => {
  assert.equal(inizioFinestra("2026-11-19", 30), "2026-10-20");
  assert.equal(inizioFinestra("2026-12-31", 30), "2026-12-01");
  assert.equal(inizioFinestra("2026-03-31", 7), "2026-03-01");
});
