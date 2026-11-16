// Poesia a memoria (issue #28): la trascrizione della poesia fotografata, verso per verso.
// Il resto (lettura a voce, parole che spariscono, dove ti blocchi) lo fa l'app: poesia.js nella cartella principale.
const testo = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const MAX_STROFE = 20, MAX_VERSI = 80;

export function promptPoesia() {
  return [
    "Nella foto c'è una poesia da imparare a memoria (pagina del libro o del quaderno, anche storta o sfocata: raddrizzala mentalmente).",
    "Trascrivila parola per parola, verso per verso, con la punteggiatura e gli apostrofi come sono scritti. Una strofa nuova dove sulla pagina c'è una riga vuota.",
    "Non correggere niente, non completare, non aggiungere versi che conosci tu: se una parola non si legge scrivi [?]. Titolo e autore solo se sono scritti; altrimenti vuoti.",
    "Lascia fuori numeri di pagina, note, esercizi e domande sotto la poesia.",
    'Rispondi solo con JSON: {"titolo":"","autore":"","strofe":[["verso","verso"]]}',
  ].join("\n\n");
}

// { titolo, autore, strofe: [[verso]] } senza righe vuote, al più 20 strofe e 80 versi; null se non c'è un verso.
export function pulisciPoesia(r) {
  if (!r || !Array.isArray(r.strofe)) return null;
  let versi = 0;
  const strofe = r.strofe.slice(0, MAX_STROFE).map((s) => (Array.isArray(s) ? s : []).map((v) => testo(v, 200)).filter(Boolean))
    .filter((s) => s.length).map((s) => { const tenuti = s.slice(0, Math.max(0, MAX_VERSI - versi)); versi += tenuti.length; return tenuti; })
    .filter((s) => s.length);
  return strofe.length ? { titolo: testo(r.titolo, 120), autore: testo(r.autore, 120), strofe } : null;
}
