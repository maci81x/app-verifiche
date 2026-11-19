// Famiglie esterne (issue #30): funzioni pure usate dalle Edge Function `accedi`, `famiglie`, `profili`, `admin`, `modello`.
import { costoUsd } from "./modelli.js";
// Il caso (byte casuali) arriva da fuori, così i test lo fissano.

// Niente 0, 1, o, l, i: si confondono scrivendoli a mano.
export const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";
const casuali = (n) => crypto.getRandomValues(new Uint8Array(n));
// ponytail: modulo 31 su un byte, distribuzione quasi uniforme; basta per nomi e inviti (il segreto vero è il codice).
const dall = (byte, n) => Array.from(byte(n), (b) => ALFABETO[b % ALFABETO.length]).join("");

// «Maria Chiara» → «maria-chiara-k7m». Il nome vuoto dopo la pulizia diventa «profilo».
export function nomeUtente(nome, byte = casuali) {
  const base = String(nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20).replace(/-+$/, "");
  return (base || "profilo") + "-" + dall(byte, 3);
}

// Come lo scrive chi entra: niente spazi ai lati, minuscole. I due profili nati prima della #30 hanno il nome come nome utente.
export const normalizzaNomeUtente = (t) => String(t ?? "").trim().toLowerCase().slice(0, 40);


export const codiceInvito = (byte = casuali) => dall(byte, 8);

const testo = (v, max) => { const t = typeof v === "string" ? v.trim() : ""; return t && t.length <= max ? t : null; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Il modulo dell'iscrizione (niente telefono: nessuna funzione lo usa, minimizzazione dei dati). { ok: true, dati } oppure { ok: false, campo } con il primo campo che non va.
export function validaIscrizione(b, versioni) {
  if (!b || typeof b !== "object") return { ok: false, campo: "richiesta" };
  const nome = testo(b.nome, 40), cognome = testo(b.cognome, 40);
  if (!nome) return { ok: false, campo: "nome" };
  if (!cognome) return { ok: false, campo: "cognome" };
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (email.length > 120 || !EMAIL.test(email)) return { ok: false, campo: "email" };
  if (typeof b.password !== "string" || b.password.length < 10 || b.password.length > 72) return { ok: false, campo: "password" };
  const c = b.consensi;
  if (!c || typeof c !== "object" || Object.keys(versioni).some((k) => c[k] !== versioni[k])) return { ok: false, campo: "consensi" };
  return { ok: true, dati: { nome, cognome, email, password: b.password } };
}

export const MAX_FIGLI = 4;

// Una riga di `consumi` per ogni chiamata al modello fatta durante una richiesta (issue #30).
const n = (x) => Number(x) || 0;
export const righeConsumo = (chiamate, studente_id, giorno, azione) => chiamate.map(({ modello, usage }) => { const u = usage ?? {}; return {
  studente_id, giorno, azione: String(azione).slice(0, 40), modello,
  input: n(u.input_tokens), output: n(u.output_tokens), cache_scritti: n(u.cache_creation_input_tokens), cache_letti: n(u.cache_read_input_tokens),
  costo: Math.round(costoUsd(modello, u) * 1e6) / 1e6,
}; });

// Il pannello admin: ruolo scritto dal server (app_metadata, mai user_metadata) e verifica in due passaggi fatta (aal2).
export const autorizzaAdmin = (c) => !!c && c.role === "authenticated" && !!c.sub && c.aal === "aal2" && c.app_metadata?.ruolo === "admin";

// «Scarica i miei dati» (portabilità, issue #30): solo campi scelti, mai hash del codice o password.
const CAMPI_GENITORE = ["email", "nome", "cognome", "creato"];
const CAMPI_PROFILO = ["id", "nome", "cognome", "classe", "nome_utente", "creato"];
const scegli = (o, campi) => Object.fromEntries(campi.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
export const esportazione = ({ genitore, consensi, invito, figli }, generato = new Date().toISOString()) => ({
  formato: "10+ export famiglia 1",
  generato,
  genitore: scegli(genitore, CAMPI_GENITORE),
  consensi: consensi ?? [],
  invito: invito ? { codice: invito.codice } : null,
  figli: (figli ?? []).map((f) => ({ profilo: scegli(f.profilo, CAMPI_PROFILO), tabelle: f.tabelle ?? {}, foto: f.foto ?? [] })),
});
