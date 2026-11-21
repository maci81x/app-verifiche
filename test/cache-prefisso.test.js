// Prompt caching: mappa, sintesi e punti chiave dello stesso argomento condividono il prefisso col materiale.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINE_PARTE_FISSA, dividiPerCache, promptMappa, promptSintesi, promptPuntiChiave } from "../supabase/functions/_shared/prompt.js";

const ARG = {
  titolo: "La Scuola siciliana", materia: "italiano",
  trascrizione: "Con il nome di Scuola poetica siciliana si indicano i poeti che, tra il 1230 e il 1250, composero le loro opere alla corte di Federico II.",
  concetti: [{ id: "uuid-1", titolo: "Che cos'è", descrizione: "d", ancora: "poeti che, tra il 1230 e il 1250", peso: 3, ordine: 0 }],
};
const prompt = { mappa: () => promptMappa(ARG, 4, "1"), sintesi: () => promptSintesi(ARG, "1") };

for (const [nome, f] of Object.entries(prompt)) {
  test(nome + ": un solo segno e il materiale sta nella parte fissa, il resto cambia", () => {
    const p = f();
    assert.equal(p.split(FINE_PARTE_FISSA).length, 2);
    const { fisso, resto } = dividiPerCache(p);
    assert.ok(fisso.includes(ARG.trascrizione), "il materiale è nella parte fissa");
    assert.ok(!resto.includes(ARG.trascrizione), "il materiale non è ripetuto dopo il segno");
    assert.ok(resto.includes("Rispondi solo con JSON"));
  });
}

test("la parte fissa è identica fra mappa e sintesi (stessa cache)", () => {
  const [a, b] = Object.values(prompt).map((f) => dividiPerCache(f()).fisso);
  assert.equal(a, b);
});

test("punti chiave (Sonnet, altra cache): niente segno, quindi niente scrittura in cache pagata per niente", () => {
  const p = promptPuntiChiave(ARG, "1");
  assert.ok(!p.includes(FINE_PARTE_FISSA));
  assert.ok(p.includes(ARG.trascrizione));
});

test("un altro argomento ha un'altra parte fissa", () => {
  const altro = { ...ARG, trascrizione: ARG.trascrizione + " Altro." };
  assert.notEqual(dividiPerCache(promptMappa(altro, 4, "1")).fisso, dividiPerCache(promptMappa(ARG, 4, "1")).fisso);
});

// Prova vera del 21/11: con schemi diversi la sintesi riscriveva la cache (2342 token scritti, 0 letti). Lo schema di
// output_config.format entra nel prefisso prima dei messaggi: mappa e sintesi devono mandare lo stesso schema e lo stesso effort.
test("mappa e sintesi chiamano il modello con lo stesso schema e lo stesso effort (stesso prefisso in cache)", () => {
  const s = readFileSync(new URL("../supabase/functions/modello/index.ts", import.meta.url), "utf8");
  const chiamata = (azione) => {
    const i = s.indexOf(`if (b.azione === "${azione}")`);
    const m = s.slice(i, s.indexOf("\n    if (b.azione ===", i + 10)).match(/chiedi\(prompt\w+\([^;]*?\),\s*(\w+),\s*\[\],\s*"(\w+)"\)/);
    assert.ok(m, "chiamata di " + azione + " non trovata");
    return m.slice(1);
  };
  assert.deepEqual(chiamata("mappa"), chiamata("sintesi"));
  assert.match(s, /const SCHEMA_ARGOMENTO = \{[\s\S]*?nodi:[\s\S]*?sintesi:/);
});

test("mappa e sintesi chiedono tutti e due i campi, con quello che non serve vuoto", () => {
  assert.match(promptMappa(ARG, 4, "1"), /"sintesi":\[\]\}'?$/m);
  assert.match(promptSintesi(ARG, "1"), /\{"nodi":\[\],"sintesi":/);
});
