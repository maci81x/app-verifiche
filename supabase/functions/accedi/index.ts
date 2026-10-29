// Accesso delle studentesse da qualsiasi telefono: nome + codice, niente email.
// Funzione anonima (verify_jwt = false): chi la chiama non ha ancora una sessione.
//
// POST { azione: "elenco" }                     → [{ id, nome, classe }] ordinati per nome
// POST { azione: "entra", studente_id, pin }    → { ok: true, access_token, refresh_token, nome, classe }
//                                                 401 { ok: false, attendi } se il codice non va
//
// Il codice e il blocco dopo tre errori li controlla il database
// (accesso_con_pin, eseguibile solo con la service role). La sessione si apre
// qui con un magic link generato e verificato lato server: la password della
// ragazza non cambia e le sessioni sugli altri telefoni restano valide.
// Email e password della studentessa non escono mai da questa funzione.
import { admin, CODICE, json, CORS } from "../_shared/http.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function elenco() {
  const { data, error } = await admin().from("studenti").select("id, nome, classe").order("nome");
  if (error) throw error;
  return json(data ?? []);
}

async function entra(studenteId: unknown, pin: unknown) {
  // Un id o un codice malformato è un codice sbagliato: stessa risposta, nessun indizio.
  if (typeof studenteId !== "string" || !UUID.test(studenteId) || typeof pin !== "string" || !CODICE.test(pin))
    return json({ ok: false, attendi: 0 }, 401);

  const db = admin();
  const { data: esito, error } = await db.rpc("accesso_con_pin", { studente: studenteId, pin });
  if (error) throw error;
  if (!esito?.ok) return json({ ok: false, attendi: Number(esito?.attendi) || 0 }, 401);

  const [{ data: st, error: e1 }, { data: u, error: e2 }] = await Promise.all([
    db.from("studenti").select("nome, classe").eq("id", studenteId).single(),
    db.auth.admin.getUserById(studenteId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  // Solo gli account creati dalla funzione `profili`: mai una sessione del genitore.
  if (u.user.app_metadata?.ruolo !== "studente" || !u.user.email) throw new Error("account non da studente: " + studenteId);

  const { data: link, error: e3 } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (e3) throw e3;
  const { data: s, error: e4 } = await admin().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (e4) throw e4;
  if (!s.session) throw new Error("sessione non aperta: " + studenteId);

  return json({
    ok: true,
    access_token: s.session.access_token,
    refresh_token: s.session.refresh_token,
    nome: st.nome,
    classe: st.classe,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);

  try {
    if (b.azione === "elenco") return await elenco();
    if (b.azione === "entra") return await entra(b.studente_id, b.pin);
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("accedi:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
