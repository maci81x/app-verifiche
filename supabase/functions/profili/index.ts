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
// POST { azione: "elimina", studente_id }        → { ok: true, foto, resti }
//      Cancella il profilo di una figlia collegata a chi chiama, con tutti i suoi dati (issue #14).
//      Ordine: foto nello storage, poi la riga `studenti` (argomenti, prove, mappe... se ne vanno
//      in cascata), poi l'account. Cancellare subito l'account dava «Database error deleting
//      user»: la cascata partiva dal servizio di autenticazione, non dalla service role.
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "fonti";
// Tabelle con i dati di una studentessa: dopo l'eliminazione devono avere 0 righe.
const TABELLE = ["argomenti", "concetti", "mappe", "sessioni", "domande", "risposte", "spiegazioni", "esercizi_tipi", "fonti", "report"];

type Db = ReturnType<typeof admin>;

// Tutti i file della studentessa nel bucket: <studente>/<argomento>/<file>.jpg, più quelli
// registrati in `fonti` (se una cartella non si elenca, i percorsi salvati bastano).
async function fotoDi(db: Db, id: string): Promise<string[]> {
  const percorsi = new Set<string>();
  const { data: righe, error } = await db.from("fonti").select("storage_path").eq("studente_id", id).not("storage_path", "is", null);
  if (error) throw error;
  (righe || []).forEach((r: { storage_path: string }) => percorsi.add(r.storage_path));
  const { data: cartelle, error: e2 } = await db.storage.from(BUCKET).list(id, { limit: 1000 });
  if (e2) throw e2;
  for (const c of cartelle || []) {
    if (c.id) { percorsi.add(id + "/" + c.name); continue; } // un file direttamente nella cartella
    const { data: file, error: e3 } = await db.storage.from(BUCKET).list(id + "/" + c.name, { limit: 1000 });
    if (e3) throw e3;
    (file || []).forEach((f) => percorsi.add(id + "/" + c.name + "/" + f.name));
  }
  return [...percorsi].filter((p) => p.startsWith(id + "/"));
}

async function resti(db: Db, id: string) {
  const conti: Record<string, number> = {};
  for (const t of TABELLE) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true }).eq("studente_id", id);
    if (error) throw error;
    conti[t] = count ?? 0;
  }
  for (const [t, col] of [["studenti", "id"], ["pin_profili", "user_id"], ["genitori_studenti", "studente_id"]]) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true }).eq(col, id);
    if (error) throw error;
    conti[t] = count ?? 0;
  }
  conti.foto = (await db.storage.from(BUCKET).list(id, { limit: 1 })).data?.length ?? 0;
  return conti;
}

async function elimina(db: Db, genitore: string, id: string) {
  const { data: link, error: e1 } = await db.from("genitori_studenti").select("studente_id")
    .eq("genitore_id", genitore).eq("studente_id", id).maybeSingle();
  if (e1) throw e1;
  if (!link) return json({ errore: "profilo non trovato" }, 404);
  const { data: u, error: e2 } = await db.auth.admin.getUserById(id);
  if (e2) throw e2;
  // Solo account da studentessa: mai quello di un genitore, anche se collegato per errore.
  if (u.user.app_metadata?.ruolo !== "studente") return json({ errore: "profilo non trovato" }, 404);

  const foto = await fotoDi(db, id);
  for (let i = 0; i < foto.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(foto.slice(i, i + 100));
    if (error) throw error;
  }
  const { error: e3 } = await db.from("studenti").delete().eq("id", id);
  if (e3) throw e3;
  const { error: e4 } = await db.auth.admin.deleteUser(id);
  if (e4) { console.error("profili: dati cancellati ma account no, da togliere a mano:", id, e4); throw e4; }
  return json({ ok: true, foto: foto.length, resti: await resti(db, id) });
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

    if (b.azione === "elimina") {
      const id = String(b.studente_id || "");
      if (!UUID.test(id)) return json({ errore: "richiesta non valida" }, 400);
      return await elimina(db, io.sub, id);
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("profili:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
