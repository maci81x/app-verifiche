// Filtro di ancoraggio, portato dal prototipo senza cambiarne la logica.
// Un'ancora regge se almeno il 60% delle sue parole di oltre tre lettere
// compare nella fonte (trascrizione più testo dei concetti), dopo aver
// normalizzato entrambe. JavaScript puro: lo usano la Edge Function e i test.

export const SOGLIA = 0.6;

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

// fonte già normalizzata. Meno di due parole lunghe: l'ancora non dice abbastanza e non regge.
export function ancoraRegge(ancora, fonte) {
  const parole = normalizza(ancora).split(" ").filter((w) => w.length > 3);
  if (parole.length < 2) return false;
  const dentro = parole.filter((w) => fonte.indexOf(w) >= 0).length;
  return dentro / parole.length >= SOGLIA;
}

// Una domanda passa solo se nasce da un concetto dell'elenco e la sua ancora regge.
// indice: { [concetto_id]: qualsiasi valore vero }
export function ancorata(d, indice, fonte) {
  if (!indice[d.concetto_id]) return false;
  return ancoraRegge(d.ancora, fonte);
}
