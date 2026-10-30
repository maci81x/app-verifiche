// Card di un nodo della mappa (issue #11): si apre dal basso al tocco su un riquadro.
// Dagli appunti (l'ancora), l'avviso se gli appunti sbagliano, In breve (la sintesi fatta
// con la mappa), Mettiti alla prova (3 domande sul concetto, salvate come prova normale)
// e Spiegamelo meglio. È un dialogo: si chiude con Esc o con ✕ e il focus resta dentro.
// Script classico caricato dopo aiuto.js: usa $, esc, htmlStato, statoValido, concettoDelNodo,
// trovaNodo, linkFonte, apriSpiegazione, preparaVerifica, mappa, corrente, modo, FONTE_WEB.

const MSG_SINTESI_VECCHIA = "Rigenera la mappa per il riassunto.";
const MSG_SINTESI_VUOTA = "Per questo concetto non ho un riassunto sicuro: leggi la frase degli appunti.";

// "ok" con il testo, "vuota" se la mappa è nuova ma la sintesi non reggeva, "vecchia" se la
// mappa è nata prima dei riassunti (il campo non c'è proprio).
function sintesiDelConcetto(nodoConcetto) {
  if (!nodoConcetto || typeof nodoConcetto.sintesi !== "string") return { tipo: "vecchia", testo: MSG_SINTESI_VECCHIA };
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
  const s = sintesiDelConcetto(c);
  return testa(htmlStato(ctx.stato)) +
    '<p class="occhiello">Dagli appunti</p><blockquote class="quaderno">' + esc(n.ancora) + "</blockquote>" +
    (ctx.errore ? '<p class="avviso-appunti" role="note"><span aria-hidden="true">✎</span> ' + esc(ctx.errore) + "</p>" : "") +
    '<p class="occhiello">In breve' + (sotto ? " · " + esc(c.titolo) : "") + "</p>" +
    '<p class="in-breve" data-tipo="' + s.tipo + '">' + esc(s.testo) + "</p>" +
    '<div class="bottoni card-azioni">' +
    '<button type="button" class="azione" data-azione="prova">Mettiti alla prova' + (sotto ? " su «" + esc(c.titolo) + "»" : "") + "</button>" +
    '<button type="button" class="minore" data-azione="spiega">Spiegamelo meglio</button></div>';
}

/* =================================================================== nel browser */

let nodoAperto = null; // { g, n } del nodo con la card aperta

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
  dentro.innerHTML = htmlCardNodo(n, { concetto, errore: dalDb && dalDb.errore_appunti, stato: g.dataset.s });
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
    chiudiCardNodo(false);
    apriSpiegazione({ concetto_id: concetto.id, titolo: concetto.titolo, ancora: concetto.ancora, materia: corrente.materia });
    return;
  }
  if (b.dataset.azione === "prova") {
    if (!dalDb) return;
    const argomento = corrente;
    chiudiCardNodo(false);
    modo = "argomento";
    preparaVerifica([argomento], $("btn-rigenera"), $("stato-mappa"), $("err-mappa"), { concetto: dalDb });
  }
}

function collegaCardNodo() {
  const box = $("card-nodo");
  if (!box) return;
  box.addEventListener("click", (e) => { if (e.target === box) chiudiCardNodo(); else azioneCardNodo(e); });
  document.addEventListener("keydown", tastiCardNodo);
}
