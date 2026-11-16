// Issue #22, la parte del server: «Le 5 cose da sapere» e «Raccontalo in 2 minuti».   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { puntiChiaveDaRisposta, esitiRacconto, ETICHETTE, MAX_PUNTI } from "../supabase/functions/_shared/punti.js";
import { promptPuntiChiave, promptRacconto } from "../supabase/functions/_shared/prompt.js";

const ARGOMENTO = {
  titolo: "La peste del Trecento", materia: "storia",
  trascrizione:
    "La peste nera. Nel 1347 alcune navi genovesi portarono la peste a Messina. " +
    "Le pulci dei topi trasmettevano la malattia agli uomini che vivevano in città sporche e affollate. " +
    "Morì circa un terzo della popolazione europea, quindi mancavano braccia per lavorare nei campi " +
    "e i contadini sopravvissuti chiesero salari più alti. Gli ebrei furono accusati di avvelenare i pozzi. " +
    "Il contagio si diffondeva lungo le rotte commerciali.",
  concetti: [
    { id: "u1", titolo: "Arrivo della peste", ancora: "Nel 1347 alcune navi genovesi portarono la peste a Messina", ordine: 0 },
    { id: "u2", titolo: "Il contagio", ancora: "Le pulci dei topi trasmettevano la malattia agli uomini", ordine: 1 },
    { id: "u3", titolo: "Le conseguenze", ancora: "Morì circa un terzo della popolazione europea", ordine: 2 },
    { id: "u4", titolo: "I capri espiatori", ancora: "Gli ebrei furono accusati di avvelenare i pozzi", ordine: 3 },
  ],
};
const punto = (concetto_id, etichetta, chiave, testo = "") => ({ concetto_id, etichetta, testo, chiave });

test("5 cose: tiene solo i punti con la chiave nel materiale, un concetto vero e un'etichetta ammessa; al massimo 5", () => {
  const r = puntiChiaveDaRisposta(ARGOMENTO, { punti: [
    punto("c1", "Quando", "Nel 1347 alcune navi genovesi portarono la peste a Messina", "Nel 1347 navi genovesi portarono la peste a Messina."),
    punto("c2", "Che cosa", "Le pulci dei topi trasmettevano la malattia"),
    punto("c3", "Perché conta", "Nel 1350 morì metà della popolazione europea"), // la chiave non regge: via
    punto("c9", "Chi", "Gli ebrei furono accusati di avvelenare i pozzi"),       // concetto inventato: via
    punto("c4", "Dove", "Gli ebrei furono accusati di avvelenare i pozzi"),      // etichetta sconosciuta: via
    punto("c2", "Che cosa", "Le pulci dei topi trasmettevano la malattia"),      // doppione: via
  ], catena: [], parole: [], domanda: null });
  assert.deepEqual(r.punti.map((p) => [p.concetto_id, p.etichetta]), [["u1", "Quando"], ["u2", "Che cosa"]]);
  assert.equal(r.punti[0].testo, "Nel 1347 navi genovesi portarono la peste a Messina.");
  assert.equal(r.scartati, 4);
  assert.deepEqual(ETICHETTE, ["Chi", "Quando", "Che cosa", "Perché conta"]);
  const tanti = puntiChiaveDaRisposta(ARGOMENTO, { punti: Array.from({ length: 8 }, (_, i) =>
    punto("c" + (1 + (i % 4)), "Che cosa", ARGOMENTO.concetti[i % 4].ancora.split(" ").slice(0, 5 + Math.floor(i / 4)).join(" "))) });
  assert.equal(tanti.punti.length, MAX_PUNTI);
});

test("5 cose: il testo del modello resta solo se regge sul materiale, altrimenti si mostra la sola frase del quaderno", () => {
  const r = puntiChiaveDaRisposta(ARGOMENTO, { punti: [
    punto("c1", "Quando", "Nel 1347 alcune navi genovesi portarono la peste a Messina", "Nel 1492 Colombo scoprì l'America."),
  ] });
  assert.equal(r.punti.length, 1);
  assert.equal(r.punti[0].testo, "");
});

