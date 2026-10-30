// Filtro di ancoraggio. JavaScript puro: lo usano la Edge Function e i test.
//
// Un'ancora regge se almeno il 70% delle sue parole di oltre tre lettere si
// ritrova nella fonte (trascrizione più testo dei concetti) a parole intere,
// nello stesso ordine e tutte dentro UNA finestra lunga quanto l'ancora più
// il 50%. Così non passa un'ancora fatta di parole vere prese qua e là
// (issue #10: prima bastava il 60% delle parole in un punto qualsiasi, anche
// dentro altre parole).

export const SOGLIA = 0.7;
export const MARGINE_FINESTRA = 1.5; // la finestra è lunga quanto l'ancora più il 50%
const MIN_LETTERE = 4;               // le parole di tre lettere o meno non contano

export function normalizza(s) {
  return String(s || "").normalize("NFC").toLowerCase().replace(/[^a-zàèéìòóù0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Fonte di uno o più argomenti: { trascrizione, concetti: [{ ancora }] }. Solo testo degli
// appunti: la trascrizione e le ancore dei concetti (già ancorate). Titoli e descrizioni li ha
// scritti il modello e non possono far reggere un'ancora (issue #10).
export function fonteDi(argomenti) {
  return argomenti.map((a) =>
    normalizza(a.trascrizione || "") + " " + normalizza((a.concetti || []).map((c) => c.ancora || "").join(" "))
  ).join(" ");
}

// Parole che cambiano un fatto anche da sole: numeri, negazioni, mesi, numeri romani.
// Devono essere le stesse nell'ancora e nel tratto di appunti che la regge, nei due versi:
// «1799» al posto di «1789», un «non» aggiunto o tolto, «luglio» al posto di «agosto».
const NEGAZIONI = new Set(["non", "mai", "né", "nessun", "nessuno", "nessuna", "niente", "nulla", "senza"]);
const MESI = new Set(["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]);
const NON_ROMANI = new Set(["vi", "ci", "li", "il", "di", "lì"]);
const critica = (w) => /^\d+$/.test(w) || NEGAZIONI.has(w) || MESI.has(w) || (/^[ivxlc]{2,}$/.test(w) && !NON_ROMANI.has(w));

// Nomi propri dell'ancora (maiuscola non a inizio frase), normalizzati: devono stare nel tratto.
function nomiPropri(ancora) {
  const nomi = [];
  String(ancora).split(/(?<=[.!?:;])\s+/).forEach((frase) => {
    frase.split(/\s+/).slice(1).forEach((w) => {
      const p = w.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, "");
      if (/^[A-ZÀ-Ý][a-zà-ÿ]{2,}$/.test(p)) normalizza(p).split(" ").forEach((x) => nomi.push(x));
    });
  });
  return nomi;
}

export const MAX_ANCORA = 400; // caratteri: oltre non è più una frase da citare

// Parole della fonte con la loro posizione. La stessa fonte serve per molte ancore:
// la si divide una volta sola.
const paroleCache = new Map();
function paroleDi(fonte) {
  let parole = paroleCache.get(fonte);
  if (!parole) {
    parole = [];
    const re = /\S+/g;
    for (let m; (m = re.exec(fonte));) parole.push({ w: m[0], da: m.index, a: m.index + m[0].length });
    if (paroleCache.size > 8) paroleCache.clear();
    paroleCache.set(fonte, parole);
  }
  return parole;
}

// Quante parole dell'ancora si ritrovano in ordine fra le parole della finestra
// (sottosequenza comune più lunga), e dove stanno la prima e l'ultima trovata.
function inOrdine(ancora, finestra) {
  const m = ancora.length, n = finestra.length;
  const t = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let a = 1; a <= m; a++)
    for (let b = 1; b <= n; b++)
      t[a][b] = finestra[b - 1].w === ancora[a - 1] ? t[a - 1][b - 1] + 1 : Math.max(t[a - 1][b], t[a][b - 1]);
  let a = m, b = n, primo = -1, ultimo = -1;
  while (a > 0 && b > 0) {
    if (finestra[b - 1].w === ancora[a - 1] && t[a][b] === t[a - 1][b - 1] + 1) { if (ultimo < 0) ultimo = b - 1; primo = b - 1; a--; b--; }
    else if (t[a - 1][b] >= t[a][b - 1]) a--;
    else b--;
  }
  return { quante: t[m][n], primo, ultimo };
}

// Il tratto di appunti trovato regge i fatti dell'ancora? tratto: parole della fonte dalla
// prima all'ultima parola lunga trovata, allargato di quante parole corte l'ancora ha prima
// e dopo (più una: un «non» subito prima conta).
function fattiUguali(tutte, ancoraRaw, parole, da, a) {
  const lunghe = tutte.filter((w) => w.length >= MIN_LETTERE);
  const prima = tutte.indexOf(lunghe[0]), dopo = tutte.length - 1 - tutte.lastIndexOf(lunghe[lunghe.length - 1]);
  const tratto = parole.slice(Math.max(0, da - prima - 1), a + dopo + 2).map((p) => p.w);
  const nelTratto = new Set(tratto), nellAncora = new Set(tutte);
  if (!tutte.filter(critica).every((w) => nelTratto.has(w))) return false;
  const nucleo = parole.slice(da, a + 1).map((p) => p.w);
  if (!nucleo.filter(critica).every((w) => nellAncora.has(w))) return false;
  const negDentro = tratto.filter((w) => NEGAZIONI.has(w)).length, negAncora = tutte.filter((w) => NEGAZIONI.has(w)).length;
  if (negDentro > negAncora) return false;
  return nomiPropri(ancoraRaw).every((w) => nelTratto.has(w));
}

// fonte già normalizzata. Meno di due parole lunghe: l'ancora non dice abbastanza e non regge.
export function ancoraRegge(ancora, fonte) {
  const raw = String(ancora || "").slice(0, MAX_ANCORA);
  const testo = normalizza(raw);
  const tutte = testo.split(" ").filter(Boolean);
  const lunghe = tutte.filter((w) => w.length >= MIN_LETTERE);
  if (lunghe.length < 2) return false;
  const servono = Math.ceil(lunghe.length * SOGLIA - 1e-9);
  const ampiezza = testo.length * MARGINE_FINESTRA;
  const cercate = new Set(lunghe);
  const parole = paroleDi(String(fonte || ""));
  // Le finestre si scorrono una volta: j è la fine della finestra che comincia in i,
  // utili quante parole dell'ancora ci sono dentro. Il confronto in ordine, che costa
  // di più, si fa solo dove le parole utili bastano. La finestra migliore comincia
  // sempre su una parola dell'ancora.
  let j = -1, utili = 0;
  for (let i = 0; i < parole.length; i++) {
    if (i > 0 && cercate.has(parole[i - 1].w)) utili--;
    if (j < i) { j = i; utili = cercate.has(parole[i].w) ? 1 : 0; }
    while (j + 1 < parole.length && parole[j + 1].a - parole[i].da <= ampiezza) {
      j++;
      if (cercate.has(parole[j].w)) utili++;
    }
    if (!cercate.has(parole[i].w) || utili < servono) continue;
    const r = inOrdine(lunghe, parole.slice(i, j + 1));
    if (r.quante >= servono && fattiUguali(tutte, raw, parole, i + r.primo, i + r.ultimo)) return true;
  }
  return false;
}

// Una domanda passa solo se nasce da un concetto dell'elenco e la sua ancora regge.
// indice: { [concetto_id]: qualsiasi valore vero }
export function ancorata(d, indice, fonte) {
  if (!indice[d.concetto_id]) return false;
  return ancoraRegge(d.ancora, fonte);
}
