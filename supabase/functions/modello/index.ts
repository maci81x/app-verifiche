// Unico punto da cui l'app parla con il modello. La chiave Anthropic è un
// segreto Supabase e non arriva mai al browser.
//
// POST { azione: "trascrivi", immagini: [base64 jpeg, max 4], aggiunta?: bool, esercizi?: bool } → { trascrizione }
// POST { azione: "concetti", materia, titolo, testo, pagine, esistenti?: [titoli] } → { concetti, ... }
//      I concetti la cui ancora non regge sul testo (filtro al 60%) vengono scartati qui.
// POST { azione: "domande", argomenti: [uuid], ripasso?, livello, tipo, modalita, quante? } → { domande, scartate }
//      quante (10, 15 o 20) solo per la verifica da stampare; senza, il numero dipende dal livello.
//      Materiale, concetti e domande già fatte si leggono dal database con i permessi
//      della studentessa: il filtro di ancoraggio lavora su quelli, non su quello che manda il browser.
// POST { azione: "correggi", modalita, pacchetto: [{ id, domanda, risposta_attesa, elementi, risposta_alunna }] } → { valutazioni }
// POST { azione: "mappa", argomento_id } → { titolo, materia, nodi: [{ id, titolo, ancora, fonte, peso, figli }], scartati, tagliati }
//      Primo livello = i concetti dell'argomento (stesso id); sotto, sotto-punti ancorati alla trascrizione.
// POST { azione: "spiega", concetto_id, errore?: { domanda, risposta_alunna, risposta_attesa } }
//      → { spiegazione, esempio, analogia, fonti: [{ titolo, url }], eta }
// POST { azione: "arricchisci", argomento_id } → { albero, aggiunti, scartati }
//      Il web aiuta a studiare e non entra mai nella verifica (_shared/web.js). Ricerca con lo
//      strumento web_search (al massimo 3 ricerche, solo i siti della lista), poi composizione
//      in JSON: le fonti si scelgono per numero fra quelle citate davvero.
// POST { azione: "esercizi_tipi", materia, titolo, testo, esistenti?: [titoli] } → { tipi, scartati }
//      Matematica (issue #5): tipi di esercizio con un esercizio vero come ancora;
//      quelli la cui ancora non si ritrova nella trascrizione vengono scartati qui.
// POST { azione: "esercizi_genera", argomento_id, quanti: 5|10, tipi?: [uuid] } → { esercizi, scartati }
//      Esercizi simili ai tipi confermati (letti dal database con i permessi della studentessa).
//      Ognuno entra solo se la sua `verifica`, ricalcolata qui (_shared/calcolo.js), coincide
//      con il risultato dichiarato; gli altri si scartano e si contano.
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
  promptRicercaSpiegazione, promptSpiegazione, promptRicercaArricchisci, promptArricchisci,
  PROMPT_TRASCRIZIONE_ESERCIZI, promptEserciziTipi, promptEserciziGenera,
} from "../_shared/prompt.js";
import { tipiAncorati } from "../_shared/esercizi.js";
import { eserciziVerificati, FORME, QUANTI, PER_CHIAMATA, quantiDaChiedere } from "../_shared/generati.js";
import { costruisciMappa, MAX_NODI, agganciMappa, arricchisciMappa } from "../_shared/mappa.js";
import { strumentoRicerca, fontiCitate, testoRicerca, spiegazioneDaRisposta } from "../_shared/web.js";
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

