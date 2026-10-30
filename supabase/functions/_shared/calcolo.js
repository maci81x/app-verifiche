// Valutatore aritmetico scritto a mano (issue #5, fetta #7). JavaScript puro: lo usano
// la Edge Function e i test. Ricalcola il risultato degli esercizi generati dal modello:
// se il conto non torna, l'esercizio non entra nella scheda.
//
// Parser a discesa ricorsiva, niente eval: conosce solo numeri (con la virgola o il punto),
// + − × · * ÷ : /, potenze ^ (anche in apice), √ e sqrt(), parentesi tonde, quadre e
// graffe, e la moltiplicazione sottintesa davanti a una parentesi o a una radice: 2(3+4).
// Tutto il resto è un errore.
//
// Grammatica:
//   somma    := prodotto (("+" | "-") prodotto)*
//   prodotto := segno (("*" | "/") segno | <sottintesa> potenza)*
//   segno    := ("+" | "-") segno | potenza
//   potenza  := primario ("^" segno)?          (da destra: 2^3^2 = 2^9)
//   primario := numero | "(" somma ")" (o [ ], { }, chiuse dalla loro) | "√" primario | "sqrt" "(" somma ")"

export class ErroreCalcolo extends Error {}

export const MAX_LUNGHEZZA = 400;
const MAX_PROFONDITA = 40;
const MAX_ESPONENTE = 64;
const APICI = "⁰¹²³⁴⁵⁶⁷⁸⁹";

// Scrittura unica: simboli della scuola → simboli del parser.
function normalizza(s) {
  return s
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (e) => "^" + [...e].map((c) => APICI.indexOf(c)).join(""))
    .replace(/[×·⋅∙]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[−–—]/g, "-");
}

function gettoni(s) {
  const out = [];
  const re = /\s*(?:(\d+(?:[.,]\d+)?)|(sqrt)|([-+*/^()[\]{}√]))/y;
  let i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) {
      if (!s.slice(i).trim()) break;
      throw new ErroreCalcolo(`simbolo sconosciuto: ${s.slice(i).trim()[0]}`);
    }
    if (m[1] !== undefined) out.push({ t: "n", v: Number(m[1].replace(",", ".")) });
    else if (m[2] !== undefined) out.push({ t: "sqrt" });
    else out.push({ t: m[3] });
    i = re.lastIndex;
  }
  return out;
}

const CHIUSA = { "(": ")", "[": "]", "{": "}" };

const finito = (x) => {
  if (!Number.isFinite(x)) throw new ErroreCalcolo("risultato non finito");
  return x;
};

function radice(x) {
  if (x < 0) throw new ErroreCalcolo("radice di un numero negativo");
  return Math.sqrt(x);
}

function potenza(b, e) {
  if (Math.abs(e) > MAX_ESPONENTE) throw new ErroreCalcolo("esponente troppo grande");
  if (b === 0 && e < 0) throw new ErroreCalcolo("divisione per zero");
  return finito(b ** e);
}

export function valuta(espressione) {
  if (typeof espressione !== "string") throw new ErroreCalcolo("espressione mancante");
  if (espressione.length > MAX_LUNGHEZZA) throw new ErroreCalcolo("espressione troppo lunga");
  const g = gettoni(normalizza(espressione));
  if (!g.length) throw new ErroreCalcolo("espressione vuota");
  let p = 0, profondita = 0;
  const guarda = () => g[p]?.t;
  const prendi = (t) => {
    if (guarda() !== t) throw new ErroreCalcolo(`atteso ${t}`);
    p++;
  };
  const scendi = (f) => {
    if (++profondita > MAX_PROFONDITA) throw new ErroreCalcolo("troppe parentesi una dentro l'altra");
    try { return f(); } finally { profondita--; }
  };

  function primario() {
    const t = guarda();
    if (t === "n") return g[p++].v;
    if (t in CHIUSA) { p++; const v = scendi(somma); prendi(CHIUSA[t]); return v; }
    if (t === "√") { p++; return radice(scendi(primario)); }
    if (t === "sqrt") { p++; prendi("("); const v = scendi(somma); prendi(")"); return radice(v); }
    throw new ErroreCalcolo(t ? `simbolo fuori posto: ${t}` : "espressione incompleta");
  }
  function pot() {
    const b = primario();
    if (guarda() !== "^") return b;
    p++;
    return potenza(b, scendi(segno));
  }
  function segno() {
    const t = guarda();
    if (t === "-") { p++; return -scendi(segno); }
    if (t === "+") { p++; return scendi(segno); }
    return pot();
  }
  function prodotto() {
    let v = segno();
    for (;;) {
      const t = guarda();
      if (t === "*") { p++; v = finito(v * segno()); }
      else if (t === "/") {
        p++;
        const d = segno();
        if (d === 0) throw new ErroreCalcolo("divisione per zero");
        v = finito(v / d);
      } else if (t in CHIUSA || t === "√" || t === "sqrt") v = finito(v * pot());
      else return v;
    }
  }
  function somma() {
    let v = prodotto();
    for (;;) {
      const t = guarda();
      if (t === "+") { p++; v = finito(v + prodotto()); }
      else if (t === "-") { p++; v = finito(v - prodotto()); }
      else return v;
    }
  }

  const v = somma();
  if (p < g.length) throw new ErroreCalcolo(`simbolo fuori posto: ${g[p].t === "n" ? g[p].v : g[p].t}`);
  return finito(v);
}

// Valuta senza lanciare: null se l'espressione non è valida.
export function valutaSicuro(espressione) {
  try { return valuta(espressione); } catch (e) {
    if (e instanceof ErroreCalcolo) return null;
    throw e;
  }
}

const DECIMALE = /^\s*[-−]?\d+(?:[.,](\d+))?\s*$/;

// Quante cifre dopo la virgola ha un risultato scritto come numero; null se non è un numero
// semplice (per esempio una frazione).
export function decimaliDichiarati(valore) {
  const m = DECIMALE.exec(String(valore ?? ""));
  return m ? (m[1] || "").length : null;
}

const EPSILON = 1e-9;

// Il ricalcolo coincide con il risultato dichiarato? Interi e frazioni devono tornare
// esatti; un decimale dichiarato con n cifre va bene se è il ricalcolo arrotondato a n cifre
// (a metà si arrotonda per eccesso, come a scuola: 0,35 → 0,4 e non 0,3).
export function coincide(calcolato, dichiarato) {
  const atteso = valutaSicuro(String(dichiarato ?? ""));
  if (atteso === null || !Number.isFinite(calcolato)) return false;
  const d = decimaliDichiarati(dichiarato);
  const margine = EPSILON * Math.max(1, Math.abs(atteso));
  if (!d) return Math.abs(calcolato - atteso) <= margine;
  const meta = 0.5 * 10 ** -d, scarto = calcolato - atteso;
  // Esattamente a metà vale solo l'arrotondamento per eccesso (in valore assoluto).
  return Math.abs(scarto) < meta - margine || (Math.abs(Math.abs(scarto) - meta) <= margine && Math.sign(scarto) !== Math.sign(atteso));
}
