// Pulizia dei concetti restituiti dal modello. JavaScript puro: lo usano la
// Edge Function (Deno) e i test (Node).
import { ancoraRegge, normalizza } from "./ancoraggio.js";

// Peso fra 1 e 3 (0 o mancante vale 2), come nel prototipo. Scarta i concetti
// senza titolo o senza ancora: senza ancora non si può né verificare una
// domanda né dire dove ripassare.
export function normalizzaConcetti(grezzi, primoOrdine = 0) {
  return (grezzi || [])
    .filter((c) => c && String(c.titolo || "").trim() && String(c.ancora || "").trim())
    .map((c, i) => ({
      titolo: String(c.titolo).trim(),
      descrizione: String(c.descrizione || "").trim(),
      ancora: String(c.ancora).trim(),
      peso: Math.min(3, Math.max(1, Number(c.peso) || 2)),
      errore_appunti: String(c.errore_appunti || "").trim() || null,
      ordine: primoOrdine + i,
    }));
}

// Tiene solo i concetti la cui ancora regge sul testo da cui sono stati estratti,
// con lo stesso filtro delle domande. Restituisce anche quanti ne ha scartati.
export function concettiAncorati(grezzi, testo, primoOrdine = 0) {
  const fonte = normalizza(testo);
  const puliti = normalizzaConcetti(grezzi, primoOrdine);
  const tenuti = puliti.filter((c) => ancoraRegge(c.ancora, fonte)).map((c, i) => ({ ...c, ordine: primoOrdine + i }));
  return {
    concetti: tenuti,
    senza_ancora: (grezzi || []).length - puliti.length,
    non_ancorati: puliti.length - tenuti.length,
  };
}
