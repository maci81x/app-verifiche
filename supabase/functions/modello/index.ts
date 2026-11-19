// Unico punto da cui l'app parla con il modello. La chiave Anthropic è un
// segreto Supabase e non arriva mai al browser.
//
// POST { azione: "trascrivi", immagini: [base64 jpeg, max 4], aggiunta?: bool, esercizi?: bool } → { trascrizione }
// POST { azione: "concetti", materia, titolo, testo, pagine, esistenti?: [titoli] } → { concetti, ... }
//      I concetti la cui ancora non regge sul testo (filtro di ancoraggio, _shared/ancoraggio.js) vengono scartati qui.
// POST { azione: "domande", argomenti: [uuid], ripasso?, livello, tipo, modalita, quante?, concetto_id? } → { domande, scartate }
//      concetti: [uuid] (o concetto_id): solo quei concetti; con uno solo, prova lampo di 3 domande.
//      quante (10, 15 o 20) solo per la verifica da stampare; senza, il numero dipende dal livello.
//      una_aperta: true, con un concetto solo (ripasso guidato, issue #21): una domanda aperta su quel
//      concetto, formulata in modo diverso da diverse_da: [testi] → { domande: [una], scartate }.
//      Materiale, concetti e domande già fatte si leggono dal database con i permessi
//      della studentessa: il filtro di ancoraggio lavora su quelli, non su quello che manda il browser.
// POST { azione: "correggi", modalita, pacchetto: [{ id, domanda, risposta_attesa, elementi, risposta_alunna }] } → { valutazioni }
// POST { azione: "mappa", argomento_id } → { titolo, materia, nodi: [{ id, titolo, ancora, fonte, peso, figli }], scartati, tagliati }
// POST { azione: "sintesi", argomento_id } → { sintesi: { [concetto_id]: testo o "" }, scartate }
//      «In breve» dei concetti, chiesto dopo la mappa (issue #13); filtrato con _shared/sintesi.js.
//      Primo livello = i concetti dell'argomento (stesso id); sotto, sotto-punti ancorati alla trascrizione.
// POST { azione: "punti_chiave", argomento_id } → { punti: [{ concetto_id, etichetta, testo, chiave }], catena: [{ testo, ancora }],
//      parole, domanda: { concetto_id, testo, ancora } | null, scartati }: «Le 5 cose da sapere» (issue #22), ogni elemento
//      passa dal filtro di ancoraggio (_shared/punti.js). La cache (tabella punti_chiave) la scrive l'app.
// POST { azione: "racconto", argomento_id, testo } → { esiti: [{ concetto_id, esito: detto|impreciso|saltato, frase_detta }], toccati, totale }
//      «Raccontalo in 2 minuti» (issue #22): il racconto detto a voce confrontato con i concetti letti dal database.
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
// POST { azione: "esercizi_correggi", pacchetto: [{ id, testo, passaggi, risultato, verifica, risposta, svolgimento }] }
//      → { correzioni: [{ id, esito, punti, letto, primo_errore, tipo_errore, spiegazione, esempio }], analisi_mancante }
// POST { azione: "compito", immagini?: [base64], testo?, esercizio? } → { esercizi: [{ id, inizio }] } oppure la scheda
//      { testo, dati, cerca, soluzione_libro, indizi, passi, risultato, verifica, trucco, domande_pronte, libro_diverso? }
//      «Aiutami con un compito» (issue #27). In matematica ogni calcolo si ricalcola qui (_shared/compito.js):
//      se non torna si chiede una seconda volta, poi { errore: "conti_non_tornano" }. Se il risultato non è
//      quello del libro, dopo il secondo tentativo la scheda arriva con libro_diverso: true.
//      Nelle altre materie, se ci sono appunti della stessa materia, si usano come fonte e le ancore si controllano.
// POST { azione: "compito_domanda", compito, cronologia: [{ chi, testo }], domanda, sbloccata } → { risposta, calcoli, figura, prova_tu }
//      Senza sbloccata: true la risposta non deve contenere il risultato finale; se lo contiene si rigenera.
// POST { azione: "esercizi_genera", modello: { testo }, quanti: 5 } → come sopra, con questo esercizio come modello (issue #27).
// POST { azione: "prova_tu", atteso: { valore, unita }, risposta, calcolo?, testo? } → { esito, giusto, punti, letto, errore_tipico?, prerequisito? }:
//      solo un calcolo (correzione.js); con il calcolo o il testo si riconosce anche l'errore tipico (issue #28).
// POST { azione: "poesia", immagini | testo } → { titolo, autore, strofe: [[verso]] } (issue #28). Conta come un aiuto.
// POST { azione: "invalsi", materia: matematica|italiano|inglese, quante: 3-10 } → { brano, domande, scartate }: solo 3ª media
//      (422 solo_terza), conta come un aiuto; le risposte di matematica ricalcolate, quelle che non tornano scartate.
// POST { azione: "esame" } → { titolo, partenza, tappe, domande, consigli, scartate }: scaletta del colloquio dell'esame
//      dagli argomenti salvati (solo 3ª, 422 solo_terza; 422 pochi_argomenti con meno di due materie). Conta come un aiuto.
// POST { azione: "lezione", argomento_id } → { schede: [{ tipo, titolo, testo, ancora, calcoli, figura, fonte: "appunti" }], scartate }
//      Mini-lezione a schede dagli appunti (issue #23, _shared/lezione.js): ancore filtrate, conti ricalcolati,
//      anni della linea del tempo presi dagli appunti. Servono 5 schede e una regola con la frase del quaderno:
//      altrimenti si chiede una seconda volta, poi 422 nessuna_lezione. Conta come un aiuto (restituito se non riesce).
// POST { azione: "video", argomento_id } → { video: [{ titolo, url, sito, embed, anteprima, durata, canale }] }
//      Due video brevi cercati solo su YouTube e Rai Scuola (DOMINI_VIDEO); durata e canale solo se la ricerca li dice.
//      Conta come un aiuto; restituito se non arriva nessun video.
// POST { azione: "gemelli", compito } → { gemelli: [{ tipo: vicino|lontano|variante, testo, passi, risultato }], scartati }
//      Stessi passi, contesto diverso, ogni conto ricalcolato e numeri intermedi adatti; quelli che non tornano
//      si scartano e i tipi mancanti si chiedono una seconda volta. Conta come un aiuto.
// POST { azione: "esercizi_genera", modello: { testo, concetto, calcolo }, mirati: true } → fino a 3 esercizi mirati
//      su un concetto, dal più facile al problema a parole, più quelli in più (extra) per chi sbaglia.
//      compito e compito_domanda contano come aiuti: al massimo il limite della famiglia al giorno per profilo (giorno di
//      Roma; 30 per le famiglie esistenti, 10 per quelle esterne, issue #30), contati in app_metadata.aiuti (lo scrive solo il server). Oltre: 429 { errore: "limite_giornaliero" }.
//      Il risultato lo giudica un calcolo (_shared/correzione.js), mai il modello; il modello
//      legge solo i passaggi scritti (o fotografati) dalla ragazza e spiega il primo errore.
// POST { azione: "smista", trascrizioni: [testo], argomenti: [{ id, materia, titolo }], oggi: "YYYY-MM-DD" }
//      → { foto: [{ materia, argomento_id, nuovo_titolo, confidenza }], scadenze: [{ materia, tipo, data, testo_letto }], scartate }
//      Il diario di ogni giorno (issue #19): una riga per trascrizione, nello stesso ordine; argomento_id e
//      nuovo_titolo entrambi null = pagina di solo diario. La data di una scadenza la ricava _shared/smista.js
//      dalla frase letta (date relative rispetto a oggi), e la frase deve stare nella trascrizione: se no, si scarta.
//
// POST { azione: "strumento", tipo: date|vocaboli|schema, argomento_id } (issue #24)
//      date → { eventi: [{ data, evento, ancora, anno }], scartati }: la linea del tempo di storia.
//      vocaboli → { lingua, vocaboli: [{ parola, traduzione }], frasi, scartati }: lingue straniere (422 nessuna_lingua).
//      schema → { titolo, forma: ciclo|strati|parti, etichette: [{ termine, ancora }], scartati }: geografia e scienze.
//      Dalla trascrizione letta con i permessi della studentessa; tutto quello che non è scritto lì si scarta
//      (_shared/strumenti.js). 422 niente_da_mostrare se non resta niente. Conta come un aiuto (restituito se non riesce).
//
// La funzione non scrive nel database: restituisce il risultato e l'app lo
// salva con i permessi della studentessa (RLS). Così la stessa funzione serve
// anche alla prova delle foto da riga di comando, che non salva niente.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { jsonSchemaOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/json-schema";
import {
  PROMPT_TRASCRIZIONE, PROMPT_TRASCRIZIONE_AGGIUNTA, promptConcetti, promptConcettiNuovi, promptDomande, promptCorrezione,
  promptMappa, promptSintesi, DOMANDE_DA_STAMPARE, DOMANDE_PER_CONCETTO,
  promptRicercaSpiegazione, promptSpiegazione, promptRicercaArricchisci, promptArricchisci,
  PROMPT_TRASCRIZIONE_ESERCIZI, promptEserciziTipi, promptEserciziGenera, promptCorrezioneEsercizi, promptSmista,
  promptCompito, promptCompitoDomanda, promptGemelli, promptPuntiChiave, promptRacconto,
} from "../_shared/prompt.js";
import { tipiAncorati } from "../_shared/esercizi.js";
import { correggiPacchetto, conAnalisi, TIPI_ERRORE } from "../_shared/correzione.js";
import { eserciziVerificati, FORME, GRANDEZZE, QUANTI, PER_CHIAMATA, quantiDaChiedere } from "../_shared/generati.js";
import { costruisciMappa, MAX_NODI, agganciMappa, arricchisciMappa, sintesiDaRisposta } from "../_shared/mappa.js";
import { strumentoRicerca, fontiCitate, testoRicerca, spiegazioneDaRisposta, DOMINI_CONSENTITI, DOMINI_VIDEO, promptRicercaVideo, promptVideo, videoScelti } from "../_shared/web.js";
import { promptLezione, pulisciLezione, FIGURE_LEZIONE, TIPI_SCHEDA } from "../_shared/lezione.js";
import { concettiAncorati } from "../_shared/concetti.js";
import { preparaPool, tieniAncorate, sceltaLampo, MIN_LAMPO, diverseDa, unaApertaNuova } from "../_shared/domande.js";
import { smistamento, breviArgomenti, oggiValido, MAX_FOTO, MAX_TESTO_FOTO, MAX_ARGOMENTI } from "../_shared/smista.js";
import { controllaCompito, pulisciCompito, pulisciRisposta, calcoliCheNonTornano, cronologiaPulita, eMatematica, indiziSenzaRisultato,
  correggiProvaTu, contaAiuti, rimborsoAiuti, giornoRoma, pulisciGemelli, TIPI_GEMELLI,
  rispostaColRisultato, rispondiSenzaRisultato, AVVISO_BLOCCATA } from "../_shared/compito.js";