const SCHEMA_SPIEGAZIONE = {
  type: "object",
  properties: {
    spiegazione: { type: "string" }, esempio: { type: "string" }, analogia: { type: "string" },
    fonti: { type: "array", items: { type: "integer" } },
  },
  required: ["spiegazione", "esempio", "analogia", "fonti"], additionalProperties: false,
} as const;
const SCHEMA_ARRICCHISCI = {
  type: "object",
  properties: {
    nodi: {
      type: "array",
      items: {
        type: "object",
        properties: { aggancio: { type: "string" }, titolo: { type: "string" }, testo: { type: "string" }, fonte: { type: "integer" } },
        required: ["aggancio", "titolo", "testo", "fonte"], additionalProperties: false,
      },
    },
  },
  required: ["nodi"], additionalProperties: false,
} as const;
const SCHEMA_TIPI = {
  type: "object",
  properties: {
    tipi: {
      type: "array",
      items: {
        type: "object",
        properties: { titolo: { type: "string" }, ancora: { type: "string" }, difficolta: { type: "integer" }, figura: { type: "boolean" } },
        required: ["titolo", "ancora", "difficolta", "figura"], additionalProperties: false,
      },
    },
  },
  required: ["tipi"], additionalProperties: false,
} as const;
const STRINGA = { type: "string" } as const;
// Lo schema elenca gli id brevi dei tipi della richiesta: il modello non può inventarne altri.
const schemaEsercizi = (brevi: string[]) => ({
  type: "object",
  properties: {
    esercizi: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: brevi }, testo: STRINGA, dati: STRINGA,
          figura: {
            type: "object",
            properties: {
              forma: { type: "string", enum: [...Object.keys(FORME), "nessuna"] },
              misure: {
                type: "array",
                items: { type: "object", properties: { nome: STRINGA, valore: STRINGA }, required: ["nome", "valore"], additionalProperties: false },
              },
            },
            required: ["forma", "misure"], additionalProperties: false,
          },
          passaggi: {
            type: "array",
            items: { type: "object", properties: { testo: STRINGA, formula: STRINGA }, required: ["testo", "formula"], additionalProperties: false },
          },
          risultato: { type: "object", properties: { valore: STRINGA, unita: STRINGA }, required: ["valore", "unita"], additionalProperties: false },
          verifica: STRINGA,
        },
        required: ["tipo", "testo", "dati", "figura", "passaggi", "risultato", "verifica"], additionalProperties: false,
      },
    },
  },
  required: ["esercizi"], additionalProperties: false,
} as const);
const testoBreve = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

class Definitivo extends Error {}
const STATO_DEFINITIVO: Record<string, number> = { rate_limited: 429, web_non_disponibile: 503, not_granted: 403 };

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

