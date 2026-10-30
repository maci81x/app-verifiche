// Unico punto da cui l'app parla con il modello. La chiave Anthropic è un
// segreto Supabase e non arriva mai al browser.
//
// POST { azione: "trascrivi", immagini: [base64 jpeg, max 4], aggiunta?: bool } → { trascrizione }
// POST { azione: "concetti", materia, titolo, testo, pagine, esistenti?: [titoli] } → { concetti, ... }
//      I concetti la cui ancora non regge sul testo (filtro al 60%) vengono scartati qui.
// POST { azione: "domande", argomenti: [uuid], ripasso?, livello, tipo, modalita, quante? } → { domande, scartate }
//      quante (10, 15 o 20) solo per la verifica da stampare; senza, il numero dipende dal livello.
//      Materiale, concetti e domande già fatte si leggono dal database con i permessi
//      della studentessa: il filtro di ancoraggio lavora su quelli, non su quello che manda il browser.
// POST { azione: "correggi", modalita, pacchetto: [{ id, domanda, risposta_attesa, elementi, risposta_alunna }] } → { valutazioni }
// POST { azione: "mappa", argomento_id } → { titolo, materia, nodi: [{ id, titolo, ancora, fonte, peso, figli }], scartati, tagliati }
//      Primo livello = i concetti dell'argomento (stesso id); sotto, sotto-punti ancorati alla trascrizione.
//
// La funzione non scrive nel database: restituisce il risultato e l'app lo
// salva con i permessi della studentessa (RLS). Così la stessa funzione serve
// anche alla prova delle foto da riga di comando, che non salva niente.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { jsonSchemaOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/json-schema";
import {
  PROMPT_TRASCRIZIONE, PROMPT_TRASCRIZIONE_AGGIUNTA, promptConcetti, promptConcettiNuovi, promptDomande, promptCorrezione,
  promptMappa, DOMANDE_DA_STAMPARE,
} from "../_shared/prompt.js";
import { costruisciMappa, MAX_NODI } from "../_shared/mappa.js";
import { concettiAncorati } from "../_shared/concetti.js";
import { preparaPool, tieniAncorate } from "../_shared/domande.js";

const MODELLO = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5";
const MAX_IMMAGINI = 4;
const MAX_BASE64 = 6_000_000; // ~4,5 MB per foto: a 2000 px ne bastano molti meno

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Il controllo verify_jwt della piattaforma ha già validato la firma, ma accetta
// anche la chiave anonima pubblica: qui si pretende una studentessa. Il ruolo sta in
// app_metadata, che solo il server può scrivere (lo mette la funzione profili):
// un account nato in qualunque altro modo non consuma la chiave Anthropic.
function claims(req: Request): { role?: string; sub?: string; app_metadata?: { ruolo?: string } } {
  try {
    const token = req.headers.get("Authorization")!.replace(/^Bearer /i, "");
    const parte = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(parte));
  } catch {
    return {};
  }
}

// Client che legge il database come la studentessa che chiama: valgono le sue policy RLS.
const comeUtente = (req: Request) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

const LIVELLI = ["semplice", "medio", "difficile"], TIPI = ["miste", "chiuse", "aperte"], MODALITA = ["scritta", "orale"];

