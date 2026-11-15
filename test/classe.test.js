// Issue #28: la classe del profilo e il programma negli aiuti (supabase/functions/_shared/classe.js).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroClasse, materiaDi, trovaArgomenti, contestoClasse, erroreDaId, prerequisitoMancante, erroriCandidati, riconosciErroreFrazioni }
  from "../supabase/functions/_shared/classe.js";

test("numero della classe dal profilo: 1, 2, 3 o null", () => {
  for (const [v, n] of [["1", 1], [2, 2], ["2ª media", 2], ["3a", 3], ["terza", 3], ["prima media", 1], [null, null], ["", null], ["5", null], ["elementari", null]])
    assert.equal(numeroClasse(v), n, String(v));
});

test("materia: nomi del libro e del quaderno ricondotti alle sei materie", () => {
  for (const [v, m] of [["Matematica", "matematica"], ["geometria", "matematica"], ["Aritmetica", "matematica"], ["grammatica", "italiano"],
    ["Epica", "italiano"], ["antologia", "italiano"], ["Storia", "storia"], ["geografia", "geografia"], ["Scienze", "scienze"], ["English", "inglese"],
    ["inglese", "inglese"], ["musica", null], ["", null]])
    assert.equal(materiaDi(v), m, String(v));
});

test("argomento trovato dalle parole chiave, fra quelli della classe e dei prerequisiti", () => {
  const fr = trovaArgomenti({ classe: 2, materia: "matematica", testo: "Calcola 1/2 + 1/3 riducendo allo stesso denominatore con il mcm." });
  assert.ok(fr.length >= 1);
  assert.equal(fr[0].classe, 2);
  assert.match(fr[0].titolo.toLowerCase(), /frazion/);
  // in 3ª un'equazione con le frazioni: l'argomento è l'equazione, non una cosa della 2ª
  const eq = trovaArgomenti({ classe: 3, materia: "matematica", testo: "Risolvi l'equazione x/2 + 1/3 = 5/6, poi verifica la soluzione." });
  assert.equal(eq[0].id, "ma3-equazioni");
  // niente di più avanti della classe
  assert.ok(trovaArgomenti({ classe: 1, materia: "matematica", testo: "equazione con incognita x e teorema di Pitagora" }).every((a) => a.classe === 1));
  // materia sconosciuta: si cerca in tutte quelle della classe
  assert.equal(trovaArgomenti({ classe: 2, materia: null, testo: "Fai l'analisi logica: soggetto, predicato e complementi." })[0].materia, "italiano");
  assert.deepEqual(trovaArgomenti({ classe: null, materia: "matematica", testo: "frazioni" }), []);
});

