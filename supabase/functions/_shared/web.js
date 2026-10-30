// Il web come aiuto allo studio (issue #4). Mai come fonte delle domande di verifica.
// JavaScript puro: lo usano la Edge Function `modello` e i test.
//
// La ricerca la fa lo strumento web_search della Claude API, dentro la stessa
// richiesta al modello: nessuna chiave in più, nessun altro servizio.

// ------------------------------------------------------------------ siti consentiti
// L'unico elenco dei siti in cui il modello può cercare. Per aggiungerne uno basta
// una riga qui (dominio senza https://, i sottodomini sono compresi) e un nuovo
// deploy di `modello`. Lista approvata il 30/10/2026 e tracciata sulla issue #4.
// Esclusi apposta i siti di riassunti scritti dagli utenti (skuola.net,
// studenti.it, docsity.com): la qualità non è controllata.
// Tolto il 30/10/2026 (issue #10): nationalgeographic.it blocca il crawler di Anthropic e
// l'API rifiuta l'intera ricerca se un dominio della lista non è raggiungibile.
export const SITI_CONSENTITI = [
  // enciclopedie e lingua
  ["treccani.it", "Enciclopedia e Vocabolario Treccani"],
  ["it.wikipedia.org", "consultazione generale"],
  ["sapere.it", "Enciclopedia De Agostini"],
  ["accademiadellacrusca.it", "lingua italiana, grammatica"],
  // divulgazione, anche per ragazzi
  ["raiscuola.rai.it", "Rai Scuola: schede e video didattici"],
  ["focusjunior.it", "scienza e storia per 8-14 anni"],
  ["focus.it", "divulgazione scientifica"],
  ["storicang.it", "Storica National Geographic"],
  // istituti scientifici e dati
  ["ingv.it", "terremoti e vulcani"],
  ["inaf.it", "astronomia"],
  ["museogalileo.it", "storia della scienza"],
  ["istat.it", "popolazione, dati per geografia"],
  // scuola e matematica
  ["zanichelli.it", "risorse online dei libri di scuola"],
  ["deascuola.it", "De Agostini Scuola"],
  ["youmath.it", "matematica spiegata passo passo"],
];
export const DOMINI_CONSENTITI = SITI_CONSENTITI.map(([dominio]) => dominio);

export const MAX_RICERCHE = 3;

// Marcatore dei nodi (e di qualsiasi contenuto) arrivati dal web.
export const FONTE_WEB = "web";

// Strumento di ricerca per la Claude API: poche ricerche, solo nei siti della lista.
// allowed_callers "direct" (issue #10): senza, la versione 20260209 cerca da dentro
// l'esecuzione di codice (filtro dinamico) e il testo finale può arrivare senza le
// citazioni da cui prendiamo le fonti. Con tre ricerche il filtro dinamico non serve.
export function strumentoRicerca() {
  return { type: "web_search_20260209", name: "web_search", max_uses: MAX_RICERCHE, allowed_domains: DOMINI_CONSENTITI, allowed_callers: ["direct"] };
}

// Vero se l'indirizzo è https e sta su un dominio della lista o su un suo sottodominio.
// Secondo controllo dopo quello della API: un link che arriva alla ragazza passa da qui.
export function dominioConsentito(url) {
  let host;
  try {
    const u = new URL(String(url));
    if (u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return DOMINI_CONSENTITI.some((d) => host === d || host.endsWith("." + d));
}

// Fonti citate davvero nella risposta della ricerca (citazioni web_search_result_location),
// una volta sola, nell'ordine in cui compaiono, e solo dai domini consentiti.
export function fontiCitate(contenuto) {
  const viste = new Set();
  const fonti = [];
  for (const blocco of contenuto || []) {
    if (!blocco || blocco.type !== "text") continue;
    for (const c of blocco.citations || []) {
      if (!c || c.type !== "web_search_result_location" || viste.has(c.url) || !dominioConsentito(c.url)) continue;
      viste.add(c.url);
      fonti.push({ titolo: String(c.title || c.url), url: c.url });
    }
  }
  return fonti;
}

// Testo della ricerca (gli appunti che il modello ha preso leggendo le fonti).
export function testoRicerca(contenuto) {
  return (contenuto || []).filter((b) => b && b.type === "text").map((b) => b.text).join("").trim();
}

// Le fonti nel prompt di composizione sono numerate da 1: il modello sceglie i numeri,
// mai gli indirizzi, così un link inventato non può arrivare all'app.
export function fontiScelte(numeri, fonti) {
  const scelte = new Set();
  for (const n of Array.isArray(numeri) ? numeri : []) {
    const i = Number(n) - 1;
    if (Number.isInteger(i) && i >= 0 && i < fonti.length) scelte.add(i);
  }
  return [...scelte].map((i) => fonti[i]);
}

// Età da usare per il tono: 2ª media → 12 anni, 3ª → 13. Senza classe, 12.
export const etaDaClasse = (classe) => (String(classe || "").trim().startsWith("3") ? 13 : 12);

const pulito = (v) => String(v == null ? "" : v).trim();

// grezza: { spiegazione, esempio, analogia, fonti: [numeri] } dalla composizione.
export function spiegazioneDaRisposta(grezza, fonti, classe) {
  return {
    spiegazione: pulito(grezza && grezza.spiegazione),
    esempio: pulito(grezza && grezza.esempio),
    analogia: pulito(grezza && grezza.analogia),
    fonti: fontiScelte(grezza && grezza.fonti, fonti),
    eta: etaDaClasse(classe),
  };
}
