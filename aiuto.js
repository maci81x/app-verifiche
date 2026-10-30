// Il web come aiuto allo studio (issue #4): "Spiegamelo meglio" e "Arricchisci dal web".
// Mai come fonte delle domande di verifica: la funzione `domande` non legge né le
// spiegazioni né i nodi web della mappa, e indice e voto non cambiano.
// Script classico caricato dopo app.js e stampa.js: usa $, esc, vai, modello, conRiprova,
// attesa, errore, avviso, messaggioModello, sb, profilo, mappa, corrente, iniziaLavoro, finisciLavoro,
// disegnaMappa, FONTE_WEB, ETICHETTA_WEB.

/* =================================================================== parti pure */

// Solo indirizzi https diventano link: il resto non arriva mai in un href.
function linkSicuro(url) {
  try { return new URL(String(url)).protocol === "https:"; } catch (e) { return false; }
}
function nomeSito(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
}
const apriFuori = (url, testo) =>
  '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(testo) + "</a>";

// Link alla fonte di un nodo web della mappa.
function linkFonte(n) {
  return linkSicuro(n.url) ? '<p class="fonte-web">Fonte: ' + apriFuori(n.url, nomeSito(n.url)) + "</p>" : "";
}

// s: { spiegazione, esempio, analogia, fonti: [{ titolo, url }] }
function htmlSpiegazione(s) {
  const fonti = (s.fonti || []).filter((f) => linkSicuro(f.url));
  const blocco = (titolo, testo) => (testo ? '<div class="spiega-blocco"><h3>' + titolo + "</h3><p>" + esc(testo) + "</p></div>" : "");
  // Senza fonti la spiegazione viene solo dagli appunti: niente etichetta "dal web".
  return (fonti.length ? '<span class="etichetta-web">' + ETICHETTA_WEB + "</span>"
    : '<p class="legenda">Non ho trovato fonti affidabili sul web: questa spiegazione viene solo dai tuoi appunti.</p>') +
    '<div class="spiega-blocco"><p>' + esc(s.spiegazione) + "</p></div>" +
    blocco("Un esempio", s.esempio) + blocco("È come…", s.analogia) +
    (fonti.length ? '<div class="spiega-blocco"><h3>Fonti</h3><ul class="fonti">' +
      fonti.map((f) => "<li>" + apriFuori(f.url, f.titolo) + ' <small>' + esc(nomeSito(f.url)) + "</small></li>").join("") + "</ul></div>" : "");
}

/* =================================================================== Spiegamelo meglio */

const FRASI_SPIEGA = ["Rileggo i tuoi appunti", "Cerco sui siti di scuola", "Scrivo una spiegazione più semplice"];
const MSG_OFFLINE_WEB = "Senza connessione non posso cercare sul web. Riprova quando sei online.";
let spiegaAperta = null;   // { concetto_id, titolo, ancora, materia, errore }
let tornaDaSpiega = null;  // { vista, materia }
let richiestaSpiega = 0;   // la risposta di una richiesta vecchia non si mostra

function messaggioWeb(e, predefinito) {
  if (e && e.dati && e.dati.errore === "web_non_disponibile") return "La ricerca sul web adesso non è disponibile. Riprova più tardi.";
  return messaggioModello(e, predefinito);
}
const senzaRete = () => typeof navigator !== "undefined" && navigator.onLine === false;

// c: { concetto_id, titolo, ancora, materia, errore?: { domanda, risposta_alunna, risposta_attesa } }
async function apriSpiegazione(c) {
  if (!c.concetto_id) return;
  const v = document.body.dataset.vista;
  if (v !== "spiega") tornaDaSpiega = { vista: v, materia: c.materia === "varie" ? null : c.materia };
  spiegaAperta = c;
  $("t-spiega").textContent = c.titolo;
  $("spiega-ancora").textContent = c.ancora ? "Negli appunti: «" + c.ancora + "»" : "";
  $("corpo-spiega").innerHTML = ""; errore($("err-spiega"), "");
  attesa($("stato-spiega"), null); $("btn-rispiega").disabled = false;
  vai("spiega", tornaDaSpiega.materia);
  // Dopo una risposta sbagliata la spiegazione parte da quell'errore: si prepara nuova.
  if (c.errore) { generaSpiegazione(); return; }
  const mia = ++richiestaSpiega;
  const { data, error } = await sb.from("spiegazioni").select("contenuto").eq("concetto_id", c.concetto_id).maybeSingle();
  if (mia !== richiestaSpiega) return;
  if (error) { errore($("err-spiega"), "Non riesco ad aprire la spiegazione salvata. Controlla la connessione, oppure tocca Spiegamelo in un altro modo."); return; }
  if (data && data.contenuto) { $("corpo-spiega").innerHTML = htmlSpiegazione(data.contenuto); return; }
  generaSpiegazione();
}

