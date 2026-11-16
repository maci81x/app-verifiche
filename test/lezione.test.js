// Issue #23, la parte del server: mini-lezione a schede (_shared/lezione.js) e video scelti (_shared/web.js).
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pulisciLezione, promptLezione, TIPI_SCHEDA, MIN_SCHEDE, MAX_SCHEDE } from "../supabase/functions/_shared/lezione.js";
import { DOMINI_VIDEO, DOMINI_CONSENTITI, strumentoRicerca, fontiCitate, idYoutube, videoScelti, promptRicercaVideo, promptVideo } from "../supabase/functions/_shared/web.js";

const STORIA = {
  titolo: "La caduta dell'Impero romano", materia: "Storia",
  trascrizione: "Nel 395 l'imperatore Teodosio divise l'impero in due parti: l'Impero romano d'Occidente e l'Impero romano d'Oriente. " +
    "Nel 476 Odoacre depose l'ultimo imperatore d'Occidente, Romolo Augustolo. Questa data segna la fine dell'età antica e l'inizio del Medioevo.",
  concetti: [{ titolo: "Divisione dell'impero", ancora: "Nel 395 l'imperatore Teodosio divise l'impero in due parti" }],
};
const NESSUNA = { tipo: "nessuna", forma: "nessuna", misure: [], eventi: [], passi: [], gruppi: [] };
const scheda = (tipo, extra = {}) => ({ tipo, titolo: "Titolo " + tipo, testo: "Testo della scheda " + tipo + ".", ancora: "", calcoli: [], figura: NESSUNA, ...extra });
const BASE = [scheda("domanda"), scheda("nomi"), scheda("regola", { ancora: "Nel 476 Odoacre depose l'ultimo imperatore d'Occidente" }), scheda("esempio"), scheda("tocca")];

test("lezione: schede nell'ordine fisso, fonte appunti, ancora vera tenuta", () => {
  const l = pulisciLezione({ schede: [BASE[1], BASE[0], ...BASE.slice(2)] }, STORIA);
  assert.deepEqual(l.schede.map((s) => s.tipo), TIPI_SCHEDA);
  assert.ok(l.schede.every((s) => s.fonte === "appunti"));
  assert.equal(l.schede[2].ancora, "Nel 476 Odoacre depose l'ultimo imperatore d'Occidente");
  assert.equal(l.scartate, 0);
  assert.equal(l.schede[0].figura, null);
});

test("lezione: un'ancora che non sta negli appunti si toglie (la scheda resta) e si conta", () => {
  const l = pulisciLezione({ schede: [...BASE.slice(0, 2), scheda("regola", { ancora: "Nel 1492 Colombo scoprì l'America con tre caravelle" }), ...BASE.slice(3)] }, STORIA);
  assert.equal(l.schede[2].ancora, "");
  assert.equal(l.scartate, 1);
  // data cambiata: non regge
  const d = pulisciLezione({ schede: [...BASE.slice(0, 2), scheda("regola", { ancora: "Nel 486 Odoacre depose l'ultimo imperatore d'Occidente" }), ...BASE.slice(3)] }, STORIA);
  assert.equal(d.schede[2].ancora, "");
});

test("lezione: un conto che non torna fa cadere la scheda; quelli giusti restano", () => {
  const giusto = scheda("esempio", { calcoli: ["3/4 × 12 = 36/4 = 9"] });
  const rotto = scheda("esempio", { titolo: "Altro esempio", calcoli: ["3/4 × 12 = 8"] });
  const l = pulisciLezione({ schede: [BASE[0], BASE[1], BASE[2], giusto, rotto, BASE[4]] }, STORIA);
  assert.equal(l.schede.filter((s) => s.tipo === "esempio").length, 1);
  assert.deepEqual(l.schede[3].calcoli, ["3/4 × 12 = 36/4 = 9"]);
  assert.equal(l.scartate, 1);
});

test("lezione: troppo poche schede buone → null; mai più di MAX_SCHEDE", () => {
  assert.equal(pulisciLezione({ schede: BASE.slice(0, MIN_SCHEDE - 1) }, STORIA), null);
  assert.equal(pulisciLezione(null, STORIA), null);
  assert.equal(pulisciLezione({ schede: [{ tipo: "boh", titolo: "x", testo: "y" }, ...BASE.slice(0, 3)] }, STORIA), null);
  const tante = pulisciLezione({ schede: [BASE[0], BASE[1], BASE[2], ...Array.from({ length: 8 }, () => BASE[3]), BASE[4]] }, STORIA);
  assert.equal(tante.schede.length, MAX_SCHEDE);
  assert.equal(tante.schede[MAX_SCHEDE - 1].tipo, "tocca", "l'ultima resta «Ora tocca a te»");
});