test("contesto per i prompt: classe, come scrivere, strategie ed errori tipici con l'id, prerequisiti, il materiale prima", () => {
  const c2 = contestoClasse({ classe: "2", materia: "Matematica", testo: "Paolo spende 1/6 dello stipendio e 2/9 per il vestito. Quanto guadagna?" });
  assert.match(c2, /2ª media/);
  assert.match(c2, /Dalla parte all'intero|ritroso/i);
  assert.match(c2, /\[frazioni-somma-denominatori\]/);
  assert.match(c2, /hanno sempre la precedenza/);
  const c1 = contestoClasse({ classe: "1", materia: "Matematica", testo: "Paolo spende 1/6 dello stipendio e 2/9 per il vestito." });
  assert.match(c1, /1ª media/);
  assert.match(c1, /frasi molto corte/i);
  assert.match(contestoClasse({ classe: "3", materia: "matematica", testo: "equazione" }), /parole tecniche/i);
  assert.notEqual(c1, c2);
  // senza classe: niente programma, solo la regola generale
  const senza = contestoClasse({ classe: null, materia: "matematica", testo: "frazioni" });
  assert.match(senza, /scuola media/);
  assert.doesNotMatch(senza, /\[frazioni-somma-denominatori\]/);
});

test("errore tipico per id e prerequisito mancante (errore di un anno prima)", () => {
  const e = erroreDaId("frazioni-somma-denominatori");
  assert.equal(e.argomento.id, "ma2-frazioni-operazioni");
  assert.equal(e.classe, 2);
  assert.ok(e.errore && e.spiegazione);
  assert.equal(erroreDaId("non-esiste"), null);
  assert.deepEqual(prerequisitoMancante("frazioni-somma-denominatori", 3), { id: "ma2-frazioni-operazioni", titolo: e.argomento.titolo, classe: 2 });
  assert.equal(prerequisitoMancante("frazioni-somma-denominatori", 2), null);
  assert.equal(prerequisitoMancante("frazioni-somma-denominatori", null), null);
});

test("errori candidati per il prompt di correzione: quelli dell'argomento e dei suoi prerequisiti", () => {
  const ids = erroriCandidati({ classe: 3, materia: "matematica", testo: "Risolvi l'equazione x/2 + 1/3 = 5/6" }).map((e) => e.id);
  assert.ok(ids.includes("frazioni-somma-denominatori"), "prerequisito della 2ª");
  assert.ok(ids.length <= 20);
});

test("1/2 + 1/3 = 2/5 riconosciuto senza modello: sommati numeratori e denominatori", () => {
  assert.equal(riconosciErroreFrazioni("1/2 + 1/3", "2/5"), "frazioni-somma-denominatori");
  assert.equal(riconosciErroreFrazioni("Calcola 3/4 + 1/6.", "4/10"), "frazioni-somma-denominatori");
  assert.equal(riconosciErroreFrazioni("3/4 − 1/6", "2/-2"), null);
  assert.equal(riconosciErroreFrazioni("1/2 + 1/3", "5/6"), null); // giusta
  assert.equal(riconosciErroreFrazioni("1/2 + 1/3", "3/5"), null); // un altro errore
  assert.equal(riconosciErroreFrazioni("2/4 + 2/4", "4/8"), "frazioni-somma-denominatori");
  assert.equal(riconosciErroreFrazioni("Quanto fa 12 + 5?", "17"), null);
  // anche nei passaggi di un'equazione: x/2 = 5/6 − 1/3 scritto 4/3
  assert.equal(riconosciErroreFrazioni("x/2 + 1/3 = 5/6", "x/2 = 5/6 − 1/3 = 4/3", { passaggi: true }), "frazioni-somma-denominatori");
});

import { erroreTipicoDi } from "../supabase/functions/_shared/classe.js";
test("errore tipico di una risposta: prima il riconoscimento senza modello, poi la scelta del modello se è fra i candidati", () => {
  // 1/2 + 1/3 = 2/5 in 2ª: per nome, niente prerequisito (è della sua classe)
  const a = erroreTipicoDi({ classe: 2, testo: "Calcola 1/2 + 1/3", risposta: "2/5", giusto: false });
  assert.equal(a.errore_tipico.id, "frazioni-somma-denominatori");
  assert.ok(a.errore_tipico.errore && a.errore_tipico.spiegazione);
  assert.equal(a.prerequisito, null);
  // in 3ª un'equazione che non torna per colpa delle frazioni: prerequisito della 2ª
  const b = erroreTipicoDi({ classe: 3, testo: "Risolvi x/2 + 1/3 = 5/6", risposta: "x = 8/3", passaggi: "x/2 = 5/6 − 1/3 = 4/3\nx = 8/3", giusto: false });
  assert.equal(b.errore_tipico.id, "frazioni-somma-denominatori");
  assert.deepEqual(b.prerequisito, { id: "ma2-frazioni-operazioni", titolo: b.errore_tipico.argomento.titolo, classe: 2 });
  // scelta del modello: tenuta solo se è un errore dei candidati
  const c = erroreTipicoDi({ classe: 3, testo: "Risolvi l'equazione 3x − (x − 4) = 10", risposta: "x = 3", scelta: "parentesi-segni", giusto: false });
  assert.equal(c.errore_tipico.id, "parentesi-segni");
  assert.equal(erroreTipicoDi({ classe: 3, testo: "Risolvi l'equazione 3x = 12", risposta: "5", scelta: "inventato", giusto: false }), null);
  // risposta giusta: niente errore
  assert.equal(erroreTipicoDi({ classe: 2, testo: "Calcola 1/2 + 1/3", risposta: "5/6", scelta: "frazioni-somma-denominatori", giusto: true }), null);
});

test("argomento: una parola generica da sola non basta; 3 x 4 = 12 non è un'equazione", () => {
  assert.deepEqual(trovaArgomenti({ classe: 2, materia: null, testo: "Vado verso casa un po' più tardi, poi parto." }), []);
  assert.ok(!trovaArgomenti({ classe: 3, materia: "matematica", testo: "Calcola 3 x 4 = 12" }).some((a) => a.id === "ma3-equazioni"));
  assert.equal(trovaArgomenti({ classe: 3, materia: "matematica", testo: "Risolvi 3x = 12" })[0].id, "ma3-equazioni");
});