const CONCETTO = {
  type: "object",
  properties: {
    titolo: { type: "string" }, descrizione: { type: "string" },
    ancora: { type: "string" }, peso: { type: "number" }, errore_appunti: { type: "string" },
  },
  required: ["titolo", "descrizione", "ancora", "peso", "errore_appunti"],
  additionalProperties: false,
} as const;
const SCHEMA_TRASCRIZIONE = {
  type: "object", properties: { trascrizione: { type: "string" } },
  required: ["trascrizione"], additionalProperties: false,
} as const;
const DOMANDA = {
  type: "object",
  properties: {
    id: { type: "string" }, concetto_id: { type: "string" }, tipo: { type: "string", enum: ["chiusa", "aperta"] },
    testo: { type: "string" }, opzioni: { type: "array", items: { type: "string" } }, corretta: { type: "integer" },
    risposta_attesa: { type: "string" }, elementi: { type: "array", items: { type: "string" } }, ancora: { type: "string" },
  },
  required: ["id", "concetto_id", "tipo", "testo", "opzioni", "corretta", "risposta_attesa", "elementi", "ancora"],
  additionalProperties: false,
} as const;
const SCHEMA_DOMANDE = {
  type: "object", properties: { domande: { type: "array", items: DOMANDA } },
  required: ["domande"], additionalProperties: false,
} as const;
const SCHEMA_VALUTAZIONI = {
  type: "object",
  properties: {
    valutazioni: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" }, completezza: { type: "number" }, correttezza: { type: "number" },
          linguaggio: { type: "number" }, totale: { type: "number" }, commento: { type: "string" },
        },
        required: ["id", "completezza", "correttezza", "linguaggio", "totale", "commento"],
        additionalProperties: false,
      },
    },
  },
  required: ["valutazioni"], additionalProperties: false,
} as const;
const SCHEMA_CONCETTI = {
  type: "object",
  properties: { concetti: { type: "array", items: CONCETTO } },
  required: ["concetti"], additionalProperties: false,
} as const;

// Mappa: la nidificazione è scritta per esteso, così il modello non va oltre tre livelli.
const DETTAGLIO = {
  type: "object", properties: { titolo: { type: "string" }, ancora: { type: "string" } },
  required: ["titolo", "ancora"], additionalProperties: false,
} as const;
const SOTTO_PUNTO = {
  type: "object",
  properties: { titolo: { type: "string" }, ancora: { type: "string" }, figli: { type: "array", items: DETTAGLIO } },
  required: ["titolo", "ancora", "figli"], additionalProperties: false,
} as const;
const SCHEMA_MAPPA = {
  type: "object",
  properties: {
    nodi: {
      type: "array",
      items: {
        type: "object",
        properties: { concetto_id: { type: "string" }, figli: { type: "array", items: SOTTO_PUNTO } },
        required: ["concetto_id", "figli"], additionalProperties: false,
      },
    },
  },
  required: ["nodi"], additionalProperties: false,
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Definitivo extends Error {}

let client: Anthropic | undefined;
// Nessuna riprova automatica: il secondo tentativo lo fa l'app, come nel prototipo.
async function chiedi(prompt: string, schema: { type: "object" }, immagini: string[] = []) {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Definitivo("not_granted");
  client ??= new Anthropic({ maxRetries: 0 });
  try {
    const r = await client.messages.parse({
      model: MODELLO,
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          ...immagini.map((data) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
          })),
          { type: "text" as const, text: prompt },
        ],
      }],
      output_config: { format: jsonSchemaOutputFormat(schema) },
    });
    if (r.parsed_output == null) throw new Error(`risposta non valida (stop: ${r.stop_reason})`);
    return r.parsed_output as Record<string, unknown>;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new Definitivo("rate_limited");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new Definitivo("not_granted");
    throw e;
  }
}

