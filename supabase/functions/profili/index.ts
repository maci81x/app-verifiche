// Creazione e collegamento dei profili delle studentesse, solo per il genitore.
//
// Le ragazze non vedono mai una mail: l'account lo crea questa funzione con
// un indirizzo e una password generati, li passa una volta sola al telefono che
// li usa per aprire la sessione, e non vengono mai mostrati. Le registrazioni
// libere restano chiuse nel progetto: senza questa funzione nessuno crea account.
//
// POST { azione: "crea", nome, classe? }   → { id, nome, classe, email, password }
// POST { azione: "collega", studente_id } → { id, nome, classe, email, password }
//      Per aprire su questo telefono un profilo che esiste già: genera una
//      password nuova e la restituisce. Le sessioni sugli altri telefoni restano.
//
// Chi chiama deve avere app_metadata.ruolo = "genitore" (lo imposta Roby, una volta).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

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

function casuale(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
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
    if (b.azione === "crea") {
      const nome = String(b.nome || "").trim().slice(0, 40);
      const classe = String(b.classe || "").trim().slice(0, 20) || null;
      if (!nome) return json({ errore: "manca il nome" }, 400);
      const email = "s-" + casuale(6) + "@verifiche.local";
      const password = casuale(24);
      const { data, error } = await db.auth.admin.createUser({
        email, password, email_confirm: true, app_metadata: { ruolo: "studente" },
      });
      if (error) throw error;
      const id = data.user.id;
      const s = await db.from("studenti").insert({ id, nome, classe });
      if (s.error) { await db.auth.admin.deleteUser(id); throw s.error; }
      const g = await db.from("genitori_studenti").insert({ genitore_id: io.sub, studente_id: id, email_report: io.email ?? "" });
      if (g.error) { await db.auth.admin.deleteUser(id); throw g.error; }
      return json({ id, nome, classe, email, password });
    }

    if (b.azione === "collega") {
      const id = String(b.studente_id || "");
      const { data: link } = await db.from("genitori_studenti").select("studente_id, studenti(nome, classe)")
        .eq("genitore_id", io.sub).eq("studente_id", id).maybeSingle();
      if (!link) return json({ errore: "profilo non trovato" }, 404);
      const password = casuale(24);
      const { data, error } = await db.auth.admin.updateUserById(id, { password });
      if (error) throw error;
      const st = link.studenti as unknown as { nome: string; classe: string | null };
      return json({ id, nome: st.nome, classe: st.classe, email: data.user.email, password });
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error(e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
