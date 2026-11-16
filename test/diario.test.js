// Il diario di ogni giorno (issue #19), la parte dell'app (senza browser).   node --test test/
// Le scritture su scadenze e giorni_diario si provano con un client Supabase finto: le tabelle
// esistono solo dopo la migration 20261116061900_scadenze_diario.sql.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "esercizi.js", "diario.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));

// Client finto: ogni from() registra le chiamate; la risposta dipende dalla tabella e dal verbo.
function finto(risposte) {
  const chiamate = [];
  const from = (tabella) => {
    const q = { tabella, ops: [] };
    chiamate.push(q);
    const p = new Proxy({}, {
      get(_, k) {
        if (k === "then") {
          const r = risposte(q) ?? { data: null, error: null };
          return (ok, ko) => Promise.resolve(r).then(ok, ko);
        }
        return (...a) => { q.ops.push([k, ...a]); return p; };
      },
    });
    return p;
  };
  return { from, chiamate };
}
const usa = (f) => { ctx.__sb = f; run("sb = __sb; profilo = { id: 's1', nome: 'Ada' }"); };
// Gli oggetti nascono nel contesto vm: si confrontano come JSON.
const verbo = (q, v) => { const o = q.ops.find((x) => x[0] === v); return o && JSON.parse(JSON.stringify(o)); };

test("oggi è la data del telefono, non quella UTC", () => {
  assert.equal(run("oggiLocale(new Date(2026, 10, 16, 23, 30))"), "2026-11-16");
  assert.equal(run("oggiLocale(new Date(2026, 0, 3, 0, 5))"), "2026-01-03");
});

test("data detta per esteso", () => {
  assert.equal(run('dataLunga("2026-11-19")'), "giovedì 19 novembre");
  assert.equal(run('dataLunga("2027-01-04")'), "lunedì 4 gennaio");
});

test("giorni di fila: si contano fino a oggi, o fino a ieri se oggi non ci sono ancora foto", () => {
  assert.equal(run('serieGiorni(["2026-11-16", "2026-11-15", "2026-11-14", "2026-11-12"], "2026-11-16")'), 3);
  assert.equal(run('serieGiorni(["2026-11-15", "2026-11-14"], "2026-11-16")'), 2);
  assert.equal(run('serieGiorni(["2026-11-14", "2026-11-13"], "2026-11-16")'), 0);
  assert.equal(run('serieGiorni(["2026-11-16", "2026-11-16"], "2026-11-16")'), 1);
  assert.equal(run('serieGiorni([], "2026-11-16")'), 0);
  // A cavallo di mese.
  assert.equal(run('serieGiorni(["2026-12-01", "2026-11-30", "2026-11-29"], "2026-12-01")'), 3);
});

test("la serie si dice solo da due giorni in su", () => {
  assert.equal(run("fraseSerie(0)"), "");
  assert.equal(run("fraseSerie(1)"), "");
  assert.equal(run("fraseSerie(4)"), "4 giorni di fila con le foto della scuola");
});

const ARG = [
  { id: "a0000000-0000-4000-8000-000000000001", materia: "Storia", titolo: "La Rivoluzione francese" },
  { id: "a0000000-0000-4000-8000-000000000002", materia: "Matematica", titolo: "Le frazioni" },
];

test("riga di una foto smistata: aggiunta, nuovo argomento o solo diario", () => {
  run("argomenti = " + JSON.stringify(ARG));
  assert.deepEqual(json(`rigaFoto({ materia: "Storia", argomento_id: "${ARG[0].id}", nuovo_titolo: null })`),
    { materia: "Storia", testo: "Aggiunta a «La Rivoluzione francese»" });
  assert.deepEqual(json('rigaFoto({ materia: "Scienze", argomento_id: null, nuovo_titolo: "Il cuore" })'),
    { materia: "Scienze", testo: "Nuovo argomento: Il cuore" });
  assert.deepEqual(json('rigaFoto({ materia: "", argomento_id: null, nuovo_titolo: null })'),
    { materia: "", testo: "Solo diario: qui non c'è niente da studiare" });
  // Un argomento cancellato nel frattempo: la riga lo dice, e con un tocco si sceglie dove metterla.
  assert.equal(json('rigaFoto({ materia: "Storia", argomento_id: "a0000000-0000-4000-8000-000000000009", nuovo_titolo: null })').testo,
    "Solo diario: qui non c'è niente da studiare");
});

