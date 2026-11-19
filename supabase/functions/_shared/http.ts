// Pezzi comuni alle Edge Function `accedi` e `profili`.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// I claim del token. La firma l'ha già verificata la piattaforma (verify_jwt = true in config.toml).
export function claims(req: Request): { role?: string; sub?: string; email?: string; aal?: string; app_metadata?: { ruolo?: string; prova?: boolean } } {
  try {
    const t = req.headers.get("Authorization")!.replace(/^Bearer /i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(t));
  } catch {
    return {};
  }
}

// Il codice delle ragazze: 4 cifre, come il tastierino dell'app.
export const CODICE = /^\d{4}$/;

// Client con la service role, senza sessione salvata. Uno nuovo per ogni uso:
// verifyOtp tiene la sessione aperta nel client che la chiama.
export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
