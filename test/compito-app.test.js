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
  assert.doesNotMatch(zero, /data-azione="soluzione"/); // la soluzione ha il suo bottone, sotto «La tua risposta»
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
  // KaTeX non conosce €: nella formula l'unità non c'è (resta nel testo del passo)
  assert.equal(run(`calcoloLatex("465 € + 305 € = 770 €")`), "465 + 305 = 770");
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
  assert.match(h, /<b>Prova tu:<\/b> Se 11 fette valgono 770 €, quanto vale 1 fetta\?<\/label>/);
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

test("Cosa sai: il dato in grassetto e il suo significato; l'evidenziatura usa il valore", () => {
  const dati = [{ valore: "1/6", significato: "la parte spesa per gli anelli" }, { valore: "305 €", significato: "" }];
  assert.equal(run(`htmlSai(${JSON.stringify(dati)})`), "<li><b>1/6</b>: la parte spesa per gli anelli</li><li><b>305 €</b></li>");
  assert.equal(run(`htmlSai(["2/9"])`), "<li><b>2/9</b></li>"); // compiti salvati prima: stringhe
  assert.match(run(`htmlTestoConDati("ha speso 1/6 e restano 305 €.", ${JSON.stringify(dati)})`), /<mark class="evidenzia">1\/6<\/mark>[\s\S]*<mark class="evidenzia">305 €<\/mark>/);
  assert.equal(run(`htmlSai([{ valore: "<b>", significato: "<i>" }])`), "<li><b>&lt;b&gt;</b>: &lt;i&gt;</li>");
});

// ------------------------------------------------------------------ segnali, esercizi mirati, ripasso 1-3-7 (#27)
const PASSI = [{ titolo: "Frazioni spese", concetto: "Lo stesso denominatore" }, { titolo: "Frazione che resta", concetto: "Trovare cosa resta" },
  { titolo: "Trovo 1/18", concetto: "Trovare l'intero se conosci una parte" }];

test("segnali di difficoltà: indizi, domande e Prova tu sbagliati o saltati, mappati sui concetti dei passi", () => {
  const segnali = [{ tipo: "indizio", passo: 1 }, { tipo: "domanda", passo: 1 }, { tipo: "prova", passo: 1, esito: "sbagliato" },
    { tipo: "domanda", passo: 3 }, { tipo: "prova", passo: 2, esito: "giusto" }, { tipo: "domanda", passo: 0 }];
  assert.deepEqual(json(`concettiDifficili(${JSON.stringify(segnali)}, ${JSON.stringify(PASSI)})`),
    [{ concetto: "Lo stesso denominatore", passo: 1, segnali: 3 }, { concetto: "Trovare l'intero se conosci una parte", passo: 3, segnali: 1 }]);
  assert.deepEqual(json(`concettiDifficili([], ${JSON.stringify(PASSI)})`), []);
  // al massimo 3 concetti
  const tanti = [1, 2, 3, 1, 2, 3, 4].map((p) => ({ tipo: "indizio", passo: p }));
  assert.equal(json(`concettiDifficili(${JSON.stringify(tanti)}, ${JSON.stringify([...PASSI, { titolo: "x", concetto: "Quarto" }])})`).length, 3);
});

test("esercizi mirati: complimento preciso solo con 3 su 3", () => {
  assert.equal(run(`esitoAllenamento("Lo stesso denominatore", [true, true, true])`), "«Lo stesso denominatore» adesso lo sai fare: 3 su 3.");
  assert.equal(run(`esitoAllenamento("Lo stesso denominatore", [true, false, true])`), "2 su 3: rifai quello segnato Non ancora, poi provane uno in più.");
});

