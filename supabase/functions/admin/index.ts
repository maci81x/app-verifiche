// Pannello dell'amministratore (issue #30). Solo l'account con app_metadata.ruolo = "admin" e la verifica in due
// passaggi fatta (aal2, TOTP di Supabase Auth): lo controlla autorizzaAdmin prima di ogni azione. Tutto con la service role.
//
// POST { azione: "riepilogo" }   → { posti_esterni, posti_occupati, famiglie: [...], figli: [...], invito }
// POST { azione: "consumi", giorni? }  → { righe: [{ studente_id, giorno, chiamate, costo }], oggi: { chiamate, costo }, mese: { chiamate, costo } }
//      ultimi 30 giorni di default, sempre dal primo del mese
// POST { azione: "imposta", posti_esterni } | { azione: "imposta", famiglia_id, limite_aiuti, limite_chiamate } → { ok }
// POST { azione: "stato", famiglia_id, stato: "attiva" | "sospesa" } → { ok } · 409 posti_esauriti (riattivare rispetta il tetto)
// POST { azione: "elimina_famiglia", famiglia_id } → { ok }   solo famiglie esterne con la mail mai confermata
// POST { azione: "contenuti", studente_id, motivo } → { argomenti, sessioni }   scrive prima la riga in accessi_admin
// POST { azione: "registro" }    → { righe }   azioni e accessi ai contenuti, dal più recente
//
// Issue #35. Ogni azione tranne riepilogo, consumi e registro (AZIONI_LETTURA) chiede `motivo` (400 motivo_mancante),
// scrive prima la riga in accessi_admin (registra) e poi fa l'effetto; sulla famiglia protetta (controllo mattutino)
// risponde 409 famiglia_protetta. La famiglia di destinazione la trova il server, anche da `studente_id`.
// Per le azioni sulla famiglia, in accessi_admin.studente_id va l'id dell'account genitore.
// POST { azione: "modifica_figlio", studente_id, nome?, cognome?, classe?, nome_utente?, motivo } → { ok } · 409 nome_utente_preso
// POST { azione: "modifica_genitore", famiglia_id, nome?, cognome?, email?, motivo } → { ok } · 409 email_presa, non_confermata
//      l'email cambia subito (email_confirm: true): con le iscrizioni spente nessuna mail di conferma
// POST { azione: "codice", studente_id, motivo } → { codice }   4 cifre nuove, sblocca il profilo; mostrato una volta, mai salvato in chiaro
// POST { azione: "link_password", famiglia_id, motivo } → { link }   pagina nuova-password.html col token nel frammento
// POST { azione: "esporta", famiglia_id, motivo } → JSON come «Scarica i miei dati» del genitore
// POST { azione: "cestino", studente_id | famiglia_id, nome, motivo } → { ok } · 400 nome_non_confermato
// POST { azione: "ripristina", studente_id | famiglia_id, motivo } → { ok } · 409 posti_esauriti, famiglia_nel_cestino, scaduto
//
// Limite dichiarato nell'informativa: dalla dashboard di Supabase si vede tutto senza passare da questo registro.
import { admin, json, CORS, UUID, claims } from "../_shared/http.ts";
import { autorizzaAdmin, AZIONI_LETTURA, nuovoCodice, validaNomeUtente, confermaNome, scaduti } from "../_shared/famiglie.js";
import { allineaAccessi, esporta, pulisciCestino } from "../_shared/eliminazione.ts";
import { codicePersonale } from "../_shared/inviti.ts";
import { giornoRoma } from "../_shared/compito.js";
import { sommeConsumi, inizioFinestra } from "../_shared/consumi.js";


const intero = (v: unknown, max: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);
type Db = ReturnType<typeof admin>;

const SITO = "https://maci81x.github.io/app-verifiche/";
type Fam = { id: string; genitore_id: string; nome: string | null; cognome: string | null; esterna: boolean; prova: boolean; stato: string; protetta: boolean; cestino: string | null };
type Stud = { id: string; nome: string; cognome: string | null; famiglia_id: string | null; cestino: string | null };
const nomeIntero = (x: { nome: string | null; cognome: string | null }) => [x.nome, x.cognome].filter(Boolean).join(" ");