import { ancoraRegge } from "../_shared/ancoraggio.js";
import { puntiChiaveDaRisposta, esitiRacconto, ETICHETTE, ESITI_RACCONTO } from "../_shared/punti.js";
import { erroreTipicoDi, numeroClasse } from "../_shared/classe.js";
import { promptPoesia, pulisciPoesia } from "../_shared/poesia.js";
import { promptInvalsi, pulisciInvalsi, FORMATI_INVALSI, MATERIE_INVALSI } from "../_shared/invalsi.js";
import { promptEsame, pulisciEsame, argomentiPerEsame, MAX_ARGOMENTI_ESAME } from "../_shared/esame.js";
import { modelloPer, effortPer, costoUsd } from "../_shared/modelli.js";
import { righeConsumo, LIMITE_AIUTI_SENZA_FAMIGLIA } from "../_shared/famiglie.js";
import { dividiPerCache } from "../_shared/prompt.js";
import { TIPI_STRUMENTO, FORME_SCHEMA, LINGUE, promptStrumento, dateAncorate, vocaboliAncorati, schemaAncorato } from "../_shared/strumenti.js";

// Contesto di una richiesta (AsyncLocalStorage: le richieste in parallelo non si mescolano): quale azione,
// se l'account è di prova (può chiedere un modello per il confronto) e quanto ha consumato finora.
// Dalla #30: anche ogni singola chiamata (per le righe di `consumi`), la riga prenotata e il limite degli aiuti della famiglia.
type Consumo = { azione: string; prova: boolean; richiesto: string; effortRichiesto: string; chiamate: number; input: number; output: number;
  cache_scritti: number; cache_letti: number; costo: number; modelli: string[];
  dettaglio: { modello: string; usage: Anthropic.Usage | undefined }[]; riga: number | null; limiteAiuti: number };
