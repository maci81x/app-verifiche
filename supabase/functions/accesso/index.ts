// Richiesta di accesso dal telefono della studentessa. Pubblica: chi la chiama
// non ha ancora nessun account (verify_jwt = false in config.toml).
//
// POST { azione: "richiedi", dispositivo? } → { id, codice, segreto, scade }
//      Il telefono mostra il codice; il segreto lo tiene per sé.
// POST { azione: "stato", id, segreto }     → { stato: "attesa" | "rifiutata" | "scaduta" }
//                                            | { stato: "approvata", id, nome, classe, email, password }
//      Le credenziali escono una volta sola e poi vengono cancellate dal database.
// POST { azione: "annulla", id, segreto }   → { stato: "annullata" }
//
// L'ok lo dà il genitore dal suo telefono, con la funzione `profili`.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { casuale, nuovoCodice, sha256, uguali, MAX_IN_ATTESA, DURATA_MS } from "../_shared/accesso.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La richiesta, solo se chi chiede ha il segreto giusto.
async function mia(db: ReturnType<typeof admin>, b: { id?: unknown; segreto?: unknown }) {
  const id = String(b.id || ""), segreto = String(b.segreto || "");
  if (!UUID.test(id) || segreto.length < 32) return null;
  const { data, error } = await db.from("richieste_accesso")
    .select("id, segreto_hash, stato, scade, studente_id, email, password, studenti(nome, classe)")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || !uguali(data.segreto_hash, await sha256(segreto))) return null;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);
  const db = admin();

  try {
    if (b.azione === "richiedi") {
      const ora = new Date();
      await db.from("richieste_accesso").delete().lt("scade", ora.toISOString());
      const { count } = await db.from("richieste_accesso").select("id", { count: "exact", head: true }).eq("stato", "attesa");
      if ((count ?? 0) >= MAX_IN_ATTESA) return json({ errore: "troppe richieste aperte, riprova fra qualche minuto" }, 429);

      const segreto = casuale(32);
      const segreto_hash = await sha256(segreto);
      const dispositivo = String(b.dispositivo || "").trim().slice(0, 40) || null;
      const scade = new Date(ora.getTime() + DURATA_MS).toISOString();
      for (let i = 0; i < 5; i++) {
        const codice = nuovoCodice();
        const { data, error } = await db.from("richieste_accesso")
          .insert({ codice, segreto_hash, dispositivo, scade }).select("id").single();
        if (!error) return json({ id: data.id, codice, segreto, scade });
        if (error.code !== "23505") throw error; // codice già in uso: ne provo un altro
      }
      throw new Error("nessun codice libero");
    }

    if (b.azione === "stato") {
      const r = await mia(db, b);
      if (!r || r.stato === "consegnata") return json({ stato: "scaduta" });
      if (new Date(r.scade).getTime() < Date.now()) {
        await db.from("richieste_accesso").delete().eq("id", r.id);
        return json({ stato: "scaduta" });
      }
      if (r.stato === "attesa") return json({ stato: "attesa", scade: r.scade });
      if (r.stato === "rifiutata") {
        await db.from("richieste_accesso").delete().eq("id", r.id);
        return json({ stato: "rifiutata" });
      }
      // approvata: consegno una volta sola, chi arriva secondo non trova niente
      const { data: presa, error } = await db.from("richieste_accesso")
        .update({ stato: "consegnata", email: null, password: null })
        .eq("id", r.id).eq("stato", "approvata").select("id");
      if (error) throw error;
      if (!presa || !presa.length) return json({ stato: "scaduta" });
      const st = r.studenti as unknown as { nome: string; classe: string | null };
      return json({ stato: "approvata", id: r.studente_id, nome: st.nome, classe: st.classe, email: r.email, password: r.password });
    }

    if (b.azione === "annulla") {
      const r = await mia(db, b);
      if (r) await db.from("richieste_accesso").delete().eq("id", r.id);
      return json({ stato: "annullata" });
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    console.error(e);
    return json({ errore: "operazione non riuscita" }, 502);
  }
});
