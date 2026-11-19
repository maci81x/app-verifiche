// Pannello dell'amministratore (issue #30). Solo l'account con app_metadata.ruolo = "admin" e la verifica in due
// passaggi fatta (aal2, TOTP di Supabase Auth): lo controlla autorizzaAdmin prima di ogni azione. Tutto con la service role.
//
// POST { azione: "riepilogo" }   → { posti_esterni, posti_occupati, famiglie: [...], figli: [...], invito }
// POST { azione: "consumi", giorni? }  → { righe: [{ studente_id, giorno, chiamate, costo }] }   ultimi 30 giorni di default
// POST { azione: "imposta", posti_esterni } | { azione: "imposta", famiglia_id, limite_aiuti, limite_chiamate } → { ok }
// POST { azione: "stato", famiglia_id, stato: "attiva" | "sospesa" } → { ok } · 409 posti_esauriti (riattivare rispetta il tetto)
// POST { azione: "elimina_famiglia", famiglia_id } → { ok }   solo famiglie esterne con la mail mai confermata
// POST { azione: "contenuti", studente_id, motivo } → { argomenti, sessioni }   scrive prima la riga in accessi_admin
// POST { azione: "registro" }    → { righe }   gli accessi ai contenuti, dal più recente
//
// Limite dichiarato nell'informativa: dalla dashboard di Supabase si vede tutto senza passare da questo registro.
import { admin, json, CORS } from "../_shared/http.ts";
import { autorizzaAdmin, codiceInvito } from "../_shared/famiglie.js";
import { giornoRoma } from "../_shared/compito.js";

function claims(req: Request) {
  try {
    const t = req.headers.get("Authorization")!.replace(/^Bearer /i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(t));
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const intero = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);
type Db = ReturnType<typeof admin>;

async function utenti(db: Db) {
  const tutti: Record<string, { email?: string; confermata: boolean; ultimo_accesso: string | null }> = {};
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) tutti[u.id] = { email: u.email, confermata: !!u.email_confirmed_at, ultimo_accesso: u.last_sign_in_at ?? null };
    if (data.users.length < 1000) break;
  }
  return tutti;
}