const testo = (v: unknown) => (typeof v === "string" ? v : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ errore: "solo POST" }, 405);
  const io = claims(req);
  if (io.role !== "authenticated" || !io.sub) return json({ errore: "non autenticato" }, 401);
  if (io.app_metadata?.ruolo !== "studente") return json({ errore: "solo le studentesse" }, 403);

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ errore: "richiesta non valida" }, 400);

  try {
    if (b.azione === "trascrivi") {
      const imm = b.immagini;
      if (!Array.isArray(imm) || !imm.length || imm.length > MAX_IMMAGINI ||
          !imm.every((x) => typeof x === "string" && x.length > 100 && x.length < MAX_BASE64))
        return json({ errore: `da 1 a ${MAX_IMMAGINI} foto JPEG in base64` }, 400);
      const r = await chiedi(b.aggiunta ? PROMPT_TRASCRIZIONE_AGGIUNTA : PROMPT_TRASCRIZIONE, SCHEMA_TRASCRIZIONE, imm);
      return json({ trascrizione: testo(r.trascrizione) });
    }

    if (b.azione === "concetti") {
      const materiale = testo(b.testo);
      if (!materiale.trim()) return json({ errore: "nessun testo da leggere" }, 422);
      const esistenti = Array.isArray(b.esistenti) ? b.esistenti.map(testo).filter(Boolean) : null;
      const pagine = Math.max(1, Math.round(Number(b.pagine)) || 1);
      const prompt = esistenti
        ? promptConcettiNuovi(esistenti, materiale, pagine)
        : promptConcetti(testo(b.materia), testo(b.titolo), materiale, pagine);
      const r = await chiedi(prompt, SCHEMA_CONCETTI);
      return json(concettiAncorati(r.concetti as unknown[], materiale));
    }

    if (b.azione === "domande") {
      const ids = Array.isArray(b.argomenti) ? b.argomenti.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
      if (!ids.length || !LIVELLI.includes(b.livello) || !TIPI.includes(b.tipo) || !MODALITA.includes(b.modalita) ||
          (b.quante != null && !DOMANDE_DA_STAMPARE.includes(b.quante)))
        return json({ errore: "richiesta non valida" }, 400);
      const db = comeUtente(req);
      // studente_id = chi chiama: il genitore legge gli argomenti ma non prepara prove.
      const { data: argomenti, error } = await db.from("argomenti")
        .select("id, titolo, materia, trascrizione, concetti(id, titolo, descrizione, ancora, peso, media)")
        .in("id", ids).eq("studente_id", io.sub);
      if (error) throw error;
      if (!argomenti?.length) return json({ errore: "argomento non trovato" }, 404);
      const { pool, indice, contesto } = preparaPool(argomenti, !!b.ripasso);
      if (!pool.length) return json({ errore: "nessun_concetto" }, 422);

      // Ultime domande fatte su questi argomenti, dalla più recente: il modello non deve ripeterle uguali.
      const { data: fatte } = await db.from("domande").select("testo, sessioni(data)")
        .in("argomento_id", ids).limit(300);
      const gia = (fatte || [])
        .sort((x: any, y: any) => String(y.sessioni?.data).localeCompare(String(x.sessioni?.data)))
        .map((x: any) => x.testo).slice(0, 24);

      const r = await chiedi(promptDomande({
        livello: b.livello, tipo: b.tipo, modalita: b.modalita, ripasso: !!b.ripasso, contesto, gia, materiale: argomenti,
        quante: b.quante,
      }), SCHEMA_DOMANDE);
      const esito = tieniAncorate(r.domande as unknown[], indice, argomenti);
      if (!esito.domande.length) return json({ errore: "nessuna_ancorata", scartate: esito.scartate }, 422);
      return json(esito);
    }

    if (b.azione === "correggi") {
      const pacchetto = Array.isArray(b.pacchetto) ? b.pacchetto.slice(0, 40).map((x: any) => ({
        id: testo(x?.id), domanda: testo(x?.domanda), risposta_attesa: testo(x?.risposta_attesa),
        elementi: Array.isArray(x?.elementi) ? x.elementi.map(testo) : [], risposta_alunna: testo(x?.risposta_alunna).slice(0, 8000),
      })) : [];
      if (!pacchetto.length) return json({ valutazioni: [] });
      const r = await chiedi(promptCorrezione(b.modalita === "orale" ? "orale" : "scritta", pacchetto), SCHEMA_VALUTAZIONI);
      return json({ valutazioni: r.valutazioni });
    }

    if (b.azione === "mappa") {
      if (typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id)) return json({ errore: "richiesta non valida" }, 400);
      // Con i permessi della studentessa, e solo i suoi argomenti: la mappa nasce da quello che c'è nel database.
      const { data: a, error } = await comeUtente(req).from("argomenti")
        .select("id, titolo, materia, trascrizione, concetti(id, titolo, descrizione, ancora, peso, ordine)")
        .eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle();
      if (error) throw error;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      if (!a.concetti?.length) return json({ errore: "nessun_concetto" }, 422);
      // Con 25 concetti o più la mappa è già piena: non serve chiedere niente al modello.
      const posti = MAX_NODI - a.concetti.length;
      const r = posti > 0 ? await chiedi(promptMappa(a, posti), SCHEMA_MAPPA) : { nodi: [] };
      return json(costruisciMappa(a, r));
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    if (e instanceof Definitivo)
      return json({ errore: e.message }, e.message === "rate_limited" ? 429 : 403);
    console.error(e);
    return json({ errore: "lettura non riuscita" }, 502);
  }
});