test("gruppi da salvare: una volta per argomento, i nuovi uguali insieme, il diario fuori", () => {
  run("argomenti = " + JSON.stringify(ARG));
  const g = json(`gruppiDaSalvare([
    { materia: "Storia", argomento_id: "${ARG[0].id}", nuovo_titolo: null },
    { materia: "Scienze", argomento_id: null, nuovo_titolo: "Il cuore" },
    { materia: "", argomento_id: null, nuovo_titolo: null },
    { materia: "scienze", argomento_id: null, nuovo_titolo: "il cuore " },
    { materia: "Storia", argomento_id: "${ARG[0].id}", nuovo_titolo: null },
  ])`);
  assert.deepEqual(g, [
    { argomento_id: ARG[0].id, materia: "Storia", titolo: "La Rivoluzione francese", indici: [0, 4] },
    { argomento_id: null, materia: "Scienze", titolo: "Il cuore", indici: [1, 3] },
  ]);
});

test("prossime date: da oggi in poi, in ordine", () => {
  const s = json(`prossimeScadenze([
    { id: "1", materia: "Storia", tipo: "orale", data: "2026-11-23" },
    { id: "2", materia: "Matematica", tipo: "scritta", data: "2026-11-19" },
    { id: "3", materia: "Inglese", tipo: "scritta", data: "2026-11-10" },
  ], "2026-11-16")`);
  assert.deepEqual(s.map((x) => x.id), ["2", "1"]);
  assert.equal(run('nomeScadenza({ materia: "Matematica", tipo: "scritta" })'), "Verifica di Matematica");
  assert.equal(run('nomeScadenza({ materia: "Storia", tipo: "orale" })'), "Interrogazione di Storia");
});

test("card della data letta: la frase del diario evidenziata, i due pulsanti, niente HTML che passa", () => {
  const h = run('htmlDataLetta({ materia: "Matematica", tipo: "scritta", data: "2026-11-19", testo_letto: "Verifica di matematica giovedì 19" }, 0)');
  assert.match(h, /Sul diario ho letto una data: «<mark class="evidenzia">Verifica di matematica giovedì 19<\/mark>»\. La segno\?/);
  assert.match(h, /Verifica di Matematica, giovedì 19 novembre/);
  assert.match(h, />Sì, segnala</);
  assert.match(h, />Non è così</);
  assert.doesNotMatch(run('htmlDataLetta({ materia: "<b>", tipo: "orale", data: "2026-11-19", testo_letto: "<img src=x>" }, 1)'), /<img|<b>/);
});

test("data segnata a mano: si controlla prima di scrivere", () => {
  assert.equal(run('scadenzaValida({ materia: "Storia", tipo: "orale", data: "2026-11-20" }, "2026-11-16")'), true);
  assert.equal(run('scadenzaValida({ materia: " ", tipo: "orale", data: "2026-11-20" }, "2026-11-16")'), false);
  assert.equal(run('scadenzaValida({ materia: "Storia", tipo: "pratica", data: "2026-11-20" }, "2026-11-16")'), false);
  assert.equal(run('scadenzaValida({ materia: "Storia", tipo: "scritta", data: "2026-11-15" }, "2026-11-16")'), false);
  assert.equal(run('scadenzaValida({ materia: "Storia", tipo: "scritta", data: "2026-02-30" }, "2026-01-16")'), false);
});

/* ---------------------------------------------------------------- database (client finto) */

