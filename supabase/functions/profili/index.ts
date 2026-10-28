// Profili delle studentesse e sblocco dei loro telefoni, solo per il genitore,
// dal SUO telefono.
//
// Le ragazze non vedono mai una mail e il genitore non scrive mai la sua sul
// telefono di una figlia. Il telefono della figlia chiede l'accesso (funzione
// `accesso`) e mostra un codice di 6 caratteri; il genitore lo scrive qui e dà
// l'ok. Le credenziali del profilo le genera questa funzione e le lascia nella
// richiesta, dove le ritira solo il telefono che l'ha aperta. Le registrazioni
// libere restano chiuse nel progetto: senza questa funzione nessuno crea account.
//
// POST { azione: "cerca", codice }  → { codice, dispositivo, creato }
// POST { azione: "approva", codice, studente_id, pin? }
//      Apre un profilo che esiste già sul telefono che ha chiesto. Il codice a
//      4 cifre si cambia solo se è indicato. Le sessioni sugli altri telefoni restano.
// POST { azione: "approva", codice, nome, classe?, pin } → crea il profilo e lo apre lì.
//      Risposta per entrambe: { id, nome }
// POST { azione: "rifiuta", codice } → { ok: true }
// POST { azione: "codice", studente_id, pin } → { ok: true }  cambia il codice a 4 cifre
//
// Chi chiama deve avere app_metadata.ruolo = "genitore" (lo imposta Roby, una volta).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { casuale, normalizzaCodice, codiceValido, pinValido, RITIRO_MS } from "../_shared/accesso.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// La piattaforma (verify_jwt) ha già verificato la firma del token.
function claims(req: Request): { role?: string; sub?: string; email?: string; app_metadata?: { ruolo?: string } } {
  try {
    const t = req.headers.get("Authorization")!.replace(/^Bearer /i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(t));
  } catch {
    return {};
  }
}

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
type Db = ReturnType<typeof admin>;

// La richiesta ancora aperta con quel codice, o null.
async function richiestaAperta(db: Db, grezzo: unknown) {
  const codice = normalizzaCodice(grezzo);
  if (!codiceValido(codice)) return null;
  const { data, error } = await db.from("richieste_accesso").select("id, codice, dispositivo, creato, scade")
    .eq("codice", codice).eq("stato", "attesa").gt("scade", new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data;
}

// Lo studente, solo se è collegato a questo genitore.
async function figlia(db: Db, genitore: string, id: unknown) {
  const { data, error } = await db.from("genitori_studenti").select("studente_id, studenti(nome, classe)")
    .eq("genitore_id", genitore).eq("studente_id", String(id || "")).maybeSingle();
  if (error) throw error;
  return data ? { id: data.studente_id as string, ...(data.studenti as unknown as { nome: string; classe: string | null }) } : null;
}

async function impostaPin(db: Db, studente: string, pin: string) {
  const { error } = await db.rpc("imposta_pin_studente", { studente, pin });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const io = claims(req);
  if (io.role !== "authenticated" || !io.sub || io.app_metadata?.ruolo !== "genitore")
    return json({ errore: "solo il genitore" }, 403);

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);
  const db = admin();

  try {
    if (b.azione === "cerca") {
      const r = await richiestaAperta(db, b.codice);
      if (!r) return json({ errore: "Codice non trovato o scaduto. Controlla le lettere, oppure fanne generare uno nuovo." }, 404);
      return json({ codice: r.codice, dispositivo: r.dispositivo, creato: r.creato });
    }

    if (b.azione === "rifiuta") {
      const r = await richiestaAperta(db, b.codice);
      if (r) await db.from("richieste_accesso").update({ stato: "rifiutata", genitore_id: io.sub }).eq("id", r.id).eq("stato", "attesa");
      return json({ ok: true });
    }

    if (b.azione === "codice") {
      if (!pinValido(b.pin)) return json({ errore: "Il codice deve essere di 4 cifre." }, 400);
      const s = await figlia(db, io.sub, b.studente_id);
      if (!s) return json({ errore: "profilo non trovato" }, 404);
      await impostaPin(db, s.id, String(b.pin));
      return json({ ok: true });
    }

    if (b.azione === "approva") {
      const r = await richiestaAperta(db, b.codice);
      if (!r) return json({ errore: "Codice non trovato o scaduto. Fanne generare uno nuovo sul telefono." }, 404);
      const pin = b.pin == null || b.pin === "" ? null : String(b.pin);
      if (pin != null && !pinValido(pin)) return json({ errore: "Il codice deve essere di 4 cifre." }, 400);

      let id: string, nome: string, email: string;
      const password = casuale(24);
      if (b.studente_id) {
        const s = await figlia(db, io.sub, b.studente_id);
        if (!s) return json({ errore: "profilo non trovato" }, 404);
        const { data, error } = await db.auth.admin.updateUserById(s.id, { password });
        if (error) throw error;
        id = s.id; nome = s.nome; email = data.user.email!;
      } else {
        nome = String(b.nome || "").trim().slice(0, 40);
        const classe = String(b.classe || "").trim().slice(0, 20) || null;
        if (!nome) return json({ errore: "Scrivi il nome." }, 400);
        if (pin == null) return json({ errore: "Per un profilo nuovo serve il codice a 4 cifre." }, 400);
        email = "s-" + casuale(6) + "@verifiche.local";
        const { data, error } = await db.auth.admin.createUser({
          email, password, email_confirm: true, app_metadata: { ruolo: "studente" },
        });
        if (error) throw error;
        id = data.user.id;
        const s = await db.from("studenti").insert({ id, nome, classe });
        if (s.error) { await db.auth.admin.deleteUser(id); throw s.error; }
        const g = await db.from("genitori_studenti").insert({ genitore_id: io.sub, studente_id: id, email_report: io.email ?? "" });
        if (g.error) { await db.auth.admin.deleteUser(id); throw g.error; }
      }
      if (pin != null) await impostaPin(db, id, pin);

      const { data: ok, error } = await db.from("richieste_accesso").update({
        stato: "approvata", genitore_id: io.sub, studente_id: id, email, password,
        scade: new Date(Date.now() + RITIRO_MS).toISOString(),
      }).eq("id", r.id).eq("stato", "attesa").select("id");
      if (error) throw error;
      if (!ok || !ok.length) return json({ errore: "La richiesta è stata chiusa nel frattempo. Fanne generare una nuova." }, 409);
      return json({ id, nome });
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error(e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
