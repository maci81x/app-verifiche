// Strumenti per materia (issue #24): date per la linea del tempo (storia), vocaboli e frasi
// (lingue straniere), schema da completare (geografia, scienze). JavaScript puro: lo usano la
// Edge Function e i test. Il modello copia dagli appunti; qui si tiene solo quello che c'è davvero:
// una data, un vocabolo o un termine mostrati sono sempre un pezzo della trascrizione.
import { ancoraRegge, fonteDi } from "./ancoraggio.js";

export const TIPI_STRUMENTO = ["date", "vocaboli", "schema"];
export const FORME_SCHEMA = ["ciclo", "strati", "parti"];
export const LINGUE = ["en-GB", "es-ES", "fr-FR", "de-DE"];
const MAX_EVENTI = 30, MAX_VOCABOLI = 40, MAX_FRASI = 10, MIN_ETICHETTE = 3, MAX_ETICHETTE = 8;

const pulisci = (v, max = 300) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const piega = (s) => String(s || "").normalize("NFC").replace(/\s+/g, " ").toLowerCase();
const fuga = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Il pezzo sta nel testo così com'è scritto (maiuscole e spazi a parte), a parole intere:
// «47» non vale dentro «476», «ca» non vale dentro «cat».
export function inTrascrizione(pezzo, testo) {
  const p = piega(pezzo).trim();
  if (!p) return false;
  return new RegExp("(?<![\\p{L}\\p{N}])" + fuga(p) + "(?![\\p{L}\\p{N}])", "u").test(piega(testo));
}

const ROMANI = { i: 1, v: 5, x: 10, l: 50, c: 100 };
function romano(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) { const v = ROMANI[s[i]], w = ROMANI[s[i + 1]] || 0; n += v < w ? -v : v; }
  return n;
}
// L'anno su cui si ordina una data scritta: «1492», «476 d.C.», «753 a.C.» (negativo), «XV secolo»
// e «15° secolo» (metà secolo: 1450), «V secolo a.C.» (-450). null se non c'è un anno.
export function annoDi(data) {
  const t = piega(data);
  const aC = /\ba\.?\s?c\.?(?![a-z])|avanti cristo/.test(t);
  const sec = /\b([ivxlc]+)\s*(?:°\s*)?sec(?:olo|\.|\b)/.exec(t) || /\bsec(?:olo|\.)?\s*([ivxlc]+)\b/.exec(t) || /\b(\d{1,2})\s*°?\s*sec(?:olo|\.|\b)/.exec(t);
  if (sec) {
    const n = /\d/.test(sec[1]) ? Number(sec[1]) : romano(sec[1]);
    if (n > 0 && n <= 21) return aC ? -(n * 100 - 50) : (n - 1) * 100 + 50;
  }
  const numeri = t.match(/\d{1,4}/g);
  if (!numeri) return null;
  const n = Number(numeri.reduce((a, b) => (b.length > a.length ? b : a)));
  return aC ? -n : n;
}

// Lingua di un argomento: dalla materia; se la materia non la dice, quella rilevata dal modello (se è una delle quattro).
export function linguaDi(materia, rilevata) {
  const m = String(materia || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/ingles|english/.test(m)) return "en-GB";
  if (/spagnol|espanol/.test(m)) return "es-ES";
  if (/frances|francais/.test(m)) return "fr-FR";
  if (/tedesc|deutsch/.test(m)) return "de-DE";
  return LINGUE.includes(rilevata) ? rilevata : null;
}

const materiale = (a) => String(a.trascrizione || "").slice(0, 120_000);

// grezzo: { eventi: [{ data, evento, ancora }] }. Una data passa se è scritta negli appunti, se sta
// nella sua frase e se la frase regge sul materiale (stesso filtro delle domande).
export function dateAncorate(grezzo, a) {
  const fonte = fonteDi([a]), viste = new Set(), eventi = [];
  let scartati = 0;
  for (const x of Array.isArray(grezzo?.eventi) ? grezzo.eventi : []) {
    const data = pulisci(x?.data, 60), evento = pulisci(x?.evento, 120), ancora = pulisci(x?.ancora, 400);
    const anno = data ? annoDi(data) : null, chiave = piega(data) + "|" + piega(evento);
    if (anno == null || !evento || viste.has(chiave) || eventi.length >= MAX_EVENTI || !inTrascrizione(data, a.trascrizione) ||
        !inTrascrizione(data, ancora) || !ancoraRegge(ancora, fonte)) { scartati++; continue; }
    viste.add(chiave);
    eventi.push({ data, evento, ancora, anno });
  }
  return { eventi, scartati };
}