test("figure: linea del tempo solo con anni scritti negli appunti, in ordine", () => {
  const f = { ...NESSUNA, tipo: "linea_tempo", eventi: [{ anno: 476, etichetta: "Fine dell'Impero d'Occidente" }, { anno: 395, etichetta: "Divisione dell'impero" }, { anno: 410, etichetta: "Sacco di Roma" }] };
  const l = pulisciLezione({ schede: [BASE[0], { ...BASE[1], figura: f }, ...BASE.slice(2)] }, STORIA);
  assert.deepEqual(l.schede[1].figura, { tipo: "linea_tempo", eventi: [{ anno: 395, etichetta: "Divisione dell'impero" }, { anno: 476, etichetta: "Fine dell'Impero d'Occidente" }] });
  assert.equal(l.scartate, 1, "il 410 non è negli appunti");
  // con un solo anno vero non c'è linea
  const una = pulisciLezione({ schede: [BASE[0], { ...BASE[1], figura: { ...f, eventi: [f.eventi[0], f.eventi[2]] } }, ...BASE.slice(2)] }, STORIA);
  assert.equal(una.schede[1].figura, null);
});

test("figure: geometria con le misure del testo, frecce e gruppi brevi", () => {
  const geo = { ...NESSUNA, tipo: "geometria", forma: "rettangolo", misure: [{ nome: "base", valore: "8 cm" }, { nome: "altezza", valore: "5 cm" }] };
  const l = pulisciLezione({ schede: [BASE[0], BASE[1], BASE[2], scheda("esempio", { testo: "Un rettangolo ha base 8 cm e altezza 5 cm.", calcoli: ["8 × 5 = 40"], figura: geo }), BASE[4]] }, STORIA);
  assert.deepEqual(l.schede[3].figura, { tipo: "geometria", forma: "rettangolo", misure: [{ nome: "base", valore: "8 cm" }, { nome: "altezza", valore: "5 cm" }] });
  // una misura inventata (non nel testo) non entra
  const inv = pulisciLezione({ schede: [BASE[0], BASE[1], BASE[2], scheda("esempio", { testo: "Un rettangolo ha base 8 cm.", figura: { ...geo, misure: [{ nome: "altezza", valore: "7 cm" }] } }), BASE[4]] }, STORIA);
  assert.equal(inv.schede[3].figura, null);
  const frecce = pulisciLezione({ schede: [BASE[0], { ...BASE[1], figura: { ...NESSUNA, tipo: "frecce", passi: ["Evaporazione", "Condensazione", "Precipitazione", " "] } }, ...BASE.slice(2)] }, STORIA);
  assert.deepEqual(frecce.schede[1].figura, { tipo: "frecce", passi: ["Evaporazione", "Condensazione", "Precipitazione"] });
  const gruppi = pulisciLezione({ schede: [BASE[0], { ...BASE[1], figura: { ...NESSUNA, tipo: "gruppi", gruppi: [{ titolo: "Vertebrati", voci: ["pesci", "uccelli"] }, { titolo: "Invertebrati", voci: ["insetti"] }] } }, ...BASE.slice(2)] }, STORIA);
  assert.equal(gruppi.schede[1].figura.gruppi.length, 2);
  // una freccia sola non è uno schema
  const una = pulisciLezione({ schede: [BASE[0], { ...BASE[1], figura: { ...NESSUNA, tipo: "frecce", passi: ["Solo"] } }, ...BASE.slice(2)] }, STORIA);
  assert.equal(una.schede[1].figura, null);
});

test("prompt della lezione: appunti, struttura fissa, frase copiata, niente persone o luoghi disegnati", () => {
  const p = promptLezione({ classe: "2", ...STORIA });
  assert.match(p, /Teodosio/);
  assert.match(p, /domanda.*nomi.*regola.*esempio.*tocca/s);
  assert.match(p, /copiata/);
  assert.match(p, /linea_tempo/);
  assert.match(p, /mai persone/i);
});

/* ------------------------------------------------------------------ video */

