// Issue #27: la parte dell'app di «Aiutami con un compito» (compito.js), senza browser.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval });
for (const f of ["semaforo.js", "app.js", "libreria.js", "formule.js", "figure.js", "compito.js"]) {
  vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
}
const run = (expr) => vm.runInContext(expr, ctx);
const json = (expr) => JSON.parse(run("JSON.stringify(" + expr + ")"));

const C = {
  testo: "Paolo ha speso 1/6 per gli anelli, 2/9 per il vestito, 465 € al ristorante. Gli rimangono 305 €. [1260 €]",
  dati: ["1/6", "2/9", "465 €", "305 €"], cerca: "lo stipendio di Paolo", soluzione_libro: "1260 €", matematica: true,
  indizi: ["Somma le frazioni spese.", "Che frazione resta?", "Che cosa sono gli euro?"],
  passi: [{ titolo: "Frazioni spese", spiegazione: "Stesso denominatore.", calcolo: "1/6 + 2/9 = 7/18", ancora: "" },
    { titolo: "Collego frazione ed euro", spiegazione: "11/18 valgono 770 €.", calcolo: "", ancora: "" }],
  risultato: { valore: "1260", unita: "€" }, verifica: { spiegazione: "Rimetto 1260 nel testo.", calcolo: "210 + 280 + 465 + 305 = 1260" },
  trucco: "Gli euro non sono frazioni.", domande_pronte: ["Come trovo lo stesso denominatore?", "Perché sommo 465 e 305?", "Me lo spieghi con un disegno?"],
};

test("aiuto a gradini: un indizio alla volta, poi Ho capito o Un altro indizio", () => {
  const zero = run(`htmlIndizi(${JSON.stringify(C)}, 0)`);
  assert.doesNotMatch(zero, /Somma le frazioni/);
  assert.match(zero, /data-azione="indizio">Dammi un indizio</);
  assert.match(zero, /data-azione="soluzione">Fammi vedere tutta la soluzione</);
  const uno = run(`htmlIndizi(${JSON.stringify(C)}, 1)`);
  assert.match(uno, /Somma le frazioni spese/);
  assert.doesNotMatch(uno, /Che frazione resta/);
  assert.match(uno, /data-azione="provo">Ho capito, provo io</);
  assert.match(uno, /data-azione="indizio">Un altro indizio</);
  const tutti = run(`htmlIndizi(${JSON.stringify(C)}, 3)`);
  assert.match(tutti, /Che cosa sono gli euro/);
  assert.doesNotMatch(tutti, /Un altro indizio/); // finiti gli indizi
  assert.equal((tutti.match(/class="azione"/g) || []).length, 0); // finiti gli indizi, il pieno non serve più
  const provo = run(`htmlIndizi(${JSON.stringify(C)}, 1, true)`); // «Ho capito, provo io»: niente altri indizi
  assert.match(provo, /Somma le frazioni spese/);
  assert.doesNotMatch(provo, /Che frazione resta|Un altro indizio|Ho capito/);
  assert.match(provo, /Fammi vedere tutta la soluzione/);
  assert.equal(run(`prossimoIndizio(3, 3)`), 3);
  assert.equal(run(`prossimoIndizio(1, 3)`), 2);
});

test("Ho letto così: i dati del testo evidenziati, tutto escapato", () => {
  const h = run(`htmlTestoConDati("Spende 1/6 e <b>465 €</b>, poi 1/6.", ["1/6", "465 €"])`);
  assert.equal((h.match(/<mark class="evidenzia">1\/6<\/mark>/g) || []).length, 2);
  assert.match(h, /&lt;b&gt;<mark class="evidenzia">465 €<\/mark>&lt;\/b&gt;/);
  assert.equal(run(`htmlTestoConDati("niente", [])`), "niente");
  // un dato non si evidenzia dentro un numero più lungo
  assert.equal(run(`htmlTestoConDati("costa 1260 euro, cioè 6 rate", ["6"])`), 'costa 1260 euro, cioè <mark class="evidenzia">6</mark> rate');
});

test("calcoli in formula: frazioni, per e diviso", () => {
  assert.equal(run(`calcoloLatex("1/6 + 2/9 = 3/18 + 4/18 = 7/18")`), "\\frac{1}{6} + \\frac{2}{9} = \\frac{3}{18} + \\frac{4}{18} = \\frac{7}{18}");
  assert.equal(run(`calcoloLatex("70 × 18 = 1260")`), "70 \\times 18 = 1260");
  assert.equal(run(`calcoloLatex("770 : 11 = 70")`), "770 \\div 11 = 70");
  assert.equal(run(`calcoloLatex("465 € + 305 € = 770 €")`), "465\\text{ €} + 305\\text{ €} = 770\\text{ €}");
});