test("causa e effetto: ogni anello ancorato, da 2 a 4; se un anello non regge la sezione sparisce", () => {
  const buona = [
    { testo: "Morì un europeo su tre.", ancora: "Morì circa un terzo della popolazione europea" },
    { testo: "Mancavano braccia nei campi.", ancora: "quindi mancavano braccia per lavorare nei campi" },
    { testo: "I contadini chiesero salari più alti.", ancora: "i contadini sopravvissuti chiesero salari più alti" },
  ];
  assert.equal(puntiChiaveDaRisposta(ARGOMENTO, { catena: buona }).catena.length, 3);
  const rotta = [...buona.slice(0, 2), { testo: "Nacque il capitalismo.", ancora: "da qui nacque il capitalismo moderno in Europa" }];
  assert.deepEqual(puntiChiaveDaRisposta(ARGOMENTO, { catena: rotta }).catena, []);
  assert.deepEqual(puntiChiaveDaRisposta(ARGOMENTO, { catena: buona.slice(0, 1) }).catena, []); // un anello non è una catena
  assert.deepEqual(puntiChiaveDaRisposta(ARGOMENTO, { catena: [] }).catena, []);
});

test("parole che fanno bella figura: solo termini scritti nel materiale, al massimo 6", () => {
  const r = puntiChiaveDaRisposta(ARGOMENTO, { parole: ["contagio", "rotte commerciali", "pandemia", "Contagio", "salari", "pulci", "pozzi", "popolazione", "città"] });
  assert.deepEqual(r.parole, ["contagio", "rotte commerciali", "salari", "pulci", "pozzi", "popolazione"]);
});

test("la domanda della prof: concetto vero e ancora nel materiale, altrimenti niente", () => {
  const ok = puntiChiaveDaRisposta(ARGOMENTO, { domanda: { concetto_id: "c3", testo: "Perché dopo la peste i contadini chiesero salari più alti?", ancora: "mancavano braccia per lavorare nei campi" } });
  assert.deepEqual(ok.domanda, { concetto_id: "u3", testo: "Perché dopo la peste i contadini chiesero salari più alti?", ancora: "mancavano braccia per lavorare nei campi" });
  assert.equal(puntiChiaveDaRisposta(ARGOMENTO, { domanda: { concetto_id: "c3", testo: "Perché?", ancora: "la peste finì nel 1352 grazie ai medici" } }).domanda, null);
  assert.equal(puntiChiaveDaRisposta(ARGOMENTO, { domanda: { concetto_id: "c7", testo: "Perché?", ancora: "mancavano braccia per lavorare nei campi" } }).domanda, null);
  assert.equal(puntiChiaveDaRisposta(ARGOMENTO, null).domanda, null);
});

test("prompt delle 5 cose: concetti con id brevi, materiale intero, catena solo se c'è", () => {
  const p = promptPuntiChiave(ARGOMENTO, "2");
  assert.match(p, /"id":"c1"/);
  assert.match(p, /Le pulci dei topi/);
  assert.match(p, /lascia catena vuota/);
  assert.match(p, /Chi.*Quando.*Che cosa.*Perché conta/);
  assert.doesNotMatch(p, /"u1"/);
});

const RACCONTO = "allora nel 1347 delle navi genovesi portarono la peste a messina e poi la malattia la trasmettevano le zanzare " +
  "e morì un terzo della popolazione europea";

test("racconto: ogni concetto ha il suo esito; detto e impreciso solo con il pezzo del racconto che lo prova", () => {
  const r = esitiRacconto(ARGOMENTO, { esiti: [
    { concetto_id: "c1", esito: "detto", frase_detta: "nel 1347 delle navi genovesi portarono la peste a messina" },
    { concetto_id: "c2", esito: "impreciso", frase_detta: "la malattia la trasmettevano le zanzare" },
    { concetto_id: "c3", esito: "detto", frase_detta: "morì metà degli europei" },            // non l'ha detto così: saltato
    { concetto_id: "c9", esito: "detto", frase_detta: "nel 1347" },                            // concetto inventato
  ] }, RACCONTO);
  assert.deepEqual(r.esiti.map((e) => [e.concetto_id, e.esito]), [["u1", "detto"], ["u2", "impreciso"], ["u3", "saltato"], ["u4", "saltato"]]);
  assert.equal(r.esiti[1].frase_detta, "la malattia la trasmettevano le zanzare");
  assert.equal(r.esiti[2].frase_detta, "");
  assert.deepEqual([r.toccati, r.totale], [2, 4]);
});

