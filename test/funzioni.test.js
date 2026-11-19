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

test("accedi: l'elenco (solo finché la v34 è online) mostra solo le famiglie esistenti, mai quelle esterne", () => {
  const s = leggi("functions/accedi/index.ts");
  assert.match(s, /famiglie!inner\(esterna\)/);
  assert.match(s, /\.eq\("famiglie\.esterna", false\)/);
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
  for (const a of ["crea", "codice", "classe", "nuovo_nome_utente", "elimina", "elimina_famiglia", "esporta", "invito", "famiglia", "consumo"])
    assert.match(s, new RegExp(`b\\.azione === "${a}"`), a);
  assert.match(s, /const TABELLE = \[[^\]]*"consumi"/);
  assert.match(s, /MAX_FIGLI/);
  const elimina = s.slice(s.indexOf("async function elimina("));
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
  assert.ok(contenuti.indexOf('from("accessi_admin").insert') > -1, "manca il registro");
  assert.ok(contenuti.indexOf('from("accessi_admin").insert') < contenuti.indexOf('from("argomenti")'), "il registro si scrive prima di leggere i contenuti");
});

test("modello: il tetto lo decide prenota_chiamata e il consumo va in tabella, non più nei metadati", () => {
  const s = leggi("functions/modello/index.ts");
  assert.match(s, /rpc\("prenota_chiamata"/);
  assert.match(s, /righeConsumo\(/);
  assert.doesNotMatch(s, /consumoAggiornato|tettoRaggiunto|app_metadata: \{ consumo/);
  assert.match(s, /contaAiuti\(am, giornoRoma\(\), .*limiteAiuti/);
});