async function postiOccupati(db: Db) {
  const { data, error } = await db.rpc("posti_occupati");
  if (error) throw error;
  return Number(data) || 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const io = claims(req);
  if (!autorizzaAdmin(io)) return json({ errore: "solo l'amministratore, con la verifica in due passaggi" }, 403);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);
  const db = admin();

  try {
    if (b.azione === "riepilogo") {
      // Prima si cancellano le iscrizioni esterne mai confermate dopo 24 ore (liberano il posto).
      const { error: ep } = await db.rpc("pulisci_iscrizioni");
      if (ep) throw ep;
      const [u, { data: famiglie, error: e1 }, { data: figli, error: e2 }, { data: imp, error: e3 }] = await Promise.all([
        utenti(db),
        db.from("famiglie").select("id, genitore_id, nome, cognome, esterna, prova, stato, limite_aiuti, limite_chiamate, invitata_da, codice_invito_usato, creato").order("creato"),
        db.from("studenti").select("id, nome, cognome, classe, nome_utente, famiglia_id, creato").order("nome"),
        db.from("impostazioni").select("posti_esterni").single(),
      ]);
      for (const e of [e1, e2, e3]) if (e) throw e;
      // il codice personale dell'admin, creato la prima volta (come in profili)
      let { data: inv } = await db.from("inviti").select("codice").eq("titolare_id", io.sub).eq("prova", false).maybeSingle();
      if (!inv) {
        const { data: nuovo, error } = await db.from("inviti").insert({ codice: codiceInvito(), titolare_id: io.sub }).select("codice").single();
        if (error) throw error;
        inv = nuovo;
      }
      return json({
        posti_esterni: imp!.posti_esterni,
        posti_occupati: await postiOccupati(db),
        famiglie: (famiglie ?? []).map((f: Record<string, unknown>) => ({ ...f, email: u[f.genitore_id as string]?.email,
          mail_confermata: u[f.genitore_id as string]?.confermata ?? false, invitata_da_email: f.invitata_da ? u[f.invitata_da as string]?.email ?? null : null })),
        figli: (figli ?? []).map((s: Record<string, unknown>) => ({ ...s, ultimo_accesso: u[s.id as string]?.ultimo_accesso ?? null })),
        invito: inv?.codice ?? null,
      });
    }

    if (b.azione === "consumi") {
      const giorni = intero(b.giorni, 365) ?? 30;
      const dal = new Date(Date.parse(giornoRoma() + "T12:00:00Z") - giorni * 86400000).toISOString().slice(0, 10);
      // PostgREST restituisce al massimo 1000 righe per richiesta: si legge a pagine fino all'ultima.
      const data: { studente_id: string; giorno: string; costo: number }[] = [];
      for (let da = 0; ; da += 1000) {
        const { data: pagina, error } = await db.from("consumi").select("studente_id, giorno, costo").gte("giorno", dal).neq("modello", "prenotata").order("id").range(da, da + 999);
        if (error) throw error;
        data.push(...(pagina ?? []));
        if (!pagina || pagina.length < 1000) break;
      }
      const somme: Record<string, { studente_id: string; giorno: string; chiamate: number; costo: number }> = {};
      for (const r of data) {
        const k = r.studente_id + "|" + r.giorno;
        const s = (somme[k] ??= { studente_id: r.studente_id, giorno: r.giorno, chiamate: 0, costo: 0 });
        s.chiamate++; s.costo = Math.round((s.costo + Number(r.costo)) * 1e6) / 1e6;
      }
      return json({ righe: Object.values(somme).sort((a, c) => (a.giorno < c.giorno ? 1 : -1)) });
    }

    if (b.azione === "imposta") {
      if (b.posti_esterni !== undefined) {
        const posti = intero(b.posti_esterni, 1000);
        if (posti === null) return json({ errore: "posti non validi" }, 400);
        const { error } = await db.from("impostazioni").update({ posti_esterni: posti }).eq("id", true);
        if (error) throw error;
        return json({ ok: true });
      }
      const aiuti = intero(b.limite_aiuti, 1000), chiamate = intero(b.limite_chiamate, 10000);
      if (typeof b.famiglia_id !== "string" || !UUID.test(b.famiglia_id) || aiuti === null || chiamate === null) return json({ errore: "limiti non validi" }, 400);
      const { error } = await db.from("famiglie").update({ limite_aiuti: aiuti, limite_chiamate: chiamate }).eq("id", b.famiglia_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (b.azione === "stato") {
      if (typeof b.famiglia_id !== "string" || !UUID.test(b.famiglia_id) || !["attiva", "sospesa"].includes(b.stato)) return json({ errore: "richiesta non valida" }, 400);
      if (b.stato === "attiva") {
        const { data: f, error } = await db.from("famiglie").select("esterna, prova, stato").eq("id", b.famiglia_id).single();
        if (error) throw error;
        const { data: imp } = await db.from("impostazioni").select("posti_esterni").single();
        // ponytail: controllo senza il lucchetto di iscrivi_famiglia; con un solo admin non c'è concorrenza vera.
        if (f.stato === "sospesa" && f.esterna && !f.prova && (await postiOccupati(db)) >= (imp?.posti_esterni ?? 0))
          return json({ errore: "posti_esauriti" }, 409);
      }
      const { error } = await db.from("famiglie").update({ stato: b.stato }).eq("id", b.famiglia_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (b.azione === "elimina_famiglia") {
      if (typeof b.famiglia_id !== "string" || !UUID.test(b.famiglia_id)) return json({ errore: "richiesta non valida" }, 400);
      const { data: f, error } = await db.from("famiglie").select("genitore_id, esterna").eq("id", b.famiglia_id).single();
      if (error) throw error;
      const { data: u, error: e2 } = await db.auth.admin.getUserById(f.genitore_id);
      if (e2) throw e2;
      // Solo le iscrizioni mai confermate: non hanno figli (profili non li crea) e la cascata porta via famiglia e consensi.
      if (!f.esterna || u.user?.email_confirmed_at) return json({ errore: "solo iscrizioni esterne non confermate" }, 409);
      const { error: e3 } = await db.auth.admin.deleteUser(f.genitore_id);
      if (e3) throw e3;
      return json({ ok: true });
    }

    if (b.azione === "contenuti") {
      const motivo = typeof b.motivo === "string" ? b.motivo.trim().slice(0, 300) : "";
      if (typeof b.studente_id !== "string" || !UUID.test(b.studente_id) || !motivo) return json({ errore: "servono profilo e motivo" }, 400);
      // Prima il registro: se non si scrive, i contenuti non escono.
      const { error } = await db.from("accessi_admin").insert({ admin_id: io.sub, studente_id: b.studente_id, azione: "contenuti", motivo });
      if (error) throw error;
      const [{ data: argomenti, error: e1 }, { data: sessioni, error: e2 }] = await Promise.all([
        db.from("argomenti").select("id, materia, titolo, trascrizione, creato, aggiornato, concetti(titolo, stato, media)").eq("studente_id", b.studente_id).order("aggiornato", { ascending: false }),
        db.from("sessioni").select("id, titolo, materia, data, livello, tipo, modalita, voto, n_domande, n_errori").eq("studente_id", b.studente_id).order("data", { ascending: false }).limit(200),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return json({ argomenti, sessioni });
    }

    if (b.azione === "registro") {
      const { data, error } = await db.from("accessi_admin").select("admin_id, studente_id, azione, motivo, creato").order("creato", { ascending: false }).limit(500);
      if (error) throw error;
      return json({ righe: data });
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("admin:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
