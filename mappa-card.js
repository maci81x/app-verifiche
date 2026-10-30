// Card di un nodo della mappa (issue #11): si apre dal basso al tocco su un riquadro.
// Dagli appunti (l'ancora), l'avviso se gli appunti sbagliano, In breve (la sintesi fatta
// con la mappa), Mettiti alla prova (3 domande sul concetto, salvate come prova normale)
// e Spiegamelo meglio. È un dialogo: si chiude con Esc o con ✕ e il focus resta dentro.
// Script classico caricato dopo aiuto.js: usa $, esc, htmlStato, statoValido, concettoDelNodo,
// trovaNodo, linkFonte, apriSpiegazione, preparaVerifica, mappa, corrente, modo, FONTE_WEB.

const MSG_SINTESI_ATTESA = "Sto preparando il riassunto…";
const MSG_SINTESI_VECCHIA = "Il riassunto non c'è ancora: riapri la mappa fra poco.";
const MSG_SINTESI_VUOTA = "Per questo concetto non ho un riassunto sicuro: leggi la frase degli appunti.";

// "ok" con il testo, "vuota" se la sintesi non reggeva, "attesa" se la si sta preparando
// (issue #13: arriva dopo la mappa), "vecchia" se non c'è e nessuno la sta preparando.
function sintesiDelConcetto(nodoConcetto, inPreparazione = false) {
  if (!nodoConcetto || typeof nodoConcetto.sintesi !== "string")
    return inPreparazione ? { tipo: "attesa", testo: MSG_SINTESI_ATTESA } : { tipo: "vecchia", testo: MSG_SINTESI_VECCHIA };
  return nodoConcetto.sintesi.trim() ? { tipo: "ok", testo: nodoConcetto.sintesi.trim() } : { tipo: "vuota", testo: MSG_SINTESI_VUOTA };
}

// HTML della card. n: nodo dell'albero; ctx: { concetto: nodo di primo livello, errore: errore_appunti,
// stato: stato del semaforo }. Funzione pura (nei test gira senza browser).
function htmlCardNodo(n, ctx) {
  const testa = (etichetta) => '<div class="card-testa"><h3 id="card-nodo-titolo">' + esc(n.titolo) + "</h3>" + etichetta +
    '<button type="button" class="chiudi" data-azione="chiudi" aria-label="Chiudi">✕</button></div>';
  if (n.fonte === FONTE_WEB) {
    return testa('<span class="etichetta-web">dal web</span>') + '<p class="card-testo">' + esc(n.testo) + "</p>" + linkFonte(n);
  }
  const c = ctx.concetto || n;
  const sotto = c.id !== n.id;
  const s = sintesiDelConcetto(c, !!ctx.sintesiInArrivo);
  return testa(htmlStato(ctx.stato)) +
    '<p class="occhiello">Dagli appunti</p><blockquote class="quaderno">' + esc(n.ancora) + "</blockquote>" +
    (ctx.errore ? '<p class="avviso-appunti" role="note"><span aria-hidden="true">✎</span> ' + esc(ctx.errore) + "</p>" : "") +
    '<p class="occhiello">In breve' + (sotto ? " · " + esc(c.titolo) : "") + "</p>" +
    '<p class="in-breve" data-tipo="' + s.tipo + '" aria-live="polite">' + esc(s.testo) + "</p>" +
    (ctx.senzaConcetto ? '<p class="legenda">Questo concetto non c\'è più nell\'argomento: rigenera la mappa.</p>'
      : '<div class="bottoni card-azioni">' +
        '<button type="button" class="azione" data-azione="prova">Mettiti alla prova' + (sotto ? " su «" + esc(c.titolo) + "»" : "") + "</button>" +
        '<button type="button" class="minore" data-azione="spiega">Spiegamelo meglio</button></div>');
}

/* =================================================================== nel browser */

let nodoAperto = null; // { g, n } del nodo con la card aperta
let lampoInCorso = false; // una prova lampo alla volta

function elementiFocus(box) {
  return Array.prototype.filter.call(box.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])"), (x) => !x.disabled && !x.hidden);
}

function apriCardNodo(g) {
  const n = mappa && trovaNodo(mappa.albero.nodi, g.dataset.id);
  if (!n || !(n.ancora || n.url)) return;
  chiudiCardNodo(false);
  const concetto = n.fonte === FONTE_WEB ? null : concettoDelNodo(mappa.albero, n.id);
  const dalDb = concetto && (corrente.concetti || []).find((c) => c.id === concetto.id);
  const box = $("card-nodo"), dentro = $("card-nodo-corpo");
  dentro.innerHTML = htmlCardNodo(n, { concetto, errore: dalDb && dalDb.errore_appunti, stato: g.dataset.s, senzaConcetto: !!concetto && !dalDb,
    sintesiInArrivo: lavoroSu(mappa.argomento_id) === "sintesi" || !!mappa.provvisoria });
  g.setAttribute("aria-pressed", "true");
  nodoAperto = { g, n, concetto, dalDb };
  box.hidden = false;
  document.body.classList.add("con-card");
  const chiudi = dentro.querySelector("[data-azione=chiudi]");
  if (chiudi) chiudi.focus();
}

function chiudiCardNodo(rimettiFocus = true) {
  const box = $("card-nodo");
  if (!box || box.hidden) return;
  box.hidden = true;
  document.body.classList.remove("con-card");
  const prima = nodoAperto && nodoAperto.g;
  if (prima) prima.setAttribute("aria-pressed", "false");
  nodoAperto = null;
  if (rimettiFocus && prima && prima.isConnected) prima.focus();
}

