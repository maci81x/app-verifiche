// Logica di app.js caricata senza browser, come nei test di Shanghai Card.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval });
vm.runInContext(readFileSync(new URL("../app.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../stampa.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../aiuto.js", import.meta.url), "utf8"), ctx);
const run = (expr) => vm.runInContext(expr, ctx);

test("curva del voto del prototipo: 0% vale 3, 60% vale 6, 100% vale 10, al mezzo punto", () => {
  assert.deepEqual([0, 30, 60, 70, 75, 80, 90, 100].map((i) => run(`voto(${i})`)), [3, 4.5, 6, 7, 7.5, 8, 9, 10]);
  assert.equal(run("votoIt(6.5)"), "6,5");
  assert.equal(run("votoIt(7)"), "7");
});

test("indice pesato sui concetti, verdetto come nel prototipo", () => {
  const es = run(`calcolaEsito(
    [{id:"d1",concetto_id:"a",peso:3},{id:"d2",concetto_id:"a",peso:3},{id:"d3",concetto_id:"b",peso:1}],
    {d1:10,d2:6,d3:0})`);
  // a: media 8 (verde) peso 3; b: media 0 (rosso) peso 1 → (8*3+0)/4 = 6 → 60%
  assert.equal(es.indice, 60);
  assert.equal(es.voto, 6);
  assert.equal(es.rossiPesanti, 0); // il rosso pesa 1: non conta fra quelli importanti
  assert.equal(es.pronta, false);
  const tutto = run(`calcolaEsito([{id:"d1",concetto_id:"a",peso:2}],{d1:9})`);
  assert.equal(tutto.pronta, true);
});

test("semaforo: da 8 verde, da 5 giallo, sotto rosso", () => {
  assert.deepEqual([8, 7.9, 5, 4.9].map((m) => run(`statoDaMedia(${m})`)), ["verde", "giallo", "giallo", "rosso"]);
});

test("mescola restituisce sempre tutte le posizioni", () => {
  for (let k = 0; k < 50; k++) assert.equal(run("JSON.stringify(mescola(4).sort())"), "[0,1,2,3]");
});

test("andamento: in salita, in calo o stabile sulle ultime dieci", () => {
  assert.equal(run("andamento([5,6,7]).verso"), "su");
  assert.equal(run("andamento([8,7,6]).verso"), "giu");
  assert.equal(run("andamento([7,7.5,7]).verso"), "pari");
  assert.equal(run("andamento([3,3,3,3,3,10,10,10,10,10,10,10]).voti.length"), 10);
});

test("pagine del materiale: una per foto più una ogni 2000 caratteri scritti", () => {
  assert.equal(run('pagineMateriale(4, "")'), 4);
  assert.equal(run('pagineMateriale(0, "x".repeat(4500))'), 3);
  assert.equal(run('pagineMateriale(0, "")'), 1);
});

test("a voce: lettere, ordinali e testo dell'opzione; nel dubbio non sceglie", () => {
  const opz = JSON.stringify(["Federico II di Svevia", "Carlo Magno", "Lorenzo de' Medici", "Dante Alighieri"]);
  const scegli = (detto) => run(`opzioneDetta(${JSON.stringify(detto)}, ${opz})`);
  assert.equal(scegli("la b"), 1);
  assert.equal(scegli("Lettera C"), 2);
  assert.equal(scegli("di"), 3);
  assert.equal(scegli("la seconda"), 1);
  assert.equal(scegli("Federico secondo di Svevia"), 0);
  assert.equal(scegli("Carlo Magno"), 1);
  assert.equal(scegli("a me sembra difficile"), -1); // "a" dentro una frase non è la lettera A
  assert.equal(scegli(""), -1);
});

test("a voce: riconosce quando non sa", () => {
  assert.equal(run('eNonLoSo("Non lo so")'), true);
  assert.equal(run('eNonLoSo("boh")'), true);
  assert.equal(run('eNonLoSo("non so se è giusto ma credo il 1250")'), false);
});

test("domanda guidata: aperta parte dal primo elemento atteso, chiusa rilegge le opzioni", () => {
  const ap = run(`domandaGuidata({tipo:"aperta", testo:"Perché si chiama siciliana?", elementi:["fiorì in Sicilia","poeti da varie regioni"]})`);
  assert.match(ap, /Parti da qui: fiorì in Sicilia\. Perché si chiama siciliana\?/);
  const ch = run(`domandaGuidata({tipo:"chiusa", testo:"Chi?", opzioni:["x","y","z","w"], _ord:[2,0,1,3]})`);
  assert.match(ch, /A: z\. B: x\. C: y\. D: w\./);
});

