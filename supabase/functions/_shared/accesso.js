// Pezzi comuni allo sblocco dal telefono del genitore (funzioni `accesso` e
// `profili`). JavaScript semplice: gira in Deno e nei test di node.

// Niente lettere o cifre che si confondono a voce o a occhio (0/O, 1/I/L, 2/Z, 5/S, 8/B).
export const ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";
export const LUNGHEZZA_CODICE = 6;
export const DURATA_MS = 10 * 60 * 1000;   // tempo per dare l'ok
export const RITIRO_MS = 5 * 60 * 1000;    // tempo per ritirare l'accesso dopo l'ok
export const MAX_IN_ATTESA = 30;           // richieste aperte insieme, contro chi le genera a raffica

export function casuale(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function nuovoCodice() {
  // Scarto i byte oltre il multiplo più alto di 25 per non favorire le prime lettere.
  const limite = 256 - (256 % ALFABETO.length);
  let c = "";
  while (c.length < LUNGHEZZA_CODICE) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    for (const x of b) if (x < limite && c.length < LUNGHEZZA_CODICE) c += ALFABETO[x % ALFABETO.length];
  }
  return c;
}

// Quello che scrive il genitore: minuscole, spazi e trattini vanno bene.
export function normalizzaCodice(s) {
  return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function codiceValido(s) {
  return s.length === LUNGHEZZA_CODICE && [...s].every((ch) => ALFABETO.includes(ch));
}

export async function sha256(testo) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
}

// Confronto a tempo costante fra due stringhe esadecimali.
export function uguali(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function pinValido(pin) {
  return /^\d{4}$/.test(String(pin == null ? "" : pin));
}
