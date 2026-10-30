// Mappa concettuale: l'albero che arriva all'app nasce solo dagli appunti.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { costruisciMappa, MAX_NODI, agganciMappa, arricchisciMappa, MAX_NODI_WEB } from "../supabase/functions/_shared/mappa.js";
import { promptMappa } from "../supabase/functions/_shared/prompt.js";

// Testo vero, dalla pagina 24 del libro fotografata il 25 ottobre 2026.
const ARGOMENTO = {
  titolo: "La Scuola siciliana",
  materia: "italiano",
  trascrizione:
    "Con il nome di Scuola poetica siciliana si indicano i poeti che, tra il 1230 e il 1250, composero le loro opere " +
    "alla corte palermitana di Federico II di Svevia, re di Sicilia, e poi imperatore del Sacro romano impero. " +
    "Il sonetto è composto di 14 versi endecasillabi (cioè di undici sillabe) suddivisi in due quartine e due terzine. " +
    "Il tema principale è l'amore cortese per una donna irraggiungibile.",
  concetti: [
    { id: "uuid-1", titolo: "Che cos'è la Scuola siciliana", ancora: "poeti che, tra il 1230 e il 1250, composero le loro opere", peso: 3, ordine: 0 },
    { id: "uuid-2", titolo: "Il sonetto", ancora: "Il sonetto è composto di 14 versi endecasillabi", peso: 2, ordine: 1 },
  ],
};

// Al modello i concetti arrivano come c1, c2... nell'ordine dei concetti.
const nodo = (titolo, ancora, figli = []) => ({ titolo, ancora, figli });

test("radice e primo livello sono l'argomento e i suoi concetti, con lo stesso id del database", () => {
  const m = costruisciMappa(ARGOMENTO, { nodi: [] });
  assert.equal(m.titolo, "La Scuola siciliana");
  assert.equal(m.materia, "italiano");
  assert.deepEqual(m.nodi.map((n) => [n.id, n.titolo, n.peso, n.fonte, n.figli.length]), [
    ["uuid-1", "Che cos'è la Scuola siciliana", 3, "appunti", 0],
    ["uuid-2", "Il sonetto", 2, "appunti", 0],
  ]);
  assert.equal(m.nodi[1].ancora, "Il sonetto è composto di 14 versi endecasillabi");
});

test("un sotto-punto senza ancora, o con un'ancora che negli appunti non c'è, viene scartato con i suoi figli", () => {
  const m = costruisciMappa(ARGOMENTO, { nodi: [
    { concetto_id: "c2", figli: [
      nodo("Le strofe", "suddivisi in due quartine e due terzine", [nodo("Undici sillabe", "endecasillabi (cioè di undici sillabe)")]),
      nodo("Senza ancora", "  ", [nodo("Figlio di un nodo scartato", "suddivisi in due quartine e due terzine")]),
      // Vera, ma il materiale non parla di Petrarca.
      nodo("Petrarca", "Francesco Petrarca perfezionò il sonetto nel Canzoniere"),
    ] },
    { concetto_id: "c1", figli: [nodo("La corte", "corte palermitana di Federico II di Svevia")] },
  ] });
  assert.deepEqual(m.nodi.map((n) => n.figli.map((f) => [f.titolo, f.fonte, f.figli.map((g) => g.titolo)])), [
    [["La corte", "appunti", []]],
    [["Le strofe", "appunti", ["Undici sillabe"]]],
  ]);
  assert.equal(m.scartati, 3); // il nodo senza ancora conta con il suo figlio
  const ids = m.nodi.flatMap((n) => [n.id, ...n.figli.flatMap((f) => [f.id, ...f.figli.map((g) => g.id)])]);
  assert.equal(new Set(ids).size, ids.length, "id ripetuti");
});

test("un concetto che il modello non conosce non entra; un titolo vuoto è scartato", () => {
  const m = costruisciMappa(ARGOMENTO, { nodi: [
    { concetto_id: "c9", figli: [nodo("Orfano", "suddivisi in due quartine e due terzine")] },
    { concetto_id: "c1", figli: [nodo(" ", "corte palermitana di Federico II di Svevia")] },
  ] });
  assert.deepEqual(m.nodi.map((n) => n.figli.length), [0, 0]);
  assert.equal(m.scartati, 2);
});

const contaTutti = (nodi) => nodi.reduce((s, n) => s + 1 + contaTutti(n.figli), 0);
const profondita = (nodi) => nodi.reduce((p, n) => Math.max(p, 1 + profondita(n.figli)), 0);
const BUONA = "suddivisi in due quartine e due terzine";

test("al massimo tre livelli sotto la radice: un quarto livello mandato dal modello non entra", () => {
  const m = costruisciMappa(ARGOMENTO, { nodi: [
    { concetto_id: "c2", figli: [nodo("Due", BUONA, [nodo("Tre", BUONA, [nodo("Quattro", BUONA)])])] },
  ] });
  assert.equal(profondita(m.nodi), 3);
  assert.equal(m.nodi[1].figli[0].figli[0].figli.length, 0);
  assert.equal(m.tagliati, 1);
});

