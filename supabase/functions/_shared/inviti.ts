// Il codice invito personale di un utente (genitore o amministratore), creato la prima volta (issue #30).
// Usato da `profili` e `admin`. Un conflitto (creato nel frattempo, o codice già preso) si risolve rileggendo.
import { codiceInvito } from "./famiglie.js";
import type { admin } from "./http.ts";

export async function codicePersonale(db: ReturnType<typeof admin>, titolare: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db.from("inviti").select("codice").eq("titolare_id", titolare).eq("prova", false).maybeSingle();
    if (error) throw error;
    if (data) return data.codice;
    const { error: e2 } = await db.from("inviti").insert({ codice: codiceInvito(), titolare_id: titolare });
    if (e2 && e2.code !== "23505") throw e2; // 23505: creato nel frattempo, o codice già usato da un altro: si rilegge
  }
  throw new Error("codice invito: troppi tentativi");
}

