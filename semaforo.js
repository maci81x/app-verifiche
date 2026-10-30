// Semaforo dei concetti (issue #11 e #12): sempre colore + forma + parola, mai il colore da
// solo. Script classico caricato prima di app.js: lo usano mappa, libreria, esito, Cosa
// studiare e stampa.

const SEMAFORO = {
  verde: { segno: "●", parola: "Lo sai" },
  giallo: { segno: "▲", parola: "Quasi" },
  rosso: { segno: "✕", parola: "Da ripassare" },
  mai: { segno: "○", parola: "Mai provato" },
};
const statoValido = (s) => (Object.hasOwn(SEMAFORO, s) ? s : "mai");
const segnoStato = (s) => SEMAFORO[statoValido(s)].segno;
const parolaStato = (s) => SEMAFORO[statoValido(s)].parola;

// Etichetta in HTML: <span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Da ripassare</span>
function htmlStato(s, classe = "sem") {
  const k = statoValido(s);
  return '<span class="' + classe + '" data-s="' + k + '"><i aria-hidden="true">' + SEMAFORO[k].segno + "</i> " + SEMAFORO[k].parola + "</span>";
}

// Stato di ogni nodo della mappa: i concetti dal loro stato, i sotto-punti da quello del loro
// concetto, i nodi del web "web". albero: { nodi: [{ id, fonte, figli }] }; stati: { [concetto_id]: stato }.
function statiNodi(albero, stati) {
  const fuori = {};
  const visita = (nodi, ereditato) => (nodi || []).forEach((n) => {
    const s = n.fonte === "web" ? "web" : (ereditato || statoValido((stati || {})[n.id]));
    fuori[n.id] = s;
    visita(n.figli, s === "web" ? null : s);
  });
  visita(albero && albero.nodi, null);
  return fuori;
}

// Concetto (primo livello) a cui appartiene un nodo: lo dice l'id ("<uuid>-1-2" → "<uuid>").
function concettoDelNodo(albero, id) {
  const primi = (albero && albero.nodi) || [];
  return primi.find((n) => n.id === id || String(id).startsWith(n.id + "-")) || null;
}