test("video: ricerca solo su YouTube e Rai; le altre ricerche restano sui siti di sempre", () => {
  assert.deepEqual(DOMINI_VIDEO, ["youtube.com", "raiplay.it", "raiscuola.rai.it"]);
  assert.deepEqual(strumentoRicerca(DOMINI_VIDEO).allowed_domains, DOMINI_VIDEO);
  assert.deepEqual(strumentoRicerca().allowed_domains, DOMINI_CONSENTITI);
  assert.ok(!DOMINI_CONSENTITI.includes("youtube.com"));
});

test("video: id di YouTube solo da indirizzi veri", () => {
  assert.equal(idYoutube("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://www.youtube.com/channel/UC123"), null);
  assert.equal(idYoutube("https://www.youtube.com/watch?v=corto"), null);
  assert.equal(idYoutube("https://evil.com/watch?v=dQw4w9WgXcQ"), null);
});

const CERCA = [
  { type: "text", text: "Ho trovato due video.", citations: [] },
  { type: "text", text: "La caduta dell'Impero romano spiegata ai ragazzi, canale Storia Facile, durata 6:40.", citations: [
    { type: "web_search_result_location", url: "https://www.youtube.com/watch?v=AAAAAAAAAAA", title: "La caduta dell'Impero romano", cited_text: "..." },
  ] },
  { type: "text", text: "Rai Scuola: Odoacre e la fine dell'Occidente, 8 minuti.", citations: [
    { type: "web_search_result_location", url: "https://www.raiscuola.rai.it/storia/articoli/2021/01/odoacre", title: "Odoacre - Rai Scuola", cited_text: "..." },
  ] },
  { type: "text", text: "Lezione lunga, 45:00.", citations: [
    { type: "web_search_result_location", url: "https://www.youtube.com/watch?v=BBBBBBBBBBB", title: "Lezione universitaria", cited_text: "..." },
    { type: "web_search_result_location", url: "https://it.wikipedia.org/wiki/Odoacre", title: "Odoacre", cited_text: "..." }, // non è un sito di video
  ] },
];

test("video: fonti solo dai siti di video; durata e canale solo se la ricerca li dice; mai più di 10 minuti", () => {
  const fonti = fontiCitate(CERCA, DOMINI_VIDEO);
  assert.deepEqual(fonti.map((f) => f.url), ["https://www.youtube.com/watch?v=AAAAAAAAAAA", "https://www.raiscuola.rai.it/storia/articoli/2021/01/odoacre", "https://www.youtube.com/watch?v=BBBBBBBBBBB"]);
  const ricerca = CERCA.map((b) => b.text).join(" ");
  const v = videoScelti({ video: [
    { fonte: 1, durata: "6:40", canale: "Storia Facile" },
    { fonte: 2, durata: "12:00", canale: "Canale inventato" }, // durata e canale non scritti nella ricerca: non si mostrano
    { fonte: 3, durata: "45:00", canale: "" }, // troppo lungo
    { fonte: 9, durata: "", canale: "" }, // non esiste
  ] }, fonti, ricerca);
  assert.equal(v.length, 2);
  assert.deepEqual(v[0], { titolo: "La caduta dell'Impero romano", url: "https://www.youtube.com/watch?v=AAAAAAAAAAA", sito: "YouTube",
    embed: "https://www.youtube-nocookie.com/embed/AAAAAAAAAAA", anteprima: "https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg", durata: "6:40", canale: "Storia Facile" });
  assert.deepEqual(v[1], { titolo: "Odoacre - Rai Scuola", url: "https://www.raiscuola.rai.it/storia/articoli/2021/01/odoacre", sito: "Rai Scuola", embed: "", anteprima: "", durata: "", canale: "" });
  assert.ok(!v[0].embed.includes("autoplay"));
  assert.deepEqual(videoScelti(null, fonti, ricerca), []);
  // lo stesso video scelto due volte vale uno
  assert.equal(videoScelti({ video: [{ fonte: 1, durata: "", canale: "" }, { fonte: 1, durata: "", canale: "" }] }, fonti, ricerca).length, 1);
});

test("prompt dei video: brevi, in italiano, adatti all'età; la scelta è per numero", () => {
  const dati = { materia: "Storia", argomento: "La caduta dell'Impero romano", classe: "2", concetti: ["Divisione dell'impero"] };
  assert.match(promptRicercaVideo(dati), /10 minuti/);
  assert.match(promptRicercaVideo(dati), /YouTube/);
  const p = promptVideo({ ...dati, ricerca: "testo", fonti: [{ titolo: "A", url: "https://www.youtube.com/watch?v=AAAAAAAAAAA" }] });
  assert.match(p, /1\. A/);
  assert.match(p, /non inventar/i);
});
