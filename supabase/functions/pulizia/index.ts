// Cancellazione definitiva del cestino oltre 30 giorni (issue #35). La chiama ogni mattina il workflow «Controllo
// mattutino» con il segreto PULIZIA_SEGRETO nell'header x-pulizia (verify_jwt = false: nessun utente dietro).
// Senza parametri e idempotente: tocca solo righe con il cestino più vecchio di 30 giorni, scrive ogni cancellazione in
// accessi_admin (azione «pulizia», senza nomi) e oltre 3 famiglie o 5 profili in un giro non cancella niente.
//
// POST (header x-pulizia) → 200 { ok: true, famiglie, profili, restano: 0 }
//                         → 500 { ok: false, troppi?, famiglie, profili, restano }   il workflow fallisce
// Solo conteggi: i log di Actions di un repo pubblico sono pubblici.
import { admin, json } from "../_shared/http.ts";
import { pulisciCestino } from "../_shared/eliminazione.ts";

const enc = new TextEncoder();
async function uguale(a: string, b: string) {
  // confronto a tempo costante sugli hash (stessa lunghezza qualunque sia l'input)
  const [x, y] = await Promise.all([a, b].map((t) => crypto.subtle.digest("SHA-256", enc.encode(t))));
  const [ax, by] = [new Uint8Array(x), new Uint8Array(y)];
  // @ts-ignore: timingSafeEqual c'è in Deno (crypto.subtle esteso)
  if (typeof crypto.subtle.timingSafeEqual === "function") return crypto.subtle.timingSafeEqual(ax, by) as boolean;
  let d = 0;
  for (let i = 0; i < ax.length; i++) d |= ax[i] ^ by[i];
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const atteso = Deno.env.get("PULIZIA_SEGRETO") ?? "";
  if (atteso.length < 32) return json({ errore: "pulizia non configurata" }, 500);
  if (!(await uguale(req.headers.get("x-pulizia") ?? "", atteso))) return json({ errore: "non autorizzato" }, 401);
  try {
    const r = await pulisciCestino(admin());
    return json(r, r.ok ? 200 : 500);
  } catch (e) {
    console.error("pulizia: giro non riuscito:", e);
    return json({ ok: false, errore: "giro non riuscito" }, 500);
  }
});