test("caricaDiario: prossime scadenze e giorni recenti del profilo", async () => {
  const f = finto((q) => q.tabella === "scadenze"
    ? { data: [{ id: "x", materia: "Storia", tipo: "orale", data: "2026-11-19", fonte: "diario" }], error: null }
    : { data: [{ data: "2026-11-16" }, { data: "2026-11-15" }], error: null });
  usa(f);
  await run('caricaDiario("2026-11-16")');
  const [s, g] = f.chiamate;
  assert.equal(s.tabella, "scadenze");
  assert.deepEqual(verbo(s, "gte"), ["gte", "data", "2026-11-16"]);
  assert.equal(g.tabella, "giorni_diario");
  assert.deepEqual(verbo(g, "gte"), ["gte", "data", "2026-09-17"]); // 60 giorni prima
  assert.deepEqual(json("diario"), { pronto: true, scadenze: [{ id: "x", materia: "Storia", tipo: "orale", data: "2026-11-19", fonte: "diario" }], giorni: ["2026-11-16", "2026-11-15"], messaggio: "" });
});

test("caricaDiario: tabella che non c'è ancora (migration non applicata), niente errore e niente card", async () => {
  usa(finto(() => ({ data: null, error: { code: "42P01", message: "relation does not exist" } })));
  await run('caricaDiario("2026-11-16")');
  assert.equal(run("diario.pronto"), false);
});

test("salvaScadenza: scrive solo i campi della tabella e la tiene in ordine", async () => {
  const f = finto((q) => ({ data: { id: "n1", ...verbo(q, "insert")[1] }, error: null }));
  usa(f);
  run('diario = { pronto: true, scadenze: [{ id: "v", materia: "Storia", tipo: "orale", data: "2026-11-25", fonte: "manuale" }], giorni: [], messaggio: "" }');
  await run('salvaScadenza({ materia: " Matematica ", tipo: "scritta", data: "2026-11-19", testo_letto: "Verifica giovedì 19" }, "diario", "2026-11-16")');
  assert.equal(f.chiamate[0].tabella, "scadenze");
  assert.deepEqual(verbo(f.chiamate[0], "insert")[1], { materia: "Matematica", tipo: "scritta", data: "2026-11-19", fonte: "diario" });
  assert.deepEqual(json("diario.scadenze.map((s) => s.id)"), ["n1", "v"]);
});

test("salvaScadenza: una data sbagliata non arriva al database", async () => {
  const f = finto(() => ({ data: null, error: null }));
  usa(f);
  await assert.rejects(run('salvaScadenza({ materia: "Storia", tipo: "scritta", data: "2026-11-01" }, "manuale", "2026-11-16")'));
  assert.equal(f.chiamate.length, 0);
});

test("salvaScadenza: l'errore del database arriva a chi chiama", async () => {
  usa(finto(() => ({ data: null, error: { message: "permission denied" } })));
  await assert.rejects(run('salvaScadenza({ materia: "Storia", tipo: "scritta", data: "2026-11-20" }, "manuale", "2026-11-16")'));
});

test("togliScadenza: cancella quella riga e la toglie dall'elenco", async () => {
  const f = finto(() => ({ data: null, error: null }));
  usa(f);
  run('diario = { pronto: true, scadenze: [{ id: "a" }, { id: "b" }], giorni: [], messaggio: "" }');
  await run('togliScadenza("a")');
  assert.ok(verbo(f.chiamate[0], "delete"));
  assert.deepEqual(verbo(f.chiamate[0], "eq"), ["eq", "id", "a"]);
  assert.deepEqual(json("diario.scadenze.map((s) => s.id)"), ["b"]);
});