test("accesso: la risposta del server decide se entrare, aspettare o riprovare", () => {
  const es = (status, dati) => run(`JSON.stringify(esitoAccesso(${status}, ${JSON.stringify(dati)}))`);
  assert.equal(es(200, { ok: true, access_token: "a", refresh_token: "r" }),
    JSON.stringify({ tipo: "dentro", sessione: { access_token: "a", refresh_token: "r" } }));
  assert.equal(es(401, { ok: false, attendi: 60 }), JSON.stringify({ tipo: "attendi", secondi: 60 }));
  assert.equal(es(401, { ok: false, attendi: 0 }), JSON.stringify({ tipo: "sbagliato" }));
  assert.equal(es(200, { ok: true }), JSON.stringify({ tipo: "errore" })); // senza token non si entra
  assert.equal(es(502, { errore: "x" }), JSON.stringify({ tipo: "errore" }));
  assert.equal(es(401, null), JSON.stringify({ tipo: "sbagliato" }));
  assert.equal(run("testoAttesa(60)"), "Troppi tentativi. Riprova fra 60 secondi.");
  assert.equal(run("testoAttesa(1)"), "Troppi tentativi. Riprova fra 1 secondo.");
});

test("elenco profili: solo righe valide, ognuna con la sua chiave di sessione; l'ultimo usato in cima", () => {
  const l = run(`JSON.stringify(profiliDaElenco([{id:"b",nome:"Mia",classe:"2"},{id:"s",nome:"Samira",classe:null},{id:"x",nome:"  "},null,{nome:"senza id"}]))`);
  assert.deepEqual(JSON.parse(l), [
    { id: "b", nome: "Mia", classe: "2", chiave: "sb-verifiche-b" },
    { id: "s", nome: "Samira", classe: "", chiave: "sb-verifiche-s" },
  ]);
  assert.equal(run("profiliDaElenco({errore:'x'})"), null);
  assert.equal(run(`ordinaProfili([{id:"b"},{id:"s"}], "s").map((p) => p.id).join()`), "s,b");
  assert.equal(run(`ordinaProfili([{id:"b"},{id:"s"}], null).map((p) => p.id).join()`), "b,s");
});

test("il blocco del codice non si calcola più nel browser", () => {
  for (const nome of ["erroreCodice", "secondiBlocco", "leggiBlocco", "salvaBlocco", "MAX_ERRORI", "BLOCCO_MS"])
    assert.equal(run(`typeof ${nome}`), "undefined", nome + " è ancora nel client");
});

test("cosa studiare: stato dell'ultima prova di ogni concetto, rossi in cima, grigio se mai verificato", () => {
  const concetti = [
    { id: "a", titolo: "Arrivo della peste", ancora: "nel 1347", peso: 2, ordine: 0 },
    { id: "b", titolo: "I flagellanti", ancora: "si frustavano", peso: 2, ordine: 1 },
    { id: "c", titolo: "Le cause", ancora: "le pulci dei ratti", peso: 3, ordine: 2 },
    { id: "d", titolo: "Mai chiesto", ancora: "x y", peso: 1, ordine: 3 },
    { id: "e", titolo: "Il contagio", ancora: "per via dei commerci", peso: 1, ordine: 4 },
  ];
  // due prove: la più vecchia (s1) e la più recente (s2)
  const righe = [
    { concetto_id: "a", sessione_id: "s1", data: "2026-10-20T10:00:00Z", punteggio: 2 },
    { concetto_id: "a", sessione_id: "s2", data: "2026-10-28T10:00:00Z", punteggio: 9 },  // ora verde
    { concetto_id: "b", sessione_id: "s1", data: "2026-10-20T10:00:00Z", punteggio: 10 },
    { concetto_id: "b", sessione_id: "s2", data: "2026-10-28T10:00:00Z", punteggio: 3 },  // ora rosso
    { concetto_id: "b", sessione_id: "s2", data: "2026-10-28T10:00:00Z", punteggio: 4 },
    { concetto_id: "c", sessione_id: "s1", data: "2026-10-20T10:00:00Z", punteggio: 6 },  // giallo, non chiesto in s2
    { concetto_id: "e", sessione_id: "s2", data: "2026-10-28T10:00:00Z", punteggio: 0 },  // rosso, una volta
    { concetto_id: null, sessione_id: "s2", data: "2026-10-28T10:00:00Z", punteggio: 0 },  // concetto cancellato
  ];
  const l = JSON.parse(run(`JSON.stringify(cosaStudiare(${JSON.stringify(concetti)}, ${JSON.stringify(righe)}))`));
  assert.deepEqual(l.map((x) => [x.id, x.stato, x.sbagliato]), [
    ["b", "rosso", 2], ["e", "rosso", 1], ["c", "giallo", 1], ["d", "mai", 0], ["a", "verde", 1],
  ]);
  assert.equal(l[0].ancora, "si frustavano");
  assert.equal(run("cosaStudiare([], []).length"), 0);
});

