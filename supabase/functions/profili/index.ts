// Profili dei figli e famiglia, solo per il genitore (issue #1, #14, #30).
//
// I ragazzi non vedono mai una mail: l'account lo crea questa funzione con un indirizzo e una password generati che non
// escono mai dal server. Entrano con nome utente + codice dalla funzione `accedi`. Le registrazioni libere restano
// chiuse nel progetto: i genitori nascono dalla funzione `famiglie` (su invito) o a mano.
//
// POST { azione: "famiglia" }                         → { famiglia, figli: [{ id, nome, cognome, classe, nome_utente, ultimo_blocco, bloccato_fino }], invito }
// POST { azione: "crea", nome, cognome?, classe?, codice } → { id, nome, classe, nome_utente }
//      403 famiglia_sospesa | mail_non_confermata | troppi_figli
// POST { azione: "codice", studente_id, codice }      → { ok: true }      cambia il codice e toglie il blocco
// POST { azione: "classe", studente_id, classe }      → { ok: true }      classe "1" | "2" | "3"
// POST { azione: "nuovo_nome_utente", studente_id }   → { ok: true, nome_utente }
// POST { azione: "elimina", studente_id }             → { ok: true, foto, resti }   un figlio con tutti i suoi dati (issue #14)
// POST { azione: "elimina_famiglia" }                 → { ok: true, figli: [{ id, foto, resti }] }   poi l'account del genitore
// POST { azione: "esporta" }                          → JSON di «Scarica i miei dati» (esportazione in _shared/famiglie.js)
// POST { azione: "consumo" }                          → { tetto, profili: [{ studente_id, giorno, chiamate, input, output, cache_scritti, cache_letti, costo, tetto }] }
//      chiamate al modello e token di oggi (ora di Roma) dalla tabella consumi; tetto per profilo (limite della famiglia).
//
// Chi chiama deve avere app_metadata.ruolo = "genitore". Le famiglie esterne con la mail del genitore non ancora
// confermata possono solo esportare ed eliminare (difesa se «Confirm email» fosse spento).
import { admin, CODICE, json, CORS, UUID, claims } from "../_shared/http.ts";
import { giornoRoma } from "../_shared/compito.js";
import { nomeUtente, MAX_FIGLI } from "../_shared/famiglie.js";
import { codicePersonale } from "../_shared/inviti.ts";
import { elimina, esporta, figliDi } from "../_shared/eliminazione.ts";


type Db = ReturnType<typeof admin>;
// Prima della #30 i genitori nascevano a mano, senza famiglia: solo loro ricevono una famiglia «esistente» alla prima
// «crea». Un account più recente senza famiglia è un'iscrizione rimasta a metà e non diventa mai una famiglia di casa.
const PRIMA_DELLA_30 = "2026-11-19T15:00:00Z";
type Famiglia = { id: string; esterna: boolean; prova: boolean; stato: string; limite_chiamate: number; cestino: string | null };



// Il figlio è collegato a questo genitore ed è un account da studente? (mai l'account di un genitore)
async function figlioDi(db: Db, genitore: string, id: unknown): Promise<string | null> {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const { data: link, error } = await db.from("genitori_studenti").select("studente_id").eq("genitore_id", genitore).eq("studente_id", id).maybeSingle();
  if (error) throw error;
  return link ? id : null;
}