test("segnaGiorno: somma le foto di oggi con un upsert su (studente_id, data)", async () => {
  const f = finto((q) => (verbo(q, "maybeSingle") ? { data: { n_foto: 2 }, error: null } : { data: null, error: null }));
  usa(f);
  run('diario = { pronto: true, scadenze: [], giorni: ["2026-11-15"], messaggio: "" }');
  assert.equal(await run('segnaGiorno(3, "2026-11-16")'), true);
  const [leggi, scrivi] = f.chiamate;
  assert.deepEqual(verbo(leggi, "eq"), ["eq", "studente_id", "s1"]);
  assert.deepEqual(verbo(scrivi, "upsert"), ["upsert", { data: "2026-11-16", n_foto: 5 }, { onConflict: "studente_id,data" }]);
  assert.deepEqual(json("diario.giorni"), ["2026-11-16", "2026-11-15"]);
});

test("segnaGiorno: se la tabella non c'è il salvataggio delle foto va avanti", async () => {
  usa(finto(() => ({ data: null, error: { code: "42P01" } })));
  assert.equal(await run('segnaGiorno(1, "2026-11-16")'), false);
  assert.equal(await run('segnaGiorno(0, "2026-11-16")'), false);
});

test("aggiungiTesto: argomento esistente con i punti nuovi, argomento nato adesso con tutti, esercizi solo testo", async () => {
  const f = finto(() => ({ data: null, error: null }));
  usa(f);
  ctx.__chiamate = [];
  run(`modello = async (c) => { __chiamate.push(JSON.parse(JSON.stringify(c))); return { concetti: [{ titolo: "Nuovo", descrizione: "d", ancora: "a", peso: 2, errore_appunti: "" }] }; }`);
  const esistente = run(`({ id: "a1", materia: "Storia", titolo: "Rivoluzione", trascrizione: "vecchio", concetti: [{ titolo: "Bastiglia", ordine: 4 }] })`);
  ctx.__a = esistente;
  assert.equal((await run('aggiungiTesto(__a, "nuovo testo", 1, () => {})')).length, 1);
  assert.deepEqual(ctx.__chiamate[0], { azione: "concetti", testo: "nuovo testo", pagine: 1, esistenti: ["Bastiglia"] });
  assert.equal(esistente.trascrizione, "vecchio\n\nnuovo testo");
  const ins = verbo(f.chiamate.find((q) => q.tabella === "concetti"), "insert")[1];
  assert.equal(ins[0].ordine, 5);
  assert.equal(ins[0].argomento_id, "a1");

  ctx.__a = run(`({ id: "a2", materia: "Scienze", titolo: "Il cuore", trascrizione: null, concetti: [] })`);
  await run('aggiungiTesto(__a, "Il cuore ha quattro cavità", 1, () => {})');
  assert.deepEqual(ctx.__chiamate[1], { azione: "concetti", materia: "Scienze", titolo: "Il cuore", testo: "Il cuore ha quattro cavità", pagine: 1 });

  ctx.__a = run(`({ id: "a3", materia: "Matematica", titolo: "Frazioni", percorso: "esercizi", trascrizione: "x", concetti: [] })`);
  assert.equal((await run('aggiungiTesto(__a, "3/4 + 1/2", 1, () => {})')).length, 0);
  assert.equal(ctx.__chiamate.length, 2); // nessuna chiamata al modello per gli esercizi
});

/* ---------------------------------------------------------------- revisione #19 */

test("foto illeggibile: la riga lo dice", () => {
  run("argomenti = []");
  const ill = run("GRUPPO_ILLEGGIBILE");
  for (const t of [ill, "", "   "]) {
    assert.deepEqual(json(`rigaFoto({ materia: "", argomento_id: null, nuovo_titolo: null }, ${JSON.stringify(t)})`),
      { materia: "", testo: "Non riesco a leggere questa foto: rifotografala o scegli tu dove va" });
  }
  assert.equal(json('rigaFoto({ materia: "", argomento_id: null, nuovo_titolo: null }, "Diario: compiti")').testo, "Solo diario: qui non c'è niente da studiare");
});