const richiesta = new AsyncLocalStorage<Consumo>();
function modelloDellaRichiesta() {
  const c = richiesta.getStore();
  return modelloPer(c?.azione ?? "", { prova: c?.prova, richiesto: c?.richiesto });
}
function effortDellaRichiesta() {
  const c = richiesta.getStore();
  return effortPer(c?.azione ?? "", { prova: c?.prova, richiesto: c?.effortRichiesto }) as "low" | "medium" | "high" | undefined;
}
function registra(modello: string, u: Anthropic.Usage | undefined) {
  const c = richiesta.getStore();
  if (!c) return;
  c.chiamate++;
  c.input += u?.input_tokens ?? 0; c.output += u?.output_tokens ?? 0;
  c.cache_scritti += u?.cache_creation_input_tokens ?? 0; c.cache_letti += u?.cache_read_input_tokens ?? 0;
  c.costo += costoUsd(modello, u ?? {});
  if (!c.modelli.includes(modello)) c.modelli.push(modello);
  c.dettaglio.push({ modello, usage: u });
}
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
function claims(req: Request): { role?: string; sub?: string; app_metadata?: { ruolo?: string; prova?: boolean } } {
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

// La classe del profilo (issue #28): con i permessi di chi chiama; null se non c'è.
async function classeDi(req: Request, id: string | undefined): Promise<string | null> {
  const { data } = await comeUtente(req).from("studenti").select("classe").eq("id", id).maybeSingle();
  return data?.classe ?? null;
}

const MAX_CONCETTI_SCELTI = 12;
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
// «In breve» (issue #13): chiamata a parte, dopo l'albero.
const SCHEMA_SINTESI = {
  type: "object",
  properties: {
    sintesi: {
      type: "array",
      items: { type: "object", properties: { concetto_id: { type: "string" }, testo: { type: "string" } }, required: ["concetto_id", "testo"], additionalProperties: false },
    },
  },
  required: ["sintesi"], additionalProperties: false,
} as const;
// «Le 5 cose da sapere» e il racconto (issue #22).
const ANCORATO = { type: "object", properties: { testo: { type: "string" }, ancora: { type: "string" } }, required: ["testo", "ancora"], additionalProperties: false } as const;
const SCHEMA_PUNTI = {
  type: "object",
  properties: {
    punti: { type: "array", items: { type: "object", properties: {
      concetto_id: { type: "string" }, etichetta: { type: "string", enum: ETICHETTE }, testo: { type: "string" }, chiave: { type: "string" },
    }, required: ["concetto_id", "etichetta", "testo", "chiave"], additionalProperties: false } },
    catena: { type: "array", items: ANCORATO },
    parole: { type: "array", items: { type: "string" } },
    domanda: { type: "object", properties: { concetto_id: { type: "string" }, testo: { type: "string" }, ancora: { type: "string" } }, required: ["concetto_id", "testo", "ancora"], additionalProperties: false },
  },
  required: ["punti", "catena", "parole", "domanda"], additionalProperties: false,
} as const;
const SCHEMA_RACCONTO = {
  type: "object",
  properties: {
    esiti: { type: "array", items: { type: "object", properties: {
      concetto_id: { type: "string" }, esito: { type: "string", enum: ESITI_RACCONTO }, frase_detta: { type: "string" },
    }, required: ["concetto_id", "esito", "frase_detta"], additionalProperties: false } },
  },
  required: ["esiti"], additionalProperties: false,
} as const;
const MAX_RACCONTO = 8000; // caratteri: due minuti parlati sono circa 2000
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
          grandezza: { type: "string", enum: GRANDEZZE },
          risultato: { type: "object", properties: { valore: STRINGA, unita: STRINGA }, required: ["valore", "unita"], additionalProperties: false },
          verifica: STRINGA,
        },
        required: ["tipo", "testo", "dati", "figura", "passaggi", "grandezza", "risultato", "verifica"], additionalProperties: false,
      },
    },
  },
  required: ["esercizi"], additionalProperties: false,
} as const);
const SCHEMA_ANALISI = {
  type: "object",
  properties: {
    analisi: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: STRINGA, primo_errore: STRINGA, tipo_errore: { type: "string", enum: TIPI_ERRORE }, errore_tipico: STRINGA,
          spiegazione: STRINGA, esempio: STRINGA,
        },
        required: ["id", "primo_errore", "tipo_errore", "errore_tipico", "spiegazione", "esempio"], additionalProperties: false,
      },
    },
  },
  required: ["analisi"], additionalProperties: false,
} as const;
// Lo schema elenca gli id brevi degli argomenti della richiesta: il modello non può inventarne altri.
const schemaSmista = (brevi: string[]) => ({
  type: "object",
  properties: {
    foto: {
      type: "array",
      items: {
        type: "object",
        properties: {
          foto: { type: "integer" }, materia: STRINGA, argomento: { type: "string", enum: [...brevi, "nuovo", "nessuno"] },
          nuovo_titolo: STRINGA, confidenza: { type: "number" },
        },
        required: ["foto", "materia", "argomento", "nuovo_titolo", "confidenza"], additionalProperties: false,
      },
    },
    scadenze: {
      type: "array",
      items: {
        type: "object",
        properties: { foto: { type: "integer" }, materia: STRINGA, tipo: { type: "string", enum: ["scritta", "orale"] }, testo_letto: STRINGA },
        required: ["foto", "materia", "tipo", "testo_letto"], additionalProperties: false,
      },
    },
  },
  required: ["foto", "scadenze"], additionalProperties: false,
} as const);
const testoBreve = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const PROVA_TU = {
  type: "object",
  properties: {
    testo: STRINGA, risultato: { type: "object", properties: { valore: STRINGA, unita: STRINGA }, required: ["valore", "unita"], additionalProperties: false },
    calcolo: STRINGA, passo: { type: "integer" }, spiegazione: STRINGA,
  },
  required: ["testo", "risultato", "calcolo", "passo", "spiegazione"], additionalProperties: false,
} as const;
// «Aiutami con un compito» (issue #27): un solo schema, con più esercizi si compila solo l'elenco.
const SCHEMA_COMPITO = {
  type: "object",
  properties: {
    esercizi: { type: "array", items: { type: "object", properties: { id: STRINGA, inizio: STRINGA }, required: ["id", "inizio"], additionalProperties: false } },
    materia: STRINGA, matematica: { type: "boolean" }, testo: STRINGA,
    dati: { type: "array", items: { type: "object", properties: { valore: STRINGA, significato: STRINGA }, required: ["valore", "significato"], additionalProperties: false } },
    cerca: STRINGA,
    soluzione_libro: STRINGA, indizi: { type: "array", items: STRINGA },
    passi: { type: "array", items: { type: "object", properties: { titolo: STRINGA, spiegazione: STRINGA, calcolo: STRINGA, ancora: STRINGA, concetto: STRINGA }, required: ["titolo", "spiegazione", "calcolo", "ancora", "concetto"], additionalProperties: false } },
    risultato: { type: "object", properties: { valore: STRINGA, unita: STRINGA }, required: ["valore", "unita"], additionalProperties: false },
    verifica: {
      type: "object",
      properties: { spiegazione: STRINGA, controlli: { type: "array", items: { type: "object", properties: { testo: STRINGA, calcolo: STRINGA }, required: ["testo", "calcolo"], additionalProperties: false } } },
      required: ["spiegazione", "controlli"], additionalProperties: false,
    },
    strategia: { type: "object", properties: { nome: STRINGA, perche: STRINGA }, required: ["nome", "perche"], additionalProperties: false },
    trucco: STRINGA, domande_pronte: { type: "array", items: STRINGA },
    prova_tu: PROVA_TU,
  },
  required: ["esercizi", "materia", "matematica", "testo", "dati", "cerca", "soluzione_libro", "strategia", "indizi", "passi", "risultato", "verifica", "trucco", "domande_pronte", "prova_tu"],
  additionalProperties: false,
} as const;
const SCHEMA_RISPOSTA_COMPITO = {
  type: "object",
  properties: {
    risposta: STRINGA, calcoli: { type: "array", items: STRINGA },
    figura: { type: "object", properties: { tipo: { type: "string", enum: ["barra_frazioni", "nessuna"] }, parti: { type: "integer" }, colorate: { type: "integer" }, etichetta: STRINGA }, required: ["tipo", "parti", "colorate", "etichetta"], additionalProperties: false },
    prova_tu: PROVA_TU, passo: { type: "integer" },
  },
  required: ["risposta", "calcoli", "figura", "prova_tu", "passo"], additionalProperties: false,
} as const;
const MAX_APPUNTI = 60_000;
// Poesia a memoria e INVALSI (issue #28).
const SCHEMA_POESIA = {
  type: "object",
  properties: { titolo: STRINGA, autore: STRINGA, strofe: { type: "array", items: { type: "array", items: STRINGA } } },
  required: ["titolo", "autore", "strofe"], additionalProperties: false,
} as const;
const SCHEMA_INVALSI = {
  type: "object",
  properties: {
    brano: { type: "object", properties: { titolo: STRINGA, testo: STRINGA, ascolto: { type: "boolean" } }, required: ["titolo", "testo", "ascolto"], additionalProperties: false },
    domande: { type: "array", items: { type: "object", properties: {
      ambito: STRINGA, formato: { type: "string", enum: FORMATI_INVALSI }, testo: STRINGA, opzioni: { type: "array", items: STRINGA },
      corretta: { type: "integer" }, risposta: STRINGA, calcolo: STRINGA, spiegazione: STRINGA,
    }, required: ["ambito", "formato", "testo", "opzioni", "corretta", "risposta", "calcolo", "spiegazione"], additionalProperties: false } },
  },
  required: ["brano", "domande"], additionalProperties: false,
} as const;

// Strumenti per materia (issue #24).
const SCHEMI_STRUMENTO = {
  date: { type: "object", properties: { eventi: { type: "array", items: { type: "object", properties: { data: STRINGA, evento: STRINGA, ancora: STRINGA },
    required: ["data", "evento", "ancora"], additionalProperties: false } } }, required: ["eventi"], additionalProperties: false },
  vocaboli: { type: "object", properties: { lingua: { type: "string", enum: [...LINGUE, "altra"] },
    vocaboli: { type: "array", items: { type: "object", properties: { parola: STRINGA, traduzione: STRINGA }, required: ["parola", "traduzione"], additionalProperties: false } },
    frasi: { type: "array", items: STRINGA } }, required: ["lingua", "vocaboli", "frasi"], additionalProperties: false },
  schema: { type: "object", properties: { titolo: STRINGA, forma: { type: "string", enum: FORME_SCHEMA },
    etichette: { type: "array", items: { type: "object", properties: { termine: STRINGA, ancora: STRINGA }, required: ["termine", "ancora"], additionalProperties: false } } },
    required: ["titolo", "forma", "etichette"], additionalProperties: false },
} as const;

const SCHEMA_ESAME = {
  type: "object",
  properties: {
    titolo: STRINGA,
    partenza: { type: "object", properties: { argomento: STRINGA, apertura: STRINGA }, required: ["argomento", "apertura"], additionalProperties: false },
    tappe: { type: "array", items: { type: "object", properties: { argomento: STRINGA, collegamento: STRINGA, concetti: { type: "array", items: STRINGA } }, required: ["argomento", "collegamento", "concetti"], additionalProperties: false } },
    domande: { type: "array", items: { type: "object", properties: { argomento: STRINGA, testo: STRINGA }, required: ["argomento", "testo"], additionalProperties: false } },
    consigli: { type: "array", items: STRINGA },
  },
  required: ["titolo", "partenza", "tappe", "domande", "consigli"], additionalProperties: false,
} as const;