function casuale(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// Scrive un nome utente nuovo (nome + 3 caratteri), riprovando se per caso è già preso (indice unico).
async function conNomeUtente(nome: string, scrivi: (nu: string) => Promise<{ error: { code?: string } | null }>) {
  for (let i = 0; i < 5; i++) {
    const nu = nomeUtente(nome);
    const { error } = await scrivi(nu);
    if (!error) return nu;
    if (error.code !== "23505") throw error;
  }
  throw new Error("nome utente: troppi tentativi");
}

async function famigliaDi(db: Db, genitore: string): Promise<Famiglia | null> {
  const { data, error } = await db.from("famiglie").select("id, esterna, prova, stato, limite_chiamate, cestino").eq("genitore_id", genitore).maybeSingle();
  if (error) throw error;
  return data as Famiglia | null;
}


async function consumo(db: Db, genitore: string, fam: Famiglia | null) {
  const giorno = giornoRoma();
  const tetto = fam?.limite_chiamate ?? 60;
  const profili = await Promise.all((await figliDi(db, genitore)).map(async (studente_id) => {
    const { data, error } = await db.from("consumi").select("input, output, cache_scritti, cache_letti, costo, modello").eq("studente_id", studente_id).eq("giorno", giorno);
    if (error) throw error;
    const righe = (data ?? []).filter((r: { modello: string }) => r.modello !== "prenotata");
    const somma = (k: string) => righe.reduce((s: number, r: Record<string, number>) => s + (Number(r[k]) || 0), 0);
    return { studente_id, giorno, chiamate: righe.length, input: somma("input"), output: somma("output"), cache_scritti: somma("cache_scritti"),
      cache_letti: somma("cache_letti"), costo: Math.round(somma("costo") * 1e6) / 1e6, tetto };
  }));
  return { tetto, profili }; // tetto in cima: lo legge ancora la v34
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const io = claims(req);
  if (io.role !== "authenticated" || !io.sub || io.app_metadata?.ruolo !== "genitore")
    return json({ errore: "solo il genitore" }, 403);
  const genitore = io.sub;

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);
  const db = admin();

  try {
    // Famiglia nel cestino (issue #35): l'account è bannato, ma un token già emesso vale fino a un'ora. Niente di niente.
    const fam = await famigliaDi(db, genitore);
    if (fam?.cestino) return json({ errore: "famiglia_nel_cestino" }, 403);

    if (b.azione === "esporta") return json(await esporta(db, genitore));

    if (b.azione === "elimina") {
      const id = await figlioDi(db, genitore, b.studente_id);
      const r = id && (await elimina(db, id, genitore));
      return r ? json({ ok: true, foto: r.foto, resti: r.resti }) : json({ errore: "profilo non trovato" }, 404);
    }

    if (b.azione === "elimina_famiglia") {
      const figli = [];
      for (const id of await figliDi(db, genitore)) { const r = await elimina(db, id, genitore); if (r) figli.push(r); }
      // in cascata vanno via famiglie, consensi e inviti; la famiglia non si cancella se resta un figlio (restrict)
      const { error } = await db.auth.admin.deleteUser(genitore);
      if (error) throw error;
      return json({ ok: true, figli });
    }

    // Da qui in poi: famiglie esterne solo con la mail confermata.
    if (fam?.esterna && !fam.prova) {
      const { data: u, error } = await db.auth.admin.getUserById(genitore);
      if (error) throw error;
      if (!u.user?.email_confirmed_at) return json({ errore: "mail_non_confermata" }, 403);
    }

    if (b.azione === "famiglia") {
      const { data: righe, error } = await db.from("studenti").select("id, nome, cognome, classe, nome_utente, cestino").in("id", await figliDi(db, genitore)).order("nome");
      if (error) throw error;
      const { data: pin, error: e2 } = await db.from("pin_profili").select("user_id, ultimo_blocco, bloccato_fino").in("user_id", (righe ?? []).map((r: { id: string }) => r.id));
      if (e2) throw e2;
      const blocco = Object.fromEntries((pin ?? []).map((p: { user_id: string; ultimo_blocco: string | null; bloccato_fino: string | null }) => [p.user_id, p]));
      const invito = await codicePersonale(db, genitore);
      return json({ famiglia: fam ? { esterna: fam.esterna, stato: fam.stato } : null, figli: (righe ?? []).map((r: { id: string }) => ({ ...r, ultimo_blocco: blocco[r.id]?.ultimo_blocco ?? null, bloccato_fino: blocco[r.id]?.bloccato_fino ?? null })), invito });
    }

    if (b.azione === "consumo") return json(await consumo(db, genitore, fam));

    if (b.azione === "crea") {
      const nome = String(b.nome || "").trim().slice(0, 40);
      const cognome = String(b.cognome || "").trim().slice(0, 40) || null;
      const classe = String(b.classe || "").trim() || null;
      if (classe && !/^[123]$/.test(classe)) return json({ errore: "classe non valida" }, 400);
      const codice = String(b.codice || "");
      if (!nome) return json({ errore: "manca il nome" }, 400);
      if (!CODICE.test(codice)) return json({ errore: "il codice deve avere 4 cifre" }, 400);
      if (fam?.stato === "sospesa") return json({ errore: "famiglia_sospesa" }, 403);
      // Un genitore che non ha ancora una famiglia (nato prima della #30, senza figli) diventa una famiglia esistente.
      let famiglia = fam?.id;
      if (!famiglia) {
        const { data: u, error: eu } = await db.auth.admin.getUserById(genitore);
        if (eu) throw eu;
        if (!u.user || u.user.created_at >= PRIMA_DELLA_30) return json({ errore: "senza_famiglia" }, 403);
        const { data: f, error } = await db.from("famiglie").insert({ genitore_id: genitore, esterna: false, limite_aiuti: 30, limite_chiamate: 150 }).select("id").single();
        if (error) throw error;
        famiglia = f.id;
      }
      if ((await figliDi(db, genitore)).length >= MAX_FIGLI) return json({ errore: "troppi_figli" }, 403);

      const { data, error } = await db.auth.admin.createUser({
        email: "s-" + casuale(6) + "@verifiche.local", password: casuale(24), email_confirm: true, app_metadata: { ruolo: "studente" },
      });
      if (error) throw error;
      const id = data.user.id;
      try {
        const nu = await conNomeUtente(nome, async (nome_utente) =>
          await db.from("studenti").insert({ id, nome, cognome, classe, nome_utente, famiglia_id: famiglia }));
        const g = await db.from("genitori_studenti").insert({ genitore_id: genitore, studente_id: id, email_report: io.email ?? "" });
        if (g.error) throw g.error;
        // Due «crea» nello stesso istante: si riconta dopo l'inserimento e chi supera il massimo si annulla.
        if ((await figliDi(db, genitore)).length > MAX_FIGLI) { await db.auth.admin.deleteUser(id); return json({ errore: "troppi_figli" }, 403); }
        const p = await db.rpc("imposta_pin_di", { studente: id, pin: codice });
        if (p.error) throw p.error;
        return json({ id, nome, classe, nome_utente: nu });
      } catch (e) {
        // a metà strada non resta un profilo senza codice: si cancella tutto (cascade)
        await db.auth.admin.deleteUser(id);
        throw e;
      }
    }

    const id = await figlioDi(db, genitore, b.studente_id);
    if (!id) return json({ errore: "profilo non trovato" }, 404);
    // Un figlio nel cestino si ripristina solo dal pannello admin: il genitore non lo modifica (può solo eliminarlo).
    const { data: st0, error: es0 } = await db.from("studenti").select("cestino").eq("id", id).single();
    if (es0) throw es0;
    if (st0.cestino) return json({ errore: "profilo_nel_cestino" }, 409);

    if (b.azione === "codice") {
      const codice = String(b.codice || "");
      if (!CODICE.test(codice)) return json({ errore: "il codice deve avere 4 cifre" }, 400);
      const { error } = await db.rpc("imposta_pin_di", { studente: id, pin: codice });
      if (error) throw error;
      return json({ ok: true });
    }

    if (b.azione === "classe") {
      const classe = String(b.classe || "");
      if (!/^[123]$/.test(classe)) return json({ errore: "classe non valida" }, 400);
      const { error } = await db.from("studenti").update({ classe }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (b.azione === "nuovo_nome_utente") {
      const { data: st, error } = await db.from("studenti").select("nome").eq("id", id).single();
      if (error) throw error;
      const nu = await conNomeUtente(st.nome, async (nome_utente) => await db.from("studenti").update({ nome_utente }).eq("id", id));
      return json({ ok: true, nome_utente: nu });
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error("profili:", b.azione, e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
