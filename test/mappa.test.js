// Mappa concettuale: l'albero che arriva all'app nasce solo dagli appunti.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { costruisciMappa, MAX_NODI } from "../supabase/functions/_shared/mappa.js";
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