// Mini-lezione (issue #23): un solo oggetto figura, si compilano solo i campi del suo tipo.
const SCHEMA_LEZIONE = {
  type: "object",
  properties: {
    schede: { type: "array", items: { type: "object", properties: {
      tipo: { type: "string", enum: TIPI_SCHEDA }, titolo: STRINGA, testo: STRINGA, ancora: STRINGA, calcoli: { type: "array", items: STRINGA },
      figura: { type: "object", properties: {
        tipo: { type: "string", enum: FIGURE_LEZIONE }, forma: { type: "string", enum: [...Object.keys(FORME), "nessuna"] },
        misure: { type: "array", items: { type: "object", properties: { nome: STRINGA, valore: STRINGA }, required: ["nome", "valore"], additionalProperties: false } },
        eventi: { type: "array", items: { type: "object", properties: { anno: { type: "integer" }, etichetta: STRINGA }, required: ["anno", "etichetta"], additionalProperties: false } },
        passi: { type: "array", items: STRINGA },
        gruppi: { type: "array", items: { type: "object", properties: { titolo: STRINGA, voci: { type: "array", items: STRINGA } }, required: ["titolo", "voci"], additionalProperties: false } },
      }, required: ["tipo", "forma", "misure", "eventi", "passi", "gruppi"], additionalProperties: false },
    }, required: ["tipo", "titolo", "testo", "ancora", "calcoli", "figura"], additionalProperties: false } },
  },
  required: ["schede"], additionalProperties: false,
} as const;
const SCHEMA_VIDEO = {
  type: "object",
  properties: { video: { type: "array", items: { type: "object", properties: { fonte: { type: "integer" }, durata: STRINGA, canale: STRINGA }, required: ["fonte", "durata", "canale"], additionalProperties: false } } },
  required: ["video"], additionalProperties: false,
} as const;

const SCHEMA_GEMELLI = {
  type: "object",
  properties: {
    gemelli: { type: "array", items: { type: "object", properties: {
      tipo: { type: "string", enum: TIPI_GEMELLI }, testo: STRINGA,
      passi: { type: "array", items: { type: "object", properties: { titolo: STRINGA, spiegazione: STRINGA, calcolo: STRINGA }, required: ["titolo", "spiegazione", "calcolo"], additionalProperties: false } },
      risultato: { type: "object", properties: { valore: STRINGA, unita: STRINGA }, required: ["valore", "unita"], additionalProperties: false },
      verifica: { type: "object", properties: { spiegazione: STRINGA, controlli: { type: "array", items: { type: "object", properties: { testo: STRINGA, calcolo: STRINGA }, required: ["testo", "calcolo"], additionalProperties: false } } }, required: ["spiegazione", "controlli"], additionalProperties: false },
    }, required: ["tipo", "testo", "passi", "risultato", "verifica"], additionalProperties: false } },
  },
  required: ["gemelli"], additionalProperties: false,
} as const;

// Il conteggio degli aiuti vive nei metadati dell'account, che solo il server può scrivere: nessuna tabella nuova.
const amministratore = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// L'aiuto si prenota subito, prima del modello (rilettura fresca, finestra di pochi millisecondi), e si
// restituisce se la risposta non riesce. Senza una tabella (nessuna migration) il tetto non è atomico:
// richieste parallele fatte apposta fuori dall'app possono superarlo di poco. Se la prenotazione non
// si scrive, la richiesta si rifiuta.
async function prenotaAiuto(sub: string): Promise<boolean> {
  const db = amministratore();
  const { data, error } = await db.auth.admin.getUserById(sub);
  if (error || !data?.user) throw error ?? new Error("utente non trovato");
  const am = data.user.app_metadata ?? {};
  const { permesso, aiuti } = contaAiuti(am, giornoRoma(), richiesta.getStore()?.limiteAiuti ?? LIMITE_AIUTI_SENZA_FAMIGLIA);
  if (!permesso) return false;
  // Solo la chiave aiuti: il server unisce le chiavi di app_metadata, così non si cancella il consumo scritto nel frattempo.
  const { error: e2 } = await db.auth.admin.updateUserById(sub, { app_metadata: { aiuti } });
  if (e2) throw e2;
  return true;
}
async function restituisciAiuto(sub: string) {
  try {
    const db = amministratore();
    const { data } = await db.auth.admin.getUserById(sub);
    const am = data?.user?.app_metadata ?? {};
    const aiuti = rimborsoAiuti(am, giornoRoma());
    if (aiuti) await db.auth.admin.updateUserById(sub, { app_metadata: { aiuti } });
  } catch (e) { console.error("restituzione aiuto:", e); }
}

class Definitivo extends Error {}
const STATO_DEFINITIVO: Record<string, number> = { rate_limited: 429, web_non_disponibile: 503, not_granted: 403 };

