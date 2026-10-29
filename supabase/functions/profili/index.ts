// Creazione dei profili delle studentesse e dei loro codici, solo per il genitore.
//
// Le ragazze non vedono mai una mail: l'account lo crea questa funzione con
// un indirizzo e una password generati che non escono mai dal server. Le
// ragazze entrano con nome + codice dalla funzione `accedi`. Le registrazioni
// libere restano chiuse nel progetto: senza questa funzione nessuno crea account.
//
// POST { azione: "crea", nome, classe?, codice }  → { id, nome, classe }
// POST { azione: "codice", studente_id, codice }  → { ok: true }
//      Cambia il codice di una figlia collegata a chi chiama e toglie l'eventuale blocco.
//
// Chi chiama deve avere app_metadata.ruolo = "genitore" (lo imposta Roby, una volta).
import { admin, CODICE, json, CORS } from "../_shared/http.ts";

// La piattaforma (verify_jwt) ha già verificato la firma del token.
function claims(req: Request): { role?: string; sub?: string; email?: string; app_metadata?: { ruolo?: string } } {
  try {
    const t = req.headers.get("Authorization")!.replace(/^Bearer /i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(t));
  } catch {
    return {};
  }
}

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
      const codice = String(b.codice || "");
      if (!nome) return json({ errore: "manca il nome" }, 400);
      if (!CODICE.test(codice)) return json({ errore: "il codice deve avere 4 cifre" }, 400);
      const email = "s-" + casuale(6) + "@verifiche.local";
      const password = casuale(24);
      const { data, error } = await db.auth.admin.createUser({
        email, password, email_confirm: true, app_metadata: { ruolo: "studente" },
      });
      if (error) throw error;
      const id = data.user.id;
      try {
        const s = await db.from("studenti").insert({ id, nome, classe });
        if (s.error) throw s.error;
        const g = await db.from("genitori_studenti").insert({ genitore_id: io.sub, studente_id: id, email_report: io.email ?? "" });
        if (g.error) throw g.error;
        const p = await db.rpc("imposta_pin_di", { studente: id, pin: codice });
        if (p.error) throw p.error;
      } catch (e) {
        // a metà strada non resta un profilo senza codice: si cancella tutto (cascade)
        await db.auth.admin.deleteUser(id);
        throw e;
      }
      return json({ id, nome, classe });
    }

    if (b.azione === "codice") {
      const id = String(b.studente_id || "");
      const codice = String(b.codice || "");
      if (!CODICE.test(codice)) return json({ errore: "il codice deve avere 4 cifre" }, 400);
      const { data: link, error: e1 } = await db.from("genitori_studenti").select("studente_id")
        .eq("genitore_id", io.sub).eq("studente_id", id).maybeSingle();
      if (e1) throw e1;
      if (!link) return json({ errore: "profilo non trovato" }, 404);
      const { error } = await db.rpc("imposta_pin_di", { studente: id, pin: codice });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("profili:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
