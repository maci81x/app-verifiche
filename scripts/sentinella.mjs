// Avviso guasti: chiamate di prova a modello, accedi (nome utente inesistente) e profili con i profili di prova, ogni mattina dal
// workflow «Controllo mattutino». Se un controllo fallisce o supera il suo tempo, lo script esce con 1, il
// workflow fallisce e GitHub manda la mail. Le credenziali arrivano dai Secrets del repo (variabili
// d'ambiente) e nei log si scrivono solo nome del controllo, esito e tempo.
//   node scripts/sentinella.mjs           (con le variabili di .github/workflows/controllo-mattutino.yml)
//   PROVA_GUASTO=true node ...            fa fallire apposta il controllo di modello (prova della mail)
const SITO = "https://maci81x.github.io/app-verifiche/";

// Un controllo: ok o NO, con il tempo; oltre il limite fallisce anche se poi risponderebbe.
export async function controlla({ nome, limite, fn }) {
  const t0 = Date.now();
  let timer;
  const scaduto = new Promise((_, no) => { timer = setTimeout(() => no(new Error("più di " + limite / 1000 + " s")), limite); });
  try {
    const nota = await Promise.race([fn(), scaduto]);
    return { ok: true, riga: "ok  " + nome + ": " + nota + " (" + Math.round((Date.now() - t0) / 100) / 10 + " s)" };
  } catch (e) {
    return { ok: false, riga: "NO  " + nome + ": " + (e && e.message ? e.message : String(e)) };
  } finally { clearTimeout(timer); }
}

const env = (k) => { const v = process.env[k]; if (!v) throw new Error("manca il secret " + k); return v; };
async function chiama(url, corpo, token) {
  const r = await fetch(url, { method: "POST", headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), authorization: "Bearer " + (token || env("SUPABASE_PUBLISHABLE_KEY")), "content-type": "application/json" }, body: JSON.stringify(corpo) });
  const dati = await r.json().catch(() => null);
  // Solo lo stato e il codice di errore dell'app: mai il corpo intero.
  if (!r.ok) throw new Error("stato " + r.status + (dati && typeof dati.errore === "string" ? " (" + dati.errore.slice(0, 60) + ")" : ""));
  return dati;
}
async function entra(email, password) {
  const r = await fetch(env("SUPABASE_URL") + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), "content-type": "application/json" }, body: JSON.stringify({ email: env(email), password: env(password) }) });
  const dati = await r.json().catch(() => ({}));
  if (!r.ok || !dati.access_token) throw new Error("accesso del profilo di prova non riuscito (stato " + r.status + ")");
  return dati.access_token;
}
const oggi = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

export const CONTROLLI = [
  { nome: "sito", limite: 20_000, fn: async () => {
    const r = await fetch(SITO);
    const html = await r.text();
    if (!r.ok || !html.includes("<title>10+</title>")) throw new Error("stato " + r.status);
    return "pagina pubblicata";
  } },
  // Dalla #30 non c'è più l'elenco dei profili: un nome utente che non esiste deve ricevere 401 con l'attesa (0),
  // cioè funzione, database e accesso_con_nome rispondono. Un nome inesistente non blocca nessun profilo.
  { nome: "accedi (nome utente inesistente)", limite: 20_000, fn: async () => {
    const r = await fetch(env("SUPABASE_URL") + "/functions/v1/accedi", { method: "POST",
      headers: { apikey: env("SUPABASE_PUBLISHABLE_KEY"), authorization: "Bearer " + env("SUPABASE_PUBLISHABLE_KEY"), "content-type": "application/json" },
      body: JSON.stringify({ azione: "entra", nome_utente: "sentinella-nessuno", pin: "0000" }) });
    const dati = await r.json().catch(() => null);
    if (r.status !== 401 || dati?.ok !== false || typeof dati?.attendi !== "number") throw new Error("stato " + r.status);
    return "risponde e non fa entrare";
  } },
  // Lo smistamento non prenota aiuti e usa il modello più economico (Haiku): circa 0,0005 $ al giorno.
  { nome: "modello (smistamento, senza aiuti)", limite: 60_000, fn: async () => {
    const token = await entra("TEST_BEA_EMAIL", "TEST_BEA_PASSWORD");
    if (process.env.PROVA_GUASTO === "true") throw new Error("guasto finto per provare la mail (PROVA_GUASTO)");
    const r = await chiama(env("SUPABASE_URL") + "/functions/v1/modello", { azione: "smista", oggi: oggi(), argomenti: [],
      trascrizioni: ["Scienze\nIl cuore è un muscolo cavo diviso in quattro cavità: due atri e due ventricoli."] }, token);
    if (!Array.isArray(r?.foto) || r.foto.length !== 1) throw new Error("risposta senza la foto smistata");
    if (!/scienz/i.test(r.foto[0].materia || "")) throw new Error("materia sbagliata");
    return "materia riconosciuta";
  } },
  { nome: "profili (consumo, genitore di prova)", limite: 20_000, fn: async () => {
    const token = await entra("TEST_GENITORE_EMAIL", "TEST_GENITORE_PASSWORD");
    const r = await chiama(env("SUPABASE_URL") + "/functions/v1/profili", { azione: "consumo" }, token);
    if (!Array.isArray(r?.profili) || typeof r.tetto !== "number") throw new Error("risposta non valida");
    return r.profili.length + " profili collegati";
  } },
];

if (import.meta.url === "file://" + process.argv[1]) {
  const esiti = [];
  for (const c of CONTROLLI) { const e = await controlla(c); esiti.push(e); console.log(e.riga); }
  const no = esiti.filter((e) => !e.ok).length;
  console.log(no ? "\n" + no + " controlli non riusciti: il workflow fallisce e GitHub manda la mail." : "\nTutto a posto.");
  process.exit(no ? 1 : 0);
}
