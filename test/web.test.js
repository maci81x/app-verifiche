// Il web come aiuto: fonti solo dalle citazioni vere e solo dai domini consentiti.   node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMINI_CONSENTITI, MAX_RICERCHE, strumentoRicerca, dominioConsentito, fontiCitate, spiegazioneDaRisposta } from "../supabase/functions/_shared/web.js";

// Risposta di una ricerca come la restituisce l'API: testo con citazioni web_search_result_location.
const RICERCA = [
  { type: "text", text: "Cerco." },
  { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "peste nera 1347" } },
  { type: "web_search_tool_result", tool_use_id: "s1", content: [
    { type: "web_search_result", url: "https://www.treccani.it/enciclopedia/peste", title: "Peste - Treccani" },
    { type: "web_search_result", url: "https://www.focusjunior.it/scuola/storia/la-peste-nera/", title: "La peste nera - Focus Junior" },
  ] },
  { type: "text", text: "La peste arrivò dai porti.", citations: [
    { type: "web_search_result_location", url: "https://www.treccani.it/enciclopedia/peste", title: "Peste - Treccani", cited_text: "..." },
  ] },
  { type: "text", text: "Si diffuse con le pulci dei ratti.", citations: [
    { type: "web_search_result_location", url: "https://www.focusjunior.it/scuola/storia/la-peste-nera/", title: "La peste nera - Focus Junior", cited_text: "..." },
    { type: "web_search_result_location", url: "https://www.treccani.it/enciclopedia/peste", title: "Peste - Treccani", cited_text: "..." }, // ripetuta
    { type: "web_search_result_location", url: "https://www.skuola.net/riassunti/peste", title: "Riassunto", cited_text: "..." }, // fuori lista
  ] },
];

test("la ricerca è limitata: al massimo 3 ricerche e solo i domini della lista", () => {
  assert.equal(MAX_RICERCHE, 3);
  const s = strumentoRicerca();
  assert.equal(s.name, "web_search");
  assert.equal(s.max_uses, 3);
  assert.deepEqual(s.allowed_domains, DOMINI_CONSENTITI);
  assert.deepEqual(s.allowed_callers, ["direct"], "ricerca diretta: le citazioni arrivano sul testo");
  assert.ok(!DOMINI_CONSENTITI.includes("nationalgeographic.it"), "blocca il crawler: farebbe fallire ogni ricerca");
  assert.ok(DOMINI_CONSENTITI.includes("treccani.it") && !DOMINI_CONSENTITI.includes("skuola.net"));
});

test("dominio consentito: anche i sottodomini, mai un dominio che ci assomiglia", () => {
  assert.equal(dominioConsentito("https://www.treccani.it/x"), true);
  assert.equal(dominioConsentito("https://media.inaf.it/2026/x"), true);
  assert.equal(dominioConsentito("https://it.wikipedia.org/wiki/Peste"), true);
  assert.equal(dominioConsentito("https://en.wikipedia.org/wiki/Plague"), false);
  assert.equal(dominioConsentito("https://falsotreccani.it/x"), false);
  assert.equal(dominioConsentito("https://treccani.it.truffa.com/x"), false);
  assert.equal(dominioConsentito("javascript:alert(1)"), false);
  assert.equal(dominioConsentito("http://www.treccani.it/x"), false); // solo https
});

test("le fonti sono solo quelle citate davvero, una volta sola, nell'ordine in cui compaiono", () => {
  assert.deepEqual(fontiCitate(RICERCA), [
    { titolo: "Peste - Treccani", url: "https://www.treccani.it/enciclopedia/peste" },
    { titolo: "La peste nera - Focus Junior", url: "https://www.focusjunior.it/scuola/storia/la-peste-nera/" },
  ]);
  assert.deepEqual(fontiCitate([{ type: "text", text: "niente" }]), []);
});

test("la spiegazione tiene solo le fonti scelte fra quelle citate: un numero inventato non diventa un link", () => {
  const fonti = fontiCitate(RICERCA);
  const s = spiegazioneDaRisposta({ spiegazione: " Negli appunti c'è... ", esempio: "Pensa a...", analogia: "È come...", fonti: [2, 2, 9, 0] }, fonti, "3");
  assert.equal(s.spiegazione, "Negli appunti c'è...");
  assert.deepEqual(s.fonti, [fonti[1]]); // 2 = seconda fonte; 9 e 0 non esistono
  assert.equal(s.eta, 13); // 3ª media
  assert.equal(spiegazioneDaRisposta({ spiegazione: "x", esempio: "", analogia: "", fonti: [] }, fonti, "2").eta, 12);
  assert.equal(spiegazioneDaRisposta({ spiegazione: "x", esempio: "", analogia: "", fonti: [] }, fonti, null).eta, 12);
});

import { promptRicercaSpiegazione, promptSpiegazione, promptRicercaArricchisci, promptArricchisci } from "../supabase/functions/_shared/prompt.js";

const CONCETTO = { titolo: "Arrivo della peste", descrizione: "dai porti nel 1347", ancora: "Nel 1347 la peste arrivò a Messina" };
const BASE = { materia: "storia", argomento: "La peste del Trecento", classe: "2", concetto: CONCETTO };

test("prompt della spiegazione: parte dagli appunti, età giusta, errore se c'è, fonti numerate", () => {
  const ricerca = promptRicercaSpiegazione({ ...BASE, errore: { domanda: "Quando arrivò?", risposta_alunna: "Nel 1492", risposta_attesa: "Nel 1347" } });
  assert.match(ricerca, /12 anni/);
  assert.match(ricerca, /Nel 1347 la peste arrivò a Messina/);
  assert.match(ricerca, /Nel 1492/);
  assert.doesNotMatch(promptRicercaSpiegazione(BASE), /ha risposto/); // senza errore, niente errore
  const finale = promptSpiegazione({ ...BASE, classe: "3", ricerca: "Appunti di ricerca.", fonti: FONTI_PROVA });
  assert.match(finale, /13 anni/);
  assert.match(finale, /Parti da quello che c'è negli appunti/);
  assert.match(finale, /1\. Peste - Treccani — https:\/\/www\.treccani\.it\/enciclopedia\/peste/);
  assert.match(finale, /da 6 a 10 righe/);
  assert.match(finale, /Appunti di ricerca\./);
});

test("prompt dell'arricchimento: agganci con id brevi, al massimo 6 nodi, niente domande di verifica", () => {
  const agganci = [{ breve: "n1", titolo: "Arrivo della peste" }, { breve: "n2", titolo: "I flagellanti" }];
  const ricerca = promptRicercaArricchisci({ materia: "storia", argomento: "La peste", classe: "3", agganci });
  assert.match(ricerca, /n1: Arrivo della peste/);
  assert.match(ricerca, /13 anni/);
  const finale = promptArricchisci({ materia: "storia", argomento: "La peste", classe: "3", agganci, ricerca: "Trovato.", fonti: FONTI_PROVA });
  assert.match(finale, /fino a 6/);
  assert.match(finale, /aggancio/);
  assert.match(finale, /2\. La peste nera - Focus Junior/);
  for (const p of [ricerca, finale]) assert.match(p, /non .*domande di verifica/i);
});

const FONTI_PROVA = [
  { titolo: "Peste - Treccani", url: "https://www.treccani.it/enciclopedia/peste" },
  { titolo: "La peste nera - Focus Junior", url: "https://www.focusjunior.it/la-peste-nera/" },
];