// Famiglia (e profilo) su cui agisce la richiesta: da famiglia_id, o da studente_id passando per studenti.famiglia_id.
// undefined = id non valido; null in un campo = non c'è.
async function famigliaDestinazione(db: Db, b: Record<string, unknown>): Promise<{ famiglia: Fam | null; studente: Stud | null } | undefined> {
  let studente: Stud | null = null, famigliaId: string | null = null;
  if (b.studente_id !== undefined) {
    if (typeof b.studente_id !== "string" || !UUID.test(b.studente_id)) return undefined;
    const { data, error } = await db.from("studenti").select("famiglia_id").eq("id", b.studente_id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const { data: s, error: e2 } = await db.from("studenti").select("id, nome, cognome, famiglia_id, cestino").eq("id", b.studente_id).single();
    if (e2) throw e2;
    studente = s as Stud;
    famigliaId = data.famiglia_id;
  } else if (b.famiglia_id !== undefined) {
    if (typeof b.famiglia_id !== "string" || !UUID.test(b.famiglia_id)) return undefined;
    famigliaId = b.famiglia_id;
  }
  if (!famigliaId) return { famiglia: null, studente };
  const { data: f, error } = await db.from("famiglie").select("id, genitore_id, nome, cognome, esterna, prova, stato, protetta, cestino").eq("id", famigliaId).maybeSingle();
  if (error) throw error;
  if (!f && !studente) return undefined;
  return { famiglia: (f as Fam) ?? null, studente };
}

async function utenti(db: Db) {
  const tutti: Record<string, { email?: string; confermata: boolean; ultimo_accesso: string | null; bannato: boolean }> = {};
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) tutti[u.id] = { email: u.email, confermata: !!u.email_confirmed_at, ultimo_accesso: u.last_sign_in_at ?? null,
      bannato: !!u.banned_until && Date.parse(u.banned_until) > Date.now() };
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
    // Dispatcher (issue #35): nega se non è una lettura di sintesi. Motivo, famiglia protetta, registro.
    let motivo = "", dest: { famiglia: Fam | null; studente: Stud | null } = { famiglia: null, studente: null };
    if (!AZIONI_LETTURA.has(b.azione)) {
      motivo = typeof b.motivo === "string" ? b.motivo.trim().slice(0, 300) : "";
      if (!motivo) return json({ errore: "motivo_mancante" }, 400);
      const d = await famigliaDestinazione(db, b);
      if (!d) return json({ errore: "profilo o famiglia non trovati" }, 404);
      if (d.famiglia?.protetta) return json({ errore: "famiglia_protetta" }, 409);
      dest = d;
    }
    // Prima il registro: se non si scrive, l'azione non parte.
    const registra = async (azione: string) => {
      const { error } = await db.from("accessi_admin").insert({ admin_id: io.sub, azione, motivo,
        studente_id: dest.studente?.id ?? dest.famiglia?.genitore_id ?? io.sub, famiglia_id: dest.famiglia?.id ?? null });
      if (error) throw error;
    };

    if (b.azione === "riepilogo") {
      // Prima si cancellano le iscrizioni esterne mai confermate dopo 24 ore (liberano il posto).
      const { error: ep } = await db.rpc("pulisci_iscrizioni");
      if (ep) throw ep;
      // Pulizia «pigra» del cestino, se il workflow del mattino fosse spento: non blocca mai il pannello.
      const pulizia = await pulisciCestino(db).catch((e) => { console.error("admin: pulizia del cestino non riuscita:", e); return { ok: false, errore: true }; });
      const [u, { data: famiglie, error: e1 }, { data: figli, error: e2 }, { data: imp, error: e3 }] = await Promise.all([
        utenti(db),
        db.from("famiglie").select("id, genitore_id, nome, cognome, esterna, prova, stato, limite_aiuti, limite_chiamate, invitata_da, codice_invito_usato, creato, cestino, protetta").order("creato"),
        db.from("studenti").select("id, nome, cognome, classe, nome_utente, famiglia_id, creato, cestino").order("nome"),
        db.from("impostazioni").select("posti_esterni").single(),
      ]);
      for (const e of [e1, e2, e3]) if (e) throw e;
      const invito = await codicePersonale(db, io.sub!);
      const famCestino = Object.fromEntries((famiglie ?? []).map((f: Record<string, unknown>) => [f.id, f.cestino]));
      return json({
        posti_esterni: imp!.posti_esterni,
        posti_occupati: await postiOccupati(db),
        // ban_diverso: colonna e ban non coincidono (un'azione interrotta a metà): ripeterla lo sistema.
        famiglie: (famiglie ?? []).map((f: Record<string, unknown>) => ({ ...f, email: u[f.genitore_id as string]?.email,
          mail_confermata: u[f.genitore_id as string]?.confermata ?? false, invitata_da_email: f.invitata_da ? u[f.invitata_da as string]?.email ?? null : null,
          ban_diverso: (u[f.genitore_id as string]?.bannato ?? false) !== !!f.cestino })),
        figli: (figli ?? []).map((s: Record<string, unknown>) => ({ ...s, ultimo_accesso: u[s.id as string]?.ultimo_accesso ?? null,
          ban_diverso: (u[s.id as string]?.bannato ?? false) !== !!(s.cestino || (s.famiglia_id && famCestino[s.famiglia_id as string])) })),
        invito,
        pulizia,
      });
    }

    if (b.azione === "consumi") {
      // Ultimi `giorni` (30), ma sempre dal primo del mese: il totale del mese è completo (issue #34).
      const oggi = giornoRoma();
      const dal = inizioFinestra(oggi, intero(b.giorni, 365) ?? 30);
      // PostgREST restituisce al massimo 1000 righe per richiesta: si legge a pagine fino all'ultima.
      const righe: { studente_id: string; giorno: string; costo: number }[] = [];
      for (let da = 0; ; da += 1000) {
        const { data: pagina, error } = await db.from("consumi").select("studente_id, giorno, costo").gte("giorno", dal).neq("modello", "prenotata").order("id").range(da, da + 999);
        if (error) throw error;
        righe.push(...(pagina ?? []));
        if (!pagina || pagina.length < 1000) break;
      }
      // Le chiamate dei figli eliminati restano per famiglia (consumi_archiviati): si mostrano come «profilo eliminato».
      const { data: archivio, error: ea } = await db.from("consumi_archiviati").select("famiglia_id, giorno, chiamate, costo").gte("giorno", dal);
      if (ea) throw ea;
      return json(sommeConsumi(righe, archivio ?? [], oggi));
    }

    if (b.azione === "imposta") {
      if (b.posti_esterni !== undefined) {
        const posti = intero(b.posti_esterni, 1000);
        if (posti === null) return json({ errore: "posti non validi" }, 400);
        await registra("tetto dei posti");
        const { error } = await db.from("impostazioni").update({ posti_esterni: posti }).eq("id", true);
        if (error) throw error;
        return json({ ok: true });
      }
      const aiuti = intero(b.limite_aiuti, 1000), chiamate = intero(b.limite_chiamate, 10000);
      if (typeof b.famiglia_id !== "string" || !UUID.test(b.famiglia_id) || aiuti === null || chiamate === null) return json({ errore: "limiti non validi" }, 400);
      await registra("limiti della famiglia");
      const { error } = await db.from("famiglie").update({ limite_aiuti: aiuti, limite_chiamate: chiamate }).eq("id", b.famiglia_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (b.azione === "stato") {
      if (typeof b.famiglia_id !== "string" || !UUID.test(b.famiglia_id) || !["attiva", "sospesa"].includes(b.stato)) return json({ errore: "richiesta non valida" }, 400);
      if (b.stato === "attiva") {
        const { error: ep } = await db.rpc("pulisci_iscrizioni"); // un'iscrizione scaduta non deve occupare il posto
        if (ep) throw ep;
        const { data: f, error } = await db.from("famiglie").select("esterna, prova, stato").eq("id", b.famiglia_id).single();
        if (error) throw error;
        const { data: imp } = await db.from("impostazioni").select("posti_esterni").single();
        // ponytail: controllo senza il lucchetto di iscrivi_famiglia; con un solo admin non c'è concorrenza vera.
        if (f.stato === "sospesa" && f.esterna && !f.prova && (await postiOccupati(db)) >= (imp?.posti_esterni ?? 0))
          return json({ errore: "posti_esauriti" }, 409);
      }
      await registra(b.stato === "attiva" ? "famiglia riattivata" : "famiglia sospesa");
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
      await registra("iscrizione non confermata eliminata");
      const { error: e3 } = await db.auth.admin.deleteUser(f.genitore_id);
      if (e3) throw e3;
      return json({ ok: true });
    }

    if (b.azione === "contenuti") {
      if (!dest.studente) return json({ errore: "servono profilo e motivo" }, 400);
      // Prima il registro: se non si scrive, i contenuti non escono.
      await registra("contenuti");
      const [{ data: argomenti, error: e1 }, { data: sessioni, error: e2 }] = await Promise.all([
        db.from("argomenti").select("id, materia, titolo, trascrizione, creato, aggiornato, concetti(titolo, stato, media)").eq("studente_id", b.studente_id).order("aggiornato", { ascending: false }),
        db.from("sessioni").select("id, titolo, materia, data, livello, tipo, modalita, voto, n_domande, n_errori").eq("studente_id", b.studente_id).order("data", { ascending: false }).limit(200),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return json({ argomenti, sessioni });
    }

    if (b.azione === "modifica_figlio") {
      if (!dest.studente) return json({ errore: "manca il profilo" }, 400);
      const cambi: Record<string, string | null> = {};
      if (b.nome !== undefined) { const n = String(b.nome ?? "").trim().slice(0, 40); if (!n) return json({ errore: "manca il nome" }, 400); cambi.nome = n; }
      if (b.cognome !== undefined) cambi.cognome = String(b.cognome ?? "").trim().slice(0, 40) || null;
      if (b.classe !== undefined) { const c = String(b.classe ?? ""); if (!/^[123]$/.test(c)) return json({ errore: "classe non valida" }, 400); cambi.classe = c; }
      if (b.nome_utente !== undefined) { const nu = validaNomeUtente(b.nome_utente); if (!nu) return json({ errore: "nome utente non valido" }, 400); cambi.nome_utente = nu; }
      if (!Object.keys(cambi).length) return json({ errore: "niente da cambiare" }, 400);
      await registra("profilo modificato: " + Object.keys(cambi).join(", "));
      const { error } = await db.from("studenti").update(cambi).eq("id", dest.studente.id);
      if (error?.code === "23505") return json({ errore: "nome_utente_preso" }, 409);
      if (error) throw error;
      return json({ ok: true });
    }

    if (b.azione === "modifica_genitore") {
      const f = dest.famiglia;
      if (!f || dest.studente) return json({ errore: "manca la famiglia" }, 400);
      const cambi: Record<string, string | null> = {};
      if (b.nome !== undefined) cambi.nome = String(b.nome ?? "").trim().slice(0, 40) || null;
      if (b.cognome !== undefined) cambi.cognome = String(b.cognome ?? "").trim().slice(0, 40) || null;
      let email: string | null = null;
      if (b.email !== undefined) {
        email = String(b.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ errore: "email non valida" }, 400);
      }
      if (!Object.keys(cambi).length && !email) return json({ errore: "niente da cambiare" }, 400);
      if (email) {
        // Un'iscrizione esterna non ancora confermata non si conferma cambiandole l'email.
        const { data: u, error } = await db.auth.admin.getUserById(f.genitore_id);
        if (error) throw error;
        if (f.esterna && !u.user?.email_confirmed_at) return json({ errore: "non_confermata" }, 409);
      }
      // Nel registro mai gli indirizzi: solo che cosa è cambiato.
      await registra("genitore modificato: " + [...Object.keys(cambi), ...(email ? ["email"] : [])].join(", "));
      if (email) {
        const { error } = await db.auth.admin.updateUserById(f.genitore_id, { email, email_confirm: true });
        if (error && (error.status === 422 || /already|exists|registered/i.test(error.message))) return json({ errore: "email_presa" }, 409);
        if (error) throw error;
        const { error: e2 } = await db.from("genitori_studenti").update({ email_report: email }).eq("genitore_id", f.genitore_id);
        if (e2) throw e2;
      }
      if (Object.keys(cambi).length) {
        const { error } = await db.from("famiglie").update(cambi).eq("id", f.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (b.azione === "codice") {
      if (!dest.studente) return json({ errore: "manca il profilo" }, 400);
      if (dest.studente.cestino || dest.famiglia?.cestino) return json({ errore: "profilo_nel_cestino" }, 409);
      await registra("codice nuovo");
      const codice = nuovoCodice();
      // imposta_pin_di salva solo l'hash e azzera blocchi e scala d'attesa. Il codice esce una volta, in questa risposta.
      const { error } = await db.rpc("imposta_pin_di", { studente: dest.studente.id, pin: codice });
      if (error) throw error;
      return json({ codice });
    }

    if (b.azione === "link_password") {
      const f = dest.famiglia;
      if (!f || dest.studente) return json({ errore: "manca la famiglia" }, 400);
      if (f.cestino) return json({ errore: "famiglia_nel_cestino" }, 409);
      const { data: u, error } = await db.auth.admin.getUserById(f.genitore_id);
      if (error) throw error;
      if (!u.user?.email || (f.esterna && !u.user.email_confirmed_at)) return json({ errore: "non_confermata" }, 409);
      await registra("link per la password");
      // Il token va nel frammento (#): non arriva a nessun server e le anteprime dei messaggi non lo consumano;
      // la pagina lo verifica solo al tocco del pulsante.
      const { data: l, error: e2 } = await db.auth.admin.generateLink({ type: "recovery", email: u.user.email });
      if (e2) throw e2;
      return json({ link: SITO + "nuova-password.html#t=" + encodeURIComponent(l.properties.hashed_token) });
    }

    if (b.azione === "esporta") {
      const f = dest.famiglia;
      if (!f || dest.studente) return json({ errore: "manca la famiglia" }, 400);
      await registra("export della famiglia");
      return json(await esporta(db, f.genitore_id));
    }

    if (b.azione === "cestino") {
      if (dest.studente) {
        const s = dest.studente;
        if (!confermaNome(b.nome, nomeIntero(s))) return json({ errore: "nome_non_confermato" }, 400);
        if (s.cestino) return json({ ok: true });
        await registra("profilo nel cestino");
        const { error } = await db.from("studenti").update({ cestino: new Date().toISOString() }).eq("id", s.id);
        if (error) throw error;
        await allineaAccessi(db, s.famiglia_id, s.id);
        return json({ ok: true });
      }
      const f = dest.famiglia;
      if (!f) return json({ errore: "manca la famiglia" }, 400);
      if (!confermaNome(b.nome, nomeIntero(f))) return json({ errore: "nome_non_confermato" }, 400);
      if (!f.cestino) {
        await registra("famiglia nel cestino");
        const { error } = await db.from("famiglie").update({ cestino: new Date().toISOString() }).eq("id", f.id);
        if (error) throw error;
      }
      await allineaAccessi(db, f.id); // anche se era già nel cestino: ripetere sistema un ban mancato
      return json({ ok: true });
    }

    if (b.azione === "ripristina") {
      if (dest.studente) {
        const s = dest.studente;
        if (!s.cestino) { await allineaAccessi(db, s.famiglia_id, s.id); return json({ ok: true }); }
        if (scaduti([s]).length) return json({ errore: "scaduto" }, 409);
        if (dest.famiglia?.cestino) return json({ errore: "famiglia_nel_cestino" }, 409);
        await registra("profilo ripristinato");
        const { error } = await db.from("studenti").update({ cestino: null }).eq("id", s.id);
        if (error) throw error;
        await allineaAccessi(db, s.famiglia_id, s.id);
        return json({ ok: true });
      }
      const f = dest.famiglia;
      if (!f) return json({ errore: "manca la famiglia" }, 400);
      if (!f.cestino) { await allineaAccessi(db, f.id); return json({ ok: true }); }
      if (scaduti([f]).length) return json({ errore: "scaduto" }, 409);
      if (f.esterna && !f.prova && f.stato === "attiva") {
        const { error: ep } = await db.rpc("pulisci_iscrizioni");
        if (ep) throw ep;
        const { data: imp } = await db.from("impostazioni").select("posti_esterni").single();
        if ((await postiOccupati(db)) >= (imp?.posti_esterni ?? 0)) return json({ errore: "posti_esauriti" }, 409);
      }
      await registra("famiglia ripristinata");
      const { error } = await db.from("famiglie").update({ cestino: null }).eq("id", f.id);
      if (error) throw error;
      await allineaAccessi(db, f.id);
      return json({ ok: true });
    }

    if (b.azione === "registro") {
      const { data, error } = await db.from("accessi_admin").select("admin_id, studente_id, famiglia_id, azione, motivo, creato").order("creato", { ascending: false }).limit(500);
      if (error) throw error;
      return json({ righe: data });
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("admin:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
