// Famiglie esterne (issue #30): nome utente, blocco del codice, inviti, iscrizione, limiti.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeUtente, normalizzaNomeUtente, codiceInvito, validaIscrizione, ALFABETO }
  from "../supabase/functions/_shared/famiglie.js";
import { VERSIONI } from "../supabase/functions/_shared/consensi.js";
import { contaAiuti } from "../supabase/functions/_shared/compito.js";

// Byte casuali finti: sempre gli stessi, così il risultato si controlla.
const finti = (...b) => (n) => Uint8Array.from({ length: n }, (_, i) => b[i % b.length]);

test("il nome utente è il nome pulito più 3 caratteri senza lettere ambigue", () => {
  assert.equal(nomeUtente("Anna", finti(0, 1, 2)), "anna-" + ALFABETO[0] + ALFABETO[1] + ALFABETO[2]);
  assert.match(nomeUtente("Maria Chiara", finti(9)), /^maria-chiara-[a-z0-9]{3}$/);
  assert.match(nomeUtente("Niccolò D'Amico", finti(5)), /^niccolo-d-amico-[a-z0-9]{3}$/);
  assert.match(nomeUtente("  ", finti(5)), /^profilo-[a-z0-9]{3}$/);
  assert.ok(nomeUtente("Bartolomeo Massimiliano Giovanni", finti(1)).length <= 24);
  for (const c of "01oli") assert.ok(!ALFABETO.includes(c), "carattere ambiguo " + c);
  // ogni byte dà un carattere dell'alfabeto
  for (let b = 0; b < 256; b++) assert.match(nomeUtente("a", finti(b)), /^a-[a-z0-9]{3}$/);
});

test("il nome utente scritto al login si confronta senza spazi ai lati e maiuscole", () => {
  assert.equal(normalizzaNomeUtente("  Anna-K7M "), "anna-k7m");
  assert.equal(normalizzaNomeUtente("Bea"), "bea");
  assert.equal(normalizzaNomeUtente(null), "");
  assert.equal(normalizzaNomeUtente("x".repeat(80)).length, 40);
});

test("il codice invito ha 8 caratteri dell'alfabeto", () => {
  assert.match(codiceInvito(finti(3, 200, 17)), new RegExp("^[" + ALFABETO + "]{8}$"));
});

const buona = () => ({
  nome: "Carla", cognome: "Verdi", email: "carla@example.org", password: "lunga-password-1",
  consensi: { privacy: VERSIONI.privacy, condizioni: VERSIONI.condizioni, dati_figlio: VERSIONI.dati_figlio },
});

test("l'iscrizione valida passa e torna con i dati puliti", () => {
  const r = validaIscrizione({ ...buona(), nome: "  Carla ", email: " Carla@Example.org " }, VERSIONI);
  assert.equal(r.ok, true);
  assert.equal(r.dati.nome, "Carla");
  assert.equal(r.dati.email, "carla@example.org");
  assert.equal("telefono" in r.dati, false); // non si raccoglie
});

test("l'iscrizione senza un consenso, con una versione vecchia o campi sbagliati si rifiuta", () => {
  const casi = [
    [{ consensi: { ...buona().consensi, dati_figlio: undefined } }, "consensi"],
    [{ consensi: { ...buona().consensi, privacy: "1999-01-01" } }, "consensi"],
    [{ consensi: null }, "consensi"],
    [{ nome: "" }, "nome"],
    [{ cognome: "x".repeat(41) }, "cognome"],
    [{ email: "non-una-mail" }, "email"],
    [{ password: "corta" }, "password"],
  ];
  for (const [modifica, campo] of casi) {
    const r = validaIscrizione({ ...buona(), ...modifica }, VERSIONI);
    assert.equal(r.ok, false, JSON.stringify(modifica));
    assert.equal(r.campo, campo, JSON.stringify(modifica));
  }
  assert.equal(validaIscrizione(null, VERSIONI).ok, false);
});

