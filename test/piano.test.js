// Issue #20: piano del giorno con ripetizione dilazionata (senza browser).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl });
for (const f of ["semaforo.js", "app.js", "libreria.js", "compito.js", "piano.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));
const piano = (stati, scadenze, oggi, sec) =>
  json(`pianoDelGiorno(${JSON.stringify(stati)}, ${JSON.stringify(scadenze)}, ${JSON.stringify(oggi)}${sec ? ", " + sec : ""})`);

const OGGI = "2026-11-16";
// Storia: 2 rossi, 2 gialli, 3 verdi. Scienze: 1 rosso, 2 mai, 1 verde.
const P = (id, stato, arg, materia, extra = {}) => ({ concetto_id: id, titolo: "Punto " + id, argomento_id: arg, materia, stato, peso: 2, ...extra });
const STORIA = [P("s1", "rosso", "A", "storia"), P("s2", "rosso", "A", "storia"), P("s3", "giallo", "A", "storia"), P("s4", "giallo", "A", "storia"),
  P("s5", "verde", "A", "storia"), P("s6", "verde", "A", "storia"), P("s7", "verde", "A", "storia")];
const SCIENZE = [P("c1", "rosso", "B", "scienze"), P("c2", "mai", "B", "scienze"), P("c3", "mai", "B", "scienze"), P("c4", "verde", "B", "scienze")];
const TUTTI = [...STORIA, ...SCIENZE];
const scad = (materia, data, arg) => ({ id: materia + data, materia, tipo: "scritta", data, argomento_id: arg ?? null });

test("nessuna scadenza: i dovuti, i rossi prima, un verde al volo, 4-6 punti", () => {
  const p = piano(TUTTI, [], OGGI);
  assert.ok(p.punti.length >= 4 && p.punti.length <= 6, "punti: " + p.punti.length);
  const stati = p.punti.map((x) => x.stato);
  assert.deepEqual(stati.slice(0, 3), ["rosso", "rosso", "rosso"]);
  assert.equal(stati.filter((s) => s === "verde").length, 1);
  assert.equal(p.punti.at(-1).motivo, "al volo");
  assert.equal(p.prossima, null);
  assert.deepEqual(p.scadenze, []);
  // senza misura: 2 minuti a punto (valore dichiarato nel codice), quindi 5 punti = 10 minuti
  assert.equal(p.secondi_punto, 120);
  assert.equal(p.punti.length, 5);
  assert.equal(p.minuti, 10);
});

test("una scadenza fra 1 giorno: quasi tutto su quell'argomento, verde compreso", () => {
  const p = piano(TUTTI, [scad("Storia", "2026-11-17", "A")], OGGI);
  assert.equal(p.prossima.giorni, 1);
  assert.equal(p.scadenze.length, 1);
  const storia = p.punti.filter((x) => x.argomento_id === "A");
  assert.ok(storia.length >= p.punti.length - 1, "storia: " + storia.length + " su " + p.punti.length);
  assert.equal(p.punti[0].stato, "rosso");
  assert.equal(p.punti[0].argomento_id, "A");
  const verde = p.punti.find((x) => x.motivo === "al volo");
  assert.equal(verde.argomento_id, "A");
  assert.equal(p.parti[0].materia, "storia");
});

test("due scadenze: minuti divisi in proporzione alla vicinanza", () => {
  // storia fra 1 giorno (peso 5), scienze fra 4 (peso 2), senza argomento: vale la materia
  const p = piano(TUTTI, [scad("scienze", "2026-11-20"), scad("storia", "2026-11-17", "A")], OGGI, 100);
  assert.equal(p.scadenze[0].materia, "storia");
  assert.equal(p.scadenze[1].giorni, 4);
  const n = (arg) => p.punti.filter((x) => x.argomento_id === arg).length;
  assert.ok(n("A") > n("B"), "storia " + n("A") + ", scienze " + n("B"));
  assert.ok(n("B") >= 1);
  assert.equal(p.punti.length, 6); // 600 / 100 secondi
  // minuti = punti × secondi misurati, per materia e in totale
  const st = p.parti.find((x) => x.materia === "storia"), sc = p.parti.find((x) => x.materia === "scienze");
  assert.equal(st.minuti, Math.round(st.punti * 100 / 60));
  assert.equal(sc.minuti, Math.round(sc.punti * 100 / 60));
  assert.equal(p.minuti, 10);
});

test("tutto verde: un piano lo stesso, solo verdi da rivedere al volo", () => {
  const verdi = TUTTI.map((x) => ({ ...x, stato: "verde" }));
  const p = piano(verdi, [], OGGI);
  assert.ok(p.punti.length >= 1);
  assert.ok(p.punti.every((x) => x.stato === "verde"));
  assert.equal(p.punti[0].motivo, "al volo");
  // con i verdi dovuti oggi (ripetizione dilazionata) il piano si riempie
  const dovuti = verdi.map((x, i) => ({ ...x, prossima: i < 4 ? "2026-11-15" : "2026-11-25" }));
  const q = piano(dovuti, [], OGGI);
  assert.equal(q.punti.length, 4);
  assert.ok(q.punti.every((x) => x.prossima <= OGGI));
});

test("niente punti: piano vuoto, zero minuti", () => {
  const p = piano([], [scad("storia", "2026-11-18")], OGGI);
  assert.deepEqual(p.punti, []);
  assert.equal(p.minuti, 0);
  assert.equal(p.prossima.giorni, 2);
});

test("la ripetizione dilazionata decide chi è dovuto; il «Ci prendo» sbagliato passa davanti a tutto", () => {
  const stati = [P("s1", "rosso", "A", "storia", { prossima: "2026-11-30" }), P("s2", "giallo", "A", "storia", { prossima: "2026-11-16" }),
    P("s3", "verde", "A", "storia", { prossima: "2026-11-16", ultima_sicurezza: "ci", ultimo_esito: 2 }), P("s4", "verde", "A", "storia")];
  const p = piano(stati, [], OGGI);
  assert.equal(p.punti[0].concetto_id, "s3");
  assert.equal(p.punti[0].motivo, "subito");
  assert.ok(!p.punti.some((x) => x.concetto_id === "s1"), "s1 non è dovuto fino al 30");
  assert.ok(p.punti.some((x) => x.concetto_id === "s2"));
});

test("scadenze passate o lontane non pesano; una verifica oggi sì", () => {
  const p = piano(TUTTI, [scad("storia", "2026-11-10", "A"), scad("scienze", "2026-11-30", "B")], OGGI);
  assert.deepEqual(p.scadenze, []);
  assert.equal(p.prossima.materia, "scienze");
  assert.equal(p.prossima.giorni, 14);
  assert.equal(piano(TUTTI, [scad("storia", OGGI, "A")], OGGI).scadenze[0].giorni, 0);
});

test("durata media misurata: dai secondi delle risposte, senza valori assurdi", () => {
  assert.equal(run("secondiPerPunto([])"), 120);
  assert.equal(run("secondiPerPunto([30, 40])"), 120); // troppo poche per fidarsi
  assert.equal(run("secondiPerPunto([30, 40, 50, 60, 70, null, 5000, 0])"), 50);
});

/* ---- aggiornamento dopo ogni risposta ---- */

const nuovo = (prima, esito, sic) => json(`nuovoStatoRipasso(${JSON.stringify(prima)}, ${esito}, ${JSON.stringify(sic)}, "${OGGI}")`);

test("esito buono: intervallo × facilità; scarso: intervallo 1; medio: intervallo uguale", () => {
  const a = nuovo(null, 9, null);
  assert.deepEqual([a.intervallo_giorni, a.prossima, a.facilita, a.ultimo_esito], [3, "2026-11-19", 2.6, 9]);
  const b = nuovo(a, 10, "ci");
  assert.deepEqual([b.intervallo_giorni, b.prossima, b.ultima_sicurezza], [8, "2026-11-24", "ci"]);
  const c = nuovo(b, 3, "forse");
  assert.deepEqual([c.intervallo_giorni, c.prossima, c.facilita], [1, "2026-11-17", 2.5]);
  const d = nuovo({ intervallo_giorni: 4, facilita: 2.2 }, 6, null);
  assert.deepEqual([d.intervallo_giorni, d.facilita, d.prossima], [4, 2.2, "2026-11-20"]);
  // la facilità resta fra 1,3 e 3
  assert.equal(nuovo({ intervallo_giorni: 1, facilita: 1.3 }, 0, null).facilita, 1.3);
  assert.equal(nuovo({ intervallo_giorni: 1, facilita: 3 }, 10, null).facilita, 3);
  assert.equal(nuovo(null, 7.26, null).ultimo_esito, 7.3);
});

test("sbagliato dato come «Ci prendo»: domani e prima di tutto", () => {
  const s = nuovo({ intervallo_giorni: 10, facilita: 2.5 }, 2, "ci");
  assert.equal(s.prossima, "2026-11-17");
  assert.equal(run(`prioritaMassima(${JSON.stringify(s)})`), true);
  assert.equal(run(`prioritaMassima(${JSON.stringify(nuovo(null, 2, "caso"))})`), false);
  assert.equal(run(`prioritaMassima(${JSON.stringify(nuovo(null, 9, "ci"))})`), false);
});

test("sicurezza per concetto: un «Ci prendo» sbagliato vince sulle altre risposte", () => {
  const domande = [{ id: "d1", concetto_id: "x" }, { id: "d2", concetto_id: "x" }, { id: "d3", concetto_id: "y" }, { id: "d4", concetto_id: "z" }];
  const risposte = { d1: { sicurezza: "forse" }, d2: { sicurezza: "ci" }, d3: { sicurezza: "ci" }, d4: {} };
  const per = { d1: { punti: 9 }, d2: { punti: 2 }, d3: { punti: 10 }, d4: { punti: 4 } };
  assert.deepEqual(json(`sicurezzePerConcetto(${JSON.stringify(domande)}, ${JSON.stringify(risposte)}, ${JSON.stringify(per)})`), { x: "ci", y: "ci" });
});

test("scrittura in ripasso_stato: upsert sulla chiave, una riga per concetto; se la tabella manca non si rompe niente", async () => {
  const chiamate = [];
  const finto = (errore) => ({ from: (t) => ({ upsert: async (righe, opz) => { chiamate.push({ t, righe, opz }); return { error: errore }; } }) });
  run(`statiRipasso = { a: { concetto_id: "a", intervallo_giorni: 3, facilita: 2.6, prossima: "2026-11-16" } }`);
  ctx.mock = finto(null);
  const ok = await run(`salvaRipassoStato(mock, [{ concetto_id: "a", media: 9 }, { concetto_id: "b", media: 3 }], { b: "ci" }, "${OGGI}")`);
  assert.equal(ok, true);
  assert.equal(chiamate.length, 1);
  assert.equal(chiamate[0].t, "ripasso_stato");
  assert.equal(chiamate[0].opz.onConflict, "concetto_id,studente_id");
  const [a, b] = chiamate[0].righe;
  assert.deepEqual([a.concetto_id, a.intervallo_giorni, a.prossima], ["a", 8, "2026-11-24"]);
  assert.deepEqual([b.concetto_id, b.intervallo_giorni, b.ultima_sicurezza, b.ultimo_esito], ["b", 1, "ci", 3]);
  assert.ok(b.aggiornato);
  assert.equal(run("statiRipasso.b.prossima"), "2026-11-17"); // il piano di domani lo vede subito
  ctx.mock = finto({ code: "PGRST205", message: "Could not find the table" });
  assert.equal(await run(`salvaRipassoStato(mock, [{ concetto_id: "a", media: 9 }], {}, "${OGGI}")`), false);
  ctx.mock = { from: () => ({ upsert: async () => { throw new Error("rete"); } }) };
  assert.equal(await run(`salvaRipassoStato(mock, [{ concetto_id: "a", media: 9 }], {}, "${OGGI}")`), false);
  assert.equal(await run(`salvaRipassoStato(mock, [], {}, "${OGGI}")`), true);
});

/* ---- dai dati dell'app al piano, numeri di Oggi ---- */

test("punti del piano: concetti degli argomenti di teoria con il loro stato di ripasso", () => {
  const args = [{ id: "A", materia: "storia", titolo: "Peste", percorso: "teoria", concetti: [{ id: "a1", titolo: "Uno", stato: "rosso", peso: 3, media: 2 }] },
    { id: "M", materia: "matematica", titolo: "Aree", percorso: "esercizi", tipi: [{ id: "t1", stato: "giallo" }], concetti: [] }];
  const p = json(`puntiDelPiano(${JSON.stringify(args)}, { a1: { concetto_id: "a1", prossima: "2026-11-20", intervallo_giorni: 4 } })`);
  assert.deepEqual(p, [{ concetto_id: "a1", titolo: "Uno", argomento_id: "A", argomento: "Peste", materia: "storia", stato: "rosso", peso: 3, media: 2,
    prossima: "2026-11-20", intervallo_giorni: 4, ultima_sicurezza: null, ultimo_esito: null }]);
});

test("giorni di fila, voto se fosse oggi, prontezza", () => {
  assert.equal(run(`giorniDiFila(["2026-11-16", "2026-11-15", "2026-11-14", "2026-11-12"], "${OGGI}")`), 3);
  assert.equal(run(`giorniDiFila(["2026-11-15", "2026-11-14"], "${OGGI}")`), 2); // oggi non ancora: la serie regge
  assert.equal(run(`giorniDiFila(["2026-11-13"], "${OGGI}")`), 0);
  assert.equal(run(`votoSeFosseOggi([{ media: 10, peso: 1 }, { media: 5, peso: 1 }, { media: null, peso: 3 }])`), 7.5); // 75% → 7,5
  assert.equal(run(`votoSeFosseOggi([{ media: null }])`), null);
  assert.deepEqual(json(`prontezza([{ stato: "verde" }, { stato: "rosso" }, { stato: "verde" }, { stato: "mai" }])`), { verdi: 2, totale: 4, percento: 50 });
});

test("frasi di Oggi: scadenza, cosa si fa, stato vuoto (voce #17, niente numeri inventati)", () => {
  assert.equal(run(`quandoIt(0)`), "oggi");
  assert.equal(run(`quandoIt(1)`), "domani");
  assert.equal(run(`quandoIt(3)`), "fra 3 giorni");
  assert.deepEqual([1, 8, 10, 11].map((n) => run(`iMinuti(${n})`)), ["il minuto", "gli 8 minuti", "i 10 minuti", "gli 11 minuti"]);
  const p = piano(TUTTI, [scad("scienze", "2026-11-20"), scad("storia", "2026-11-17", "A")], OGGI, 100);
  const r = run(`rigaPiano(${JSON.stringify(p)})`);
  assert.match(r, /^Oggi \d+ minut[io] di storia e \d+ di scienze\.$/);
  const vuoto = piano(TUTTI, [], OGGI);
  assert.equal(run(`rigaPiano(${JSON.stringify(vuoto)})`), "Nessuna verifica in vista. Segna una data, o fai i 10 minuti per non dimenticare.");
  const html = run(`htmlPiano(${JSON.stringify(p)})`);
  assert.match(html, /I tuoi 10 minuti di oggi/);
  assert.match(html, /Parti con i 10 minuti/);
  assert.match(html, /data-s="rosso"/);
  assert.doesNotMatch(html, /sicura|pronta|→/);
});

test("settimana: sette giorni da oggi, sigla della materia sul giorno della verifica", () => {
  const g = json(`giorniSettimana([{ materia: "Storia", tipo: "scritta", data: "2026-11-19" }, { materia: "matematica", tipo: "orale", data: "2026-11-19" }], "${OGGI}")`);
  assert.equal(g.length, 7);
  assert.equal(g[0].data, OGGI);
  assert.equal(g[0].nome, "lun");
  assert.equal(g[3].numero, 19);
  assert.deepEqual(g[3].sigle, ["STO", "MAT"]);
  assert.deepEqual(g[1].sigle, []);
});