test("racconto: esito sconosciuto o doppio non conta; senza risposta tutti saltati", () => {
  const r = esitiRacconto(ARGOMENTO, { esiti: [
    { concetto_id: "c1", esito: "forse", frase_detta: "nel 1347 delle navi genovesi" },
    { concetto_id: "c4", esito: "saltato", frase_detta: "" },
    { concetto_id: "c4", esito: "detto", frase_detta: "morì un terzo della popolazione europea" },
  ] }, RACCONTO);
  assert.deepEqual(r.esiti.map((e) => e.esito), ["saltato", "saltato", "saltato", "saltato"]);
  assert.equal(esitiRacconto(ARGOMENTO, null, RACCONTO).toccati, 0);
});

test("prompt del racconto: i punti con la frase del quaderno e il racconto, ignora le esitazioni", () => {
  const p = promptRacconto(ARGOMENTO, RACCONTO, "2");
  assert.match(p, /"id":"c4"/);
  assert.match(p, /zanzare/);
  assert.match(p, /detto.*impreciso.*saltato/s);
  assert.match(p, /riconoscimento vocale/);
});

test("revisione: chiavi, ancore e frasi dette oltre 400 caratteri si scartano (ancoraRegge guarda solo i primi 400)", () => {
  const lunga = ARGOMENTO.concetti[0].ancora + " " + "parola ".repeat(60);
  assert.ok(lunga.length > 400);
  assert.equal(puntiChiaveDaRisposta(ARGOMENTO, { punti: [punto("c1", "Quando", lunga)] }).punti.length, 0);
  assert.deepEqual(puntiChiaveDaRisposta(ARGOMENTO, { catena: [{ testo: "", ancora: lunga }, { testo: "", ancora: ARGOMENTO.concetti[2].ancora }] }).catena, []);
  assert.equal(puntiChiaveDaRisposta(ARGOMENTO, { domanda: { concetto_id: "c1", testo: "Perché?", ancora: lunga } }).domanda, null);
  const detto = "nel 1347 delle navi genovesi portarono la peste a messina " + "e poi ".repeat(80);
  const r = esitiRacconto(ARGOMENTO, { esiti: [{ concetto_id: "c1", esito: "detto", frase_detta: detto.trim() }] }, detto);
  assert.equal(r.esiti[0].esito, "saltato");
});

test("revisione: la frase detta ha almeno 3 parole e non è la stessa di un altro concetto", () => {
  const r = esitiRacconto(ARGOMENTO, { esiti: [
    { concetto_id: "c1", esito: "detto", frase_detta: "nel 1347" },
    { concetto_id: "c2", esito: "detto", frase_detta: "morì un terzo della popolazione europea" },
    { concetto_id: "c3", esito: "detto", frase_detta: "morì un terzo della popolazione europea" },
  ] }, RACCONTO);
  assert.deepEqual(r.esiti.map((e) => e.esito), ["saltato", "saltato", "saltato", "saltato"]);
});

test("5 cose: una chiave che è un pezzo di frase si allarga alla frase intera; se non c'è, non diventa un punto", () => {
  const r = puntiChiaveDaRisposta(ARGOMENTO, { punti: [
    punto("c2", "Che cosa", "trasmettevano la malattia agli uomini che vivevano in città sporche e affollate"),
    punto("c1", "Quando", "Nel 1347 alcune navi genovesi portarono la peste a Messina"),
    punto("c3", "Perché conta", "mancavano braccia per lavorare nei campi e salari altissimi"), // pezzo non copiato: via
  ] });
  assert.deepEqual(r.punti.map((p) => p.concetto_id), ["u2", "u1"]);
  assert.equal(r.punti[0].chiave, "Le pulci dei topi trasmettevano la malattia agli uomini che vivevano in città sporche e affollate.");
});