test("cosa studiare: a pari stato prima il concetto sbagliato nella prova più recente", () => {
  const concetti = [{ id: "vecchio", titolo: "V", ancora: "v", peso: 3, ordine: 0 }, { id: "nuovo", titolo: "N", ancora: "n", peso: 1, ordine: 1 }];
  const righe = [
    { concetto_id: "vecchio", sessione_id: "s1", data: "2026-10-01T10:00:00+00:00", punteggio: 0 },
    { concetto_id: "vecchio", sessione_id: "s1", data: "2026-10-01T10:00:00+00:00", punteggio: 0 },
    { concetto_id: "nuovo", sessione_id: "s2", data: "2026-10-28T10:00:00.123+00:00", punteggio: 2 },
  ];
  const l = JSON.parse(run(`JSON.stringify(cosaStudiare(${JSON.stringify(concetti)}, ${JSON.stringify(righe)}))`));
  assert.deepEqual(l.map((x) => [x.id, x.stato]), [["nuovo", "rosso"], ["vecchio", "rosso"]]);
});

// Albero di prova: titoli lunghi apposta, tre livelli, una foglia con una parola lunghissima.
const ALBERO = {
  titolo: "La peste del Trecento e le sue conseguenze sulla società europea", materia: "storia",
  nodi: [
    { id: "k1", titolo: "Arrivo della peste nera in Europa nel 1347 dai porti del Mar Nero", ancora: "nel 1347", fonte: "appunti", peso: 3, figli: [
      { id: "k1-1", titolo: "Le navi genovesi", ancora: "a", fonte: "appunti", figli: [
        { id: "k1-1-1", titolo: "Caffa, in Crimea, assediata dai mongoli", ancora: "b", fonte: "appunti", figli: [] },
        { id: "k1-1-2", titolo: "Precipitevolissimevolmente diffusa", ancora: "c", fonte: "appunti", figli: [] },
      ] },
      { id: "k1-2", titolo: "Messina", ancora: "d", fonte: "appunti", figli: [] },
    ] },
    { id: "k2", titolo: "I flagellanti", ancora: "e", fonte: "appunti", peso: 2, figli: [] },
    { id: "k3", titolo: "Le conseguenze economiche: meno contadini, salari più alti", ancora: "f", fonte: "appunti", peso: 1, figli: [
      { id: "k3-1", titolo: "Rivolte nelle campagne", ancora: "g", fonte: "appunti", figli: [] },
    ] },
  ],
};
const sovrapposti = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const larghezza of [320, 375, 600, 900]) {
  test(`mappa larga ${larghezza}px: tutti i nodi dentro il viewBox e nessuno sopra un altro`, () => {
    const l = JSON.parse(run(`JSON.stringify(layoutMappa(${JSON.stringify(ALBERO)}, ${larghezza}))`));
    assert.equal(l.w, larghezza);
    assert.equal(l.verticale, larghezza < 600);
    assert.equal(l.nodi.length, 9); // radice + 8
    for (const n of l.nodi) {
      assert.ok(n.x >= 0 && n.y >= 0 && n.x + n.w <= l.w && n.y + n.h <= l.h, `${n.id} esce dal viewBox`);
      assert.ok(n.righe.length >= 1 && n.righe.every((r) => r.length <= n.caratteri), `${n.id}: testo più largo del riquadro`);
    }
    for (let i = 0; i < l.nodi.length; i++)
      for (let j = i + 1; j < l.nodi.length; j++)
        assert.ok(!sovrapposti(l.nodi[i], l.nodi[j]), `${l.nodi[i].id} copre ${l.nodi[j].id}`);
    assert.equal(l.linee.length, 8); // una per ogni nodo tranne la radice
    const svg = run(`svgMappa(layoutMappa(${JSON.stringify(ALBERO)}, ${larghezza}), { k1: "rosso" })`);
    assert.match(svg, new RegExp(`viewBox="0 0 ${larghezza} ${l.h}"`));
    assert.equal((svg.match(/class="m-nodo/g) || []).length, 9);
    assert.match(svg, /data-s="rosso"/); // il pallino del concetto
  });
}

test("mappa: in verticale i figli stanno sotto e più a destra del padre; in orizzontale a destra", () => {
  const nodo = (l, id) => l.nodi.find((n) => n.id === id);
  const v = JSON.parse(run(`JSON.stringify(layoutMappa(${JSON.stringify(ALBERO)}, 375))`));
  assert.ok(nodo(v, "k1-1").x > nodo(v, "k1").x && nodo(v, "k1-1").y > nodo(v, "k1").y);
  const o = JSON.parse(run(`JSON.stringify(layoutMappa(${JSON.stringify(ALBERO)}, 900))`));
  assert.ok(nodo(o, "k1-1").x >= nodo(o, "k1").x + nodo(o, "k1").w);
  assert.equal(run(`svgMappa(layoutMappa({ titolo: "<b>x</b>", nodi: [] }, 375), {})`).includes("<b>"), false, "testo non escapato");
});

// ---------------------------------------------------------------- stampa (issue #3)
const INFO = { nome: "Samira", materia: "storia", titolo: "La peste <del> Trecento", data: "2026-10-30T10:00:00Z" };
const stampa = (tipo, dati) => run(`componiStampa(${JSON.stringify({ tipo, info: INFO, dati })})`);
const intestazioneOk = (html) => {
  assert.match(html, /Samira/);
  assert.match(html, /storia/);
  assert.match(html, /La peste &lt;del&gt; Trecento/); // titolo escapato
  assert.doesNotMatch(html, /<del>/);
  assert.doesNotMatch(html, /<button/); // niente pulsanti nel documento
};

test("stampa della mappa: l'SVG e sotto l'elenco dei nodi con le loro ancore", () => {
  const html = stampa("mappa", { albero: { ...ALBERO, nodi: [{ ...ALBERO.nodi[1], ancora: "si frustavano in pubblico" }, ALBERO.nodi[0]] }, stati: { k2: "rosso" } });
  intestazioneOk(html);
  assert.match(html, /<svg class="mappa"/);
  assert.match(html, /Mappa concettuale/);
  assert.match(html, /I flagellanti[\s\S]*si frustavano in pubblico/);
  assert.match(html, /Caffa, in Crimea, assediata dai mongoli/); // anche il terzo livello nell'elenco
});

test("stampa di Cosa studiare: stato con simbolo e parola, volte sbagliato e ancora", () => {
  const html = stampa("studiare", [
    { id: "b", titolo: "I flagellanti", ancora: "si frustavano", stato: "rosso", sbagliato: 2 },
    { id: "d", titolo: "Mai chiesto", ancora: "x y", stato: "mai", sbagliato: 0 },
  ]);
  intestazioneOk(html);
  assert.match(html, /✕[\s\S]*da rifare[\s\S]*I flagellanti[\s\S]*sbagliato 2 volte[\s\S]*si frustavano/);
  assert.match(html, /○[\s\S]*mai verificato[\s\S]*Mai chiesto/);
});

test("verifica da stampare: prima solo le domande, poi su un'altra pagina il foglio soluzioni con le lettere giuste", () => {
  const html = stampa("verifica", [
    { tipo: "chiusa", testo: "Quando arrivò la peste?", opzioni: ["1347", "1492", "1215", "1789"], corretta: 0, _ord: [2, 0, 3, 1] },
    { tipo: "aperta", testo: "Chi erano i flagellanti?", risposta_attesa: "Penitenti che si frustavano in pubblico", elementi: ["penitenti", "frusta"] },
  ]);
  intestazioneOk(html);
  const [domande, soluzioni] = html.split('<section class="st-soluzioni');
  assert.ok(soluzioni, "manca il foglio soluzioni");
  assert.match(domande, /<section class="st-domande/);
  assert.match(domande, /Quando arrivò la peste\?[\s\S]*A\.[\s\S]*1215[\s\S]*B\.[\s\S]*1347[\s\S]*C\.[\s\S]*1789[\s\S]*D\.[\s\S]*1492/);
  assert.match(domande, /Chi erano i flagellanti\?[\s\S]*class="st-righe/);
  assert.doesNotMatch(domande, /Penitenti che si frustavano|penitenti/); // nessuna soluzione fra le domande
  assert.match(soluzioni, /^ st-salto/); // il foglio soluzioni comincia su una pagina nuova
  assert.match(soluzioni, /Soluzioni/);
  assert.match(soluzioni, /B\. 1347/);
  assert.match(soluzioni, /Penitenti che si frustavano in pubblico[\s\S]*penitenti[\s\S]*frusta/);
});

test("stampa dell'esito: voto, prontezza e ogni concetto con simbolo, parola e ancora", () => {
  const html = stampa("esito", { indice: 60, voto: 6, verdetto: "Ci siamo quasi.", righe: [
    { titolo: "Arrivo della peste", media: 9, stato: "verde", ancora: "nel 1347" },
    { titolo: "Le cause", media: 2.5, stato: "rosso", ancora: "le pulci dei ratti", errore_appunti: "negli appunti: 1348" },
    { titolo: "Il contagio", media: 6, stato: "giallo", ancora: "per via dei commerci" },
  ] });
  intestazioneOk(html);
  assert.match(html, /voto stimato 6/i);
  assert.match(html, /prontezza 60%/);
  // dal più debole: rosso, giallo, verde
  assert.match(html, /✕[\s\S]*da rifare[\s\S]*Le cause[\s\S]*le pulci dei ratti[\s\S]*negli appunti: 1348[\s\S]*▲[\s\S]*Il contagio[\s\S]*●[\s\S]*Arrivo della peste/);
});

// ---------------------------------------------------------------- web come aiuto (issue #4)
const CON_WEB = { ...ALBERO, nodi: [{ ...ALBERO.nodi[1], figli: [
  { id: "web-1", titolo: "Penitenti in processione per le strade delle città", testo: "Camminavano frustandosi.", url: "https://www.treccani.it/x", fonte: "web", figli: [] },
] }, ALBERO.nodi[0]] };

for (const larghezza of [375, 900]) {
  test(`mappa con un nodo dal web a ${larghezza}px: etichetta "dal web", colore neutro, dentro il viewBox`, () => {
    const l = JSON.parse(run(`JSON.stringify(layoutMappa(${JSON.stringify(CON_WEB)}, ${larghezza}))`));
    const w = l.nodi.find((n) => n.id === "web-1");
    assert.equal(w.righe.at(-1), "dal web");
    assert.ok(w.x + w.w <= l.w && w.y + w.h <= l.h);
    const svg = run(`svgMappa(layoutMappa(${JSON.stringify(CON_WEB)}, ${larghezza}), {})`);
    assert.match(svg, /<g class="m-nodo" data-id="web-1" data-l="2" data-fonte="web" tabindex="0" role="button"/);
    assert.match(svg, /class="m-etichetta"[^>]*>dal web</);
    assert.match(svg, /<path class="m-linea" data-l="2" data-fonte="web"/);
    assert.doesNotMatch(svg, /data-id="k2" data-l="1" data-fonte="web"/); // i nodi degli appunti restano com'erano
  });
}

test("Spiegamelo meglio: spiegazione, esempio e analogia escapati, fonti cliccabili solo se https", () => {
  const html = run(`htmlSpiegazione(${JSON.stringify({
    spiegazione: "Negli appunti <b>c'è</b> scritto...", esempio: "Pensa a una nave.", analogia: "È come un raffreddore.",
    fonti: [{ titolo: "Peste - Treccani", url: "https://www.treccani.it/enciclopedia/peste" },
            { titolo: "Trappola", url: "javascript:alert(1)" }],
  })})`);
  assert.match(html, /Negli appunti &lt;b&gt;c'è&lt;\/b&gt; scritto/);
  assert.match(html, /Un esempio[\s\S]*Pensa a una nave/);
  assert.match(html, /È come[\s\S]*un raffreddore/);
  assert.match(html, /<a href="https:\/\/www\.treccani\.it\/enciclopedia\/peste" target="_blank" rel="noopener noreferrer">Peste - Treccani<\/a>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /dal web/);
  assert.doesNotMatch(run(`htmlSpiegazione({ spiegazione: "x", esempio: "", analogia: "", fonti: [] })`), /Fonti/);
});