test("gli aiuti accettano il limite della famiglia", () => {
  const g = "2026-11-19";
  assert.equal(contaAiuti({ aiuti: { giorno: g, n: 9 } }, g, 10).permesso, true);
  assert.equal(contaAiuti({ aiuti: { giorno: g, n: 10 } }, g, 10).permesso, false);
  assert.equal(contaAiuti({ aiuti: { giorno: g, n: 10 } }, g).permesso, true); // senza limite: 30 come oggi
});

import { MAX_FIGLI, righeConsumo, autorizzaAdmin } from "../supabase/functions/_shared/famiglie.js";

test("al massimo 4 figli per famiglia", () => assert.equal(MAX_FIGLI, 4));

test("ogni chiamata al modello diventa una riga di consumo con il suo costo", () => {
  const righe = righeConsumo([
    { modello: "claude-opus-5-5", usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 2000 } },
    { modello: "claude-haiku-5-5", usage: { input_tokens: 10 } },
    { modello: "claude-haiku-5-5", usage: undefined },
  ], "s1", "2026-11-19", "compito");
  assert.equal(righe.length, 3);
  assert.deepEqual(righe[0], { studente_id: "s1", giorno: "2026-11-19", azione: "compito", modello: "claude-opus-5-5",
    input: 1000, output: 500, cache_scritti: 0, cache_letti: 2000, costo: 0.0144 });
  assert.equal(righe[2].input, 0);
  assert.equal(righe[2].costo, 0);
  assert.equal(righeConsumo([], "s1", "2026-11-19", "x").length, 0);
  assert.equal(righeConsumo([{ modello: "m", usage: {} }], "s1", "2026-11-19", "a".repeat(80))[0].azione.length, 40);
});

test("l'amministratore passa solo con ruolo admin e verifica in due passaggi", () => {
  const ok = { role: "authenticated", sub: "u", aal: "aal2", app_metadata: { ruolo: "admin" } };
  assert.equal(autorizzaAdmin(ok), true);
  assert.equal(autorizzaAdmin({ ...ok, aal: "aal1" }), false);
  assert.equal(autorizzaAdmin({ ...ok, app_metadata: { ruolo: "genitore" } }), false);
  assert.equal(autorizzaAdmin({ ...ok, user_metadata: { ruolo: "admin" }, app_metadata: {} }), false);
  assert.equal(autorizzaAdmin({ ...ok, role: "anon" }), false);
  assert.equal(autorizzaAdmin({ ...ok, sub: "" }), false);
  assert.equal(autorizzaAdmin(null), false);
});

import { esportazione } from "../supabase/functions/_shared/famiglie.js";

test("l'export della famiglia: genitore, consensi, invito e per ogni figlio le sue tabelle, senza codici né password", () => {
  const e = esportazione({
    genitore: { email: "carla@example.org", nome: "Carla", cognome: "Verdi", creato: "2026-11-19T10:00:00Z", pin_hash: "x", password: "y" },
    consensi: [{ documento: "privacy", versione: "2026-11-19", accettato: "2026-11-19T10:00:00Z" }],
    invito: { codice: "abcdefgh" },
    figli: [{ profilo: { id: "s1", nome: "Anna", nome_utente: "anna-k7m", pin_hash: "z" }, tabelle: { argomenti: [{ id: "a1" }], consumi: [] }, foto: ["s1/a1/p.jpg"] }],
  }, "2026-11-19T12:00:00Z");
  assert.equal(e.formato, "10+ export famiglia 1");
  assert.equal(e.generato, "2026-11-19T12:00:00Z");
  assert.deepEqual(e.genitore, { email: "carla@example.org", nome: "Carla", cognome: "Verdi", creato: "2026-11-19T10:00:00Z" });
  assert.equal(e.consensi.length, 1);
  assert.equal(e.invito.codice, "abcdefgh");
  assert.equal(e.figli[0].profilo.nome_utente, "anna-k7m");
  assert.equal("pin_hash" in e.figli[0].profilo, false);
  assert.deepEqual(e.figli[0].tabelle.argomenti, [{ id: "a1" }]);
  assert.deepEqual(e.figli[0].foto, ["s1/a1/p.jpg"]);
  assert.equal(JSON.stringify(e).includes("pin_hash"), false);
});