test("stessa scadenza già segnata: materia senza maiuscole, tipo e data uguali", () => {
  const lista = '[{ id: "x", materia: "Matematica", tipo: "scritta", data: "2026-11-19" }]';
  assert.equal(run(`giaSegnata({ materia: " matematica ", tipo: "scritta", data: "2026-11-19" }, ${lista})`), true);
  assert.equal(run(`giaSegnata({ materia: "matematica", tipo: "orale", data: "2026-11-19" }, ${lista})`), false);
  assert.equal(run(`giaSegnata({ materia: "matematica", tipo: "scritta", data: "2026-11-20" }, ${lista})`), false);
  run(`diario = { pronto: true, scadenze: ${lista}, giorni: [], messaggio: "" }`);
  const h = run('htmlDataLetta({ materia: "matematica", tipo: "scritta", data: "2026-11-19", testo_letto: "Verifica di matematica giovedì 19" }, 0)');
  assert.match(h, /Già segnata/);
  assert.doesNotMatch(h, /Sì, segnala/);
});

test("salvaScadenza: una già segnata non si scrive di nuovo", async () => {
  const f = finto(() => ({ data: null, error: null }));
  usa(f);
  run('diario = { pronto: true, scadenze: [{ id: "x", materia: "Matematica", tipo: "scritta", data: "2026-11-19", fonte: "diario" }], giorni: [], messaggio: "" }');
  await run('salvaScadenza({ materia: "matematica", tipo: "scritta", data: "2026-11-19" }, "manuale", "2026-11-16")');
  assert.equal(f.chiamate.length, 0);
  assert.equal(run("diario.scadenze.length"), 1);
});

test("salvaScadenza: il doppione rifiutato dal database (indice unico) non è un errore", async () => {
  usa(finto(() => ({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } })));
  run('diario = { pronto: true, scadenze: [], giorni: [], messaggio: "" }');
  assert.equal(await run('salvaScadenza({ materia: "Storia", tipo: "orale", data: "2026-11-20" }, "diario", "2026-11-16")'), null);
});

test("aggiungiTesto ripetuto dopo un errore: il testo non si aggiunge due volte", async () => {
  const f = finto(() => ({ data: null, error: null }));
  usa(f);
  ctx.__chiamate = [];
  run(`modello = async (c) => { __chiamate.push(JSON.parse(JSON.stringify(c))); return { concetti: [] }; }`);
  ctx.__a = run(`({ id: "a2", materia: "Scienze", titolo: "Il cuore", trascrizione: "Il cuore ha quattro cavità", concetti: [] })`);
  await run('aggiungiTesto(__a, "Il cuore ha quattro cavità", 1, () => {})');
  assert.equal(ctx.__a.trascrizione, "Il cuore ha quattro cavità");
  assert.equal(f.chiamate.filter((q) => q.tabella === "argomenti").length, 0);
  assert.deepEqual(ctx.__chiamate[0], { azione: "concetti", materia: "Scienze", titolo: "Il cuore", testo: "Il cuore ha quattro cavità", pagine: 1 });
});

// mettiVia: foto una per una, argomenti nuovi creati una volta sola, testo una volta sola.
function preparaMettiVia({ fallisceFoto = new Set(), fallisceTesto = false } = {}) {
  const f = finto((q) => (q.tabella === "argomenti" ? { data: { id: "nuovo-" + f.chiamate.length, ...verbo(q, "insert")[1] }, error: null } : { data: null, error: null }));
  usa(f);
  ctx.__foto = []; ctx.__testi = []; ctx.__falliscono = fallisceFoto; ctx.__testoKo = { v: fallisceTesto };
  run(`argomenti = ${JSON.stringify(ARG.map((a) => ({ ...a, concetti: [] })))};
    conservaFoto = async (a, blobs) => { __foto.push(blobs[0]); return __falliscono.has(blobs[0]) ? [] : ["p"]; };
    aggiungiTesto = async (a, testo) => { if (__testoKo.v) throw new Error("rete"); __testi.push([a.id, testo]); return [{}]; };
    segnaGiorno = async () => true;
    smistate = { blobs: ["b0", "b1", "b2"], testi: ["storia", "cuore", "diario"], righe: [
      { materia: "Storia", argomento_id: "${ARG[0].id}", nuovo_titolo: null },
      { materia: "Scienze", argomento_id: null, nuovo_titolo: "Il cuore" },
      { materia: "", argomento_id: null, nuovo_titolo: null } ], scadenze: [] };`);
  return f;
}

