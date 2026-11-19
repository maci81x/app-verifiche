// famiglia.js (issue #30): sola lettura del genitore, invito dall'URL, testi senza forme di genere.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const leggi = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, URLSearchParams, Response, Headers, setTimeout, clearTimeout,
  localStorage: { getItem: () => null, setItem() { throw new Error("non deve scrivere"); }, removeItem() {} } });
for (const f of ["semaforo.js", "app.js", "libreria.js", "famiglia.js"]) vm.runInContext(leggi(f), ctx);
const run = (e) => vm.runInContext(e, ctx);

test("sola lettura: GET e HEAD passano con l'header x-figlio solo verso /rest/v1/, il resto riceve 403 senza partire", async () => {
  const viste = [];
  ctx.fetchVera = async (url, opz) => { viste.push({ url: String(url), metodo: (opz && opz.method) || "GET", headers: new Headers(opz && opz.headers) }); return new Response("[]", { status: 200 }); };
  run(`fSola = fetchSoloLettura("figlio-1", fetchVera)`);
  const base = "https://x.supabase.co";
  await run(`fSola("${base}/rest/v1/argomenti?select=*", { method: "GET", headers: { apikey: "k" } })`);
  await run(`fSola("${base}/rest/v1/sessioni", { method: "HEAD" })`);
  await run(`fSola("${base}/storage/v1/object/list/fonti", { method: "GET" })`);
  for (const [url, metodo] of [["/rest/v1/argomenti", "POST"], ["/rest/v1/argomenti?id=eq.1", "PATCH"], ["/rest/v1/argomenti", "DELETE"],
    ["/rest/v1/rpc/svuota_memoria", "POST"], ["/storage/v1/object/fonti/x.jpg", "POST"], ["/functions/v1/modello", "POST"]]) {
    const r = await run(`fSola("${base}${url}", { method: "${metodo}" })`);
    assert.equal(r.status, 403, metodo + " " + url);
    assert.match(await r.text(), /sola lettura/);
  }
  assert.equal(viste.length, 3, "le scritture non devono partire");
  assert.equal(viste[0].headers.get("x-figlio"), "figlio-1");
  assert.equal(viste[0].headers.get("apikey"), "k", "gli header dell'app restano");
  assert.equal(viste[1].headers.get("x-figlio"), "figlio-1");
  assert.equal(viste[2].headers.get("x-figlio"), null, "l'header va solo a /rest/v1/");
});

test("sola lettura: il telefono del genitore non salva niente del figlio", () => {
  run("soloLettura = true");
  assert.doesNotThrow(() => run(`salvaLocale("verifiche-scelte-figlio-1", { livello: "medio" })`));
  run("soloLettura = false");
});

test("invito dall'indirizzo: ?invito=CODICE, pulito; senza codice niente", () => {
  assert.equal(run(`codiceDaIndirizzo("https://maci81x.github.io/app-verifiche/?invito=ABCD2345")`), "abcd2345");
  assert.equal(run(`codiceDaIndirizzo("https://maci81x.github.io/app-verifiche/?invito=%20abcd2345%20&x=1")`), "abcd2345");
  assert.equal(run(`codiceDaIndirizzo("https://maci81x.github.io/app-verifiche/")`), "");
  assert.equal(run(`codiceDaIndirizzo("https://maci81x.github.io/app-verifiche/?invito=<script>")`), "");
  assert.equal(run(`linkInvito("abcd2345")`), "https://maci81x.github.io/app-verifiche/?invito=abcd2345");
});

test("profilo bloccato: dal momento di fine del blocco; avviso recente per 7 giorni", () => {
  const ora = Date.parse("2026-11-19T15:00:00Z");
  assert.equal(run(`statoBlocco({ bloccato_fino: "2026-11-19T16:00:00Z", ultimo_blocco: "2026-11-19T14:59:00Z" }, ${ora}).bloccato`), true);
  assert.equal(run(`statoBlocco({ bloccato_fino: "2026-11-19T14:00:00Z", ultimo_blocco: "2026-11-19T13:59:00Z" }, ${ora}).bloccato`), false);
  assert.equal(run(`statoBlocco({ bloccato_fino: "2026-11-19T14:00:00Z", ultimo_blocco: "2026-11-19T13:59:00Z" }, ${ora}).recente`), true);
  assert.equal(run(`statoBlocco({ bloccato_fino: null, ultimo_blocco: "2026-11-01T10:00:00Z" }, ${ora}).recente`), false);
  assert.equal(run(`statoBlocco({}, ${ora}).bloccato`), false);
});

test("l'app non chiama nuove funzioni rpc in lettura (in sola lettura sarebbero POST bloccati)", () => {
  const rpc = readdirSync(new URL("../", import.meta.url)).filter((f) => f.endsWith(".js"))
    .flatMap((f) => [...leggi(f).matchAll(/\.rpc\("(\w+)"/g)].map((m) => m[1]));
  assert.deepEqual([...new Set(rpc)], ["svuota_memoria"]);
});

test("testi nuovi senza forme di genere e senza «Sbagliato»", () => {
  const testi = leggi("famiglia.js") + leggi("index.html") + leggi("privacy.html") + leggi("condizioni.html") + leggi("admin.html");
  for (const p of [/\bsicura\b/i, /\bpronta\b/i, /\bstanca\b/i, /\bbrava\b/i, /\balunna\b/i, /\bragazza\b/i, /\bSbagliato\b/])
    assert.doesNotMatch(testi, p, String(p));
});

test("service worker v35: famiglia.js e pagine privacy in cache, il pannello admin mai", () => {
  const sw = leggi("sw.js");
  assert.match(sw, /app-verifiche-v35/);
  for (const f of ["famiglia.js?v=35", "privacy.html", "condizioni.html"]) assert.ok(sw.includes("/app-verifiche/" + f), f);
  assert.doesNotMatch(sw, /'\/app-verifiche\/admin/);
  assert.match(sw, /\/admin\\\.\(html\|js\)\$\/\.test\(url\.pathname\)\) return;/);
});

test("informativa e condizioni: versione uguale a quella che il server registra, segnaposto del titolare, registro admin 12 mesi", async () => {
  const { VERSIONI } = await import("../supabase/functions/_shared/consensi.js");
  for (const [f, doc] of [["privacy.html", "privacy"], ["condizioni.html", "condizioni"]]) {
    const h = leggi(f);
    assert.match(h, new RegExp(`data-documento="${doc}" data-versione="${VERSIONI[doc]}"`), f);
    assert.match(h, new RegExp(`Versione ${VERSIONI[doc]}`), f);
    assert.match(h, /\[TITOLARE\]|\[EMAIL DEL TITOLARE\]/, f);
  }
  const p = leggi("privacy.html");
  assert.match(p, /registro degli accessi dell'amministratore[^<]*<b>12 mesi<\/b>/);
  assert.match(p, /In breve, per chi studia/);
  assert.match(p, /accesso tecnico diretto/);
  assert.doesNotMatch(p, /telefono del genitore|numero di telefono del genitore/i);
});
