// Issue #18: nome 10+, design «evidenziatore», voce 10-14 neutra. Controlli sui file
// statici (manifest, index.html, style.css, sw.js, testi nei .js).   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const leggi = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const JS = ["semaforo.js", "app.js", "libreria.js", "stampa.js", "aiuto.js", "mappa-card.js", "figure.js", "formule.js", "esercizi.js", "prova-esercizi.js", "compito.js", "piano.js", "ripasso.js"];
const html = leggi("index.html");
const css = leggi("style.css");

// Le stringhe di un sorgente JS, senza i commenti: è lì che stanno i testi per l'utente.
function stringheJs(src) {
  const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((r) => !/^\s*\/\//.test(r)).join("\n");
  return senzaCommenti.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) || [];
}
const testoHtml = html.replace(/<!--[\s\S]*?-->/g, "");

test("nome 10+: manifest, titolo e nome sulla schermata Home", () => {
  const m = JSON.parse(leggi("manifest.json"));
  assert.equal(m.name, "10+");
  assert.equal(m.short_name, "10+");
  assert.equal(m.background_color, "#FFFFFF");
  assert.match(html, /<title>10\+<\/title>/);
  assert.match(html, /apple-mobile-web-app-title" content="10\+"/);
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
});

test("logo 10+: «10» e «+» su rettangolino giallo", () => {
  assert.match(html, /<span class="logo"[^>]*>10<span class="logo-piu"[^>]*>\+<\/span><\/span>/);
  assert.match(css, /\.logo-piu\{[^}]*background:var\(--evidenziatore\)/);
});

test("carattere unico Bricolage Grotesque, niente Fraunces, Figtree, JetBrains Mono", () => {
  assert.match(html, /family=Bricolage\+Grotesque:opsz,wght@12\.\.96,400;12\.\.96,500;12\.\.96,700;12\.\.96,800/);
  for (const [nome, src] of [["index.html", html], ["style.css", css], ...JS.map((f) => [f, leggi(f)])]) {
    assert.doesNotMatch(src, /Fraunces|Figtree|JetBrains/, nome + " usa ancora un vecchio carattere");
  }
});

test("token della issue regole, chiaro e scuro", () => {
  const chiaro = css.slice(0, css.indexOf("@media (prefers-color-scheme:dark)"));
  for (const t of ["--carta:#FFFFFF", "--inchiostro:#1A1A1E", "--inchiostro-2:#5B5E66", "--bordo:#E6E6E1", "--superficie:#F4F4F1", "--evidenziatore:#FFE55C",
    "--verde-bg:#DDF3E4", "--verde:#1A6B3E", "--giallo-bg:#FFF0C2", "--giallo:#8A5300", "--rosso-bg:#FDE3DF", "--rosso:#B0291A", "--grigio-bg:#EEF0EC", "--grigio:#4A4E57", "--web:#9AA1AC"]) {
    assert.ok(chiaro.includes(t), "manca " + t);
  }
  const scuro = css.match(/:root\[data-theme="dark"\]\{([^}]*)\}/)[1];
  assert.match(scuro, /--carta:#15151A/);
  assert.match(css, /--evidenzia:linear-gradient\(transparent 28%,\s*var\(--evidenziatore\) 28%,\s*var\(--evidenziatore\) 92%,\s*transparent 92%\)/);
});

test("niente etichette in maiuscolo, pulsanti a pillola alti almeno 52px", () => {
  assert.doesNotMatch(css, /text-transform:\s*uppercase/);
  const azione = css.match(/button\.azione\{([^}]*)\}/)[1];
  assert.match(azione, /border-radius:999px/);
  assert.match(azione, /min-height:52px/);
  assert.match(azione, /background:var\(--inchiostro\)/);
  assert.match(azione, /color:var\(--evidenziatore\)/);
});

