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

// ---------------------------------------------------------------- pannello admin (issue #35)

export const GIORNI_CESTINO = 30;

// Codice nuovo a 4 cifre, uniforme: da 2 byte (0..65535) si scartano i valori ≥ 60000 (multiplo di 10000).
export function nuovoCodice(byte = casuali) {
  for (;;) {
    const [a, b] = byte(2);
    const n = a * 256 + b;
    if (n < 60000) return String(n % 10000).padStart(4, "0");
  }
}

// Nome utente scelto dall'admin: minuscolo, comincia con lettera o cifra, poi lettere, cifre e trattini, 3-40 caratteri.
export function validaNomeUtente(t) {
  const n = typeof t === "string" ? t.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9-]{2,39}$/.test(n) ? n : null;
}

// Righe nel cestino da più di GIORNI_CESTINO giorni.
export const scaduti = (righe, ora = Date.now()) =>
  righe.filter((r) => r.cestino && Date.parse(r.cestino) <= ora - GIORNI_CESTINO * 86400000);

// Conferma dell'eliminazione: il nome scritto per intero (spazi ai lati e maiuscole non contano).
export const confermaNome = (scritto, nome) => {
  const pulisci = (x) => String(x ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return pulisci(nome) !== "" && pulisci(scritto) === pulisci(nome);
};

// Pulizia del cestino (issue #35): cosa cancellare in un giro. Una famiglia scaduta porta con sé tutti i suoi figli; un
// figlio scaduto in una famiglia attiva va da solo. Le famiglie protette (controllo mattutino) non si toccano mai.
// Oltre la soglia il giro non cancella niente e fallisce: un numero così alto è più probabilmente un errore che un caso vero.
export const SOGLIA_PULIZIA = { famiglie: 3, profili: 5 };
export function pianoPulizia({ famiglie, figli }, ora = Date.now()) {
  const protette = new Set(famiglie.filter((f) => f.protetta).map((f) => f.id));
  const fam = scaduti(famiglie.filter((f) => !f.protetta), ora).map((f) => ({ ...f, figli: figli.filter((s) => s.famiglia_id === f.id).map((s) => s.id) }));
  const viaConFamiglia = new Set(fam.flatMap((f) => f.figli));
  const soli = scaduti(figli, ora).filter((s) => !viaConFamiglia.has(s.id) && !protette.has(s.famiglia_id)).map((s) => s.id);
  const profili = viaConFamiglia.size + soli.length;
  return { famiglie: fam, figli: soli, profili, troppi: fam.length > SOGLIA_PULIZIA.famiglie || profili > SOGLIA_PULIZIA.profili };
}

// Azioni del pannello admin che non chiedono il motivo e non guardano la famiglia protetta: solo letture di sintesi.
export const AZIONI_LETTURA = new Set(["riepilogo", "consumi", "registro"]);

// Registro dell'amministratore (issue #37): si tiene 12 mesi di calendario (informativa), poi la pulizia del mattino
// lo cancella. Oltre SOGLIA_REGISTRO righe in un giro non si cancella niente: più probabilmente è un errore.
export const SOGLIA_REGISTRO = 500;
export function limiteRegistro(ora = Date.now()) {
  const d = new Date(ora);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString();
}
export const pianoRegistro = (n) => ({ cancella: n > 0 && n <= SOGLIA_REGISTRO, troppi: n > SOGLIA_REGISTRO });
