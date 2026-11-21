// Eliminazione ed export dei dati di un figlio o di una famiglia (issue #14, #30, #35). Usati da `profili` (il genitore),
// `admin` (l'amministratore) e `pulizia` (cestino oltre 30 giorni): una sola procedura, con il controllo «0 righe».
import type { admin } from "./http.ts";
import { esportazione, pianoPulizia, scaduti, limiteRegistro, pianoRegistro } from "./famiglie.js";

type Db = ReturnType<typeof admin>;
export const BUCKET = "fonti";
// Tabelle con i dati di un figlio: dopo l'eliminazione devono avere 0 righe; le stesse vanno nell'export.
export const TABELLE = ["argomenti", "concetti", "mappe", "sessioni", "domande", "risposte", "spiegazioni", "esercizi_tipi", "ripasso_stato", "fonti", "report", "scadenze", "giorni_diario", "punti_chiave", "consumi"];
// Colonna unica per profilo con cui sfogliare le tabelle senza `id` (export a pagine).
const ORDINE: Record<string, string> = { ripasso_stato: "concetto_id", giorni_diario: "data" };

// Tutti i file del figlio nel bucket (<studente>/<argomento>/<file>.jpg), a pagine da 1000 e scendendo nelle
// sottocartelle, più quelli registrati in `fonti`.
export async function elenca(db: Db, cartella: string, profondita = 0): Promise<string[]> {
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

export async function fotoDi(db: Db, id: string): Promise<string[]> {
  const percorsi = new Set<string>(await elenca(db, id));
  const { data: righe, error } = await db.from("fonti").select("storage_path").eq("studente_id", id).not("storage_path", "is", null);
  if (error) throw error;
  (righe || []).forEach((r: { storage_path: string }) => percorsi.add(r.storage_path));
  return [...percorsi].filter((p) => p.startsWith(id + "/"));
}

// Quante righe e quanti file restano: dopo l'eliminazione deve essere tutto 0. Se il conteggio stesso non riesce,
// l'eliminazione resta riuscita: resti = null.
export async function resti(db: Db, id: string) {
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

export async function figliDi(db: Db, genitore: string): Promise<string[]> {
  const { data, error } = await db.from("genitori_studenti").select("studente_id").eq("genitore_id", genitore);
  if (error) throw error;
  return (data ?? []).map((r: { studente_id: string }) => r.studente_id);
}

// Ordine (issue #14): ogni passo si può ripetere finché il collegamento col genitore esiste.
// 1. i dati (argomenti, prove, report, consumi: il resto va in cascata) con la service role;
// 2. le foto nello storage (i percorsi si raccolgono prima, da `fonti` e dalla cartella);
// 3. l'account: la sua cascata tocca solo studenti, collegamento e codice. Cancellarlo con tutti i dati dentro dava
//    «Database error deleting user». Se fallisce lo stesso, si prova togliendo prima la riga `studenti`.
export async function elimina(db: Db, id: string, genitore?: string) {
  // Un figlio collegato anche a un altro genitore (dati vecchi o messi a mano): chi elimina toglie solo il suo collegamento.
  const { count, error: e1 } = await db.from("genitori_studenti").select("*", { count: "exact", head: true }).eq("studente_id", id);
  if (e1) throw e1;
  if (genitore && (count ?? 0) > 1) {
    const { error } = await db.from("genitori_studenti").delete().eq("studente_id", id).eq("genitore_id", genitore);
    if (error) throw error;
    // Il figlio resta all'altro genitore: anche la sua famiglia diventa quella (altrimenti il restrict blocca l'account).
    const { data: altro, error: e3 } = await db.from("genitori_studenti").select("genitore_id").eq("studente_id", id).limit(1).maybeSingle();
    if (e3) throw e3;
    const { data: fa, error: e4 } = await db.from("famiglie").select("id").eq("genitore_id", altro?.genitore_id ?? "").maybeSingle();
    if (e4) throw e4;
    const { error: e5 } = await db.from("studenti").update({ famiglia_id: fa?.id ?? null }).eq("id", id);
    if (e5) throw e5;
    return { id, foto: 0, resti: null, scollegato: true };
  }
  const { data: u, error: e2 } = await db.auth.admin.getUserById(id);
  if (e2) throw e2;
  if (u.user?.app_metadata?.ruolo !== "studente") return null;

  const foto = await fotoDi(db, id);
  // Le chiamate del figlio restano alla famiglia, sommate e senza dati personali: reggono il tetto della famiglia
  // (eliminare e ricreare un figlio non azzera la spesa di oggi) e il costo resta nel pannello admin.
  const { error: ea } = await db.rpc("archivia_consumi", { studente: id });
  if (ea) throw ea;
  for (const t of ["sessioni", "argomenti", "report", "consumi"]) {
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
  return { id, foto: foto.length, resti: await resti(db, id) };
}

export async function esporta(db: Db, genitore: string) {
  const [{ data: u, error: e1 }, { data: fam, error: e2 }, { data: consensi, error: e3 }, { data: invito, error: e4 }] = await Promise.all([
    db.auth.admin.getUserById(genitore),
    db.from("famiglie").select("nome, cognome, creato").eq("genitore_id", genitore).maybeSingle(),
    db.from("consensi").select("documento, versione, accettato").eq("genitore_id", genitore).order("accettato"),
    db.from("inviti").select("codice").eq("titolare_id", genitore).eq("prova", false).maybeSingle(),
  ]);
  for (const e of [e1, e2, e3, e4]) if (e) throw e;
  const figli = [];
  for (const id of await figliDi(db, genitore)) {
    const { data: profilo, error } = await db.from("studenti").select("id, nome, cognome, classe, nome_utente, creato").eq("id", id).single();
    if (error) throw error;
    const tabelle: Record<string, unknown[]> = {};
    // PostgREST restituisce al massimo 1000 righe per richiesta: si legge a pagine fino all'ultima.
    for (const t of TABELLE) {
      tabelle[t] = [];
      for (let da = 0; ; da += 1000) {
        const { data, error: e } = await db.from(t).select("*").eq("studente_id", id).order(ORDINE[t] ?? "id").range(da, da + 999);
        if (e) throw e;
        tabelle[t].push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
    }
    figli.push({ profilo, tabelle, foto: await fotoDi(db, id) });
  }
  return esportazione({ genitore: { email: u.user?.email, nome: fam?.nome, cognome: fam?.cognome, creato: fam?.creato ?? u.user?.created_at }, consensi, invito, figli });
}

// ---------------------------------------------------------------- cestino (issue #35)

// Ban degli account ricalcolato dalle colonne `cestino` (unica fonte): genitore bannato se la famiglia è nel cestino,
// figlio se lui o la sua famiglia lo sono. Idempotente: si può ripetere dopo un errore a metà. Prima si scrive la
// colonna, poi si chiama questa. Il ban ferma nuovo accesso e rinnovo della sessione; le letture le chiude il database.
async function banna(db: Db, id: string, ban: boolean) {
  const { error } = await db.auth.admin.updateUserById(id, { ban_duration: ban ? "876000h" : "none" });
  if (error) throw error;
}
export async function allineaAccessi(db: Db, famigliaId: string | null, studenteId?: string) {
  if (!famigliaId) {
    // profilo senza famiglia (dati vecchi): conta solo il suo cestino
    const { data: s, error } = await db.from("studenti").select("cestino").eq("id", studenteId!).single();
    if (error) throw error;
    return banna(db, studenteId!, !!s.cestino);
  }
  const [{ data: f, error: e1 }, { data: figli, error: e2 }] = await Promise.all([
    db.from("famiglie").select("genitore_id, cestino").eq("id", famigliaId).single(),
    db.from("studenti").select("id, cestino").eq("famiglia_id", famigliaId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  await banna(db, f.genitore_id, !!f.cestino);
  for (const s of figli ?? []) await banna(db, s.id, !!(f.cestino || s.cestino));
}

// Riga del registro per la pulizia automatica: nessun admin, nessun nome, solo gli id (issue #35).
const NESSUN_ADMIN = "00000000-0000-0000-0000-000000000000";
async function registraPulizia(db: Db, studente_id: string, famiglia_id: string | null) {
  const { error } = await db.from("accessi_admin").insert({ admin_id: NESSUN_ADMIN, studente_id, famiglia_id, azione: "pulizia", motivo: "cestino oltre 30 giorni" });
  if (error) throw error;
}

// Registro oltre 12 mesi (issue #37): prima si contano le righe, poi si cancellano solo se sono entro la soglia.
// Una riga sola nel registro dice quante ne sono andate via (senza nomi).
export async function pulisciRegistro(db: Db, ora = Date.now()) {
  const limite = limiteRegistro(ora);
  const { count, error } = await db.from("accessi_admin").select("*", { count: "exact", head: true }).lt("creato", limite);
  if (error) throw error;
  const n = count ?? 0;
  const piano = pianoRegistro(n);
  if (!piano.cancella) return { ok: !piano.troppi, registro: 0, registro_troppi: piano.troppi };
  const { error: e2, count: via } = await db.from("accessi_admin").delete({ count: "exact" }).lt("creato", limite);
  if (e2) throw e2;
  const { error: e3 } = await db.from("accessi_admin").insert({ admin_id: NESSUN_ADMIN, studente_id: NESSUN_ADMIN, azione: "pulizia del registro", motivo: (via ?? n) + " righe oltre 12 mesi" });
  if (e3) throw e3;
  return { ok: true, registro: via ?? n, registro_troppi: false };
}

const riuscita = (r: { scollegato?: boolean; resti: Record<string, number> | null } | null) =>
  !!r && (r.scollegato === true || (!!r.resti && Object.values(r.resti).every((n) => n === 0)));

// Cancellazione definitiva di quello che è nel cestino da più di 30 giorni. Un giro alla volta (lucchetto in
// impostazioni); oltre la soglia non cancella niente. Risponde solo con i conteggi: niente id né nomi (log pubblici).
// ponytail: riallinea il ban di tutte le famiglie a ogni giro; con decine di famiglie va bene, con migliaia no.
export async function pulisciCestino(db: Db, ora = Date.now()) {
  const { data: preso, error: el } = await db.rpc("prendi_pulizia", { minuti: 10 });
  if (el) throw el;
  if (!preso) return { ok: true, occupata: true, famiglie: 0, profili: 0, restano: 0 };
  try {
    // Prima il registro: gira anche nei giorni in cui il cestino supera la sua soglia.
    // Un errore qui non ferma il cestino, ma il giro fallisce (workflow rosso).
    const reg = await pulisciRegistro(db, ora).catch((e) => {
      console.error("pulizia: registro non pulito:", e);
      return { ok: false, registro: 0, registro_troppi: false };
    });
    const [{ data: famiglie, error: e1 }, { data: figli, error: e2 }] = await Promise.all([
      db.from("famiglie").select("id, genitore_id, cestino, protetta"),
      db.from("studenti").select("id, famiglia_id, cestino"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const piano = pianoPulizia({ famiglie: famiglie ?? [], figli: figli ?? [] }, ora);
    if (piano.troppi) return { ok: false, troppi: true, famiglie: piano.famiglie.length, profili: piano.profili, restano: 0, registro: reg.registro, registro_troppi: reg.registro_troppi };

    // «Scaduto» si ricontrolla subito prima di cancellare: un «Ripristina» nel frattempo vince.
    const ancoraScaduto = async (tabella: string, id: string) => {
      const { data, error } = await db.from(tabella).select("cestino").eq("id", id).maybeSingle();
      if (error) throw error;
      return !!data && scaduti([data], ora).length === 1;
    };
    let nf = 0, np = 0, restano = 0;
    for (const id of piano.figli) {
      if (!(await ancoraScaduto("studenti", id))) continue;
      const fam = (figli ?? []).find((s: { id: string }) => s.id === id)?.famiglia_id ?? null;
      await registraPulizia(db, id, fam);
      if (riuscita(await elimina(db, id))) np++; else restano++;
    }
    for (const f of piano.famiglie) {
      if (!(await ancoraScaduto("famiglie", f.id))) continue;
      await registraPulizia(db, f.genitore_id, f.id);
      let ok = true;
      for (const id of f.figli) { if (riuscita(await elimina(db, id, f.genitore_id))) np++; else { ok = false; restano++; } }
      if (!ok) { restano++; continue; }
      // in cascata vanno via famiglia, consensi e inviti; se resta un figlio il restrict lo impedisce
      const { error } = await db.auth.admin.deleteUser(f.genitore_id);
      if (error) { console.error("pulizia: genitore non cancellato:", f.id, error); restano++; } else nf++;
    }
    for (const f of famiglie ?? []) if (!piano.famiglie.some((x: { id: string }) => x.id === f.id)) await allineaAccessi(db, f.id);
    return { ok: restano === 0 && reg.ok, famiglie: nf, profili: np, restano, registro: reg.registro, registro_troppi: reg.registro_troppi };
  } finally {
    await db.rpc("lascia_pulizia");
  }
}