async function generaSpiegazione() {
  const c = spiegaAperta, btn = $("btn-rispiega");
  if (!c) return;
  if (senzaRete()) { errore($("err-spiega"), MSG_OFFLINE_WEB); return; }
  const mia = ++richiestaSpiega;
  btn.disabled = true; errore($("err-spiega"), "");
  attesa($("stato-spiega"), FRASI_SPIEGA);
  try {
    const s = await conRiprova(() => modello({ azione: "spiega", concetto_id: c.concetto_id, ...(c.errore ? { errore: c.errore } : {}) }));
    // Salvata anche se intanto ha cambiato pagina: la prossima volta è già pronta. Senza fonti
    // non si salva, così un nuovo tentativo può trovarne.
    const { error } = (s.fonti || []).length
      ? await sb.from("spiegazioni").upsert(
        { concetto_id: c.concetto_id, contenuto: s, generata: new Date().toISOString() }, { onConflict: "concetto_id,studente_id" })
      : { error: null };
    if (mia !== richiestaSpiega) return;
    $("corpo-spiega").innerHTML = htmlSpiegazione(s);
    if (error) avviso($("err-spiega"), "Non sono riuscito a salvarla: la vedi adesso, ma la prossima volta va richiesta di nuovo.");
  } catch (e) {
    if (mia !== richiestaSpiega) return;
    errore($("err-spiega"), messaggioWeb(e, "Non sono riuscito a preparare la spiegazione. Riprova fra un momento."));
  } finally {
    if (mia === richiestaSpiega) { attesa($("stato-spiega"), null); btn.disabled = false; }
  }
}

function esciDaSpiega() {
  richiestaSpiega++;
  attesa($("stato-spiega"), null);
  const t = tornaDaSpiega || { vista: profilo ? "libreria" : "profili", materia: null };
  vai(t.vista, t.materia);
}

// Pulsante "Spiegamelo meglio" da mettere accanto a un concetto o a una risposta sbagliata.
function bottoneSpiega(c) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "minore spiega-btn"; b.textContent = "Spiegamelo meglio";
  b.onclick = () => apriSpiegazione(c);
  return b;
}

/* =================================================================== Arricchisci dal web */

const FRASI_ARRICCHISCI = ["Cerco esempi e curiosità sui siti di scuola", "Controllo le fonti", "Aggiungo i nodi alla mappa"];

async function arricchisciDalWeb() {
  const a = corrente, btn = $("btn-arricchisci");
  if (!a || !mappa || mappa.argomento_id !== a.id || mappa.provvisoria) return;
  if (senzaRete()) { errore($("err-mappa"), MSG_OFFLINE_WEB); return; }
  if (!iniziaLavoro(a.id, "arricchisci")) return;
  const generataPrima = mappa.generata;
  btn.disabled = true; $("btn-rigenera").disabled = true; errore($("err-mappa"), "");
  attesa($("stato-mappa"), FRASI_ARRICCHISCI);
  try {
    const r = await conRiprova(() => modello({ azione: "arricchisci", argomento_id: a.id }));
    if (!r.aggiunti) { if (corrente === a) avviso($("err-mappa"), "Non ho trovato niente di affidabile da aggiungere. La mappa resta com'era."); return; }
    // La mappa è cambiata nel frattempo (Rigenera): l'albero arricchito è di quella vecchia, non si salva.
    if (corrente === a && (!mappa || mappa.generata !== generataPrima)) return;
    const { error } = await sb.from("mappe").update({ albero: r.albero }).eq("argomento_id", a.id);
    if (corrente !== a) return;
    mappa = { ...mappa, albero: r.albero };
    disegnaMappa();
    if (error) avviso($("err-mappa"), "Non sono riuscito a salvare i nodi nuovi: li vedi adesso, ma la prossima volta vanno cercati di nuovo.");
    else avviso($("err-mappa"), "Ho aggiunto " + r.aggiunti + (r.aggiunti === 1 ? " nodo" : " nodi") + " dal web: li riconosci dall'etichetta. Tocca per leggere e aprire la fonte.");
  } catch (e) {
    if (corrente === a) errore($("err-mappa"), e.dati && e.dati.errore === "nessuna_mappa"
      ? "Prima serve la mappa: tocca Rigenera."
      : messaggioWeb(e, "Non sono riuscito ad arricchire la mappa. Riprova fra un momento."));
  } finally {
    finisciLavoro(a.id, "arricchisci");
    if (corrente === a) { attesa($("stato-mappa"), null); aggiornaBottoniMappa(); }
  }
}

function collegaAiuto() {
  $("btn-rispiega").addEventListener("click", generaSpiegazione);
  $("btn-spiega-indietro").addEventListener("click", esciDaSpiega);
  $("btn-arricchisci").addEventListener("click", arricchisciDalWeb);
}
