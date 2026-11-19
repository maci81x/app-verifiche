// Accesso di chi studia da qualsiasi telefono: nome utente + codice, niente email (issue #1, #30). Nessun elenco
// dei profili: il telefono ricorda solo quelli entrati da lì.
// Funzione anonima (verify_jwt = false): chi la chiama non ha ancora una sessione.
//
// POST { azione: "entra", nome_utente, pin }   → { ok: true, access_token, refresh_token, id, nome, classe, nome_utente }
//                                                401 { ok: false, attendi } se il codice non va o il profilo è bloccato
//                                                403 { errore: "famiglia_sospesa" } (solo dopo il codice giusto)
//
// Codice, blocco crescente dopo 5 errori e sospensione li controlla il database (accesso_con_nome, eseguibile solo
// con la service role). La sessione si apre qui con un magic link generato e verificato lato server: la password del
// profilo non cambia e le sessioni sugli altri telefoni restano valide. Email e password non escono mai da qui.
import { admin, CODICE, json, CORS } from "../_shared/http.ts";
import { normalizzaNomeUtente } from "../_shared/famiglie.js";

const NO = (attendi = 0) => json({ ok: false, attendi }, 401);

async function entra(nomeUtente: unknown, pin: unknown) {
  // Un nome o un codice malformato è un codice sbagliato: stessa risposta, nessun indizio.
  if (typeof pin !== "string" || !CODICE.test(pin)) return NO();
  const utente = typeof nomeUtente === "string" ? normalizzaNomeUtente(nomeUtente) : "";
  if (!utente) return NO();
  const db = admin();

  const { data: esito, error } = await db.rpc("accesso_con_nome", { utente, pin });
  if (error) throw error;
  if (esito?.sospesa) return json({ errore: "famiglia_sospesa" }, 403);
  if (!esito?.ok) return NO(Number(esito?.attendi) || 0);
  const id = String(esito.studente_id);

  const [{ data: st, error: e1 }, { data: u, error: e2 }] = await Promise.all([
    db.from("studenti").select("nome, classe, nome_utente").eq("id", id).single(),
    db.auth.admin.getUserById(id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  // Solo gli account creati dalla funzione `profili`: mai una sessione del genitore.
  if (u.user.app_metadata?.ruolo !== "studente" || !u.user.email) throw new Error("account non da studente: " + id);

  const { data: link, error: e3 } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (e3) throw e3;
  const { data: s, error: e4 } = await admin().auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (e4) throw e4;
  if (!s.session) throw new Error("sessione non aperta: " + id);

  return json({
    ok: true,
    access_token: s.session.access_token,
    refresh_token: s.session.refresh_token,
    id,
    nome: st.nome,
    classe: st.classe,
    nome_utente: st.nome_utente,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);

  try {
    if (b.azione === "entra") return await entra(b.nome_utente, b.pin);
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("accedi:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
