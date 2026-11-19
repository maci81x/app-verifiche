// Iscrizione dei genitori su invito (issue #30). Funzione anonima (verify_jwt = false): chi si iscrive non ha un account.
//
// POST { azione: "invito", codice }  → { stato: "valido" | "solo_invito" | "posti_esauriti" | "a_breve", prova, versioni }
// POST { azione: "iscrivi", codice, nome, cognome, email, password, consensi: { privacy, condizioni, dati_figlio } }
//      → { ok: true, prova, mail }   anche se l'email è già registrata (non si rivela chi è iscritto)
//      400 { errore: "campo", campo } · 409 { errore: "solo_invito" | "posti_esauriti" } · 503 { errore: "a_breve" }
//
// Codice e posti li controlla il database (stato_invito, iscrivi_famiglia con un lucchetto: due iscrizioni nello stesso
// istante non superano il tetto). Le famiglie vere si iscrivono solo con il segreto MAIL_PRONTA = "si", cioè dopo che lo
// SMTP di Resend è configurato in Supabase Auth e una mail di prova è arrivata. Il codice di prova (monouso) conferma
// la mail subito. La mail di conferma la manda Supabase Auth (metodo `resend`, tipo signup), non questo codice.
import { admin, json, CORS } from "../_shared/http.ts";
import { validaIscrizione } from "../_shared/famiglie.js";
import { VERSIONI } from "../_shared/consensi.js";

const SITO = "https://maci81x.github.io/app-verifiche/";
type Db = ReturnType<typeof admin>;

// Lo stato di un codice per chi sta per iscriversi; null se il codice vale e c'è posto.
async function statoInvito(db: Db, codice: unknown) {
  if (typeof codice !== "string" || codice.length > 20) return { stato: "solo_invito", prova: false };
  const { data, error } = await db.rpc("stato_invito", { codice });
  if (error) throw error;
  if (!data?.valido) return { stato: "solo_invito", prova: false };
  if (!data.prova && Deno.env.get("MAIL_PRONTA") !== "si") return { stato: "a_breve", prova: false };
  if (!data.posti_liberi) return { stato: "posti_esauriti", prova: !!data.prova };
  return { stato: "valido", prova: !!data.prova };
}

async function iscrivi(db: Db, b: Record<string, unknown>) {
  const v = validaIscrizione(b, VERSIONI);
  if (!v.ok) return json({ errore: "campo", campo: v.campo }, 400);
  const s = await statoInvito(db, b.codice);
  if (s.stato === "a_breve") return json({ errore: "a_breve" }, 503);
  if (s.stato !== "valido") return json({ errore: s.stato }, 409);

  const { nome, cognome, email, password } = v.dati!;
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: s.prova, app_metadata: { ruolo: "genitore" },
  });
  if (error) {
    // Email già registrata: stessa risposta del successo, così non si scopre chi è iscritto.
    if ((error as { code?: string }).code === "email_exists" || /already|registered/i.test(error.message)) return json({ ok: true, prova: s.prova, mail: true });
    throw error;
  }
  const id = data.user.id; // l'unico utente che questa richiesta può cancellare
  try {
    const { data: r, error: e } = await db.rpc("iscrivi_famiglia", { genitore: id, nome, cognome, codice: b.codice, versioni: VERSIONI });
    if (e) throw e;
    if (!r?.ok) {
      await db.auth.admin.deleteUser(id);
      return json({ errore: r?.errore === "posti_esauriti" ? "posti_esauriti" : "solo_invito" }, 409);
    }
  } catch (e) {
    await db.auth.admin.deleteUser(id);
    throw e;
  }
  if (s.prova) return json({ ok: true, prova: true, mail: false });
  const { error: e2 } = await db.auth.resend({ type: "signup", email, options: { emailRedirectTo: SITO } });
  if (e2) console.error("famiglie: mail di conferma non partita:", id, e2.message);
  return json({ ok: true, prova: false, mail: !e2 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);
  const db = admin();
  try {
    if (b.azione === "invito") return json({ ...(await statoInvito(db, b.codice)), versioni: VERSIONI });
    if (b.azione === "iscrivi") return await iscrivi(db, b);
    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("famiglie:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
