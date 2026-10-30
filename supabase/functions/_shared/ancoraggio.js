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
  return String(s || "").toLowerCase().replace(/[^a-zàèéìòóù0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Fonte di uno o più argomenti: { trascrizione, concetti: [{ ancora, titolo, descrizione }] }
export function fonteDi(argomenti) {
  return argomenti.map((a) =>
    normalizza(a.trascrizione || "") + " " +
    normalizza((a.concetti || []).map((c) => c.ancora + " " + c.titolo + " " + c.descrizione).join(" "))
  ).join(" ");
}

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
// (sottosequenza comune più lunga).
function inOrdine(ancora, finestra) {
  let prima = new Array(finestra.length + 1).fill(0);
  for (const w of ancora) {
    const ora = [0];
    for (let j = 0; j < finestra.length; j++)
      ora.push(finestra[j].w === w ? prima[j] + 1 : Math.max(prima[j + 1], ora[j]));
    prima = ora;
  }
  return prima[finestra.length];
}

// fonte già normalizzata. Meno di due parole lunghe: l'ancora non dice abbastanza e non regge.
export function ancoraRegge(ancora, fonte) {
  const testo = normalizza(ancora);
  const lunghe = testo.split(" ").filter((w) => w.length >= MIN_LETTERE);
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
    if (inOrdine(lunghe, parole.slice(i, j + 1)) >= servono) return true;
  }
  return false;
}

// Una domanda passa solo se nasce da un concetto dell'elenco e la sua ancora regge.
// indice: { [concetto_id]: qualsiasi valore vero }
export function ancorata(d, indice, fonte) {
  if (!indice[d.concetto_id]) return false;
  return ancoraRegge(d.ancora, fonte);
}
