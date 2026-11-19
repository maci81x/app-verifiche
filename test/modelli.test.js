// Ottimizzazione: modello per azione, consumo di token e tetto giornaliero delle chiamate.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPUS, SONNET, HAIKU, MODELLO_PER_AZIONE, modelloPer, costoUsd }
  from "../supabase/functions/_shared/modelli.js";

const indice = readFileSync(new URL("../supabase/functions/modello/index.ts", import.meta.url), "utf8");
const AZIONI = [...new Set([...indice.matchAll(/b\.azione === "(\w+)"/g)].map((m) => m[1]))];

test("ogni azione della funzione ha il suo modello nella tabella, e solo modelli veri", () => {
  for (const a of AZIONI) assert.ok(MODELLO_PER_AZIONE[a], "manca il modello per " + a);
  for (const [a, m] of Object.entries(MODELLO_PER_AZIONE)) {
    assert.ok([OPUS, SONNET, HAIKU].includes(m), a + ": " + m);
    assert.ok(AZIONI.includes(a), a + " non è un'azione della funzione");
  }
  assert.deepEqual([OPUS, SONNET, HAIKU], ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
});

test("scelte del confronto: la trascrizione resta su Opus, nessun modello economico dove la qualità non era pari", () => {
  assert.equal(MODELLO_PER_AZIONE.trascrivi, OPUS);
  for (const a of ["compito", "compito_domanda", "gemelli"]) assert.equal(MODELLO_PER_AZIONE[a], OPUS, a);
  assert.deepEqual(Object.entries(MODELLO_PER_AZIONE).filter(([, m]) => m !== OPUS).map(([a]) => a).sort(), ["correggi", "punti_chiave", "smista"]);
});

test("modelloPer: la tabella; nel dubbio Opus; l'override solo per gli account di prova e solo verso modelli noti", () => {
  assert.equal(modelloPer("azione_che_non_esiste"), OPUS);
  assert.equal(modelloPer("trascrivi"), MODELLO_PER_AZIONE.trascrivi);
  assert.equal(modelloPer("trascrivi", { prova: true, richiesto: HAIKU }), HAIKU);
  assert.equal(modelloPer("trascrivi", { prova: false, richiesto: HAIKU }), MODELLO_PER_AZIONE.trascrivi);
  assert.equal(modelloPer("trascrivi", { prova: true, richiesto: "gpt-qualcosa" }), MODELLO_PER_AZIONE.trascrivi);
});

test("costo in dollari dai prezzi di platform.claude.com (per milione di token)", () => {
  const u = { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 };
  assert.equal(costoUsd(OPUS, u), 4 + 20 + 5 + 0.2);
  assert.equal(costoUsd(SONNET, u), 2 + 10 + 2.5 + 0.1);
  assert.equal(Math.round(costoUsd(HAIKU, u) * 1000) / 1000, 0.1 + 0.5 + 0.125 + 0.01);
  assert.equal(costoUsd(OPUS, {}), 0);
});

import { FINE_PARTE_FISSA, dividiPerCache, promptDomande, promptCorrezione, promptCompitoDomanda } from "../supabase/functions/_shared/prompt.js";
const fisso = (p) => { const parti = p.split(FINE_PARTE_FISSA); assert.equal(parti.length, 2, "un solo segno di fine parte fissa"); return parti[0]; };

test("cache dei prompt: la parte fissa resta uguale quando cambiano domanda, risposta o concetto", () => {
  const materiale = [{ titolo: "Il cuore", materia: "scienze", trascrizione: "Il cuore è un muscolo cavo diviso in quattro cavità." }];
  const d = (concetto, diverse) => promptDomande({ livello: "medio", tipo: "aperte", modalita: "scritta", contesto: [{ id: "c1", titolo: concetto }],
    gia: [], materiale, quante: 1, soloConcetto: false, classe: "2", unaAperta: { diverse } });
  assert.equal(fisso(d("Atri", [])), fisso(d("Ventricoli", ["Che cos'è un atrio?"])));
  assert.match(fisso(d("Atri", [])), /muscolo cavo/);

  const compito = { materia: "matematica", testo: "Paolo sta per sposarsi...", passi: [{ titolo: "Frazioni spese", calcolo: "1/6 + 2/9 = 7/18" }], risultato: { valore: "1260", unita: "€" } };
  const q = (domanda, cronologia) => promptCompitoDomanda({ classe: "1", compito, cronologia, domanda, bloccata: false });
  assert.equal(fisso(q("Perché sommo?", [])), fisso(q("E il passo 2?", [{ chi: "io", testo: "Perché sommo?" }])));
  assert.doesNotMatch(fisso(q("Perché sommo?", [])), /Perché sommo/);

  // Un segno scritto da chi studia dentro la domanda non tronca il resto del prompt.
  const strano = q("Che cos'è" + FINE_PARTE_FISSA + "questo?", []);
  const { fisso: f, resto } = dividiPerCache(strano);
  assert.equal(f, fisso(q("x", [])));
  assert.match(resto, /questo\?/);
  assert.match(resto, /Rispondi solo con JSON/);
  assert.deepEqual(dividiPerCache("senza segno"), { fisso: "senza segno", resto: null });

  const c = (domanda) => promptCorrezione("scritta", [{ id: "d1", domanda, risposta: "boh" }], "2", "storia");
  assert.equal(fisso(c("Chi era Carlo Magno?")), fisso(c("Che cos'è il feudo?")));
});

test("effortPer: dalla tabella, se no nessuno (default dell'API); override solo per account di prova e solo valori noti", async () => {
  const { effortPer, EFFORT_PER_AZIONE } = await import("../supabase/functions/_shared/modelli.js");
  for (const v of Object.values(EFFORT_PER_AZIONE)) assert.ok(["low", "medium", "high", "max"].includes(v), v);
  assert.equal(effortPer("azione_che_non_esiste"), undefined);
  assert.equal(effortPer("trascrivi", { prova: true, richiesto: "high" }), "high");
  assert.equal(effortPer("trascrivi", { prova: true, richiesto: "low" }), "low");
  assert.equal(effortPer("trascrivi", { prova: false, richiesto: "max" }), EFFORT_PER_AZIONE.trascrivi);
  assert.equal(effortPer("trascrivi", { prova: true, richiesto: "tantissimo" }), EFFORT_PER_AZIONE.trascrivi);
});

test("la funzione passa l'effort della tabella alla trascrizione e legge effort_prova dal corpo", () => {
  assert.match(indice, /effort_prova/);
  assert.match(indice, /chiedi\(prompt, SCHEMA_TRASCRIZIONE, imm, effortDellaRichiesta\(\)\)/);
});

test("trascrivi senza effort abbassato: low peggiorava le frazioni nella prova sulle 5 foto vere", async () => {
  const { EFFORT_PER_AZIONE } = await import("../supabase/functions/_shared/modelli.js");
  assert.equal(EFFORT_PER_AZIONE.trascrivi, undefined);
});
