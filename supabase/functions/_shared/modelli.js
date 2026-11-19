// Quale modello per quale azione e quanto costa (branch ottimizzazione).
// La tabella viene dal confronto vero Opus / Sonnet / Haiku sulle stesse prove (rapporto nella issue #29):
// per ogni azione il modello più economico che dà lo stesso risultato; nel dubbio, o se non provata, Opus.

export const OPUS = "claude-opus-5-5";
export const SONNET = "claude-sonnet-5-5";
export const HAIKU = "claude-haiku-5-5";
const NOTI = [OPUS, SONNET, HAIKU];

export const MODELLO_PER_AZIONE = {
  // Provate nel confronto del 16 novembre 2026: 2 giri sulle stesse prove, giudizio alla cieca della qualità,
  // più 8 foto vere per la trascrizione. Esempi e numeri nel rapporto della issue #29.
  trascrivi: OPUS,      // Haiku rifiuta le pagine di libro («protetto da copyright») o le riassume; Sonnet ha numeri diversi in 4 foto vere su 8
  smista: HAIKU,        // materie, pagina di diario e data giuste in tutti i giri, uguale a Opus (la data la calcola il server)
  correggi: SONNET,     // 6 risposte su 6 nella fascia giusta in tutti i giri, commenti di qualità pari (Haiku: errori di contenuto)
  compito: OPUS,        // Sonnet: un maschile («Attento») e verifica incompleta in un giro; Haiku: strategia sbagliata, Linda in 3 passi
  compito_domanda: OPUS, // tutor: Opus spiega meglio il perché dell'errore tipico in tutti e due i giri
  gemelli: OPUS,        // Sonnet quasi pari ma con difetti di grammatica e contesti poco credibili in un giro: nel dubbio Opus
  punti_chiave: SONNET, // meglio di Opus in tutti e due i giri: meno frasi tolte dal filtro di ancoraggio
  // Non provate nel confronto: restano su Opus.
  concetti: OPUS, esercizi_tipi: OPUS, esercizi_genera: OPUS, esercizi_correggi: OPUS, mappa: OPUS, sintesi: OPUS,
  domande: OPUS, spiega: OPUS, arricchisci: OPUS, video: OPUS, lezione: OPUS, poesia: OPUS, invalsi: OPUS,
  esame: OPUS, strumento: OPUS, racconto: OPUS,
  prova_tu: OPUS, // di solito non chiama il modello (risposta controllata dal server)
};

// Effort per azione; senza voce nessun effort, cioè il default dell'API. Nel dubbio non si abbassa.
// trascrivi resta senza effort: con "low" (prova del 19 novembre 2026, stesse 5 foto, 6 giri) le frazioni scritte
// a mano perdevano le parentesi in 2 giri su 6 e la lettura era più lenta, non più veloce (rapporto nella #29).
export const EFFORT_PER_AZIONE = {};
const EFFORT_NOTI = ["low", "medium", "high", "max"];
// Come modelloPer: richiesto vale solo per gli account di prova e solo verso un effort noto.
export function effortPer(azione, { prova = false, richiesto = "" } = {}) {
  if (prova && EFFORT_NOTI.includes(richiesto)) return richiesto;
  return EFFORT_PER_AZIONE[azione];
}

// richiesto vale solo per gli account di prova (app_metadata.prova, scritto solo dal server) e solo verso un modello noto.
export function modelloPer(azione, { prova = false, richiesto = "" } = {}) {
  if (prova && NOTI.includes(richiesto)) return richiesto;
  return MODELLO_PER_AZIONE[azione] ?? OPUS;
}

// Dollari per milione di token, da platform.claude.com/docs/en/about-claude/pricing (16 novembre 2026).
// Haiku 5.5 costa così solo fino a 100.000 token di prompt: qui i prompt restano molto sotto.
const PREZZI = {
  [OPUS]: { input: 4, output: 20, cache_scritti: 5, cache_letti: 0.2 },
  [SONNET]: { input: 2, output: 10, cache_scritti: 2.5, cache_letti: 0.1 },
  [HAIKU]: { input: 0.1, output: 0.5, cache_scritti: 0.125, cache_letti: 0.01 },
};
export function costoUsd(modello, u = {}) {
  const p = PREZZI[modello] ?? PREZZI[OPUS];
  const n = (x) => Number(x) || 0;
  return (n(u.input_tokens) * p.input + n(u.output_tokens) * p.output +
    n(u.cache_creation_input_tokens) * p.cache_scritti + n(u.cache_read_input_tokens) * p.cache_letti) / 1e6;
}

// Tetto delle chiamate e consumo (issue #30): nel database, funzione prenota_chiamata e tabella consumi.