// grezzo: { lingua, vocaboli: [{ parola, traduzione }], frasi: [testo] }. Una coppia passa solo se
// parola e traduzione sono scritte negli appunti; una frase solo se è copiata com'è (da 2 a 12 parole).
export function vocaboliAncorati(grezzo, a) {
  const vocaboli = [], frasi = [], viste = new Set();
  let scartati = 0;
  for (const x of Array.isArray(grezzo?.vocaboli) ? grezzo.vocaboli : []) {
    const parola = pulisci(x?.parola, 80), traduzione = pulisci(x?.traduzione, 80), chiave = piega(parola);
    if (!parola || !traduzione || chiave === piega(traduzione) || viste.has(chiave) || vocaboli.length >= MAX_VOCABOLI ||
        !inTrascrizione(parola, a.trascrizione) || !inTrascrizione(traduzione, a.trascrizione)) { scartati++; continue; }
    viste.add(chiave);
    vocaboli.push({ parola, traduzione });
  }
  for (const f of Array.isArray(grezzo?.frasi) ? grezzo.frasi : []) {
    const frase = pulisci(f, 200), parole = frase.split(" ").filter(Boolean).length;
    if (parole < 2 || parole > 12 || frasi.length >= MAX_FRASI || frasi.some((y) => piega(y) === piega(frase)) ||
        !inTrascrizione(frase, a.trascrizione)) { scartati++; continue; }
    frasi.push(frase);
  }
  return { lingua: linguaDi(a.materia, grezzo?.lingua), vocaboli, frasi, scartati };
}

// grezzo: { titolo, forma, etichette: [{ termine, ancora }] }. Un termine passa se è scritto negli
// appunti, sta nella sua frase e la frase regge. Con meno di 3 termini lo schema non si fa.
export function schemaAncorato(grezzo, a) {
  const fonte = fonteDi([a]), etichette = [];
  let scartati = 0;
  for (const x of Array.isArray(grezzo?.etichette) ? grezzo.etichette : []) {
    const termine = pulisci(x?.termine, 60), ancora = pulisci(x?.ancora, 400);
    if (!termine || etichette.length >= MAX_ETICHETTE || etichette.some((e) => piega(e.termine) === piega(termine)) ||
        !inTrascrizione(termine, a.trascrizione) || !inTrascrizione(termine, ancora) || !ancoraRegge(ancora, fonte)) { scartati++; continue; }
    etichette.push({ termine, ancora });
  }
  return { titolo: pulisci(grezzo?.titolo, 120) || pulisci(a.titolo, 120), forma: FORME_SCHEMA.includes(grezzo?.forma) ? grezzo.forma : "parti",
    etichette: etichette.length >= MIN_ETICHETTE ? etichette : [], scartati };
}

const COPIA = "Copia parola per parola dal materiale: non correggere, non tradurre, non aggiungere niente che nel materiale non è scritto, nemmeno se lo sai.";
export function promptStrumento(tipo, a) {
  const testa = "Sei un insegnante di scuola media italiana. Questo è il materiale di studio (" + pulisci(a.materia, 60) + ", «" + pulisci(a.titolo, 120) + "»).";
  const compito = {
    date: [
      "Trova le date scritte nel materiale, per la linea del tempo. Per ognuna: data copiata esattamente come è scritta (per esempio «476 d.C.», «XV secolo», «12 ottobre 1492»); evento detto in poche parole (al massimo otto); ancora, la frase del materiale che contiene la data, copiata parola per parola.",
      "Solo date scritte: niente date che conosci tu, niente date ricavate con un calcolo. Al massimo " + MAX_EVENTI + ".",
      'Rispondi solo con JSON: {"eventi":[{"data":"","evento":"","ancora":""}]}',
    ],
    vocaboli: [
      "È materiale di lingua straniera. lingua: quella che si studia (en-GB, es-ES, fr-FR, de-DE, oppure altra).",
      "vocaboli: le coppie parola straniera e traduzione italiana scritte negli appunti, ognuna copiata come è scritta. Solo coppie dove sono scritte tutte e due le parti. Al massimo " + MAX_VOCABOLI + ".",
      "frasi: frasi brevi nella lingua straniera scritte negli appunti (da 2 a 12 parole), copiate esattamente, da dire a voce. Al massimo " + MAX_FRASI + ".",
      'Rispondi solo con JSON: {"lingua":"","vocaboli":[{"parola":"","traduzione":""}],"frasi":[""]}',
    ],
    schema: [
      "Scegli UNO schema da completare con i termini scritti nel materiale: ciclo (fasi in ordine che si ripetono, come il ciclo dell'acqua), strati (dall'esterno all'interno o dall'alto in basso, come gli strati della Terra) o parti (le parti di un tutto, come le parti del fiore).",
      "Da " + MIN_ETICHETTE + " a " + MAX_ETICHETTE + " etichette. Per ognuna: termine copiato esattamente dal materiale (una o poche parole) e ancora, la frase del materiale che contiene il termine e dice cos'è, copiata parola per parola. In ciclo e strati metti le etichette nell'ordine giusto.",
      'Rispondi solo con JSON: {"titolo":"","forma":"parti","etichette":[{"termine":"","ancora":""}]}',
    ],
  }[tipo];
  return [testa, COPIA, ...compito.slice(0, -1), "Materiale:\n" + materiale(a), compito.at(-1)].join("\n\n");
}
