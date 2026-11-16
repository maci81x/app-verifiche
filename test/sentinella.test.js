// Avviso guasti (workflow «Controllo mattutino»): un controllo fallisce se la risposta è sbagliata o lenta,
// e nei log non finiscono mai credenziali o token.   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { controlla, CONTROLLI } from "../scripts/sentinella.mjs";

const lento = (ms, valore) => () => new Promise((r) => setTimeout(() => r(valore), ms));

test("un controllo riuscito dice ok e il tempo", async () => {
  const e = await controlla({ nome: "prova", limite: 1000, fn: async () => "3 profili" });
  assert.equal(e.ok, true);
  assert.match(e.riga, /^ok  prova: 3 profili \(\d+(\.\d)? s\)$/);
});

test("troppo lento: fallisce anche se poi risponderebbe bene", async () => {
  const e = await controlla({ nome: "lento", limite: 50, fn: lento(500, "ok") });
  assert.equal(e.ok, false);
  assert.match(e.riga, /^NO  lento: più di 0\.05 s/);
});

test("risposta sbagliata: fallisce con il motivo, senza il corpo della risposta", async () => {
  const e = await controlla({ nome: "rotto", limite: 1000, fn: async () => { throw new Error("stato 502 (lettura non riuscita)"); } });
  assert.equal(e.ok, false);
  assert.equal(e.riga, "NO  rotto: stato 502 (lettura non riuscita)");
});

test("i controlli sono accedi, modello e profili, con limiti di tempo", () => {
  assert.deepEqual(CONTROLLI.map((c) => c.nome), ["sito", "accedi (elenco dei profili)", "modello (smistamento, senza aiuti)", "profili (consumo, genitore di prova)"]);
  for (const c of CONTROLLI) assert.ok(c.limite > 0 && c.limite <= 90_000, c.nome);
});

test("niente credenziali nel codice né nel workflow: solo i Secrets del repo", () => {
  const codice = readFileSync(new URL("../scripts/sentinella.mjs", import.meta.url), "utf8");
  const flusso = readFileSync(new URL("../.github/workflows/controllo-mattutino.yml", import.meta.url), "utf8");
  for (const testo of [codice, flusso]) {
    assert.doesNotMatch(testo, /@app-verifiche\.test|@gmail\.com|eyJ[A-Za-z0-9_-]{10,}|sb_publishable_/);
  }
  for (const s of ["TEST_BEA_EMAIL", "TEST_BEA_PASSWORD", "TEST_GENITORE_EMAIL", "TEST_GENITORE_PASSWORD", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"])
    assert.match(flusso, new RegExp("\\$\\{\\{ secrets\\." + s + " \\}\\}"));
  assert.doesNotMatch(codice, /console\.(log|error)\([^)]*(token|password|access_token|PASSWORD)/i);
  assert.match(flusso, /schedule:\s*\n\s*- cron:/);
  assert.match(flusso, /workflow_dispatch:/);
});
