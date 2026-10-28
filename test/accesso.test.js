// Sblocco dal telefono del genitore: il codice da leggere e il segreto.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  ALFABETO, LUNGHEZZA_CODICE, nuovoCodice, normalizzaCodice, codiceValido, sha256, uguali, casuale, pinValido,
} from "../supabase/functions/_shared/accesso.js";

test("il codice ha 6 caratteri, tutti dall'alfabeto senza lettere ambigue", () => {
  for (let k = 0; k < 200; k++) {
    const c = nuovoCodice();
    assert.equal(c.length, LUNGHEZZA_CODICE);
    assert.ok(codiceValido(c), c);
  }
  for (const ambigua of "01258BILOSZ") assert.ok(!ALFABETO.includes(ambigua), ambigua);
});

test("il genitore può scrivere il codice in minuscolo, con spazi o trattini", () => {
  assert.equal(normalizzaCodice(" k7f-q3m "), "K7FQ3M");
  assert.equal(normalizzaCodice("acd 346"), "ACD346");
  assert.ok(codiceValido(normalizzaCodice("acd 346")));
  assert.ok(!codiceValido(normalizzaCodice("ACD34")));   // corto
  assert.ok(!codiceValido(normalizzaCodice("ACD340")));  // lo zero non c'è
  assert.equal(normalizzaCodice(null), "");
});

test("segreto: hash stabile, confronto esatto", async () => {
  const s = casuale(32);
  assert.equal(s.length, 64);
  const h = await sha256(s);
  assert.equal(h.length, 64);
  assert.ok(uguali(h, await sha256(s)));
  assert.ok(!uguali(h, await sha256(s + "x")));
  assert.ok(!uguali(h, h.slice(1)));
  assert.ok(!uguali(h, undefined));
});

test("codice a 4 cifre del profilo", () => {
  assert.ok(pinValido("0427"));
  assert.ok(!pinValido("427"));
  assert.ok(!pinValido("12a4"));
  assert.ok(!pinValido(null));
});

test("nell'app: nome del telefono e codice leggibile", () => {
  const ctx = vm.createContext({ console, Math, Date, JSON, Promise, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(readFileSync(new URL("../app.js", import.meta.url), "utf8"), ctx);
  const run = (e) => vm.runInContext(e, ctx);
  assert.equal(run(`nomeDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")`), "iPhone");
  assert.equal(run(`nomeDispositivo("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari")`), "telefono Android");
  assert.equal(run(`nomeDispositivo("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mobile/15E148")`), "iPad");
  assert.equal(run(`nomeDispositivo("")`), "dispositivo");
  assert.equal(run(`codiceLeggibile("K7FQ3M")`), "K7F Q3M");
});