const plain = (x) => JSON.parse(JSON.stringify(x));

test("mettiVia: una foto non salvata fa fallire il gruppo; al nuovo tentativo solo quella, niente doppioni", async () => {
  const f = preparaMettiVia({ fallisceFoto: new Set(["b1"]) });
  const e1 = plain(await run("mettiVia(() => {})"));
  assert.deepEqual(e1, { salvate: 1, nuoviArgomenti: 1, punti: 1, fotoFallite: 1, testoFallito: 0, gruppiFalliti: 0 });
  assert.deepEqual(plain(ctx.__foto), ["b0", "b1"]);
  assert.deepEqual(plain(ctx.__testi), [[ARG[0].id, "storia"]]); // il cuore aspetta la sua foto
  assert.match(run("messaggioMessaVia(" + JSON.stringify(e1) + ")"), /1 foto non è stata salvata/);
  // Nuovo tentativo: solo la foto mancante, sullo stesso argomento nuovo; storia non si ripete.
  ctx.__falliscono = new Set();
  const e2 = plain(await run("mettiVia(() => {})"));
  assert.equal(e2.fotoFallite, 0);
  assert.equal(e2.nuoviArgomenti, 0);
  assert.deepEqual(plain(ctx.__foto), ["b0", "b1", "b1"]);
  assert.equal(f.chiamate.filter((q) => q.tabella === "argomenti").length, 1);
  const testi = plain(ctx.__testi);
  assert.equal(testi.length, 2);
  assert.equal(testi[1][1], "cuore");
  assert.match(testi[1][0], /^nuovo-/);
});

test("mettiVia: foto salvate ma testo no; al nuovo tentativo solo il testo", async () => {
  preparaMettiVia({ fallisceTesto: true });
  const e1 = plain(await run("mettiVia(() => {})"));
  assert.equal(e1.fotoFallite, 0);
  assert.equal(e1.testoFallito, 2);
  assert.match(run("messaggioMessaVia(" + JSON.stringify(e1) + ")"), /Non ricaricare le foto/);
  ctx.__testoKo.v = false;
  const e2 = plain(await run("mettiVia(() => {})"));
  assert.equal(plain(ctx.__foto).length, 2); // le foto non si rimettono via
  assert.equal(e2.testoFallito, 0);
  assert.equal(plain(ctx.__testi).length, 2);
});

test("messaggio della messa via: dice cosa è andato storto e cosa fare", () => {
  assert.match(run('messaggioMessaVia({ salvate: 1, nuoviArgomenti: 0, punti: 0, fotoFallite: 1, testoFallito: 0, gruppiFalliti: 0 })'), /1 foto non è stata salvata.*Riprova/);
  assert.match(run('messaggioMessaVia({ salvate: 0, nuoviArgomenti: 0, punti: 0, fotoFallite: 0, testoFallito: 0, gruppiFalliti: 1 })'), /Riprova/);
  assert.equal(run('messaggioMessaVia({ salvate: 2, nuoviArgomenti: 1, punti: 3, fotoFallite: 0, testoFallito: 0, gruppiFalliti: 0 })'),
    "Foto messe via, 1 argomento nuovo, 3 punti nuovi da studiare.");
  assert.equal(run('messaggioMessaVia({ salvate: 0, nuoviArgomenti: 0, punti: 0, fotoFallite: 0, testoFallito: 0, gruppiFalliti: 0 })'), "Fatto: oggi solo diario.");
});