// Ricerca sul web: testo libero con citazioni (le citazioni non vanno insieme alle
// risposte JSON, per questo la composizione è una seconda chiamata). Se l'API mette in
// pausa un turno lungo (pause_turn) si rimanda il messaggio così com'è, al massimo 3 volte.
const GIRI_RICERCA = 3;
async function cercaSulWeb(prompt: string) {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Definitivo("not_granted");
  client ??= new Anthropic({ maxRetries: 0 });
  let contenuto: Anthropic.ContentBlock[] = [];
  try {
    for (let giro = 0; giro < GIRI_RICERCA; giro++) {
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
      if (contenuto.length) messages.push({ role: "assistant", content: contenuto as Anthropic.ContentBlockParam[] });
      const r = await client.messages.create({
        model: MODELLO, max_tokens: 8000, messages,
        tools: [strumentoRicerca() as Anthropic.WebSearchTool20260209],
      });
      contenuto = [...contenuto, ...r.content];
      if (r.stop_reason !== "pause_turn") break;
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new Definitivo("rate_limited");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new Definitivo("not_granted");
    // Ricerca web spenta per l'organizzazione o non accettata: lo si dice chiaro all'app.
    if (e instanceof Anthropic.BadRequestError) { console.error("ricerca web:", e); throw new Definitivo("web_non_disponibile"); }
    throw e;
  }
  return { fonti: fontiCitate(contenuto), ricerca: testoRicerca(contenuto) };
}

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
      const prompt = b.esercizi ? PROMPT_TRASCRIZIONE_ESERCIZI : (b.aggiunta ? PROMPT_TRASCRIZIONE_AGGIUNTA : PROMPT_TRASCRIZIONE);
      const r = await chiedi(prompt, SCHEMA_TRASCRIZIONE, imm);
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

    if (b.azione === "esercizi_tipi") {
      const materiale = testo(b.testo).slice(0, 200_000);
      if (!materiale.trim()) return json({ errore: "nessun testo da leggere" }, 422);
      const esistenti = Array.isArray(b.esistenti) ? b.esistenti.map(testo).filter(Boolean).slice(0, 50) : [];
      const r = await chiedi(promptEserciziTipi(testo(b.materia), testo(b.titolo), materiale, esistenti), SCHEMA_TIPI);
      return json(tipiAncorati(r.tipi as unknown[], materiale, esistenti));
    }

    if (b.azione === "esercizi_genera") {
      if (typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id) || !QUANTI.includes(b.quanti))
        return json({ errore: "richiesta non valida" }, 400);
      const scelti = Array.isArray(b.tipi) ? b.tipi.filter((x: unknown) => typeof x === "string" && UUID.test(x)).slice(0, 50) : [];
      const db = comeUtente(req);
      const [{ data: a, error }, { data: st }] = await Promise.all([
        db.from("argomenti").select("titolo, materia, esercizi_tipi(id, titolo, ancora, difficolta, figura, ordine)")
          .eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle(),
        db.from("studenti").select("classe").eq("id", io.sub).maybeSingle(),
      ]);
      if (error) throw error;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      const tipi = [...(a.esercizi_tipi || [])].sort((x, y) => x.ordine - y.ordine)
        .filter((t) => !scelti.length || scelti.includes(t.id));
      if (!tipi.length) return json({ errore: "nessun_tipo" }, 422);
      const brevi = tipi.map((_, i) => "t" + (i + 1));
      const perBreve = Object.fromEntries(tipi.map((t, i) => [brevi[i], { id: t.id, titolo: t.titolo }]));
      const elenco = tipi.map((t, i) => ({ breve: brevi[i], titolo: t.titolo, ancora: t.ancora, difficolta: t.difficolta, figura: t.figura }));
      // A gruppi di cinque, in parallelo: una risposta sola con 15 esercizi svolti è troppo lunga.
      // Ogni gruppo parte da un tipo diverso, così la distribuzione non si ripete uguale.
      const gruppi = Array.from({ length: b.quanti / PER_CHIAMATA }, (_, g) =>
        chiedi(promptEserciziGenera({
          materia: a.materia, titolo: a.titolo, classe: st?.classe ?? null, quanti: quantiDaChiedere(PER_CHIAMATA),
          tipi: [...elenco.slice(g % elenco.length), ...elenco.slice(0, g % elenco.length)],
        }), schemaEsercizi(brevi)));
      const risposte = await Promise.all(gruppi);
      const esito = eserciziVerificati(risposte.flatMap((r) => r.esercizi as unknown[]), perBreve, b.quanti);
      if (!esito.esercizi.length) return json({ errore: "nessun_verificato", scartati: esito.scartati }, 422);
      return json(esito);
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

    if (b.azione === "spiega") {
      if (typeof b.concetto_id !== "string" || !UUID.test(b.concetto_id)) return json({ errore: "richiesta non valida" }, 400);
      const db = comeUtente(req);
      const [{ data: c, error }, { data: st }] = await Promise.all([
        db.from("concetti").select("titolo, descrizione, ancora, argomenti(titolo, materia)")
          .eq("id", b.concetto_id).eq("studente_id", io.sub).maybeSingle(),
        db.from("studenti").select("classe").eq("id", io.sub).maybeSingle(),
      ]);
      if (error) throw error;
      if (!c) return json({ errore: "concetto non trovato" }, 404);
      const arg = c.argomenti as unknown as { titolo: string; materia: string };
      const e = b.errore && typeof b.errore === "object" ? b.errore : null;
      const dati = {
        materia: arg.materia, argomento: arg.titolo, classe: st?.classe ?? null,
        concetto: { titolo: c.titolo, descrizione: c.descrizione, ancora: c.ancora },
        errore: e && testoBreve(e.domanda) ? {
          domanda: testoBreve(e.domanda), risposta_alunna: testoBreve(e.risposta_alunna), risposta_attesa: testoBreve(e.risposta_attesa),
        } : null,
      };
      const { fonti, ricerca } = await cercaSulWeb(promptRicercaSpiegazione(dati));
      const r = await chiedi(promptSpiegazione({ ...dati, ricerca, fonti }), SCHEMA_SPIEGAZIONE);
      return json(spiegazioneDaRisposta(r, fonti, dati.classe));
    }

    if (b.azione === "arricchisci") {
      if (typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id)) return json({ errore: "richiesta non valida" }, 400);
      const db = comeUtente(req);
      const [{ data: a, error }, { data: m, error: e2 }, { data: st }] = await Promise.all([
        db.from("argomenti").select("titolo, materia").eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle(),
        db.from("mappe").select("albero").eq("argomento_id", b.argomento_id).eq("studente_id", io.sub).maybeSingle(),
        db.from("studenti").select("classe").eq("id", io.sub).maybeSingle(),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      if (!m) return json({ errore: "nessuna_mappa" }, 422);
      const agganci = agganciMappa(m.albero);
      const dati = { materia: a.materia, argomento: a.titolo, classe: st?.classe ?? null, agganci };
      const { fonti, ricerca } = await cercaSulWeb(promptRicercaArricchisci(dati));
      // Senza fonti citate non si aggiunge niente: ogni nodo web deve avere il suo link.
      if (!fonti.length) return json({ albero: m.albero, aggiunti: 0, scartati: 0 });
      const r = await chiedi(promptArricchisci({ ...dati, ricerca, fonti }), SCHEMA_ARRICCHISCI);
      return json(arricchisciMappa(m.albero, r, fonti));
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    if (e instanceof Definitivo) return json({ errore: e.message }, STATO_DEFINITIVO[e.message] ?? 403);
    console.error(e);
    return json({ errore: "lettura non riuscita" }, 502);
  }
});
