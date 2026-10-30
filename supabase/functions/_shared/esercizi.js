// Tipi di esercizio di matematica (issue #5, fetta #6). JavaScript puro: lo usano la
// Edge Function e i test.
//
// Ancoraggio: ogni tipo porta come ancora il testo di un esercizio vero fotografato.
// Il filtro delle parole (ancoraggio.js) non basta per la matematica, dove un esercizio
// è fatto soprattutto di numeri e simboli: qui contano anche i numeri, e devono stare
// vicini fra loro nella trascrizione, non sparsi per la pagina.

export const SOGLIA_ESERCIZIO = 0.7;
export const MIN_SEGNI = 3;      // un'ancora con meno di tre numeri o parole non dice abbastanza
export const MAX_TIPI = 15;

// Stessa scrittura per i simboli che la trascrizione può rendere in modi diversi.
const APICI = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function normalizzaMat(s) {
  return String(s || "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (e) => "^" + [...e].map((c) => APICI.indexOf(c)).join(""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[×·⋅∙*]/g, " * ")
    .replace(/[÷:]/g, " / ")
    .replace(/[−–—]/g, "-")
    .replace(/[\[{]/g, "(").replace(/[\]}]/g, ")");
}

// Numeri (con la virgola o il punto) e parole di almeno quattro lettere.
export function segni(s) {
  return (normalizzaMat(s).match(/\d+(?:[.,]\d+)?|[a-zàèéìòóù]{4,}/g) || []).map((t) => t.replace(",", "."));
}

const compatto = (s) => normalizzaMat(s).replace(/\s+/g, "");

// fonte: il testo da cui il tipo è stato estratto (la trascrizione).
// Regge se l'esercizio compare tale e quale (spazi a parte), oppure se in un tratto
// della trascrizione lungo il doppio dell'ancora si ritrova almeno il 70% dei suoi segni.
export function ancoraEsercizioRegge(ancora, fonte) {
  const a = segni(ancora);
  if (a.length < MIN_SEGNI) return false;
  const c = compatto(ancora);
  if (c.length >= 6 && compatto(fonte).includes(c)) return true;
  const f = segni(fonte);
  const finestra = a.length * 2;
  const serve = Math.ceil(a.length * SOGLIA_ESERCIZIO);
  for (let i = 0; i < Math.max(1, f.length - a.length + 1); i++) {
    const resto = f.slice(i, i + finestra);
    let trovati = 0;
    for (const t of a) {
      const j = resto.indexOf(t);
      if (j >= 0) { trovati++; resto.splice(j, 1); }
    }
    if (trovati >= serve) return true;
  }
  return false;
}

const chiaveTitolo = (t) => String(t).toLowerCase().replace(/\s+/g, " ").trim();

// Pulisce i tipi del modello e tiene solo quelli ancorati. esistenti: titoli già salvati
// sull'argomento, che non si ripetono. Restituisce anche quanti ne ha scartati.
export function tipiAncorati(grezzi, fonte, esistenti = []) {
  const visti = new Set(esistenti.map(chiaveTitolo));
  const tenuti = [];
  let scartati = 0;
  for (const t of grezzi || []) {
    const titolo = String(t?.titolo || "").trim(), ancora = String(t?.ancora || "").trim();
    if (!titolo || !ancora || visti.has(chiaveTitolo(titolo)) || !ancoraEsercizioRegge(ancora, fonte) || tenuti.length >= MAX_TIPI) {
      scartati++;
      continue;
    }
    visti.add(chiaveTitolo(titolo));
    tenuti.push({
      titolo,
      ancora,
      difficolta: Math.min(3, Math.max(1, Math.round(Number(t.difficolta)) || 2)),
      figura: t.figura === true,
    });
  }
  return { tipi: tenuti, scartati };
}
