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
// domini: per i video (issue #23) la ricerca va solo su DOMINI_VIDEO.
export function strumentoRicerca(domini = DOMINI_CONSENTITI) {
  return { type: "web_search_20260209", name: "web_search", max_uses: MAX_RICERCHE, allowed_domains: domini, allowed_callers: ["direct"] };
}

// Vero se l'indirizzo è https e sta su un dominio della lista o su un suo sottodominio.
// Secondo controllo dopo quello della API: un link che arriva alla ragazza passa da qui.
export function dominioConsentito(url, domini = DOMINI_CONSENTITI) {
  let host;
  try {
    const u = new URL(String(url));
    if (u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return domini.some((d) => host === d || host.endsWith("." + d));
}

// Fonti citate davvero nella risposta della ricerca (citazioni web_search_result_location),
// una volta sola, nell'ordine in cui compaiono, e solo dai domini consentiti.
export function fontiCitate(contenuto, domini = DOMINI_CONSENTITI) {
  const viste = new Set();
  const fonti = [];
  for (const blocco of contenuto || []) {
    if (!blocco || blocco.type !== "text") continue;
    for (const c of blocco.citations || []) {
      if (!c || c.type !== "web_search_result_location" || viste.has(c.url) || !dominioConsentito(c.url, domini)) continue;
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

// ------------------------------------------------------------------ video scelti (issue #23)
// Due video brevi per argomento, cercati solo su YouTube e Rai. Questi domini non entrano in
// DOMINI_CONSENTITI: le altre ricerche (spiega, arricchisci) restano sui siti di sempre.
export const DOMINI_VIDEO = ["youtube.com", "raiscuola.rai.it"]; // raiplay.it non è raggiungibile dalla ricerca web di Anthropic (400, prova del 16/11/2026)
export const MAX_VIDEO = 2, MAX_MINUTI_VIDEO = 10;

// L'id di un video YouTube (11 caratteri) da watch?v=, shorts/, embed/; null per tutto il resto.
export function idYoutube(url) {
  if (!dominioConsentito(url, ["youtube.com"])) return null;
  const u = new URL(url);
  const id = u.pathname === "/watch" ? u.searchParams.get("v") : (/^\/(?:shorts|embed|live)\/([^/]+)/.exec(u.pathname) || [])[1];
  return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
}
const sitoVideo = (url) => (dominioConsentito(url, ["youtube.com"]) ? "YouTube" : "Rai Scuola");
// La durata deve comparire intera nel testo: 6:40 non combacia dentro 16:40 o 6:40:10, 8 min non dentro 18 minuti.
const dentroIntera = (d, testo) => new RegExp("(?<![\\d:.,])" + d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\d:])", "i").test(testo);

// "6:40", "1:02:00", "8 minuti", "8 min" → minuti; null se non si legge.
function minuti(durata) {
  const d = String(durata || "").trim().toLowerCase();
  const p = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(d);
  if (p) return Number(p[1] || 0) * 60 + Number(p[2]) + Number(p[3]) / 60;
  const m = /^(\d{1,3}) ?min(?:uti)?$/.exec(d);
  return m ? Number(m[1]) : null;
}

export function promptRicercaVideo({ materia, argomento, classe, concetti }) {
  return [
    "Cerca su YouTube e su Rai Scuola (al massimo tre ricerche) 3 o 4 video brevi, al massimo " + MAX_MINUTI_VIDEO + " minuti, in italiano, che spiegano bene questo argomento a ragazz* di " + etaDaClasse(classe) + " anni.",
    "Materia: " + materia + ". Argomento: " + argomento + "." + ((concetti || []).length ? "\nPunti: " + concetti.join("; ") + "." : ""),
    "Preferisci canali di scuola, di divulgazione o di insegnanti. Niente video per adulti, niente pubblicità, niente video lunghi.",
    "Per ogni video scrivi il titolo, il canale e la durata solo se li leggi nei risultati, citando la pagina del video (non una pagina di elenco o di canale).",
    NIENTE_DOMANDE,
  ].join("\n\n");
}
const NIENTE_DOMANDE = "Non scrivere domande di verifica: i video servono solo a capire meglio.";

export function promptVideo({ materia, argomento, classe, ricerca, fonti }) {
  return [
    "Scegli i " + MAX_VIDEO + " video più adatti a spiegare questo argomento a ragazz* di " + etaDaClasse(classe) + " anni: pertinenti, brevi (al massimo " + MAX_MINUTI_VIDEO + " minuti), in italiano.",
    "Materia: " + materia + ". Argomento: " + argomento + ".",
    "fonte = il numero del video nell'elenco qui sotto. durata (per esempio 6:40) e canale: copiali da quello che è stato trovato; se non ci sono, stringa vuota. Non inventare durate o canali. Se un video non è pertinente, non sceglierlo: meglio uno solo o nessuno.",
    "Quello che è stato trovato:\n" + (ricerca || "(niente)"),
    "Video:\n" + fonti.map((f, i) => i + 1 + ". " + f.titolo + " — " + f.url).join("\n"),
  ].join("\n\n");
}

// grezza: { video: [{ fonte: numero, durata, canale }] } → al più MAX_VIDEO video pronti da mostrare.
// Durata e canale solo se compaiono nel testo della ricerca; con una durata oltre i 10 minuti il video non entra.
export function videoScelti(grezza, fonti, ricerca) {
  const nella = String(ricerca || "").toLowerCase();
  const visti = new Set(), video = [];
  for (const g of Array.isArray(grezza && grezza.video) ? grezza.video : []) {
    const f = fontiScelte([g && g.fonte], fonti)[0];
    if (!f || visti.has(f.url) || video.length >= MAX_VIDEO) continue;
    const d = pulito(g.durata), c = pulito(g.canale).slice(0, 80);
    const durata = d && minuti(d) !== null && dentroIntera(d, nella) ? d : "";
    if (durata && minuti(durata) > MAX_MINUTI_VIDEO) continue;
    visti.add(f.url);
    const id = idYoutube(f.url);
    video.push({ titolo: f.titolo.slice(0, 160), url: f.url, sito: sitoVideo(f.url),
      embed: id ? "https://www.youtube-nocookie.com/embed/" + id : "", anteprima: id ? "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" : "",
      durata, canale: c && nella.includes(c.toLowerCase()) ? c : "" });
  }
  return video;
}
