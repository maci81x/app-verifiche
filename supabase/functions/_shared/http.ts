// Pezzi comuni alle Edge Function `accedi` e `profili`.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Il codice delle ragazze: 4 cifre, come il tastierino dell'app.
export const CODICE = /^\d{4}$/;

// Client con la service role, senza sessione salvata. Uno nuovo per ogni uso:
// verifyOtp tiene la sessione aperta nel client che la chiama.
export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
