// Quale modello per quale azione, quanto costa, quanto si è speso oggi (branch ottimizzazione).
// La tabella viene dal confronto vero Opus / Sonnet / Haiku sulle stesse prove (rapporto nella issue #29):
// per ogni azione il modello più economico che dà lo stesso risultato; nel dubbio, o se non provata, Opus.

export const OPUS = "claude-opus-5-5";
export const SONNET = "claude-sonnet-5-5";
export const HAIKU = "claude-haiku-5-5";
const NOTI = [OPUS, SONNET, HAIKU];

export const MODELLO_PER_AZIONE = {
  // provate nel confronto
  trascrivi: OPUS,
  smista: OPUS,
  correggi: OPUS,
  compito: OPUS,
  compito_domanda: OPUS,
  gemelli: OPUS,
  punti_chiave: OPUS,
  // non provate nel confronto: restano su Opus
  concetti: OPUS, esercizi_tipi: OPUS, esercizi_genera: OPUS, esercizi_correggi: OPUS, mappa: OPUS, sintesi: OPUS,
  domande: OPUS, spiega: OPUS, arricchisci: OPUS, video: OPUS, lezione: OPUS, poesia: OPUS, invalsi: OPUS,
  esame: OPUS, strumento: OPUS, racconto: OPUS,
  prova_tu: OPUS, // di solito non chiama il modello (risposta controllata dal server)
};

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

// Tetto su tutte le chiamate al modello di un profilo in un giorno (ora di Roma), aiuti compresi.
export const TETTO_CHIAMATE = 150;
const CAMPI = ["chiamate", "input", "output", "cache_scritti", "cache_letti", "costo"];
const arrotonda = (x) => Math.round(x * 1e6) / 1e6;

export function consumoDelGiorno(appMetadata, giorno) {
  const c = appMetadata?.consumo;
  const oggi = c && c.giorno === giorno;
  return Object.fromEntries([["giorno", giorno], ...CAMPI.map((k) => [k, oggi ? Number(c[k]) || 0 : 0])]);
}
export const tettoRaggiunto = (appMetadata, giorno) => consumoDelGiorno(appMetadata, giorno).chiamate >= TETTO_CHIAMATE;
export function consumoAggiornato(appMetadata, giorno, delta) {
  const c = consumoDelGiorno(appMetadata, giorno);
  for (const k of CAMPI) c[k] = arrotonda(c[k] + (Number(delta[k]) || 0));
  return c;
}