test("al massimo 25 nodi: tutti i concetti restano e i sotto-punti si spartiscono a turno", () => {
  const concetti = Array.from({ length: 10 }, (_, i) => ({ id: "k" + i, titolo: "Concetto " + i, ancora: BUONA, peso: 2, ordine: i }));
  const nodi = concetti.map((_, i) => ({ concetto_id: "c" + (i + 1), figli:
    [1, 2, 3].map((j) => nodo("Punto " + i + "." + j, BUONA, [nodo("Dettaglio", BUONA), nodo("Dettaglio", BUONA)])) }));
  const m = costruisciMappa({ ...ARGOMENTO, concetti }, { nodi });
  assert.equal(contaTutti(m.nodi), MAX_NODI);
  assert.equal(m.nodi.length, 10);
  assert.ok(m.nodi.every((n) => n.figli.length >= 1), "un concetto è rimasto senza sotto-punti");
  // 15 posti per i sotto-punti: un giro completo (10) e mezzo (5); i dettagli non ci stanno più
  assert.deepEqual(m.nodi.map((n) => n.figli.length), [2, 2, 2, 2, 2, 1, 1, 1, 1, 1]);
  assert.equal(profondita(m.nodi), 2);
  assert.equal(m.tagliati, 100 - MAX_NODI);
  assert.equal(m.scartati, 0);
});

test("con più di 25 concetti restano tutti i concetti e nessun sotto-punto", () => {
  const concetti = Array.from({ length: 30 }, (_, i) => ({ id: "k" + i, titolo: "C" + i, ancora: BUONA, ordine: i }));
  const m = costruisciMappa({ ...ARGOMENTO, concetti }, { nodi: [{ concetto_id: "c1", figli: [nodo("Punto", BUONA)] }] });
  assert.equal(m.nodi.length, 30);
  assert.equal(contaTutti(m.nodi), 30);
});

test("il prompt dà i concetti con gli id brevi, chiede ancore copiate e vieta quello che non è scritto", () => {
  const p = promptMappa(ARGOMENTO, 23);
  assert.match(p, /"id":"c1","titolo":"Che cos'è la Scuola siciliana"/);
  assert.match(p, /"id":"c2"/);
  assert.doesNotMatch(p, /uuid-1/);
  assert.match(p, /parola per parola/);
  assert.match(p, /vera ma non scritta/);
  assert.match(p, /23/); // quanti sotto-punti in tutto
  assert.match(p, /corte palermitana/); // la trascrizione c'è
});

test("i concetti restano sulla mappa anche se la loro ancora non si ritrova nella trascrizione", () => {
  // Scelta voluta: sono già stati ancorati all'estrazione, e mappa e semaforo devono avere gli stessi concetti.
  const m = costruisciMappa({ ...ARGOMENTO, trascrizione: "testo cambiato" }, { nodi: [] });
  assert.deepEqual(m.nodi.map((n) => n.id), ["uuid-1", "uuid-2"]);
  assert.equal(m.scartati, 0);
});

// ---------------------------------------------------------------- nodi dal web (issue #4)
const FONTI = [
  { titolo: "Peste - Treccani", url: "https://www.treccani.it/enciclopedia/peste" },
  { titolo: "Il sonetto - Focus Junior", url: "https://www.focusjunior.it/sonetto" },
];
const albero = () => {
  const m = costruisciMappa(ARGOMENTO, { nodi: [{ concetto_id: "c2", figli: [nodo("Le strofe", "suddivisi in due quartine e due terzine", [nodo("Undici sillabe", "endecasillabi (cioè di undici sillabe)")])] }] });
  return { titolo: m.titolo, materia: m.materia, nodi: m.nodi };
};
const senzaWeb = (nodi) => nodi.filter((n) => n.fonte !== "web").map((n) => ({ ...n, figli: senzaWeb(n.figli) }));
const webDi = (nodi) => nodi.flatMap((n) => [...(n.fonte === "web" ? [n] : []), ...webDi(n.figli)]);
const web = (aggancio, titolo, fonte = 1) => ({ aggancio, titolo, testo: "Due o tre righe su " + titolo + ".", fonte });

test("al modello si offrono come agganci solo concetti e sotto-punti degli appunti, con id brevi", () => {
  const a = agganciMappa(albero());
  assert.deepEqual(a.map((x) => [x.breve, x.titolo]), [["n1", "Che cos'è la Scuola siciliana"], ["n2", "Il sonetto"], ["n3", "Le strofe"]]);
});

