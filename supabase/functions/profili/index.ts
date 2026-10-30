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
//      Ordine: dati, foto, account (vedi elimina). Cancellare subito l'account dava «Database
//      error deleting user».
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

// Tutti i file della studentessa nel bucket (<studente>/<argomento>/<file>.jpg), a pagine da
// 1000 e scendendo nelle sottocartelle, più quelli registrati in `fonti`.
async function elenca(db: Db, cartella: string, profondita = 0): Promise<string[]> {
  const fuori: string[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(cartella, { limit: 1000, offset: da });
    if (error) throw error;
    for (const x of data || []) {
      const percorso = cartella + "/" + x.name;
      if (x.id) fuori.push(percorso);
      else if (profondita < 4) fuori.push(...(await elenca(db, percorso, profondita + 1)));
    }
    if (!data || data.length < 1000) break;
  }
  return fuori;
}
async function fotoDi(db: Db, id: string): Promise<string[]> {
  const percorsi = new Set<string>(await elenca(db, id));
  const { data: righe, error } = await db.from("fonti").select("storage_path").eq("studente_id", id).not("storage_path", "is", null);
  if (error) throw error;
  (righe || []).forEach((r: { storage_path: string }) => percorsi.add(r.storage_path));
  return [...percorsi].filter((p) => p.startsWith(id + "/"));
}

// Quante righe e quanti file restano: dopo l'eliminazione deve essere tutto 0. Se il conteggio
// stesso non riesce, l'eliminazione resta riuscita: resti = null.
async function resti(db: Db, id: string) {
  try {
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
    conti.foto = (await elenca(db, id)).length;
    return conti;
  } catch (e) {
    console.error("profili: conteggio dopo l'eliminazione non riuscito:", id, e);
    return null;
  }
}

// Ordine (issue #14): ogni passo si può ripetere finché il collegamento col genitore esiste.
// 1. i dati (argomenti, prove, report: il resto va in cascata) con la service role;
// 2. le foto nello storage (i percorsi si raccolgono prima, da `fonti` e dalla cartella);
// 3. l'account: la sua cascata tocca solo studenti, collegamento e codice. Cancellarlo con
//    tutti i dati dentro dava «Database error deleting user». Se fallisce lo stesso, si
//    prova togliendo prima la riga `studenti`, come si faceva a mano.
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
  for (const t of ["sessioni", "argomenti", "report"]) {
    const { error } = await db.from(t).delete().eq("studente_id", id);
    if (error) throw error;
  }
  for (let i = 0; i < foto.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(foto.slice(i, i + 100));
    if (error) throw error;
  }
  const { error: e3 } = await db.auth.admin.deleteUser(id);
  if (e3) {
    console.error("profili: account non cancellato al primo tentativo, tolgo prima la riga studenti:", id, e3);
    const { error: e4 } = await db.from("studenti").delete().eq("id", id);
    if (e4) throw e4;
    const { error: e5 } = await db.auth.admin.deleteUser(id);
    if (e5) { console.error("profili: dati cancellati ma account no, da togliere a mano:", id, e5); throw e5; }
  }
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