test("niente emoji né → appesi ai pulsanti nell'HTML", () => {
  assert.doesNotMatch(testoHtml, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(testoHtml, /→\s*<\/button>/);
  for (const f of JS) for (const s of stringheJs(leggi(f))) assert.doesNotMatch(s, /\p{Extended_Pictographic}|→\s*<\/button>/u, f + ": " + s);
});

test("forme neutre: grep di pronta, sicura, brava, stanca non trova testi per l'utente", () => {
  const vietate = /pronta|sicura|brava|stanca/i;
  assert.doesNotMatch(testoHtml.replace(/<script[\s\S]*?<\/script>/g, ""), vietate);
  for (const f of JS) for (const s of stringheJs(leggi(f))) assert.doesNotMatch(s, vietate, f + ": " + s);
  // niente asterischi al posto della desinenza («sicur*»): si gira la frase
  for (const f of JS) for (const s of stringheJs(leggi(f))) assert.doesNotMatch(s, /[a-zà]\*(?=[\s.,;:!?]|$)/i, f + ": " + s);
});

test("service worker: cache alzata e stessa versione di index.html", () => {
  const sw = leggi("sw.js");
  const v = Number(sw.match(/app-verifiche-v(\d+)/)[1]);
  assert.ok(v >= 15, "cache non alzata");
  const versioni = [...html.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(versioni.length >= 11 && versioni.every((x) => x === v), "?v= in index.html diverso dalla cache");
  assert.ok([...sw.matchAll(/\?v=(\d+)/g)].every((m) => Number(m[1]) === v));
  assert.match(sw, /icons\/icon-maskable-512\.png/);
});

test("semaforo: ○ Ancora da provare per ciò che non è mai stato provato", () => {
  const ctx = vm.createContext({});
  vm.runInContext(leggi("semaforo.js"), ctx);
  assert.equal(vm.runInContext(`parolaStato("mai")`, ctx), "Ancora da provare");
  assert.equal(vm.runInContext(`parolaStato("rosso")`, ctx), "Da ripassare");
  assert.match(html, /○<\/i> Ancora da provare/);
});

test("evidenziatore: la frase del quaderno escapata dentro <mark class=\"evidenzia\">", () => {
  const ctx = vm.createContext({});
  vm.runInContext(leggi("semaforo.js"), ctx);
  assert.equal(vm.runInContext(`evidenzia("a <b> & c")`, ctx), '<mark class="evidenzia">a &lt;b&gt; &amp; c</mark>');
  assert.equal(vm.runInContext(`evidenzia("")`, ctx), "");
  assert.equal(vm.runInContext(`evidenzia(null)`, ctx), "");
  assert.match(css, /mark\.evidenzia\{[^}]*background:var\(--evidenzia\)/);
  assert.match(css, /mark\.evidenzia\{[^}]*box-decoration-break:clone/);
});

test("correzioni prima del merge: niente sovrapposizioni, tinta per riga, nota solo su profili ed esito", () => {
  assert.doesNotMatch(css, /\.barra-fissa\{[^}]*position:fixed/);
  assert.match(css, /\[style\*="--h"\]\{--tinta:hsl\(var\(--h\) var\(--s\) var\(--l\)\)\}/);
  assert.match(css, /\*,\*::before,\*::after\{box-sizing:border-box\}/);
  assert.match(css, /\.nota\{display:none\}/);
  assert.match(css, /body\[data-vista="profili"\] \.nota,body\[data-vista="esito"\] \.nota\{display:block[;}]/);
  assert.match(css, /\.bottoni-esito\{[^}]*flex-direction:column/);
  assert.match(css, /html:has\(body\.con-card\)\{overflow:hidden\}/);
  assert.match(html, /<div class="tacche" id="tacche"/);
  assert.doesNotMatch(html.match(/<section id="v-libreria"[\s\S]*?<\/section>\n/)[0], /btn-svuota/);
  assert.match(html.match(/<section id="v-impostazioni"[\s\S]*?<\/section>\n/)[0], /id="btn-svuota"/);
});

test("nessun nome globale doppio fra gli script: uno caricato dopo sovrascriverebbe l'altro", () => {
  const visti = {};
  for (const f of JS) {
    for (const m of leggi(f).matchAll(/^(?:async\s+)?function\s+(\w+)|^(?:const|let|var)\s+(\w+)/gm)) {
      const nome = m[1] || m[2];
      assert.ok(!visti[nome], nome + " è sia in " + visti[nome] + " sia in " + f);
      visti[nome] = f;
    }
  }
});

test("barra in basso bilanciata: due voci per lato, fotocamera al centro esatto", () => {
  const barra = html.match(/<nav class="barra-basso"[\s\S]*?<\/nav>/)[0];
  const pulsanti = [...barra.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.equal(pulsanti.length, 5);
  assert.match(pulsanti[2], /id="btn-nuovo"/);
  assert.deepEqual(pulsanti.filter((b) => /voce-barra/.test(b)).map((b) => b.match(/data-vai="(\w+)"/)[1]), ["libreria", "argomenti", "storico", "profili"]);
  assert.match(barra, /<span>Profilo<\/span>/);
  assert.match(css, /\.barra-basso\{[^}]*grid-template-columns:1fr 1fr 84px 1fr 1fr/);
});