test("i nodi dal web si aggiungono senza toccare quelli degli appunti, con fonte web e link", () => {
  const prima = albero();
  const r = arricchisciMappa(prima, { nodi: [web("n2", "Petrarca e il sonetto", 2), web("n1", "Federico II", 1)] }, FONTI);
  assert.deepEqual(senzaWeb(r.albero.nodi), prima.nodi, "i nodi degli appunti sono cambiati");
  assert.deepEqual(prima, albero(), "l'albero di partenza è stato modificato");
  const w = webDi(r.albero.nodi);
  assert.deepEqual(w.map((n) => [n.titolo, n.fonte, n.url]), [
    ["Federico II", "web", FONTI[0].url],
    ["Petrarca e il sonetto", "web", FONTI[1].url],
  ]);
  assert.equal(r.albero.nodi[1].figli.at(-1).titolo, "Petrarca e il sonetto"); // agganciato al sonetto
  assert.ok(w.every((n) => n.testo && !n.ancora && n.figli.length === 0));
  assert.equal(r.aggiunti, 2);
  assert.deepEqual(r.nodi.map((n) => [n.titolo, n.aggancio, n.fonte]), [["Petrarca e il sonetto", "uuid-2", "web"], ["Federico II", "uuid-1", "web"]]);
});

test("nodi web: al massimo 6; scartati quelli senza aggancio valido, senza fonte citata o sotto un dettaglio", () => {
  const r = arricchisciMappa(albero(), { nodi: [
    web("n9", "Aggancio inesistente"),
    web("n1", "Fonte inventata", 7),
    web("n1", "Senza titolo".replace(/.*/, " ")),
    ...Array.from({ length: 8 }, (_, i) => web(i % 2 ? "n3" : "n1", "Buono " + i)),
  ] }, FONTI);
  const w = webDi(r.albero.nodi);
  assert.equal(w.length, MAX_NODI_WEB);
  assert.equal(MAX_NODI_WEB, 6);
  assert.ok(w.every((n) => n.titolo.startsWith("Buono")));
  assert.equal(r.scartati, 3 + 2); // tre non validi, due oltre il massimo
  // "Undici sillabe" è un dettaglio (terzo livello): non è un aggancio, la mappa resta a tre livelli
  assert.ok(!agganciMappa(albero()).some((a) => a.titolo === "Undici sillabe"));
});

test("arricchire di nuovo sostituisce i nodi dal web di prima, non li accumula", () => {
  const uno = arricchisciMappa(albero(), { nodi: [web("n1", "Primo giro")] }, FONTI).albero;
  const due = arricchisciMappa(uno, { nodi: [web("n2", "Secondo giro")] }, FONTI).albero;
  assert.deepEqual(webDi(due.nodi).map((n) => n.titolo), ["Secondo giro"]);
  assert.deepEqual(senzaWeb(due.nodi), albero().nodi);
  // i nodi web di prima non sono agganci per quelli nuovi
  assert.ok(!agganciMappa(uno).some((a) => a.titolo === "Primo giro"));
});

test("«in breve» a parte (issue #13): la sintesi resta se regge sugli appunti, sparisce (e si conta) se no", async () => {
  const { sintesiDaRisposta } = await import("../supabase/functions/_shared/mappa.js");
  const r = sintesiDaRisposta(ARGOMENTO, { sintesi: [
    { concetto_id: "c1", testo: "Sono i poeti che tra il 1230 e il 1250 composero alla corte di Federico II." },
    { concetto_id: "c2", testo: "Il sonetto lo inventò Jacopo da Lentini nel 1240." },
    { concetto_id: "c9", testo: "Concetto che non esiste." },
  ] });
  assert.equal(r.sintesi["uuid-1"], "Sono i poeti che tra il 1230 e il 1250 composero alla corte di Federico II.");
  assert.equal(r.sintesi["uuid-2"], "", "Jacopo e il 1240 non sono negli appunti");
  assert.equal(r.scartate, 1);
  // Ogni concetto ha la sua voce, anche se il modello l'ha saltato.
  assert.deepEqual(sintesiDaRisposta(ARGOMENTO, { sintesi: [] }).sintesi, { "uuid-1": "", "uuid-2": "" });
  // La mappa arriva senza sintesi: si aggiunge dopo.
  assert.ok(costruisciMappa(ARGOMENTO, { nodi: [] }).nodi.every((n) => !("sintesi" in n)));
});

test("prompt: la mappa non chiede più la sintesi, la chiede promptSintesi per 12-13 anni e solo dal materiale", async () => {
  const { promptSintesi } = await import("../supabase/functions/_shared/prompt.js");
  assert.doesNotMatch(promptMappa(ARGOMENTO, 10), /sintesi/);
  const p = promptSintesi(ARGOMENTO);
  assert.match(p, /12-13 anni/);
  assert.match(p, /nel materiale non ci sono/);
  assert.match(p, /"id":"c1"/);
  assert.match(p, /Scuola poetica siciliana/);
});