let client: Anthropic | undefined;
// Nessuna riprova automatica: il secondo tentativo lo fa l'app, come nel prototipo.
// effort: "low" per i compiti di sola estrazione dove conta la velocità (mappa, sintesi).
async function chiedi(prompt: string, schema: { type: "object" }, immagini: string[] = [], effort?: "low" | "medium" | "high") {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Definitivo("not_granted");
  client ??= new Anthropic({ maxRetries: 0 });
  try {
    const model = modelloDellaRichiesta();
    // Prompt caching: la parte prima di FINE_PARTE_FISSA (il materiale, l'esercizio già spiegato) è uguale da
    // una chiamata all'altra e si legge dalla cache per 5 minuti; il resto (domanda, risposta) cambia.
    const { fisso, resto } = dividiPerCache(prompt);
    const testi = resto === null ? [{ type: "text" as const, text: fisso }]
      : [{ type: "text" as const, text: fisso, cache_control: { type: "ephemeral" as const } }, { type: "text" as const, text: resto }];
    const r = await client.messages.parse({
      model,
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          ...immagini.map((data) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
          })),
          ...testi,
        ],
      }],
      output_config: { format: jsonSchemaOutputFormat(schema), ...(effort ? { effort } : {}) },
    });
    registra(model, r.usage);
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
async function cercaSulWeb(prompt: string, domini: string[] = DOMINI_CONSENTITI) {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Definitivo("not_granted");
  client ??= new Anthropic({ maxRetries: 0 });
  let contenuto: Anthropic.ContentBlock[] = [];
  try {
    for (let giro = 0; giro < GIRI_RICERCA; giro++) {
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
      if (contenuto.length) messages.push({ role: "assistant", content: contenuto as Anthropic.ContentBlockParam[] });
      const model = modelloDellaRichiesta();
      const r = await client.messages.create({
        model, max_tokens: 8000, messages,
        tools: [strumentoRicerca(domini) as Anthropic.WebSearchTool20260209],
      });
      registra(model, r.usage);
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
  return { fonti: fontiCitate(contenuto, domini), ricerca: testoRicerca(contenuto) };
}

async function gestisci(req: Request): Promise<Response> {
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
      const r = await chiedi(prompt, SCHEMA_TRASCRIZIONE, imm, effortDellaRichiesta());
      return json({ trascrizione: testo(r.trascrizione) });
    }

    if (b.azione === "concetti") {
      const materiale = testo(b.testo);
      if (!materiale.trim()) return json({ errore: "nessun testo da leggere" }, 422);
      const esistenti = Array.isArray(b.esistenti) ? b.esistenti.map(testo).filter(Boolean) : null;
      const pagine = Math.max(1, Math.round(Number(b.pagine)) || 1);
      const classe = await classeDi(req, io.sub);
      const prompt = esistenti
        ? promptConcettiNuovi(esistenti, materiale, pagine, { classe, materia: testo(b.materia) })
        : promptConcetti(testo(b.materia), testo(b.titolo), materiale, pagine, classe);
      const r = await chiedi(prompt, SCHEMA_CONCETTI);
      return json(concettiAncorati(r.concetti as unknown[], materiale));
    }

    if (b.azione === "esercizi_tipi") {
      const materiale = testo(b.testo).slice(0, 200_000);
      if (!materiale.trim()) return json({ errore: "nessun testo da leggere" }, 422);
      const esistenti = Array.isArray(b.esistenti) ? b.esistenti.map(testo).filter(Boolean).slice(0, 50) : [];
      const { data: st } = await comeUtente(req).from("studenti").select("classe").eq("id", io.sub).maybeSingle();
      const r = await chiedi(promptEserciziTipi(testo(b.materia), testo(b.titolo), materiale, esistenti, st?.classe ?? null), SCHEMA_TIPI);
      return json(tipiAncorati(r.tipi as unknown[], materiale, esistenti));
    }

    // «Fammi un esercizio simile» (issue #27): il modello è l'esercizio del compito, non un argomento salvato.
    if (b.azione === "esercizi_genera" && b.modello && typeof b.modello === "object") {
      const modello = testoBreve(b.modello.testo, 4000).trim();
      const mirati = b.mirati === true ? { concetto: testoBreve(b.modello.concetto, 80).trim(), calcolo: testoBreve(b.modello.calcolo, 400).trim(), testo: modello } : null;
      if (mirati) b.quanti = 5; // se ne chiedono di più: tre in ordine di difficoltà e quelli in più per chi sbaglia
      if (!modello || !QUANTI.includes(b.quanti) || (mirati && !mirati.concetto)) return json({ errore: "richiesta non valida" }, 400);
      const { data: st } = await comeUtente(req).from("studenti").select("classe").eq("id", io.sub).maybeSingle();
      const perBreve = { t1: { id: "compito", titolo: "Esercizio simile" } };
      const elenco = [{ breve: "t1", titolo: "Esercizio simile al compito", ancora: modello, difficolta: 2, figura: false }];
      const gruppi = Array.from({ length: b.quanti / PER_CHIAMATA }, () =>
        chiedi(promptEserciziGenera({ materia: "matematica", titolo: "", classe: st?.classe ?? null, quanti: quantiDaChiedere(PER_CHIAMATA), tipi: elenco, mirati }), schemaEsercizi(["t1"])));
      const risposte = await Promise.all(gruppi);
      const esito = eserciziVerificati(risposte.flatMap((r) => r.esercizi as unknown[]), perBreve, b.quanti);
      if (!esito.esercizi.length) return json({ errore: "nessun_verificato", scartati: esito.scartati }, 422);
      // Mirati: l'ordine del modello va dal più facile al problema a parole; i primi tre, gli altri di scorta.
      return json(mirati ? { esercizi: esito.esercizi.slice(0, 3), extra: esito.esercizi.slice(3), scartati: esito.scartati } : esito);
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

    if (b.azione === "esercizi_correggi") {
      const { correzioni, daAnalizzare } = correggiPacchetto(b.pacchetto);
      if (!correzioni.length) return json({ errore: "richiesta non valida" }, 400);
      const classe = await classeDi(req, io.sub);
      // Errori tipici per nome (issue #28): senza modello quando si può (1/2 + 1/3 = 2/5), poi la scelta del modello.
      const grezzi = new Map((Array.isArray(b.pacchetto) ? b.pacchetto : []).map((x: any) => [testo(x?.id).trim().slice(0, 40), x]));
      const conTipici = (lista: any[], analisi: unknown[] = []) => lista.map((c) => {
        const x: any = grezzi.get(c.id) || {}, a: any = (analisi as any[]).find((y) => y?.id === c.id) || {};
        return { ...c, ...(erroreTipicoDi({ classe, testo: testo(x.testo), risposta: testo(x.risposta), passaggi: testo(x.svolgimento), scelta: testo(a.errore_tipico), giusto: c.giusto }) || {}) };
      });
      if (!daAnalizzare.length) return json({ correzioni: conTipici(correzioni), analisi_mancante: false });
      // Senza la spiegazione dei passaggi la correzione del risultato vale lo stesso.
      try {
        const r = await chiedi(promptCorrezioneEsercizi({ classe, pacchetto: daAnalizzare }), SCHEMA_ANALISI);
        return json({ correzioni: conTipici(conAnalisi(correzioni, r.analisi as unknown[], daAnalizzare), r.analisi as unknown[]), analisi_mancante: false });
      } catch (e) {
        if (e instanceof Definitivo && e.message !== "rate_limited") throw e;
        console.error("analisi dei passaggi:", e);
        return json({ correzioni: conTipici(correzioni), analisi_mancante: true });
      }
    }

    if (b.azione === "smista") {
      const tr = b.trascrizioni, ar = b.argomenti ?? [];
      if (!Array.isArray(tr) || !tr.length || tr.length > MAX_FOTO || !tr.every((x) => typeof x === "string") ||
          !Array.isArray(ar) || ar.length > MAX_ARGOMENTI ||
          !ar.every((a: any) => a && typeof a.id === "string" && UUID.test(a.id) && testo(a.materia).trim() && testo(a.titolo).trim()) ||
          !oggiValido(b.oggi))
        return json({ errore: "richiesta non valida" }, 400);
      const trascrizioni = tr.map((x: string) => x.slice(0, MAX_TESTO_FOTO));
      if (!trascrizioni.some((x: string) => x.trim())) return json({ errore: "nessun testo da leggere" }, 422);
      const argomenti = ar.map((a: any) => ({ id: a.id, materia: testoBreve(a.materia, 60).trim(), titolo: testoBreve(a.titolo, 200).trim() }));
      const brevi = breviArgomenti(argomenti);
      const elenco = argomenti.map((a: any, i: number) => ({ breve: brevi[i], materia: a.materia, titolo: a.titolo }));
      const r = await chiedi(promptSmista({ oggi: b.oggi, trascrizioni, argomenti: elenco }), schemaSmista(brevi), [], "low");
      return json(smistamento(r, trascrizioni, argomenti, b.oggi));
    }

    if (b.azione === "compito") {
      const imm = Array.isArray(b.immagini) ? b.immagini : [];
      const scritto = testoBreve(b.testo, 6000).trim();
      if ((!imm.length && !scritto) || imm.length > MAX_IMMAGINI ||
          !imm.every((x: unknown) => typeof x === "string" && x.length > 100 && x.length < MAX_BASE64))
        return json({ errore: `una foto (fino a ${MAX_IMMAGINI}) o il testo dell'esercizio` }, 400);
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
      const db = comeUtente(req);
      const { data: st } = await db.from("studenti").select("classe").eq("id", io.sub).maybeSingle();
      const base = { classe: st?.classe ?? null, testo: scritto || null, esercizio: testoBreve(b.esercizio, 200).trim() || null };
      const foto = scritto ? [] : imm;
      // Il testo scritto (o corretto) da chi studia vale più di quello riscritto dal modello.
      const conTesto = (x: any) => (x && !x.esercizi && scritto ? { ...x, testo: scritto } : x);
      let c = conTesto(pulisciCompito(await chiedi(promptCompito(base), SCHEMA_COMPITO, foto)));
      if (!c) return json({ errore: "nessun_esercizio" }, 422);
      if (c.esercizi) return json(c); // l'elenco da scegliere non consuma un aiuto: lo consuma l'esercizio scelto
      if (eMatematica(c)) {
        // Ogni conto si ricalcola; se non torna si chiede una seconda volta, poi niente soluzione.
        // Il secondo tentativo si tiene solo se è migliore: conti giusti battono conti rotti.
        const voto = (e: any) => (e.ok ? 2 : e.motivo === "libro" ? 1 : 0);
        let esito = controllaCompito(c);
        if (!esito.ok) {
          const nota = esito.motivo === "libro"
            ? "Attenzione: il tuo risultato non coincide con la soluzione del libro. Rileggi il testo e rifai i conti."
            : "Attenzione: nel tentativo precedente un conto non tornava (" + (esito.motivo === "passo" ? "passo " + esito.passo : esito.motivo) + "). Rifai i conti uno per uno.";
          const di_nuovo = conTesto(pulisciCompito(await chiedi(promptCompito(base) + "\n\n" + nota, SCHEMA_COMPITO, foto)));
          if (di_nuovo && !di_nuovo.esercizi) {
            const esito2 = controllaCompito(di_nuovo);
            if (voto(esito2) > voto(esito)) { c = di_nuovo; esito = esito2; }
          }
        }
        // Il motivo (passo, risultato, verifica) aiuta a capire un rifiuto; l'app mostra lo stesso messaggio.
        if (!esito.ok && esito.motivo !== "libro") return json({ errore: "conti_non_tornano", motivo: esito.motivo, passo: esito.passo ?? null }, 422);
        // In matematica non ci sono frasi del quaderno da evidenziare; gli indizi non dicono il risultato.
        // Conti giusti ma risultato diverso dal libro: si mostrano tutti e due, senza dire chi ha ragione.
        const scheda = { ...c, matematica: true, indizi: indiziSenzaRisultato(c), passi: c.passi.map((p: any) => ({ ...p, ancora: "" })), libro_diverso: !esito.ok };
        riuscito = true;
        return json(scheda);
      }
      // Altre materie: se ci sono appunti della stessa materia, si rifà con quelli come fonte e
      // si tengono solo le ancore che si ritrovano davvero negli appunti.
      const { data: arg } = c.materia
        ? await db.from("argomenti").select("trascrizione").eq("studente_id", io.sub).ilike("materia", c.materia.replace(/[%_\\]/g, "")).order("aggiornato", { ascending: false }).limit(5)
        : { data: null };
      const appunti = (arg || []).map((a: any) => a.trascrizione || "").join("\n\n").slice(0, MAX_APPUNTI);
      if (appunti.trim()) {
        const conAppunti = pulisciCompito(await chiedi(promptCompito({ ...base, testo: base.testo || c.testo, appunti }), SCHEMA_COMPITO));
        if (conAppunti && !conAppunti.esercizi) c = conTesto(conAppunti);
      }
      const passi = c.passi.map((p: any) => ({ ...p, calcolo: "", ancora: p.ancora && appunti && ancoraRegge(p.ancora, appunti) ? p.ancora : "" }));
      const scheda = { ...c, passi, libro_diverso: false };
      riuscito = true;
      return json(scheda);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    if (b.azione === "compito_domanda") {
      const compito = pulisciCompito(b.compito);
      const domanda = testoBreve(b.domanda, 600).trim();
      if (!compito || compito.esercizi || !domanda) return json({ errore: "richiesta non valida" }, 400);
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
      const { data: st } = await comeUtente(req).from("studenti").select("classe").eq("id", io.sub).maybeSingle();
      // Finché l'app non dice sbloccata (almeno 1 indizio e 1 risposta provata) il risultato non si dice.
      const bloccata = b.sbloccata !== true;
      const prompt = promptCompitoDomanda({ classe: st?.classe ?? null, compito, cronologia: cronologiaPulita(b.cronologia), domanda, bloccata });
      const genera = async (extra = "") => pulisciRisposta(await chiedi(prompt + extra, SCHEMA_RISPOSTA_COMPITO));
      let r = bloccata ? await rispondiSenzaRisultato(genera, compito) : await genera();
      if (!r) return json({ errore: "lettura non riuscita" }, 502);
      // I conti della risposta si ricalcolano come quelli della soluzione: una seconda volta, poi niente.
      if (calcoliCheNonTornano(r).length) {
        const di_nuovo = await genera("\n\nAttenzione: nel tentativo precedente un conto non tornava. Rifai i conti uno per uno." + (bloccata ? AVVISO_BLOCCATA : ""));
        if (di_nuovo && !(bloccata && rispostaColRisultato(di_nuovo, compito))) r = di_nuovo;
        if (calcoliCheNonTornano(r).length) return json({ errore: "conti_non_tornano" }, 422);
      }
      riuscito = true;
      return json(r);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    // Poesia a memoria (issue #28): la foto (o il testo) della poesia, trascritta verso per verso. Conta come un aiuto.
    if (b.azione === "poesia") {
      const imm = Array.isArray(b.immagini) ? b.immagini : [];
      const scritto = testoBreve(b.testo, 6000).trim();
      if ((!imm.length && !scritto) || imm.length > MAX_IMMAGINI ||
          !imm.every((x: unknown) => typeof x === "string" && x.length > 100 && x.length < MAX_BASE64))
        return json({ errore: `una foto (fino a ${MAX_IMMAGINI}) o il testo della poesia` }, 400);
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
        const prompt = promptPoesia() + (scritto ? "\n\nLa poesia, scritta a mano da chi studia (la foto non c'è):\n" + scritto : "");
        const p = pulisciPoesia(await chiedi(prompt, SCHEMA_POESIA, imm));
        if (!p) return json({ errore: "nessuna_poesia" }, 422);
        riuscito = true;
        return json(p);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    // «Allenati per l'INVALSI» (issue #28): solo per la terza media. Conta come un aiuto.
    if (b.azione === "invalsi") {
      const quante = Math.min(10, Math.max(3, Math.round(Number(b.quante)) || 5));
      if (!MATERIE_INVALSI.includes(b.materia)) return json({ errore: "richiesta non valida" }, 400);
      const classe = await classeDi(req, io.sub);
      if (numeroClasse(classe) !== 3) return json({ errore: "solo_terza" }, 422); // 422: l'app lo legge (403 è «non autorizzato»)
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
        const esito = pulisciInvalsi(await chiedi(promptInvalsi({ materia: b.materia, quante, classe }), SCHEMA_INVALSI), b.materia, quante);
        if (!esito.domande.length) return json({ errore: "nessuna_domanda", scartate: esito.scartate }, 422);
        riuscito = true;
        return json(esito);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    // «Esame di terza media» (issue #28): scaletta del colloquio dagli argomenti salvati. Solo 3ª, conta come un aiuto.
    if (b.azione === "esame") {
      const classe = await classeDi(req, io.sub);
      if (numeroClasse(classe) !== 3) return json({ errore: "solo_terza" }, 422); // 422: l'app lo legge (403 è «non autorizzato»)
      const { data: salvati, error } = await comeUtente(req).from("argomenti").select("id, titolo, materia, concetti(titolo)")
        .eq("studente_id", io.sub).order("aggiornato", { ascending: false }).limit(MAX_ARGOMENTI_ESAME);
      if (error) throw error;
      const argomenti = argomentiPerEsame(salvati);
      if (!argomenti) return json({ errore: "pochi_argomenti" }, 422);
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
        let e = pulisciEsame(await chiedi(promptEsame({ classe, argomenti }), SCHEMA_ESAME), argomenti);
        if (!e) e = pulisciEsame(await chiedi(promptEsame({ classe, argomenti }) + "\n\nAttenzione: usa solo gli id dell'elenco e almeno due materie diverse.", SCHEMA_ESAME), argomenti);
        if (!e) return json({ errore: "nessuna_scaletta" }, 422);
        riuscito = true;
        return json(e);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    if (b.azione === "gemelli") {
      const compito = pulisciCompito(b.compito);
      if (!compito || compito.esercizi || !compito.passi.some((p: any) => p.calcolo)) return json({ errore: "richiesta non valida" }, 400);
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
        const { data: st } = await comeUtente(req).from("studenti").select("classe").eq("id", io.sub).maybeSingle();
        const classe = st?.classe ?? null;
        let esito = pulisciGemelli(await chiedi(promptGemelli({ classe, compito, tipi: TIPI_GEMELLI }), SCHEMA_GEMELLI), compito);
        // I tipi scartati si rigenerano una volta, chiedendo solo quelli.
        if (esito.mancano.length) {
          const di_nuovo = pulisciGemelli(await chiedi(promptGemelli({ classe, compito, tipi: esito.mancano }), SCHEMA_GEMELLI), compito);
          const tutti = [...esito.gemelli, ...di_nuovo.gemelli.filter((g) => esito.mancano.includes(g.tipo))];
          const motivi: Record<string, number> = { ...esito.motivi };
          for (const [k, n] of Object.entries(di_nuovo.motivi)) motivi[k] = (motivi[k] || 0) + Number(n);
          esito = { gemelli: TIPI_GEMELLI.map((t) => tutti.find((g) => g.tipo === t)).filter(Boolean), scartati: esito.scartati + di_nuovo.scartati, motivi, scarti: [...esito.scarti, ...di_nuovo.scarti], mancano: [] };
        }
        if (!esito.gemelli.length) return json({ errore: "nessun_gemello", scartati: esito.scartati }, 422);
        if (esito.scartati) console.log("gemelli scartati:", JSON.stringify(esito.motivi));
        // Agli account di prova anche i gemelli scartati, per capire perché.
        const fuori = { gemelli: esito.gemelli, scartati: esito.scartati, motivi: esito.motivi, ...(richiesta.getStore()?.prova ? { scarti: esito.scarti } : {}) };
        riuscito = true;
        return json(fuori);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    // «Prova tu» (issue #27): la risposta la giudica un calcolo, non il modello. Non conta come aiuto.
    if (b.azione === "prova_tu") {
      const atteso = b.atteso && typeof b.atteso === "object" ? { valore: testoBreve(b.atteso.valore, 40), unita: testoBreve(b.atteso.unita, 20) } : null;
      if (!atteso?.valore) return json({ errore: "richiesta non valida" }, 400);
      const esito = correggiProvaTu(testoBreve(b.risposta, 60), atteso);
      // Con il testo o il calcolo della domanda si riconosce l'errore tipico (1/2 + 1/3 = 2/5) senza modello;
      // la classe si legge solo se c'è (serve per il prerequisito).
      const domanda = testoBreve(b.calcolo, 400) || testoBreve(b.testo, 400);
      const tipico = domanda && !esito.giusto ? erroreTipicoDi({ classe: null, testo: domanda, risposta: testoBreve(b.risposta, 60), giusto: false }) : null;
      if (!tipico) return json(esito);
      return json({ ...esito, ...erroreTipicoDi({ classe: await classeDi(req, io.sub), testo: domanda, risposta: testoBreve(b.risposta, 60), giusto: false }) });
    }

    if (b.azione === "strumento") {
      if (!TIPI_STRUMENTO.includes(b.tipo) || typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id))
        return json({ errore: "richiesta non valida" }, 400);
      const { data: a, error } = await comeUtente(req).from("argomenti")
        .select("id, titolo, materia, trascrizione, concetti(ancora)")
        .eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle();
      if (error) throw error;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      if (!String(a.trascrizione || "").trim()) return json({ errore: "nessun testo da leggere" }, 422);
      const tipo = b.tipo as "date" | "vocaboli" | "schema";
      // Conta come un aiuto; se non resta niente da mostrare (422) o qualcosa va storto, l'aiuto si restituisce.
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
        const r = await chiedi(promptStrumento(tipo, a), SCHEMI_STRUMENTO[tipo], [], "low");
        if (tipo === "date") {
          const d = dateAncorate(r, a);
          if (d.eventi.length < 2) return json({ errore: "niente_da_mostrare", scartati: d.scartati }, 422);
          riuscito = true; return json(d);
        }
        if (tipo === "vocaboli") {
          const v = vocaboliAncorati(r, a);
          if (!v.lingua) return json({ errore: "nessuna_lingua" }, 422);
          if (!v.vocaboli.length && !v.frasi.length) return json({ errore: "niente_da_mostrare", scartati: v.scartati }, 422);
          riuscito = true; return json(v);
        }
        const sc = schemaAncorato(r, a);
        if (!sc.etichette.length) return json({ errore: "niente_da_mostrare", scartati: sc.scartati }, 422);
        riuscito = true; return json(sc);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    if (b.azione === "domande") {
      const ids = Array.isArray(b.argomenti) ? b.argomenti.filter((x: unknown) => typeof x === "string").slice(0, 200) : [];
      // concetti (o concetto_id): solo quei concetti. Uno solo = prova lampo di 3 domande
      // («Mettiti alla prova», issue #11); più d'uno = «Ripassa i rossi» (issue #12).
      const grezzi = b.concetti != null ? b.concetti : (b.concetto_id != null ? [b.concetto_id] : null);
      const filtro = grezzi == null ? null
        : (Array.isArray(grezzi) && grezzi.length >= 1 && grezzi.length <= MAX_CONCETTI_SCELTI &&
           grezzi.every((x: unknown) => typeof x === "string" && UUID.test(x)) ? new Set(grezzi as string[]) : false);
      const soloConcetto = !!filtro && filtro.size === 1;
      const unaAperta = b.una_aperta === true ? { diverse: diverseDa(b.diverse_da) } : null;
      if ((unaAperta && (!soloConcetto || b.tipo !== "aperte")) ||
          !ids.length || !LIVELLI.includes(b.livello) || !TIPI.includes(b.tipo) || !MODALITA.includes(b.modalita) ||
          (b.quante != null && !DOMANDE_DA_STAMPARE.includes(b.quante)) || filtro === false ||
          (filtro && (b.ripasso || b.quante != null)))
        return json({ errore: "richiesta non valida" }, 400);
      const db = comeUtente(req);
      // studente_id = chi chiama: il genitore legge gli argomenti ma non prepara prove.
      const { data: argomenti, error } = await db.from("argomenti")
        .select("id, titolo, materia, trascrizione, concetti(id, titolo, descrizione, ancora, peso, media)")
        .in("id", ids).eq("studente_id", io.sub);
      if (error) throw error;
      if (!argomenti?.length) return json({ errore: "argomento non trovato" }, 404);
      // Solo i concetti scelti. Il materiale resta tutto, così il filtro di ancoraggio lavora come sempre.
      const scelti = filtro
        ? argomenti.map((a: any) => ({ ...a, concetti: (a.concetti || []).filter((c: any) => filtro.has(c.id)) }))
        : argomenti;
      if (filtro && !scelti.some((a: any) => a.concetti.length)) return json({ errore: "concetto non trovato" }, 404);
      const { pool, indice, contesto } = preparaPool(scelti, !!b.ripasso);
      if (!pool.length) return json({ errore: "nessun_concetto" }, 422);

      // Ultime domande fatte su questi argomenti, dalla più recente: il modello non deve ripeterle uguali.
      const { data: fatte } = await db.from("domande").select("testo, sessioni(data)")
        .in("argomento_id", ids).limit(300);
      const gia = (fatte || [])
        .sort((x: any, y: any) => String(y.sessioni?.data).localeCompare(String(x.sessioni?.data)))
        .map((x: any) => x.testo).slice(0, 24);

      const r = await chiedi(promptDomande({
        livello: b.livello, tipo: b.tipo, modalita: b.modalita, ripasso: !!b.ripasso, contesto, gia, materiale: argomenti,
        quante: b.quante, soloConcetto, classe: await classeDi(req, io.sub), unaAperta,
      }), SCHEMA_DOMANDE);
      const tenute = tieniAncorate(r.domande as unknown[], indice, argomenti);
      if (unaAperta) {
        const d = unaApertaNuova(tenute.domande, unaAperta.diverse);
        return d ? json({ domande: [d], scartate: tenute.scartate }) : json({ errore: "nessuna_ancorata", scartate: tenute.scartate }, 422);
      }
      // Il modello a volte ne scrive una in più: la prova lampo resta di tre, scelte per tipo.
      if (soloConcetto && tenute.domande.length < MIN_LAMPO) return json({ errore: "nessuna_ancorata", scartate: tenute.scartate }, 422);
      const esito = soloConcetto
        ? { domande: sceltaLampo(tenute.domande, b.tipo, DOMANDE_PER_CONCETTO), scartate: tenute.scartate }
        : tenute;
      if (!esito.domande.length) return json({ errore: "nessuna_ancorata", scartate: esito.scartate }, 422);
      return json(esito);
    }

    if (b.azione === "correggi") {
      const pacchetto = Array.isArray(b.pacchetto) ? b.pacchetto.slice(0, 40).map((x: any) => ({
        id: testo(x?.id), domanda: testo(x?.domanda), risposta_attesa: testo(x?.risposta_attesa),
        elementi: Array.isArray(x?.elementi) ? x.elementi.map(testo) : [], risposta_alunna: testo(x?.risposta_alunna).slice(0, 8000),
      })) : [];
      if (!pacchetto.length) return json({ valutazioni: [] });
      const r = await chiedi(promptCorrezione(b.modalita === "orale" ? "orale" : "scritta", pacchetto, await classeDi(req, io.sub), testo(b.materia)), SCHEMA_VALUTAZIONI);
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
      // Solo l'albero, il più in fretta possibile: le sintesi arrivano dopo con l'azione `sintesi`
      // (issue #13). Con 25 concetti o più la mappa è già piena: niente modello.
      const posti = MAX_NODI - a.concetti.length;
      const r = posti > 0 ? await chiedi(promptMappa(a, posti, await classeDi(req, io.sub)), SCHEMA_MAPPA, [], "low") : { nodi: [] };
      return json(costruisciMappa(a, r));
    }

    if (b.azione === "sintesi") {
      if (typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id)) return json({ errore: "richiesta non valida" }, 400);
      const { data: a, error } = await comeUtente(req).from("argomenti")
        .select("id, titolo, materia, trascrizione, concetti(id, titolo, descrizione, ancora, peso, ordine)")
        .eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle();
      if (error) throw error;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      if (!a.concetti?.length) return json({ errore: "nessun_concetto" }, 422);
      const r = await chiedi(promptSintesi(a, await classeDi(req, io.sub)), SCHEMA_SINTESI, [], "low");
      return json(sintesiDaRisposta(a, r));
    }

    if (b.azione === "punti_chiave" || b.azione === "racconto") {
      if (typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id)) return json({ errore: "richiesta non valida" }, 400);
      const racconto = testoBreve(b.testo, MAX_RACCONTO).trim();
      if (b.azione === "racconto" && !racconto) return json({ errore: "richiesta non valida" }, 400);
      const { data: a, error } = await comeUtente(req).from("argomenti")
        .select("id, titolo, materia, trascrizione, concetti(id, titolo, descrizione, ancora, peso, ordine)")
        .eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle();
      if (error) throw error;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      if (!a.concetti?.length) return json({ errore: "nessun_concetto" }, 422);
      const classe = await classeDi(req, io.sub);
      if (b.azione === "racconto") return json(esitiRacconto(a, await chiedi(promptRacconto(a, racconto, classe), SCHEMA_RACCONTO, [], "low"), racconto));
      const esito = puntiChiaveDaRisposta(a, await chiedi(promptPuntiChiave(a, classe), SCHEMA_PUNTI));
      if (!esito.punti.length) return json({ errore: "nessun_punto", scartati: esito.scartati }, 422);
      return json(esito);
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

    // Mini-lezione a schede (issue #23): dagli appunti dell'argomento, letti con i permessi di chi studia.
    if (b.azione === "lezione") {
      if (typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id)) return json({ errore: "richiesta non valida" }, 400);
      const { data: a, error } = await comeUtente(req).from("argomenti")
        .select("titolo, materia, trascrizione, concetti(titolo, ancora, ordine), esercizi_tipi(ancora)")
        .eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle();
      if (error) throw error;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      if (!testo(a.trascrizione).trim()) return json({ errore: "nessun_testo" }, 422);
      const concetti = [...(a.concetti || [])].sort((x: any, y: any) => x.ordine - y.ordine);
      // Le ancore dei concetti e dei tipi di esercizio sono già state controllate sugli appunti: valgono come fonte.
      const fonte = { trascrizione: a.trascrizione, concetti: [...concetti, ...(a.esercizi_tipi || [])] };
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
        const prompt = promptLezione({ classe: await classeDi(req, io.sub), materia: a.materia, titolo: a.titolo, trascrizione: a.trascrizione, concetti });
        let l = pulisciLezione(await chiedi(prompt, SCHEMA_LEZIONE), fonte);
        if (!l) l = pulisciLezione(await chiedi(prompt + "\n\nAttenzione: nel tentativo precedente troppe schede non andavano, o mancava la scheda regola con la frase copiata dagli appunti. Copia le frasi dagli appunti, metti i conti solo in calcoli e rifalli uno per uno.", SCHEMA_LEZIONE), fonte);
        if (!l) return json({ errore: "nessuna_lezione" }, 422);
        riuscito = true;
        return json(l);
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    if (b.azione === "video") {
      if (typeof b.argomento_id !== "string" || !UUID.test(b.argomento_id)) return json({ errore: "richiesta non valida" }, 400);
      const db = comeUtente(req);
      const [{ data: a, error }, classe] = await Promise.all([
        db.from("argomenti").select("titolo, materia, concetti(titolo)").eq("id", b.argomento_id).eq("studente_id", io.sub).maybeSingle(),
        classeDi(req, io.sub),
      ]);
      if (error) throw error;
      if (!a) return json({ errore: "argomento non trovato" }, 404);
      if (!(await prenotaAiuto(io.sub))) return json({ errore: "limite_giornaliero" }, 429);
      let riuscito = false;
      try {
        const dati = { materia: a.materia, argomento: a.titolo, classe, concetti: (a.concetti || []).map((c: any) => c.titolo).slice(0, 12) };
        const { fonti, ricerca } = await cercaSulWeb(promptRicercaVideo(dati), DOMINI_VIDEO);
        // Una ricerca andata a vuoto non consuma l'aiuto.
        if (!fonti.length) return json({ video: [] });
        const r = await chiedi(promptVideo({ ...dati, ricerca, fonti }), SCHEMA_VIDEO);
        const video = videoScelti(r, fonti, ricerca);
        riuscito = video.length > 0;
        return json({ video });
      } finally { if (!riuscito) await restituisciAiuto(io.sub); }
    }

    return json({ errore: "azione sconosciuta" }, 400);
  } catch (e) {
    if (e instanceof Definitivo) return json({ errore: e.message }, STATO_DEFINITIVO[e.message] ?? 403);
    console.error(e);
    return json({ errore: "lettura non riuscita" }, 502);
  }
}

// Ogni richiesta (issue #30): prenota_chiamata, sotto un lucchetto per profilo, controlla famiglia sospesa e tetto delle
// chiamate di oggi (limite della famiglia) e prenota subito una riga in `consumi`: richieste parallele vedono le
// prenotazioni delle altre, quindi il tetto non si supera (al massimo delle chiamate dell'ultima richiesta accettata).
// A fine richiesta la riga prenotata diventa la prima chiamata, le altre si aggiungono, nessuna chiamata la cancella.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
Deno.serve(async (req) => {
  const io = req.method === "POST" ? claims(req) : {};
  if (io.role !== "authenticated" || !io.sub || io.app_metadata?.ruolo !== "studente") return gestisci(req);
  const db = amministratore();
  const corpo = await req.clone().json().catch(() => null);
  const azione = String(corpo?.azione ?? "");
  const oggi = giornoRoma();
  const { data: p, error } = await db.rpc("prenota_chiamata", { studente: io.sub, oggi, azione });
  if (error) { console.error("prenota_chiamata:", error); return json({ errore: "Riprova fra poco." }, 503); }
  if (p?.errore === "famiglia_sospesa") return json({ errore: "famiglia_sospesa" }, 403);
  if (p?.errore === "tetto_giornaliero") return json({ errore: "tetto_giornaliero", tetto: p.tetto }, 429);
  if (!p?.ok) return json({ errore: "Riprova fra poco." }, 503);
  // prova: account di prova per il confronto dei modelli (app_metadata, scritto solo dal server, arriva nel token)
  const c: Consumo = { azione, prova: io.app_metadata?.prova === true, richiesto: String(corpo?.modello_prova ?? ""),
    effortRichiesto: String(corpo?.effort_prova ?? ""), chiamate: 0, input: 0, output: 0, cache_scritti: 0, cache_letti: 0, costo: 0, modelli: [],
    dettaglio: [], riga: Number(p.id), limiteAiuti: Number(p.limite_aiuti) };
  const risposta = await richiesta.run(c, () => gestisci(req));
  const salva = (async () => {
    try {
      const righe = righeConsumo(c.dettaglio, io.sub!, oggi, azione);
      if (!righe.length) { await db.from("consumi").delete().eq("id", c.riga!).eq("studente_id", io.sub!); return; }
      const [prima, ...altre] = righe;
      const { error: e1 } = await db.from("consumi").update(prima).eq("id", c.riga!).eq("studente_id", io.sub!);
      if (e1) throw e1;
      if (altre.length) { const { error: e2 } = await db.from("consumi").insert(altre); if (e2) throw e2; }
    } catch (e) { console.error("consumo:", e); }
  })();
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(salva); else await salva;
  if (!c.chiamate) return risposta;
  // Per il confronto dei modelli: agli account di prova si dice quale modello ha risposto e quanto è costato.
  if (c.prova) risposta.headers.set("x-consumo", JSON.stringify({ modelli: c.modelli, chiamate: c.chiamate, input: c.input,
    output: c.output, cache_scritti: c.cache_scritti, cache_letti: c.cache_letti, costo: c.costo }));
  return risposta;
});
