// Logica di app.js caricata senza browser, come nei test di Shanghai Card.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ console, Math, Date, JSON, Promise, URL, setTimeout, clearTimeout, setInterval, clearInterval });
vm.runInContext(readFileSync(new URL("../soldi.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../semaforo.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../app.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../libreria.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../stampa.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../aiuto.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../mappa-card.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../figure.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../formule.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../esercizi.js", import.meta.url), "utf8"), ctx);
vm.runInContext(readFileSync(new URL("../prova-esercizi.js", import.meta.url), "utf8"), ctx);
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
  assert.equal(es(200, { ok: true, access_token: "a", refresh_token: "r", id: "s1", nome: "Ada", classe: "2", nome_utente: "ada-k7m" }),
    JSON.stringify({ tipo: "dentro", sessione: { access_token: "a", refresh_token: "r" }, profilo: { id: "s1", nome: "Ada", classe: "2", nome_utente: "ada-k7m" } }));
  assert.equal(es(401, { ok: false, attendi: 60 }), JSON.stringify({ tipo: "attendi", secondi: 60 }));
  assert.equal(es(401, { ok: false, attendi: 0 }), JSON.stringify({ tipo: "sbagliato" }));
  assert.equal(es(403, { errore: "famiglia_sospesa" }), JSON.stringify({ tipo: "sospesa" }));
  assert.equal(es(200, { ok: true }), JSON.stringify({ tipo: "errore" })); // senza token non si entra
  assert.equal(es(200, { ok: true, access_token: "a", refresh_token: "r" }), JSON.stringify({ tipo: "errore" })); // senza profilo nemmeno
  assert.equal(es(502, { errore: "x" }), JSON.stringify({ tipo: "errore" }));
  assert.equal(es(401, null), JSON.stringify({ tipo: "sbagliato" }));
  assert.equal(run("testoAttesa(60)"), "Troppi tentativi. Riprova fra 60 secondi.");
  assert.equal(run("testoAttesa(1)"), "Troppi tentativi. Riprova fra 1 secondo.");
  assert.equal(run("testoAttesa(3600)"), "Troppi tentativi. Riprova fra 60 minuti.");
  assert.equal(run("testoAttesa(86400)"), "Troppi tentativi. Riprova fra 24 ore, oppure chiedi al tuo genitore di cambiare il codice.");
});

