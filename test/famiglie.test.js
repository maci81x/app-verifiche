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

import { nuovoCodice, validaNomeUtente, scaduti, confermaNome, GIORNI_CESTINO } from "../supabase/functions/_shared/famiglie.js";

test("codice nuovo: 4 cifre, da byte casuali, uniforme anche sugli zeri iniziali", () => {
  assert.equal(nuovoCodice(() => Uint8Array.from([0, 0])), "0000");
  assert.match(nuovoCodice(), /^\d{4}$/);
  for (let i = 0; i < 200; i++) assert.match(nuovoCodice(), /^\d{4}$/);
  // byte che darebbero più di 9999 si scartano: nessun codice fuori dalle 4 cifre
  let chiamate = 0;
  const byte = () => (chiamate++ === 0 ? Uint8Array.from([255, 255]) : Uint8Array.from([0x04, 0xD2]));
  assert.equal(nuovoCodice(byte), "1234");
});

test("nome utente scelto dall'admin: minuscolo, da 3 a 40 caratteri, lettere, cifre e trattini", () => {
  assert.equal(validaNomeUtente("  Anna-K7M "), "anna-k7m");
  assert.equal(validaNomeUtente("bea"), "bea");
  for (const no of ["ab", "-anna", "anna k", "anna_k", "ànna", "x".repeat(41), "", null]) assert.equal(validaNomeUtente(no), null, String(no));
});

test("cestino: scaduto dopo 30 giorni esatti, non prima", () => {
  const ora = Date.parse("2026-12-20T12:00:00Z");
  const righe = [{ id: "a", cestino: "2026-11-20T11:59:00Z" }, { id: "b", cestino: "2026-11-20T12:01:00Z" }, { id: "c", cestino: null }];
  assert.equal(GIORNI_CESTINO, 30);
  assert.deepEqual(scaduti(righe, ora).map((r) => r.id), ["a"]);
});

test("conferma scrivendo il nome: senza spazi ai lati e senza maiuscole, ma tutto il nome", () => {
  assert.equal(confermaNome(" carla verdi ", "Carla Verdi"), true);
  assert.equal(confermaNome("Carla", "Carla Verdi"), false);
  assert.equal(confermaNome("", ""), false);
  assert.equal(confermaNome(null, "Carla"), false);
});

import { pianoPulizia, SOGLIA_PULIZIA, AZIONI_LETTURA } from "../supabase/functions/_shared/famiglie.js";

const ORA = Date.parse("2026-12-20T12:00:00Z");
const giorniFa = (g) => new Date(ORA - g * 86400000).toISOString();

test("pulizia: a 29 giorni non si tocca, a 31 si cancella; i figli di una famiglia scaduta vanno con lei", () => {
  const p = pianoPulizia({
    famiglie: [{ id: "f1", genitore_id: "g1", cestino: giorniFa(31) }, { id: "f2", genitore_id: "g2", cestino: giorniFa(29) }, { id: "f3", genitore_id: "g3", cestino: null }],
    figli: [
      { id: "a", famiglia_id: "f1", cestino: null }, { id: "b", famiglia_id: "f1", cestino: giorniFa(2) },
      { id: "c", famiglia_id: "f2", cestino: null }, { id: "d", famiglia_id: "f3", cestino: giorniFa(31) },
      { id: "e", famiglia_id: "f3", cestino: giorniFa(29) },
    ],
  }, ORA);
  assert.deepEqual(p.famiglie.map((f) => [f.id, f.figli]), [["f1", ["a", "b"]]]);
  assert.deepEqual(p.figli, ["d"]);
  assert.equal(p.profili, 3);
  assert.equal(p.troppi, false);
});

test("pulizia: oltre 3 famiglie o 5 profili in un giro, troppi = true (non si cancella niente)", () => {
  assert.deepEqual(SOGLIA_PULIZIA, { famiglie: 3, profili: 5 });
  const fam = (n) => Array.from({ length: n }, (_, i) => ({ id: "f" + i, genitore_id: "g" + i, cestino: giorniFa(40) }));
  const figli = (n, f = null) => Array.from({ length: n }, (_, i) => ({ id: "s" + i, famiglia_id: f, cestino: giorniFa(40) }));
  assert.equal(pianoPulizia({ famiglie: fam(3), figli: [] }, ORA).troppi, false);
  assert.equal(pianoPulizia({ famiglie: fam(4), figli: [] }, ORA).troppi, true);
  assert.equal(pianoPulizia({ famiglie: [], figli: figli(5) }, ORA).troppi, false);
  assert.equal(pianoPulizia({ famiglie: [], figli: figli(6) }, ORA).troppi, true);
  // i figli dentro una famiglia scaduta contano nei 5 profili
  assert.equal(pianoPulizia({ famiglie: fam(1).map((f) => ({ ...f, id: "x" })), figli: figli(6, "x").map((s) => ({ ...s, cestino: null })) }, ORA).troppi, true);
});

test("pulizia: una famiglia protetta non si cancella mai", () => {
  const p = pianoPulizia({ famiglie: [{ id: "f1", genitore_id: "g1", cestino: giorniFa(40), protetta: true }], figli: [{ id: "a", famiglia_id: "f1", cestino: giorniFa(40) }] }, ORA);
  assert.deepEqual([p.famiglie.length, p.figli.length], [0, 0]);
});

test("admin: solo riepilogo, consumi e registro senza motivo", () => {
  assert.deepEqual([...AZIONI_LETTURA].sort(), ["consumi", "registro", "riepilogo"]);
});

// ---------------------------------------------------------------- registro dopo 12 mesi (issue #37)
import { limiteRegistro, pianoRegistro, SOGLIA_REGISTRO } from "../supabase/functions/_shared/famiglie.js";

test("registro: si tiene 12 mesi di calendario; la riga a 11 mesi resta, quella a 13 va via", () => {
  const ora = Date.parse("2027-11-21T05:30:00Z");
  const limite = limiteRegistro(ora);
  assert.equal(limite, "2026-11-21T05:30:00.000Z");
  const undici = "2026-12-21T05:30:00Z", tredici = "2026-10-21T05:30:00Z";
  assert.ok(undici >= limite, "a 11 mesi resta");
  assert.ok(tredici < limite, "a 13 mesi va via");
});

test("registro: oltre 500 righe in un giro non si cancella niente", () => {
  assert.equal(SOGLIA_REGISTRO, 500);
  assert.deepEqual(pianoRegistro(0), { cancella: false, troppi: false });
  assert.deepEqual(pianoRegistro(500), { cancella: true, troppi: false });
  assert.deepEqual(pianoRegistro(501), { cancella: false, troppi: true });
});

test("registro: il 29 febbraio il limite è il 28 febbraio dell'anno prima (mai un giorno in più)", () => {
  assert.equal(limiteRegistro(Date.parse("2028-02-29T05:30:00Z")), "2027-02-28T05:30:00.000Z");
});