test("soluzione passo per passo: passi numerati da toccare, verifica, trucco; libro diverso detto senza giudicare", () => {
  const h = run(`htmlSoluzioneCompito(${JSON.stringify(C)})`);
  assert.match(h, /<li class="passo" data-passo="1">[\s\S]*<b>Frazioni spese<\/b>/);
  assert.match(h, /data-passo="2"[\s\S]*Collego frazione ed euro/);
  assert.match(h, /Verifica[\s\S]*Rimetto 1260 nel testo/);
  assert.match(h, /class="trucco"[\s\S]*Il trucco da ricordare[\s\S]*Gli euro non sono frazioni/);
  assert.match(h, /Risultato: <b>1260 €<\/b>/);
  assert.doesNotMatch(h, /io ottengo/);
  const diverso = run(`htmlSoluzioneCompito(${JSON.stringify({ ...C, libro_diverso: true, risultato: { valore: "1250", unita: "€" } })})`);
  assert.match(diverso, /Il libro dice 1260 €, io ottengo 1250 €: controlliamo insieme il testo\./);
});

test("barra delle frazioni: tante parti quante dice, colorate quelle giuste", () => {
  const s = run(`svgBarraFrazioni({ parti: 18, colorate: 11, etichetta: "11/18" })`);
  assert.equal((s.match(/<rect /g) || []).length, 18);
  assert.equal((s.match(/data-colorata="1"/g) || []).length, 11);
  assert.match(s, /11\/18/);
  assert.equal(run(`svgBarraFrazioni(null)`), "");
});

test("i compiti di oggi: gli ultimi 5, il più recente in cima, niente doppioni", () => {
  let lista = [];
  for (let i = 0; i < 7; i++) lista = json(`salvaCompito(${JSON.stringify(lista)}, { testo: "es ${i}" }, "2026-11-15T10:0${i}:00Z")`);
  assert.equal(lista.length, 5);
  assert.equal(lista[0].compito.testo, "es 6");
  lista = json(`salvaCompito(${JSON.stringify(lista)}, { testo: "es 4" }, "2026-11-15T11:00:00Z")`);
  assert.equal(lista.length, 5);
  assert.equal(lista[0].compito.testo, "es 4");
  const ieri = json(`salvaCompito([], { testo: "vecchio" }, "2026-11-14T10:00:00Z")`);
  assert.equal(json(`compitiDiOggi(${JSON.stringify([...lista, ...ieri])}, new Date("2026-11-15T18:00:00Z"))`).length, 5);
});

test("i compiti di oggi reggono a una voce rotta nella memoria del telefono", () => {
  assert.equal(json(`compitiDiOggi([null, { quando: "2026-11-15T10:00:00Z" }, { quando: "2026-11-15T10:00:00Z", compito: { testo: "a" } }], new Date("2026-11-15T12:00:00Z"))`).length, 1);
});

test("strategia con un nome prima dei passi, verifica con una ✓ per controllo", () => {
  const L = { ...C, strategia: { nome: "Andare a ritroso", perche: "Si parte dalla fine." },
    verifica: { spiegazione: "Vado avanti.", controlli: [{ testo: "Prima ora: restano 32", calcolo: "48 - (48 : 4 + 4) = 32" }, { testo: "Seconda ora: restano 20", calcolo: "32 - (32 : 4 + 4) = 20" }] } };
  const h = run(`htmlSoluzioneCompito(${JSON.stringify(L)})`);
  assert.ok(h.indexOf("Andare a ritroso") < h.indexOf('class="passi-compito"'), "la strategia viene prima dei passi");
  assert.match(h, /class="strategia"[\s\S]*Strategia: <b>Andare a ritroso<\/b>[\s\S]*Si parte dalla fine/);
  assert.equal((h.match(/class="controllo"/g) || []).length, 2);
  assert.match(h, /<span class="spunta" aria-hidden="true">✓<\/span>[\s\S]*Prima ora: restano 32/);
});

test("Prova tu: campo per la risposta, poi Ci sei o Non ancora con il passo da guardare", () => {
  const p = { testo: "Se 11 fette valgono 770 €, quanto vale 1 fetta?", risultato: { valore: "70", unita: "€" }, calcolo: "770 : 11 = 70", passo: 5, spiegazione: "Dividi 770 per 11." };
  const h = run(`htmlProvaTu(${JSON.stringify(p)}, "pt-1")`);
  assert.match(h, /Prova tu: Se 11 fette valgono 770 €, quanto vale 1 fetta\?/);
  assert.match(h, /<input type="text" id="pt-1"[^>]*inputmode="decimal"/);
  assert.match(h, /data-azione="controlla" data-pt="pt-1">Controlla</);
  assert.match(run(`htmlEsitoProvaTu({ giusto: true, esito: "giusto" }, ${JSON.stringify(p)})`), /●<\/i> Ci sei/);
  const no = run(`htmlEsitoProvaTu({ giusto: false, esito: "sbagliato" }, ${JSON.stringify(p)})`);
  assert.match(no, /✕<\/i> Non ancora: guarda il passo 5/);
  assert.match(no, /Dividi 770 per 11\./);
  assert.match(run(`htmlEsitoProvaTu({ giusto: true, esito: "senza_unita" }, ${JSON.stringify(p)})`), /manca l'unità/);
});

test("limite degli aiuti: il messaggio è quello giusto", () => {
  assert.equal(run(`messaggioModello(new Definitivo("limite_giornaliero"), "x")`), "Per oggi hai usato tutti gli aiuti: riprova domani.");
});