test("profili salvati: il nome della v34 diventa il nome utente; l'ultimo usato in cima", () => {
  assert.equal(run(`nomeUtenteVecchio("  Ada ")`), "ada");
  assert.equal(run(`nomeUtenteVecchio("Maria Chiara")`), "maria chiara");
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
    const conStati = JSON.parse(run(`JSON.stringify(layoutMappa(${JSON.stringify(ALBERO)}, ${larghezza}, MAPPA.carattere, { k1: "rosso", k2: "verde" }))`));
    for (const n of conStati.nodi)
      assert.ok(n.x + n.w <= conStati.w && n.y + n.h <= conStati.h && n.righe.every((r) => r.length <= n.caratteri), `${n.id} con lo stato esce dal riquadro`);
    const svg = run(`svgMappa(layoutMappa(${JSON.stringify(ALBERO)}, ${larghezza}, MAPPA.carattere, { k1: "rosso", k2: "verde" }))`);
    assert.match(svg, new RegExp(`viewBox="0 0 ${larghezza} ${conStati.h}"`));
    assert.equal((svg.match(/class="m-nodo/g) || []).length, 9);
    // Semaforo con colore (data-s), forma e parola; i sotto-punti prendono lo stato del concetto.
    assert.match(svg, /data-id="k1" data-l="1" data-s="rosso"/);
    assert.match(svg, /data-id="k1-1-2" data-l="3" data-s="rosso"/);
    assert.match(svg, /data-id="k2" data-l="1" data-s="verde"/);
    assert.match(svg, /data-id="k3" data-l="1" data-s="mai"/);
    assert.match(svg.replace(/<\/tspan><tspan class="m-stato"[^>]*>/g, " "), /✕ Da ripassare/);
    assert.match(svg.replace(/<\/tspan><tspan class="m-stato"[^>]*>/g, " "), /● Lo sai/);
    assert.match(svg, /aria-label="I flagellanti, Lo sai"/);
    assert.match(svg, /aria-pressed="false"/);
    assert.doesNotMatch(svg, /data-id="radice"[^>]*data-s=/, "la radice non ha semaforo");
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
const INFO = { nome: "Leo", materia: "storia", titolo: "La peste <del> Trecento", data: "2026-10-30T10:00:00Z" };
const stampa = (tipo, dati) => run(`componiStampa(${JSON.stringify({ tipo, info: INFO, dati })})`);
const intestazioneOk = (html) => {
  assert.match(html, /Leo/);
  assert.match(html, /storia/);
  assert.match(html, /La peste &lt;del&gt; Trecento/); // titolo escapato
  assert.doesNotMatch(html, /<del>/);
  assert.doesNotMatch(html, /<button/); // niente pulsanti nel documento
};

test("stampa della mappa: l'SVG e sotto l'elenco dei nodi con le loro ancore", () => {
  const html = stampa("mappa", { albero: { ...ALBERO, nodi: [{ ...ALBERO.nodi[1], ancora: "si frustavano in pubblico" }, ALBERO.nodi[0]] }, stati: { k2: "rosso" } });
  intestazioneOk(html);
  assert.match(html, /<svg class="mappa"/);
  assert.match(html, /Mappa dell'argomento/);
  assert.match(html, /I flagellanti[\s\S]*<mark class="evidenzia">si frustavano in pubblico<\/mark>/);
  assert.match(html, /Caffa, in Crimea, assediata dai mongoli/); // anche il terzo livello nell'elenco
});

test("stampa di Cosa studiare: stato con simbolo e parola, volte sbagliato e ancora", () => {
  const html = stampa("studiare", [
    { id: "b", titolo: "I flagellanti", ancora: "si frustavano", stato: "rosso", sbagliato: 2 },
    { id: "d", titolo: "Mai chiesto", ancora: "x y", stato: "mai", sbagliato: 0 },
  ]);
  intestazioneOk(html);
  assert.match(html, /✕ Da ripassare[\s\S]*I flagellanti[\s\S]*2 volte da rivedere[\s\S]*<mark class="evidenzia">si frustavano<\/mark>/);
  assert.match(html, /○ Ancora da provare[\s\S]*Mai chiesto/);
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
  assert.match(html, /✕ Da ripassare[\s\S]*Le cause[\s\S]*<mark class="evidenzia">le pulci dei ratti<\/mark>[\s\S]*Sul quaderno c'è un errore: 1348[\s\S]*▲[\s\S]*Il contagio[\s\S]*●[\s\S]*Arrivo della peste/);
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
    assert.match(svg, /<g class="m-nodo" data-id="web-1" data-l="2" data-fonte="web" data-s="web" tabindex="0" role="button" aria-pressed="false"/);
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

// ---------------------------------------------------------------- esercizi di matematica (issue #5)

test("Teoria/Esercizi solo per le materie di matematica, con le varianti", () => {
  for (const m of ["Matematica", "aritmetica", "Geometria", "ALGEBRA", "matematica e geometria"]) assert.equal(run(`eMatematica(${JSON.stringify(m)})`), true, m);
  for (const m of ["storia", "scienze", "", "italiano"]) assert.equal(run(`eMatematica(${JSON.stringify(m)})`), false, m);
});

test("libreria: un argomento di esercizi conta i tipi, gli altri i concetti", () => {
  assert.equal(run(`contaVoci({ percorso: "teoria", concetti: [1, 2, 3] })`), "3 punti da studiare");
  assert.equal(run(`contaVoci({ concetti: [1] })`), "1 punto da studiare");
  assert.equal(run(`contaVoci({ percorso: "esercizi", concetti: [], tipi: [{}, {}] })`), "2 tipi di esercizio");
  assert.equal(run(`contaVoci({ percorso: "esercizi", concetti: [], tipi: [{}] })`), "1 tipo di esercizio");
});

test("checklist: si salvano solo i tipi spuntati, in ordine dopo quelli già salvati", () => {
  const righe = run(`righeTipi("arg", [
    { titolo: "Frazioni", ancora: "3/4 + 1/2", difficolta: 2, figura: false },
    { titolo: "Pitagora", ancora: "cateti 6 e 8", difficolta: 3, figura: true },
    { titolo: "Potenze", ancora: "2^3 + 5^2", difficolta: 1 }], [true, false, true], 4)`);
  assert.deepEqual(JSON.parse(JSON.stringify(righe)), [
    { argomento_id: "arg", titolo: "Frazioni", ancora: "3/4 + 1/2", difficolta: 2, figura: false, ordine: 4 },
    { argomento_id: "arg", titolo: "Potenze", ancora: "2^3 + 5^2", difficolta: 1, figura: false, ordine: 5 },
  ]);
  assert.equal(run(`righeTipi("arg", [{ titolo: "x", ancora: "y", difficolta: 1 }], [false]).length`), 0);
});

test("lettura degli esercizi vuota se non c'è testo o se tutti i gruppi erano illeggibili", () => {
  assert.equal(run(`lettoVuoto([])`), true);
  assert.equal(run(`lettoVuoto([GRUPPO_ILLEGGIBILE, GRUPPO_ILLEGGIBILE])`), true);
  assert.equal(run(`lettoVuoto([GRUPPO_ILLEGGIBILE, "45) 3/4 + 1/2 ="])`), false);
});

// ---------------------------------------------------------------- esercizi simili (issue #5, fetta #7)

const ESERCIZIO = {
  tipo: "Teorema di <Pitagora>", testo: "Calcola l'ipotenusa con i cateti di 9 cm e 12 cm.", dati: "cateti 9 cm e 12 cm",
  figura: { forma: "triangolo_rettangolo", misure: [{ nome: "cateto1", valore: "12 cm" }, { nome: "ipotenusa", valore: "?" }] },
  passaggi: [{ testo: "Applico Pitagora", formula: "\\sqrt{9^{2} + 12^{2}}" }], risultato: { valore: "15", unita: "cm" },
};

test("esercizio: consegna, dati e figura in vista; passaggi e risultato solo dentro la soluzione", () => {
  const html = run(`htmlEsercizio(${JSON.stringify(ESERCIZIO)}, 2)`);
  assert.match(html, /Esercizio 3: Teorema di &lt;Pitagora&gt;/);
  assert.match(html, /<svg [^>]*class="figura"/);
  const [fuori, dentro] = html.split("<details>");
  assert.doesNotMatch(fuori, /15 cm|Applico/, "la soluzione non si vede prima di chiederla");
  assert.match(dentro, /Mostra la soluzione/);
  assert.match(dentro, /Applico Pitagora[\s\S]*data-latex="\\sqrt\{9\^\{2\} \+ 12\^\{2\}\}"[^>]*>√\(9² \+ 12²\)/);
  assert.match(dentro, /Risultato: <b>15 cm<\/b>/);
  const senza = run(`htmlEsercizio(${JSON.stringify({ ...ESERCIZIO, figura: null, dati: "", risultato: { valore: "3/4", unita: "" } })}, 0)`);
  assert.doesNotMatch(senza, /<svg|Dati:/);
  assert.match(senza, /Risultato: <b>3\/4<\/b>/);
});

test("nota sugli esercizi scartati dal ricalcolo", () => {
  assert.equal(run("notaScartatiEsercizi(0)"), "");
  assert.match(run("notaScartatiEsercizi(1)"), /^Ho tolto 1 esercizio:/);
  assert.match(run("notaScartatiEsercizi(3)"), /^Ho tolto 3 esercizi:/);
});

// ---------------------------------------------------------------- prova di esercizi (issue #5, fetta #8)

const PROVA = [
  { tipo_id: "t-fr", tipo: "Frazioni", testo: "Calcola 3/4 + 1/2", risultato: { valore: "5/4", unita: "" }, passaggi: [{ testo: "Denominatore comune", formula: "\\frac{3}{4}+\\frac{2}{4}" }] },
  { tipo_id: "t-pi", tipo: "Pitagora", testo: "Ipotenusa con cateti 9 cm e 12 cm", risultato: { valore: "15", unita: "cm" }, passaggi: [] },
  { tipo_id: "t-fr", tipo: "Frazioni", testo: "Calcola 2/3 - 1/6", risultato: { valore: "1/2", unita: "" }, passaggi: [] },
];

test("esito per tipo: media e semaforo di ogni tipo, ogni tipo pesa uguale nel voto", () => {
  const es = JSON.parse(JSON.stringify(run(`esitoPerTipo(${JSON.stringify(PROVA)}, [10, 5, 0])`)));
  assert.deepEqual(es.righe.map((r) => [r.titolo, r.n, r.media, r.stato]), [["Frazioni", 2, 5, "giallo"], ["Pitagora", 1, 5, "giallo"]]);
  assert.equal(es.indice, 50);
  assert.equal(es.voto, run("voto(50)"));
  assert.equal(run(`esitoPerTipo([], []).indice`), 0);
});

test("aprire la soluzione prima di correggere vale al massimo 5 punti", () => {
  assert.equal(run("puntiConAiuto(10, true)"), 5);
  assert.equal(run("puntiConAiuto(0, true)"), 0);
  assert.equal(run("puntiConAiuto(8, false)"), 8);
});

test("correzione: risposta e risultato affiancati, passaggi con il primo errore cerchiato, tipo, spiegazione ed esempio", () => {
  const giusta = run(`htmlCorrezione({ esito: "giusto", punti: 10, risposta: "5/4" }, ${JSON.stringify(PROVA[0])})`);
  assert.match(giusta, /data-s="verde"[\s\S]*✓<\/span> Giusto[\s\S]*10\/10/);
  assert.match(giusta, /La tua risposta<\/span><b>5\/4<\/b>[\s\S]*Risultato giusto<\/span><b>5\/4<\/b>/);
  assert.doesNotMatch(giusta, /Ecco come si fa/);
  const sbagliata = run(`htmlCorrezione({ esito: "sbagliato", punti: 0, risposta: "4/6", svolgimento: "3/4 + 1/2 = 4/6 <b>\\n4/6 = 2/3",
    primo_errore: "3/4 + 1/2 = 4/6 <b>", tipo_errore: "calcolo", spiegazione: "Hai sommato i denominatori.", esempio: "1/3 + 1/3 = 2/3" }, ${JSON.stringify(PROVA[0])})`);
  assert.match(sbagliata, /class="corretto" data-s="rosso"/);
  assert.match(sbagliata, /class="box-risp" data-s="rosso"><span class="etich">La tua risposta<\/span><b>4\/6<\/b>/);
  assert.match(sbagliata, /<li class="errore-cerchiato"><span class="vedi">primo errore<\/span> 3\/4 \+ 1\/2 = 4\/6 &lt;b&gt;<\/li><li>4\/6 = 2\/3<\/li>/);
  assert.match(sbagliata, /etichetta-errore">errore di calcolo[\s\S]*Hai sommato i denominatori[\s\S]*Esempio svolto[\s\S]*Ecco come si fa[\s\S]*Risultato: <b>5\/4<\/b>/);
  assert.match(run(`htmlCorrezione({ esito: "senza_unita", punti: 5, vista: true }, ${JSON.stringify(PROVA[1])})`), /data-s="giallo"[\s\S]*manca l'unità[\s\S]*Avevi aperto la soluzione/);
  // Passaggio sbagliato che non si ritrova nelle righe: compare da solo, segnato.
  assert.match(run(`righePassaggi("a = 1\\nb = 2", "c = 3").map((r) => r.t + (r.errore ? "!" : "")).join("|")`), /^a = 1\|b = 2\|c = 3!$/);
  // Spazi e segni di per diversi: si cerchia la riga, non si aggiunge un doppione.
  assert.equal(run(`righePassaggi("7 × 2 = 15\\n15 + 1 = 16", "7x2=15").map((r) => r.t + (r.errore ? "!" : "")).join("|")`), "7 × 2 = 15!|15 + 1 = 16");
  // Il passaggio citato con il contesto: vince la riga più lunga che combacia, non quella corta prima.
  assert.equal(run(`righePassaggi("x = 5\\nx + 3 = 9", "da x = 5 hai scritto x + 3 = 9").filter((r) => r.errore).map((r) => r.t).join()`), "x + 3 = 9");
});

test("prova salvata con i valori già ammessi: domande aperte, livello medio, tipo come concetto, esercizio completo", () => {
  const righe = JSON.parse(JSON.stringify(run(`righeDomandeEsercizi("s1", "a1", ${JSON.stringify(PROVA)}, { "t-fr": "3/4 + 1/2 =" })`)));
  assert.equal(righe.length, 3);
  assert.deepEqual(righe.map((r) => [r.ordine, r.tipo, r.livello, r.concetto_titolo, r.concetto_id]),
    [[1, "aperta", "medio", "Frazioni", null], [2, "aperta", "medio", "Pitagora", null], [3, "aperta", "medio", "Frazioni", null]]);
  assert.equal(righe[1].risposta_attesa, "15 cm");
  assert.equal(righe[0].ancora, "3/4 + 1/2 =");
  assert.equal(righe[1].ancora, PROVA[1].testo, "senza ancora del tipo vale la consegna");
  assert.equal(righe[0].esercizio.testo, "Calcola 3/4 + 1/2");
  assert.match(run("htmlRispostaEsercizio(2)"), /id="ris-es-2"[\s\S]*id="pas-es-2"[\s\S]*id="foto-es-2"[\s\S]*id="cor-es-2"/);
});

// ---------------------------------------------------------------- stampa degli esercizi (issue #5, fetta #9)

const DA_STAMPARE = [
  { tipo_id: "t-pi", tipo: "Pitagora", testo: "Calcola l'ipotenusa con i cateti di 9 cm e 12 cm.", dati: "cateti 9 cm e 12 cm",
    figura: { forma: "triangolo_rettangolo", misure: [{ nome: "cateto1", valore: "12 cm" }, { nome: "cateto2", valore: "9 cm" }, { nome: "ipotenusa", valore: "?" }] },
    passaggi: [{ testo: "Applico il teorema di Pitagora", formula: "\\sqrt{9^{2} + 12^{2}}" }, { testo: "Calcolo la radice", formula: "\\sqrt{225} = 15" }],
    risultato: { valore: "15", unita: "cm" } },
  { tipo_id: "t-fr", tipo: "Frazioni", testo: "Calcola 3/4 + 1/2", dati: "", figura: null,
    passaggi: [{ testo: "Porto allo stesso denominatore", formula: "\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}" }],
    risultato: { valore: "5/4", unita: "" } },
];

test("scheda esercizi: ogni esercizio con la sua figura e i quadretti, nessuna soluzione prima del salto pagina", () => {
  const html = run(`componiStampa({ tipo: "esercizi", info: { titolo: "Pitagora", materia: "matematica", nome: "Anna" }, dati: ${JSON.stringify(DA_STAMPARE)} })`);
  assert.match(html, /<p class="st-tipo">Esercizi<\/p>/);
  const [scheda, soluzioni] = html.split('<section class="st-soluzioni st-salto">');
  assert.ok(soluzioni, "le soluzioni stanno in una sezione con il salto pagina");
  assert.equal((scheda.match(/class="st-quesito st-esercizio"/g) || []).length, 2);
  assert.equal((scheda.match(/<svg [^>]*class="figura"/g) || []).length, 1, "figura solo dove c'è");
  assert.equal((scheda.match(/class="st-quadretti"/g) || []).length, 2, "spazio quadrettato per ogni esercizio");
  assert.match(scheda, /Calcola l'ipotenusa[\s\S]*<svg [^>]*class="figura"[\s\S]*st-quadretti[\s\S]*Calcola 3\/4/);
  assert.doesNotMatch(scheda, /Risultato|Applico|5\/4|15 cm|Porto/, "nessuna soluzione nella scheda");
  assert.match(soluzioni, /Applico il teorema di Pitagora[\s\S]*Risultato: 15 cm[\s\S]*Porto allo stesso denominatore[\s\S]*Risultato: 5\/4/);
  assert.match(soluzioni, /√\(9² \+ 12²\)/, "formule leggibili anche senza KaTeX");
});

test("quadretti: dentro il loro viewBox, più alti per gli esercizi con più passaggi", () => {
  const q = run("svgQuadretti(40)");
  assert.match(q, /viewBox="0 0 180 40"/);
  for (const m of q.matchAll(/[xy][12]="([\d.]+)"/g)) assert.ok(+m[1] >= 0 && +m[1] <= 180);
  assert.ok(run(`spazioSvolgimento(${JSON.stringify(DA_STAMPARE[0])})`) > run(`spazioSvolgimento(${JSON.stringify(DA_STAMPARE[1])})`));
  assert.equal(run("spazioSvolgimento({ passaggi: [] })"), 30);
  assert.equal(run("spazioSvolgimento({ passaggi: new Array(20).fill({}) })"), 90);
});

test("esito degli esercizi da stampare: semaforo per tipo con simbolo e parola, poi ogni esercizio", () => {
  const dati = run(`datiEsitoEsercizi(${JSON.stringify(DA_STAMPARE)}, [{ esito: "giusto", punti: 10, risposta: "15 cm" }, { esito: "sbagliato", punti: 0, risposta: "4/6" }])`);
  const html = run(`componiStampa({ tipo: "esito_esercizi", info: { titolo: "Pitagora", materia: "matematica" }, dati: ${JSON.stringify(dati)} })`);
  assert.match(html, /Com'è andata con gli esercizi/);
  assert.match(html, /✕ Da ripassare<\/span><b>Frazioni<\/b>[\s\S]*● Lo sai<\/span><b>Pitagora<\/b>/, "dal tipo peggiore, con simbolo e parola");
  assert.match(html, /0,0\/10, 1 esercizio/);
  assert.match(html, /Hai scritto: 4\/6\. Risultato giusto: 5\/4[\s\S]*Non ancora<\/b>, 0\/10/);
  assert.match(html, /Voto della prova /);
});

// ------------------------------------------------------------------ mappa interattiva (issue #11)
test("semaforo: sempre forma e parola insieme al colore; stato sconosciuto = mai provato", () => {
  assert.equal(run(`htmlStato("rosso")`), '<span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Da ripassare</span>');
  assert.equal(run(`htmlStato("verde")`), '<span class="sem" data-s="verde"><i aria-hidden="true">●</i> Lo sai</span>');
  assert.match(run(`htmlStato("giallo")`), /▲<\/i> Quasi/);
  assert.match(run(`htmlStato("boh")`), /data-s="mai"><i aria-hidden="true">○<\/i> Ancora da provare/);
  assert.equal(run(`htmlStato("__proto__")`).includes('data-s="mai"'), true);
});

test("stati dei nodi: i sotto-punti prendono lo stato del concetto, il web resta web", () => {
  const albero = { nodi: [
    { id: "c1", fonte: "appunti", figli: [{ id: "c1-1", fonte: "appunti", figli: [{ id: "c1-1-1", fonte: "appunti", figli: [] }, { id: "web-1", fonte: "web", figli: [] }] }] },
    { id: "c2", fonte: "appunti", figli: [] },
  ] };
  assert.deepEqual(JSON.parse(run(`JSON.stringify(statiNodi(${JSON.stringify(albero)}, { c1: "rosso" }))`)),
    { c1: "rosso", "c1-1": "rosso", "c1-1-1": "rosso", "web-1": "web", c2: "mai" });
  assert.equal(run(`concettoDelNodo(${JSON.stringify(albero)}, "c1-1-1").id`), "c1");
  assert.equal(run(`concettoDelNodo(${JSON.stringify(albero)}, "web-1")`), null);
});

test("card del nodo: ancora, avviso degli appunti, in breve, prova e spiegazione; tutto escapato", () => {
  const concetto = { id: "c1", titolo: "Le vittime", ancora: "Uccise circa un terzo della popolazione.", fonte: "appunti", sintesi: "La peste uccise una persona su tre.", figli: [] };
  const html = run(`htmlCardNodo(${JSON.stringify(concetto)}, { concetto: ${JSON.stringify(concetto)}, errore: "negli appunti: un quarto", stato: "rosso" })`);
  assert.match(html, /<h3 id="card-nodo-titolo">Le vittime<\/h3>/);
  assert.match(html, /✕<\/i> Da ripassare/);
  assert.match(html, /Dai tuoi appunti<\/p><blockquote class="quaderno"><mark class="evidenzia">Uccise circa un terzo della popolazione\.<\/mark><\/blockquote>/);
  assert.match(html, /class="avviso-appunti" role="note">Sul quaderno c'è un errore: un quarto</);
  assert.match(html, /In breve<\/p><p class="in-breve" data-tipo="ok" aria-live="polite">La peste uccise una persona su tre\.<\/p>/);
  assert.match(html, /data-azione="prova">Mettiti alla prova<\/button>/);
  assert.match(html, /data-azione="spiega">Spiegamelo meglio<\/button>/);
  assert.match(html, /data-azione="chiudi" aria-label="Chiudi">✕/);
  const cattivo = run(`htmlCardNodo({ titolo: "<img src=x onerror=alert(1)>", ancora: "<script>", fonte: "appunti" }, { stato: "mai" })`);
  assert.equal(/<img|<script/.test(cattivo), false);
});

test("card: riassunto in preparazione, non ancora pronto, o non sicuro (issue #13)", () => {
  const senza = { id: "c1", titolo: "T", ancora: "a b", fonte: "appunti", figli: [] };
  assert.match(run(`htmlCardNodo(${JSON.stringify(senza)}, { concetto: ${JSON.stringify(senza)}, stato: "mai", sintesiInArrivo: true })`),
    /data-tipo="attesa" aria-live="polite">Sto preparando il riassunto…/);
  assert.match(run(`htmlCardNodo(${JSON.stringify(senza)}, { concetto: ${JSON.stringify(senza)}, stato: "mai" })`), /data-tipo="vecchia" aria-live="polite">Il riassunto non c'è ancora/);
  const vuoto = { ...senza, sintesi: "" };
  assert.match(run(`htmlCardNodo(${JSON.stringify(vuoto)}, { concetto: ${JSON.stringify(vuoto)}, stato: "mai" })`), /data-tipo="vuota" aria-live="polite">Su questo punto non ho un riassunto affidabile/);
  // Anche con la sintesi in arrivo, i pulsanti restano: niente si blocca.
  assert.match(run(`htmlCardNodo(${JSON.stringify(senza)}, { concetto: ${JSON.stringify(senza)}, stato: "mai", sintesiInArrivo: true })`), /data-azione="prova"/);
});

test("mappa subito (issue #13): scheletro dai concetti, sintesi unite senza toccare l'albero di partenza", () => {
  const a = { titolo: "La peste", materia: "storia", concetti: [{ id: "c2", titolo: "Due", ancora: "b", ordine: 1 }, { id: "c1", titolo: "Uno", ancora: "a", ordine: 0, peso: 3 }] };
  const prov = JSON.parse(run(`JSON.stringify(alberoProvvisorio(${JSON.stringify(a)}))`));
  assert.deepEqual(prov.nodi.map((n) => [n.id, n.fonte, n.figli.length]), [["c1", "appunti", 0], ["c2", "appunti", 0]]);
  assert.equal(run(`mancanoSintesi(${JSON.stringify(prov)})`), true);
  const unito = JSON.parse(run(`(() => { const p = alberoProvvisorio(${JSON.stringify(a)}); const u = conSintesi(p, { c1: "Prima frase.", c2: "" });
    return JSON.stringify({ u, p }); })()`));
  assert.deepEqual(unito.u.nodi.map((n) => n.sintesi), ["Prima frase.", ""]);
  assert.ok(unito.p.nodi.every((n) => !("sintesi" in n)), "l'albero di partenza non cambia");
  assert.equal(run(`mancanoSintesi(${JSON.stringify(unito.u)})`), false);
  // I nodi dal web non hanno sintesi e non contano.
  assert.equal(run(`mancanoSintesi({ nodi: [{ id: "w", fonte: "web" }, { id: "c1", fonte: "appunti", sintesi: "" }] })`), false);
});

test("card di un sotto-punto: la sua ancora, il riassunto e la prova del suo concetto", () => {
  const c = { id: "c1", titolo: "Le conseguenze", ancora: "Conseguenze", fonte: "appunti", sintesi: "Mancano contadini.", figli: [] };
  const sp = { id: "c1-2", titolo: "Aumentano i salari", ancora: "i salari aumentano", fonte: "appunti", figli: [] };
  const html = run(`htmlCardNodo(${JSON.stringify(sp)}, { concetto: ${JSON.stringify(c)}, stato: "giallo" })`);
  assert.match(html, /<blockquote class="quaderno"><mark class="evidenzia">i salari aumentano<\/mark><\/blockquote>/);
  assert.match(html, /In breve, su «Le conseguenze»/);
  assert.match(html, /Mettiti alla prova su «Le conseguenze»/);
});

test("card di un nodo dal web: etichetta, testo e fonte, niente prova", () => {
  const w = { id: "web-1", titolo: "Quarantena", testo: "Quaranta giorni di isolamento.", url: "https://it.wikipedia.org/wiki/Quarantena", fonte: "web", figli: [] };
  const html = run(`htmlCardNodo(${JSON.stringify(w)}, { stato: "web" })`);
  assert.match(html, /etichetta-web">dal web/);
  assert.match(html, /Quaranta giorni di isolamento\./);
  assert.match(html, /it\.wikipedia\.org/);
  assert.doesNotMatch(html, /data-azione="prova"/);
});

// ------------------------------------------------------------------ libreria e profili (issue #12)
const LIB = [
  { id: "a1", titolo: "La peste", materia: "storia", aggiornato: "2026-10-20", concetti: [
    { id: "c1", stato: "rosso", peso: 2, ordine: 0 }, { id: "c2", stato: "rosso", peso: 3, ordine: 1 }, { id: "c3", stato: "verde" }, { id: "c4" }] },
  { id: "a2", titolo: "I Comuni", materia: "storia", aggiornato: "2026-10-25", concetti: [{ id: "d1", stato: "giallo" }, { id: "d2", stato: "rosso" }] },
  { id: "a3", titolo: "Frazioni", materia: "matematica", percorso: "esercizi", concetti: [], tipi: [{ id: "t1", stato: "verde" }, { id: "t2", stato: "giallo" }] },
];
test("libreria: riepilogo dei concetti per stato, anche dei tipi di esercizio", () => {
  assert.deepEqual(JSON.parse(run(`JSON.stringify(riepilogoStati(${JSON.stringify(LIB)}))`)), { verde: 2, giallo: 2, rosso: 3, mai: 1 });
  assert.deepEqual(JSON.parse(run(`JSON.stringify(contaStati(${JSON.stringify(LIB[2])}))`)), { verde: 1, giallo: 1, rosso: 0, mai: 0 });
});

test("libreria: da ripassare prima è l'argomento con più rossi; nessuno se è tutto verde", () => {
  assert.equal(run(`daRipassarePrima(${JSON.stringify(LIB)}).id`), "a1");
  assert.equal(run(`daRipassarePrima([{ id: "x", concetti: [{ stato: "verde" }] }])`), null);
  // prova lampo: il rosso che pesa di più
  assert.equal(run(`concettoPiuDebole(${JSON.stringify(LIB[0])}).id`), "c2");
});

test("libreria: barra verde/giallo/rosso con le parole per chi non vede i colori", () => {
  const h = run(`htmlBarra({ verde: 1, giallo: 1, rosso: 2, mai: 0 })`);
  assert.match(h, /data-s="verde" style="width:25%"/);
  assert.match(h, /data-s="rosso" style="width:50%"/);
  assert.match(h, /<span class="conto" data-s="verde"><i aria-hidden="true">●<\/i> 1<span class="solo-lettore"> lo sai<\/span>/);
  assert.match(h, /data-s="rosso"><i aria-hidden="true">✕<\/i> 2/);
  assert.equal(run(`htmlBarra({ verde: 0, giallo: 0, rosso: 0, mai: 0 })`), "");
});

test("profili: tinta fissa per id, sottotitolo con classe e da ripassare solo se noto", () => {
  // Tinte delle materie (niente bordeaux), una diversa per profilo, uguali su ogni telefono.
  const t1 = JSON.parse(run(`JSON.stringify(tinteProfili([{ id: "b" }, { id: "a" }]))`));
  const t2 = JSON.parse(run(`JSON.stringify(tinteProfili([{ id: "a" }, { id: "b" }]))`));
  assert.deepEqual(t1, t2);
  assert.notEqual(t1.a.join(), t1.b.join());
  const ammesse = JSON.parse(run(`JSON.stringify(MATERIE.filter((m) => m[0] !== "arte").map((m) => m[2]))`));
  assert.ok([t1.a[0], t1.b[0]].every((h) => ammesse.includes(h)));
  assert.equal(run(`sottotitoloProfilo({ classe: "2ª media" }, 3)`), "2ª media, 3 da ripassare");
  assert.equal(run(`sottotitoloProfilo({ classe: "2ª media" }, 0)`), "2ª media, niente da ripassare");
  assert.equal(run(`sottotitoloProfilo({ classe: "2ª media" }, null)`), "2ª media");
  assert.equal(run(`sottotitoloProfilo({}, null)`), "");
  assert.equal(run(`sottotitoloProfilo({ classe: "3" }, 2)`), "3ª media, 2 da ripassare");
});

test("un lavoro del modello per argomento: due argomenti non si liberano a vicenda (revisione #13)", () => {
  assert.equal(run(`iniziaLavoro("A", "sintesi")`), true);
  assert.equal(run(`iniziaLavoro("A", "mappa")`), false, "sullo stesso argomento non parte un secondo lavoro");
  assert.equal(run(`iniziaLavoro("B", "sintesi")`), true);
  run(`finisciLavoro("A", "sintesi")`);
  assert.equal(run(`lavoroSu("B")`), "sintesi", "finire A non libera B");
  run(`finisciLavoro("B", "mappa")`);
  assert.equal(run(`lavoroSu("B")`), "sintesi", "si libera solo il lavoro giusto");
  run(`finisciLavoro("B", "sintesi")`);
  assert.equal(run(`lavoroSu("B")`), null);
  assert.equal(run(`iniziaLavoro(null, "mappa")`), false);
});

test("sintesi: un concetto tolto dall'argomento prende \"\" e la mappa non la richiede più (revisione #13)", () => {
  const albero = { nodi: [{ id: "c1", fonte: "appunti", figli: [] }, { id: "c-tolto", fonte: "appunti", figli: [] }, { id: "w", fonte: "web", figli: [] }] };
  const u = JSON.parse(run(`JSON.stringify(conSintesi(${JSON.stringify(albero)}, { c1: "Frase." }))`));
  assert.deepEqual(u.nodi.map((n) => n.sintesi), ["Frase.", "", undefined]);
  assert.equal(run(`mancanoSintesi(${JSON.stringify(u)})`), false);
});

test("a voce: per ogni guasto del microfono dice cosa fare, mai un errore muto", () => {
  for (const c of ["not-allowed", "service-not-allowed", "audio-capture", "no-mic", "network", "language-not-supported", "muto"]) {
    const m = run(`messaggioVoce(${JSON.stringify(c)})`);
    assert.ok(m.length > 30, c);
    assert.ok(!m.includes("(" + c + ")"), "codice noto senza spiegazione: " + c);
  }
  assert.match(run('messaggioVoce("bad-grammar")'), /\(bad-grammar\)/); // un codice nuovo si vede, per capire il guasto
});

// ------------------------------------------------------------------ revisione #18
test("evidenziatore solo sulla frase del quaderno: il testo di un esercizio generato non passa per ancora", () => {
  assert.equal(run(`ancoraDellaDomanda({ testo: "Calcola l'area", ancora: "Calcola l'area" })`), "");
  assert.equal(run(`ancoraDellaDomanda({ testo: "Chi erano?", ancora: "si frustavano", concetti: null })`), "si frustavano");
  assert.equal(run(`ancoraDellaDomanda({ testo: "Chi erano?", ancora: "x", concetti: { ancora: "dal concetto" } })`), "dal concetto");
});

test("volte da rivedere: il conteggio dello storico non sembra lo stato di oggi", () => {
  assert.equal(run(`testoVolte({ sbagliato: 1, stato: "verde" })`), "1 volta da rivedere");
  assert.equal(run(`testoVolte({ sbagliato: 3, stato: "rosso" })`), "3 volte da rivedere");
});

test("Rileggi solo se c'è la frase; nota sul quaderno con i due punti", () => {
  const html = stampa("studiare", [{ id: "a", titolo: "Senza frase", ancora: "", stato: "rosso", sbagliato: 1 }]);
  assert.doesNotMatch(html, /Rileggi/);
  assert.equal(run(`notaQuaderno("x")`), "Sul quaderno c'è un errore: x");
});

// ------------------------------------------------------------------ correzioni prima del merge #18
test("nota sul quaderno: niente «negli appunti» ripetuto, poi minuscolo", () => {
  assert.equal(run(`notaQuaderno("Negli appunti c'è scritto 1384: la data giusta è 1348.")`), "Sul quaderno c'è un errore: 1384: la data giusta è 1348.");
  assert.equal(run(`notaQuaderno("negli appunti: versi decasillabi invece di endecasillabi")`), "Sul quaderno c'è un errore: versi decasillabi invece di endecasillabi");
  assert.equal(run(`notaQuaderno("La data giusta è 1348")`), "Sul quaderno c'è un errore: la data giusta è 1348");
  assert.equal(run(`notaQuaderno("")`), "");
});

test("card «Da ripassare prima»: un solo pulsante pieno Ripassa questo, la mappa come link, conteggi una volta", () => {
  const a = { titolo: "La peste", materia: "storia", concetti: [{ id: "c1", stato: "rosso" }, { id: "c2", stato: "giallo" }] };
  const html = run(`htmlPrimo(${JSON.stringify(a)}, { id: "c1" })`);
  assert.equal((html.match(/class="azione"/g) || []).length, 1);
  assert.match(html, /class="azione" data-azione="lampo">Ripassa questo</);
  assert.match(html, /class="link" data-azione="mappa">Apri la mappa</);
  assert.equal((html.match(/data-s="rosso"/g) || []).length, 2); // barra e conteggio sotto, non anche nella riga della materia
  const senza = run(`htmlPrimo(${JSON.stringify(a)}, null)`);
  assert.match(senza, /class="azione" data-azione="mappa">Apri la mappa</);
});

test("passaggi dell'esercizio: la casella ha un nome per il lettore di schermo", () => {
  assert.match(run("htmlRispostaEsercizio(2)"), /<textarea id="pas-es-2" aria-label="I tuoi passaggi"/);
});

test("ottimizzazione: tetto giornaliero delle richieste con un messaggio chiaro", () => {
  assert.match(run(`messaggioModello(new Definitivo("tetto_giornaliero"), "x")`), /150 richieste.*domani/);
  assert.match(readFileSync(new URL("../app.js", import.meta.url), "utf8"), /json\.errore === "tetto_giornaliero"/);
});

test("consumo di oggi per il genitore: token e costo, 4 decimali sotto il centesimo (issue #34)", () => {
  assert.equal(run(`testoConsumo({ chiamate: 23, input: 60000, output: 25000, cache_scritti: 0, cache_letti: 4000, costo: 0.7412 }, 150)`),
    "Oggi: 23 richieste su 150 · 89.000 token · circa 0,74 $");
  assert.equal(run(`testoConsumo({ chiamate: 0, input: 0, output: 0, cache_scritti: 0, cache_letti: 0, costo: 0 }, 150)`),
    "Oggi: nessuna richiesta (massimo 150)");
  assert.equal(run(`testoConsumo({ chiamate: 4, input: 5284, output: 280, cache_scritti: 0, cache_letti: 0, costo: 0.000668 }, 150)`),
    "Oggi: 4 richieste su 150 · 5564 token · circa 0,0007 $");
});

// Foto veloci: foto più leggere, lettura una foto per chiamata con al massimo 3 chiamate insieme, ordine tenuto.
test("foto ridotte a 1568 px sul lato lungo, JPEG 0,92 (0,8 sbagliava le frazioni scritte a mano)", () => {
  assert.equal(run("LATO_MAX"), 1568);
  assert.equal(run("QUALITA_JPEG"), 0.92);
});

test("inParallelo: risultati nell'ordine della lista e mai più di 3 lavori insieme", async () => {
  run("var __attivi = 0, __max = 0;");
  const r = await run(`inParallelo([50, 10, 40, 5, 30, 1, 20], 3, async (ms, i) => {
    __attivi++; __max = Math.max(__max, __attivi);
    await new Promise((ok) => setTimeout(ok, ms));
    __attivi--; return "p" + i;
  })`);
  assert.deepEqual(Array.from(r), ["p0", "p1", "p2", "p3", "p4", "p5", "p6"]);
  assert.equal(run("__max"), 3);
  assert.deepEqual(Array.from(await run("inParallelo([], 3, async () => 1)")), []);
});

test("trascrivi: una foto per chiamata, 3 alla volta, testi in ordine, avanzamento vero e spunta per foto", async () => {
  run(`var __chiamate = [], __attive = 0, __picco = 0, __passi = [], __lette = [];
    base64 = async (b) => "img" + b;
    conRiprova = (f) => f();
    modello = async (c) => {
      __attive++; __picco = Math.max(__picco, __attive); __chiamate.push(c.immagini);
      await new Promise((ok) => setTimeout(ok, c.immagini[0] === "img1" ? 40 : 5));
      __attive--;
      if (c.immagini[0] === "img3") throw new Error("rete");
      return { trascrizione: "testo " + c.immagini[0] };
    };`);
  const testi = await run(`trascrivi([0, 1, 2, 3, 4], false, (t) => __passi.push(t), false, (i) => __lette.push(i))`);
  assert.deepEqual(Array.from(testi), ["testo img0", "testo img1", "testo img2", run("GRUPPO_ILLEGGIBILE"), "testo img4"]);
  assert.ok(run("__chiamate").every((x) => x.length === 1), "una foto per chiamata");
  assert.equal(run("__picco"), 3);
  assert.equal(run("__passi")[0], "Leggo la foto 1 di 5");
  assert.ok(run("__passi").includes("Leggo la foto 5 di 5"));
  assert.ok(run("__passi").every((p) => /^Leggo la foto [1-5] di 5$/.test(p)), run("__passi").join(" | "));
  // la spunta arriva solo per le foto lette davvero, nell'ordine in cui finiscono
  assert.deepEqual(Array.from(run("__lette")).sort(), [0, 1, 2, 4]);
  assert.notEqual(run("__lette")[0], 1, "la foto lenta non blocca le spunte delle altre");
});

test("trascrivi: un errore definitivo ferma tutto", async () => {
  run(`modello = async () => { throw new Definitivo("rate_limited"); };`);
  await assert.rejects(run(`trascrivi([0, 1], false, () => {})`), (e) => e.message === "rate_limited");
});

test("salvaELeggi: salvataggio e lettura partono insieme, i testi tornano in ordine", async () => {
  run(`var __ordine = [];
    conservaFoto = async (a, blobs) => { __ordine.push("salva:0"); await new Promise((ok) => setTimeout(ok, 30)); __ordine.push("salva:1"); return blobs; };
    modello = async (c) => { __ordine.push("leggi"); return { trascrizione: "t" + c.immagini[0] }; };
    base64 = async (b) => b;
    passoAttesa = () => {};`);
  const testi = await run(`salvaELeggi({ id: "a" }, ["x", "y"], false, {}, false, null)`);
  assert.deepEqual(Array.from(testi), ["tx", "ty"]);
  const o = run("__ordine");
  assert.ok(o.indexOf("leggi") < o.indexOf("salva:1"), "la lettura non aspetta il salvataggio: " + o.join(","));
});

test("inParallelo: dopo un errore non parte nessun lavoro nuovo", async () => {
  run("var __partiti = [];");
  await assert.rejects(run(`inParallelo([0, 1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
    __partiti.push(x);
    if (x === 0) throw new Error("stop");
    await new Promise((ok) => setTimeout(ok, 10));
  })`));
  await new Promise((ok) => setTimeout(ok, 60));
  assert.deepEqual(Array.from(run("__partiti")), [0, 1, 2]);
});

test("salvaELeggi: niente testi vuoti fra quelli da unire", async () => {
  run(`conservaFoto = async (a, b) => b; base64 = async (b) => b;
    modello = async (c) => ({ trascrizione: c.immagini[0] === "vuota" ? "" : "t" + c.immagini[0] });`);
  assert.deepEqual(Array.from(await run(`salvaELeggi({ id: "a" }, ["x", "vuota", "y"], false, {}, false, null)`)), ["tx", "ty"]);
});
