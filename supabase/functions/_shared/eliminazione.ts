// Eliminazione ed export dei dati di un figlio o di una famiglia (issue #14, #30, #35). Usati da `profili` (il genitore),
// `admin` (l'amministratore) e `pulizia` (cestino oltre 30 giorni): una sola procedura, con il controllo «0 righe».
import type { admin } from "./http.ts";
import { esportazione } from "./famiglie.js";

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
