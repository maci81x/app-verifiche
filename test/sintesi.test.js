// «In breve» della mappa (issue #11): parole importanti, numeri e nomi propri dal materiale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sintesiRegge, sintesiPulita, MAX_SINTESI } from "../supabase/functions/_shared/sintesi.js";
import { normalizza } from "../supabase/functions/_shared/ancoraggio.js";

// Il quaderno della fixture test/fixture/quaderno-storia.jpg, trascritto.
const FONTE = normalizza("La peste del Trecento. Nel 1347 la peste nera arrivò in Europa con le navi genovesi partite da Caffa. " +
  "Uccise circa un terzo della popolazione. Si diffondeva con le pulci dei ratti. Conseguenze: mancano contadini, " +
  "i salari aumentano, nascono rivolte.");

test("una sintesi con parole proprie ma presa dal materiale regge", () => {
  assert.equal(sintesiRegge("Nel 1347 la peste nera arrivò in Europa sulle navi genovesi partite da Caffa.", FONTE), true);
  // radici: «contadini» su «contadini», «aumentarono» su «aumentano», «rivolte» su «rivolte»
  assert.equal(sintesiRegge("Dopo la peste mancavano i contadini: per questo i salari aumentarono e nacquero rivolte.", FONTE), true);
});

test("un numero che nel materiale non c'è fa cadere la sintesi", () => {
  assert.equal(sintesiRegge("Nel 1348 la peste nera arrivò in Europa.", FONTE), false);
  assert.equal(sintesiRegge("La peste uccise 25 milioni di persone.", FONTE), false);
});

test("un nome proprio che nel materiale non c'è fa cadere la sintesi", () => {
  assert.equal(sintesiRegge("La peste era causata dal batterio Yersinia, portato dalle pulci dei ratti.", FONTE), false);
  assert.equal(sintesiRegge("Le navi partite da Caffa arrivarono a Messina.", FONTE), false);
});

test("troppe parole importanti fuori dal materiale: scartata", () => {
  assert.equal(sintesiRegge("La peste provocò carestie terribili, processioni religiose e persecuzioni violentissime.", FONTE), false);
});

test("vuota, troppo lunga o con spazi strani", () => {
  assert.equal(sintesiRegge("", FONTE), false);
  assert.equal(sintesiRegge("peste ".repeat(Math.ceil(MAX_SINTESI / 6) + 1), FONTE), false);
  assert.equal(sintesiPulita("  La peste   arrivò in Europa nel 1347.  ", FONTE), "La peste arrivò in Europa nel 1347.");
  assert.equal(sintesiPulita("Nel 1492 Colombo scoprì l'America.", FONTE), "");
});
