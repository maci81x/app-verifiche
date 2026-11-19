// Edge Function della #30 controllate sul sorgente (come modelli.test.js): chi chiama cosa, in che ordine.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const leggi = (f) => readFileSync(new URL("../supabase/" + f, import.meta.url), "utf8");
const FUNZIONI = readdirSync(new URL("../supabase/functions/", import.meta.url)).filter((d) => !d.startsWith("_") && !d.startsWith("."));

test("nessuna funzione chiama più accesso_con_pin: l'accesso passa da accesso_con_nome", () => {
  for (const f of FUNZIONI) assert.doesNotMatch(leggi(`functions/${f}/index.ts`), /accesso_con_pin/, f);
  assert.match(leggi("functions/accedi/index.ts"), /rpc\("accesso_con_nome"/);
});

test("accedi: nessun elenco dei profili e nessun accesso per id, solo nome utente + codice", () => {
  const s = leggi("functions/accedi/index.ts");
  assert.doesNotMatch(s, /azione === "elenco"/);
  assert.doesNotMatch(s, /b\.studente_id/, "niente accesso per id dal client");
  assert.match(s, /famiglia_sospesa/);
});

test("famiglie: anonima, con invito, consensi alla versione corrente e iscrizioni vere solo con MAIL_PRONTA", () => {
  assert.match(leggi("config.toml"), /\[functions\.famiglie\]\s*\nverify_jwt = false/);
  const s = leggi("functions/famiglie/index.ts");
  for (const r of [/validaIscrizione\(/, /VERSIONI/, /rpc\("iscrivi_famiglia"/, /rpc\("stato_invito"/, /MAIL_PRONTA/, /deleteUser\(/])
    assert.match(s, r);
  assert.doesNotMatch(s, /listUsers|getUserByEmail/, "l'utente da cancellare si trova per id, mai per email");
});

test("profili: azioni nuove, massimo figli, consumi contati e cancellati prima dell'account", () => {
  const s = leggi("functions/profili/index.ts");
  for (const a of ["crea", "codice", "classe", "nuovo_nome_utente", "elimina", "elimina_famiglia", "esporta", "famiglia", "consumo"])
    assert.match(s, new RegExp(`b\\.azione === "${a}"`), a);
  const el = leggi("functions/_shared/eliminazione.ts");
  assert.match(el, /const TABELLE = \[[^\]]*"consumi"/);
  assert.match(s, /MAX_FIGLI/);
  const elimina = el.slice(el.indexOf("async function elimina("));
  assert.ok(elimina.indexOf('"consumi"') > -1 && elimina.indexOf('"consumi"') < elimina.indexOf("deleteUser"), "consumi cancellati prima dell'account");
  assert.match(s, /from\("consumi"\)/, "il consumo si legge dalla tabella");
  assert.doesNotMatch(s, /consumoDelGiorno/);
});

test("admin: ogni azione passa prima da autorizzaAdmin, e i contenuti scrivono il registro prima di rispondere", () => {
  const s = leggi("functions/admin/index.ts");
  const controllo = s.indexOf("autorizzaAdmin(");
  assert.ok(controllo > -1 && controllo < s.indexOf('b.azione ==='), "autorizzaAdmin prima delle azioni");
  assert.match(s, /rpc\("pulisci_iscrizioni"\)/, "il riepilogo non pulisce le iscrizioni scadute");
  const contenuti = s.slice(s.indexOf('b.azione === "contenuti"'));
  assert.ok(contenuti.indexOf("registra(") > -1, "manca il registro");
  assert.ok(contenuti.indexOf("registra(") < contenuti.indexOf('from("argomenti")'), "il registro si scrive prima di leggere i contenuti");
  assert.match(s.slice(s.indexOf("const registra")), /from\("accessi_admin"\)\.insert/);
});

test("modello: il tetto lo decide prenota_chiamata e il consumo va in tabella, non più nei metadati", () => {
  const s = leggi("functions/modello/index.ts");
  assert.match(s, /rpc\("prenota_chiamata"/);
  assert.match(s, /righeConsumo\(/);
  assert.doesNotMatch(s, /consumoAggiornato|tettoRaggiunto|app_metadata: \{ consumo/);
  assert.match(s, /contaAiuti\(am, giornoRoma\(\), .*limiteAiuti/);
});

test("revisione del branch: consumi archiviati prima di eliminare, famiglia di ripiego solo per gli account vecchi, cancellazioni controllate", () => {
  const p = leggi("functions/profili/index.ts");
  const elimina = leggi("functions/_shared/eliminazione.ts").slice(leggi("functions/_shared/eliminazione.ts").indexOf("async function elimina("));
  assert.ok(elimina.indexOf('rpc("archivia_consumi"') > -1 && elimina.indexOf('rpc("archivia_consumi"') < elimina.indexOf('"consumi"]'), "il consumo si archivia prima di cancellarlo");
  assert.match(p, /senza_famiglia/);
  assert.match(p, /PRIMA_DELLA_30/);
  const f = leggi("functions/famiglie/index.ts");
  assert.doesNotMatch(f, /^\s*await db\.auth\.admin\.deleteUser\(id\);/m, "l'esito di deleteUser va controllato");
  assert.match(leggi("functions/admin/index.ts"), /from\("consumi_archiviati"\)/);
});

// ---------------------------------------------------------------- issue #35
const blocco = (s, da) => { const i = s.indexOf(da); assert.ok(i > -1, "manca " + da); const j = s.indexOf("\n    if (b.azione ===", i + 10); return s.slice(i, j > -1 ? j : undefined); };

test("admin #35: motivo e famiglia protetta controllati una volta, prima di ogni azione che non è una lettura di sintesi", () => {
  const s = leggi("functions/admin/index.ts");
  const prima = s.indexOf('if (b.azione === "riepilogo")');
  for (const pezzo of ["AZIONI_LETTURA.has(b.azione)", "motivo_mancante", "famiglia_protetta", "famigliaDestinazione("]) {
    const i = s.indexOf(pezzo);
    assert.ok(i > -1 && i < prima, pezzo + " va nel dispatcher, prima delle azioni");
  }
  // la famiglia si risolve anche dal profilo
  assert.match(s.slice(s.indexOf("async function famigliaDestinazione")), /from\("studenti"\)\.select\("famiglia_id"\)/);
  // ogni azione che non è una lettura scrive il registro (registra) prima dell'effetto
  for (const a of ["imposta", "stato", "elimina_famiglia", "modifica_figlio", "modifica_genitore", "codice", "link_password", "esporta", "cestino", "ripristina"])
    assert.match(blocco(s, `b.azione === "${a}"`), /registra\(/, a + " senza registro");
});

test("admin #35: codice nuovo generato sul server, mai nei log né nel registro", () => {
  const s = leggi("functions/admin/index.ts");
  const c = blocco(s, 'b.azione === "codice"');
  assert.match(c, /nuovoCodice\(\)/);
  assert.match(c, /rpc\("imposta_pin_di"/);
  assert.doesNotMatch(c, /console\./);
  assert.deepEqual(c.match(/registra\([^)]*\)/g), ['registra("codice nuovo")'], "nel registro solo una scritta fissa, mai il codice");
  assert.doesNotMatch(s, /console\.[a-z]+\([^)]*\bcodice\b/);
});

test("admin #35: cestino con il nome scritto, ban dopo la colonna, ripristino con i controlli", () => {
  const s = leggi("functions/admin/index.ts");
  const c = blocco(s, 'b.azione === "cestino"');
  assert.match(c, /confermaNome\(/);
  assert.ok(c.indexOf("cestino: new Date") > -1 && c.indexOf("cestino: new Date") < c.indexOf("allineaAccessi("), "prima la colonna, poi il ban");
  const r = blocco(s, 'b.azione === "ripristina"');
  for (const x of ["allineaAccessi(", "posti_esauriti", "famiglia_nel_cestino", "scaduto"]) assert.ok(r.includes(x), "ripristina: manca " + x);
  const l = blocco(s, 'b.azione === "link_password"');
  assert.match(l, /type: "recovery"/);
  assert.match(l, /nuova-password\.html#t=/);
  const e = leggi("functions/_shared/eliminazione.ts");
  assert.match(e, /ban_duration: ban \? "876000h" : "none"/);
});

test("pulizia #35: segreto a tempo costante, soglia prima di cancellare, registro, workflow", () => {
  assert.match(readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8"), /\[functions\.pulizia\]\nverify_jwt = false/);
  const p = leggi("functions/pulizia/index.ts");
  assert.match(p, /timingSafeEqual/);
  assert.match(p, /PULIZIA_SEGRETO/);
  assert.doesNotMatch(p, /console\.[a-z]+\([^)]*segreto/i);
  const e = leggi("functions/_shared/eliminazione.ts");
  const pc = e.slice(e.indexOf("export async function pulisciCestino"));
  assert.ok(pc.indexOf("piano.troppi") > -1 && pc.indexOf("piano.troppi") < pc.indexOf("elimina("), "la soglia si controlla prima di cancellare");
  assert.match(e, /azione: "pulizia", motivo: "cestino oltre 30 giorni"/);
  assert.ok(pc.indexOf("registraPulizia(") < pc.indexOf("elimina("), "il registro prima di cancellare");
  assert.match(pc, /prendi_pulizia/);
  const w = readFileSync(new URL("../.github/workflows/controllo-mattutino.yml", import.meta.url), "utf8");
  assert.match(w, /functions\/v1\/pulizia/);
  assert.match(w, /x-pulizia: \$PULIZIA_SEGRETO/);
  assert.match(w, /if: always\(\)/);
});

test("profili #35: una famiglia nel cestino non fa niente; un figlio nel cestino non si tocca", () => {
  const p = leggi("functions/profili/index.ts");
  assert.match(p, /famiglia_nel_cestino/);
  assert.match(p, /profilo_nel_cestino/);
});

test("admin #35 (revisione): studente_id e famiglia_id insieme rifiutati; le azioni vecchie usano la famiglia risolta", () => {
  const s = leggi("functions/admin/index.ts");
  assert.match(s, /b\.studente_id !== undefined && b\.famiglia_id !== undefined/);
  for (const a of ["stato", "elimina_famiglia"]) assert.doesNotMatch(blocco(s, `b.azione === "${a}"`), /\.eq\("id", b\.famiglia_id\)/, a);
  assert.doesNotMatch(blocco(s, 'b.azione === "imposta"'), /\.eq\("id", b\.famiglia_id\)/);
});