test("ripasso a 1, 3 e 7 giorni; dopo un errore si riparte da 1", () => {
  const v = json(`nuovoRipasso({ testo: "Paolo…" }, new Date("2026-11-15T10:00:00Z"))`);
  assert.equal(v.giorni, 1); assert.equal(v.prossimo, "2026-11-16");
  assert.deepEqual(json(`ripassiDovuti([${JSON.stringify(v)}], new Date("2026-11-15T20:00:00Z"))`), []);
  assert.equal(json(`ripassiDovuti([${JSON.stringify(v)}], new Date("2026-11-16T08:00:00Z"))`).length, 1);
  const tre = json(`aggiornaRipasso(${JSON.stringify(v)}, true, new Date("2026-11-16T08:00:00Z"))`);
  assert.equal(tre.giorni, 3); assert.equal(tre.prossimo, "2026-11-19");
  const sette = json(`aggiornaRipasso(${JSON.stringify(tre)}, true, new Date("2026-11-19T08:00:00Z"))`);
  assert.equal(sette.giorni, 7); assert.equal(sette.prossimo, "2026-11-26");
  assert.equal(json(`aggiornaRipasso(${JSON.stringify(sette)}, true, new Date("2026-11-26T08:00:00Z"))`).finito, true);
  const daCapo = json(`aggiornaRipasso(${JSON.stringify(sette)}, false, new Date("2026-11-26T08:00:00Z"))`);
  assert.equal(daCapo.giorni, 1); assert.equal(daCapo.prossimo, "2026-11-27");
  assert.deepEqual(json(`ripassiDovuti([{ ...${JSON.stringify(sette)}, finito: true }, null], new Date("2026-12-30T08:00:00Z"))`), []);
});

test("revisione: esito dell'allenamento al plurale, date del ripasso giuste anche col cambio d'ora", () => {
  assert.equal(run(`esitoAllenamento("X", [false, false, true])`), "1 su 3: rifai quelli segnati Non ancora, poi provane uno in più.");
  // 28 marzo 2027: in Italia si passa all'ora legale; il ripasso dopo 1 giorno è il 29
  assert.equal(json(`nuovoRipasso({ testo: "a" }, new Date("2027-03-27T23:30:00Z"))`).prossimo, "2027-03-29");
  assert.equal(json(`nuovoRipasso({ testo: "a" }, new Date("2027-03-28T10:00:00Z"))`).prossimo, "2027-03-29");
});

/* ---- soluzione bloccata finché non si prova (decisione di Roby sulla #27) ---- */
test("soluzione bloccata senza tentativi; sbloccata dopo un indizio e una risposta provata", () => {
  assert.equal(run(`soluzioneSbloccata(${JSON.stringify(C)})`), false);
  const conIndizio = json(`conSblocco(${JSON.stringify(C)}, "indizio")`);
  assert.equal(run(`soluzioneSbloccata(${JSON.stringify(conIndizio)})`), false);
  const soloRisposta = json(`conSblocco(${JSON.stringify(C)}, "risposta")`);
  assert.equal(run(`soluzioneSbloccata(${JSON.stringify(soloRisposta)})`), false);
  const tutti = json(`conSblocco(conSblocco(${JSON.stringify(C)}, "risposta"), "indizio")`);
  assert.equal(run(`soluzioneSbloccata(${JSON.stringify(tutti)})`), true);
  assert.equal(C.sblocco, undefined); // il compito di partenza non cambia
  assert.match(run("MSG_BLOCCATA"), /^Prima prova tu: leggi un indizio e scrivi la tua risposta, anche se non sei sicur\*\. Poi ti faccio vedere tutto\.$/);
});

test("lo sblocco si ricorda per quel compito: riaperto da I compiti di oggi resta sbloccato", () => {
  const sbloccato = json(`conSblocco(conSblocco(${JSON.stringify(C)}, "indizio"), "risposta")`);
  const lista = json(`salvaCompito(salvaCompito([], ${JSON.stringify(C)}, "2026-11-15T18:00:00Z"), ${JSON.stringify(sbloccato)}, "2026-11-15T18:05:00Z")`);
  assert.equal(lista.length, 1);
  assert.equal(run(`soluzioneSbloccata(${JSON.stringify(lista[0].compito)})`), true);
});

test("esito della risposta provata prima della soluzione: non svela il risultato", () => {
  const no = run(`htmlEsitoTentativo({ giusto: false, esito: "sbagliato" }, ${JSON.stringify(C)})`);
  assert.match(no, /Non ancora/);
  assert.doesNotMatch(no, /1260/);
  assert.match(run(`htmlEsitoTentativo({ giusto: true, esito: "giusto" }, ${JSON.stringify(C)})`), /Ci sei/);
  assert.match(run(`htmlEsitoTentativo({ giusto: true, esito: "senza_unita" }, ${JSON.stringify(C)})`), /manca l'unità: €/);
});