// Esc chiude; Tab gira solo fra i pulsanti della card.
function tastiCardNodo(e) {
  const box = $("card-nodo");
  if (box.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); chiudiCardNodo(); return; }
  if (e.key !== "Tab") return;
  const fuochi = elementiFocus(box);
  if (!fuochi.length) return;
  const primo = fuochi[0], ultimo = fuochi[fuochi.length - 1];
  if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  else if (!box.contains(document.activeElement)) { e.preventDefault(); primo.focus(); }
}

function azioneCardNodo(e) {
  const b = e.target.closest("[data-azione]");
  if (!b || !nodoAperto) return;
  const { concetto, dalDb } = nodoAperto;
  if (b.dataset.azione === "chiudi") { chiudiCardNodo(); return; }
  if (!concetto) return;
  if (b.dataset.azione === "spiega") {
    if (!dalDb) return;
    chiudiCardNodo(false);
    apriSpiegazione({ concetto_id: concetto.id, titolo: concetto.titolo, ancora: concetto.ancora, materia: corrente.materia });
    return;
  }
  if (b.dataset.azione === "prova") {
    if (!dalDb || lampoInCorso) return;
    const argomento = corrente;
    chiudiCardNodo(false);
    modo = "argomento"; lampoInCorso = true;
    // Un pulsante tutto suo: preparaVerifica lo spegne e lo riaccende, Rigenera resta com'è.
    preparaVerifica([argomento], document.createElement("button"), $("stato-mappa"), $("err-mappa"), { concetto: dalDb })
      .finally(() => { lampoInCorso = false; });
  }
}

function collegaCardNodo() {
  const box = $("card-nodo");
  if (!box) return;
  box.addEventListener("click", (e) => { if (e.target === box) chiudiCardNodo(); else azioneCardNodo(e); });
  document.addEventListener("keydown", tastiCardNodo);
}

/* =================================================================== «In breve» dopo la mappa (issue #13) */
// La mappa arriva prima, senza sintesi; le sintesi si chiedono dopo, in background, e si
// salvano nell'albero. Una generazione per argomento alla volta: mappa, sintesi o arricchisci.

// Il lavoro "sintesi" sta nel registro di app.js (lavoriMappa): uno per argomento alla volta.

// Albero da disegnare subito, prima del modello: radice e concetti (già nel database).
function alberoProvvisorio(a) {
  return { titolo: a.titolo, materia: a.materia, nodi: [...(a.concetti || [])].sort((x, y) => (x.ordine || 0) - (y.ordine || 0))
    .map((c) => ({ id: c.id, titolo: c.titolo, ancora: c.ancora, fonte: "appunti", peso: c.peso || 2, figli: [] })) };
}

// Vero se qualche concetto degli appunti non ha ancora il campo sintesi.
const mancanoSintesi = (albero) => ((albero && albero.nodi) || []).some((n) => n.fonte !== "web" && typeof n.sintesi !== "string");

// Albero nuovo con le sintesi sui concetti: { [concetto_id]: testo }. Non tocca quello di partenza.
// I concetti che il server non conosce più (tolti dall'argomento) prendono "": così una mappa
// con un concetto cancellato non richiede il riassunto a ogni apertura.
function conSintesi(albero, sintesi) {
  return { ...albero, nodi: (albero.nodi || []).map((n) => (n.fonte === "web" ? n
    : { ...n, sintesi: Object.hasOwn(sintesi, n.id) ? String(sintesi[n.id] || "") : (typeof n.sintesi === "string" ? n.sintesi : "") })) };
}

async function generaSintesi(a) {
  if (!a || senzaRete() || !iniziaLavoro(a.id, "sintesi")) return;
  if (stessoArgomento(corrente, a)) { aggiornaBottoniMappa(); aggiornaInBreveAperto(); }
  try {
    const r = await conRiprova(() => modello({ azione: "sintesi", argomento_id: a.id }));
    // Si parte dall'albero salvato: è quello che vale, anche se nel frattempo ha cambiato argomento.
    const { data, error } = await sb.from("mappe").select("albero, generata").eq("argomento_id", a.id).maybeSingle();
    if (error) throw error;
    if (!data) return;
    const albero = conSintesi(data.albero, r.sintesi || {});
    const { error: e2 } = await sb.from("mappe").update({ albero }).eq("argomento_id", a.id);
    if (e2) throw e2;
    if (mappa && mappa.argomento_id === a.id && !mappa.provvisoria) mappa = { ...mappa, albero };
  } catch (e) {
    // Il riassunto non è essenziale: la card dice che non c'è ancora e alla prossima apertura si riprova.
    console.warn("sintesi della mappa non riuscita:", a.id, e && e.message);
  } finally {
    finisciLavoro(a.id, "sintesi");
    if (mappa && mappa.argomento_id === a.id) aggiornaInBreveAperto();
    if (stessoArgomento(corrente, a)) aggiornaBottoniMappa();
  }
}

// Se la card di un nodo è aperta, il suo «In breve» si aggiorna senza ridisegnare niente.
function aggiornaInBreveAperto() {
  const p = document.querySelector("#card-nodo:not([hidden]) .in-breve");
  if (!p || !nodoAperto || !nodoAperto.concetto || !mappa) return;
  const c = trovaNodo(mappa.albero.nodi, nodoAperto.concetto.id);
  const s = sintesiDelConcetto(c, lavoroSu(mappa.argomento_id) === "sintesi" || !!mappa.provvisoria);
  p.dataset.tipo = s.tipo; p.textContent = s.testo;
}
