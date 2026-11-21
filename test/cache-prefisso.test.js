// Prompt caching: mappa, sintesi e punti chiave dello stesso argomento condividono il prefisso col materiale.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { FINE_PARTE_FISSA, dividiPerCache, promptMappa, promptSintesi, promptPuntiChiave } from "../supabase/functions/_shared/prompt.js";

const ARG = {
  titolo: "La Scuola siciliana", materia: "italiano",
  trascrizione: "Con il nome di Scuola poetica siciliana si indicano i poeti che, tra il 1230 e il 1250, composero le loro opere alla corte di Federico II.",
  concetti: [{ id: "uuid-1", titolo: "Che cos'è", descrizione: "d", ancora: "poeti che, tra il 1230 e il 1250", peso: 3, ordine: 0 }],
};
const prompt = { mappa: () => promptMappa(ARG, 4, "1"), sintesi: () => promptSintesi(ARG, "1"), punti: () => promptPuntiChiave(ARG, "1") };

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

test("la parte fissa è identica fra mappa, sintesi e punti chiave (stessa cache)", () => {
  const [a, b, c] = Object.values(prompt).map((f) => dividiPerCache(f()).fisso);
  assert.equal(a, b);
  assert.equal(b, c);
});

test("un altro argomento ha un'altra parte fissa", () => {
  const altro = { ...ARG, trascrizione: ARG.trascrizione + " Altro." };
  assert.notEqual(dividiPerCache(promptMappa(altro, 4, "1")).fisso, dividiPerCache(promptMappa(ARG, 4, "1")).fisso);
});
