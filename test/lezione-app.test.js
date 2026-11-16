// Issue #23, la parte dell'app: schede, figure, voce e video della mini-lezione (senza browser).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const memoria = new Map();
const localStorage = { getItem: (k) => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, String(v)) };
const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval, Intl, localStorage });
for (const f of ["semaforo.js", "app.js", "figure.js", "lezione.js"])
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));

const REGOLA = { tipo: "regola", titolo: "La fine dell'impero", testo: "Nel 476 cade l'Impero d'Occidente. Finisce l'età antica!", ancora: "Nel 476 Odoacre depose l'ultimo imperatore", calcoli: [], figura: null, fonte: "appunti" };

test("frasi: una per volta, con la punteggiatura", () => {
  assert.deepEqual(json(`frasiDi("Prima frase. Seconda? Terza senza punto")`), ["Prima frase.", "Seconda?", "Terza senza punto"]);
  assert.deepEqual(json(`frasiDi("")`), []);
  assert.deepEqual(json(`frasiDi("Roma nasce nel 753 a.C. Poi cresce. Nel 490 a.C. c'è Maratona.")`), ["Roma nasce nel 753 a.C. Poi cresce.", "Nel 490 a.C. c'è Maratona."]);
  assert.deepEqual(json(`frasiDi("Erano 1.000 soldati. Nel sec. XV cambia tutto.")`), ["Erano 1.000 soldati.", "Nel sec. XV cambia tutto."]);
});

test("scheda: ogni pezzo letto a voce ha il suo posto nella scheda; la frase del quaderno è evidenziata", () => {
  const s = { ...REGOLA, calcoli: ["3/4 × 12 = 9"] };
  const html = run(`htmlScheda(${JSON.stringify(s)})`);
  const pezzi = json(`pezziScheda(${JSON.stringify(s)})`);
  const posti = [...html.matchAll(/data-f="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(posti, pezzi.map((_, i) => i));
  assert.match(html, /<mark class="evidenzia">Nel 476 Odoacre depose l&#39;ultimo imperatore<\/mark>|<mark class="evidenzia">Nel 476 Odoacre depose l'ultimo imperatore<\/mark>/);
  assert.match(html, /L'idea centrale/);
  assert.equal(pezzi[pezzi.length - 1].includes("per"), true, "il × si legge «per»");
  // senza ancora niente «Sul tuo quaderno»
  assert.doesNotMatch(run(`htmlScheda(${JSON.stringify({ ...REGOLA, ancora: "" })})`), /quaderno/);
  // il testo è escapato
  assert.doesNotMatch(run(`htmlScheda(${JSON.stringify({ ...REGOLA, testo: "<img src=x onerror=alert(1)>." })})`), /<img/);
});

test("figure: linea del tempo con gli anni (a.C. per i negativi), schemi a frecce e a gruppi, geometria da figure.js", () => {
  const lt = run(`htmlFiguraLezione({ tipo: "linea_tempo", eventi: [{ anno: -753, etichetta: "Fondazione di Roma" }, { anno: 476, etichetta: "Fine dell'Impero d'Occidente" }] })`);
  assert.match(lt, /753 a\.C\./);
  assert.match(lt, />476</);
  assert.match(lt, /role="img"/);
  const fr = run(`htmlFiguraLezione({ tipo: "frecce", passi: ["Evaporazione", "Condensazione", "Precipitazione"] })`);
  assert.equal((fr.match(/<rect/g) || []).length, 3);
  assert.match(fr, /Evaporazione, poi Condensazione/);
  const gr = run(`htmlFiguraLezione({ tipo: "gruppi", gruppi: [{ titolo: "Vertebrati", voci: ["pesci", "uccelli"] }, { titolo: "Invertebrati", voci: ["insetti"] }] })`);
  assert.match(gr, /Vertebrati/); assert.match(gr, /• insetti/);
  const geo = run(`htmlFiguraLezione({ tipo: "geometria", forma: "rettangolo", misure: [{ nome: "base", valore: "8 cm" }] })`);
  assert.match(geo, /class="figura"/);
  assert.equal(run(`htmlFiguraLezione(null)`), "");
});

test("video: anteprima da toccare (niente iframe e niente autoplay subito), «dal web», durata e canale solo se ci sono", () => {
  const yt = run(`htmlVideo({ titolo: "La caduta di Roma", url: "https://www.youtube.com/watch?v=AAAAAAAAAAA", sito: "YouTube", embed: "https://www.youtube-nocookie.com/embed/AAAAAAAAAAA", anteprima: "https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg", durata: "6:40", canale: "Storia Facile" }, 0)`);
  assert.doesNotMatch(yt, /iframe|autoplay/);
  assert.match(yt, /data-video="0"/);
  assert.match(yt, /dal web/);
  assert.match(yt, /YouTube: Storia Facile, 6:40/);
  const rai = run(`htmlVideo({ titolo: "Odoacre", url: "https://www.raiscuola.rai.it/x", sito: "Rai Scuola", embed: "", anteprima: "", durata: "", canale: "" }, 1)`);
  assert.match(rai, /Guarda su Rai Scuola/);
  assert.match(rai, /rel="noopener noreferrer"/);
  assert.match(rai, /Rai Scuola: durata non indicata<\/p>/, "niente durata o canale inventati");
  assert.doesNotMatch(run(`htmlVideo({ titolo: "x", url: "javascript:alert(1)", sito: "Rai Scuola", embed: "", anteprima: "", durata: "", canale: "" }, 0)`), /href/);
});

test("video spenti dal genitore: per profilo, su questo telefono", () => {
  assert.equal(run(`videoAccesi("p1")`), true);
  run(`salvaLocale(chiaveVideoSpenti("p1"), true)`);
  assert.equal(run(`videoAccesi("p1")`), false);
  assert.equal(run(`videoAccesi("p2")`), true);
});

test("lezione salvata valida solo se ha schede intere", () => {
  assert.equal(run(`lezioneValida({ schede: [${JSON.stringify(REGOLA)}] })`), true);
  assert.equal(run(`lezioneValida({ schede: [] })`), false);
  assert.equal(run(`lezioneValida({ schede: [{ tipo: "regola" }] })`), false);
  assert.equal(run(`lezioneValida(null)`), false);
});
