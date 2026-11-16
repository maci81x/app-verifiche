// Tre modi di studiare per ragionare (issue #22): la mappa per paragrafi, «Le 5 cose da sapere»
// e «Raccontalo in 2 minuti».
// Script classico caricato dopo mappa-card.js: usa $, esc, evidenzia, htmlStato, piatto, notaQuaderno,
// SBAGLIATA, vai, attesa, errore, avviso, modello, conRiprova, messaggioModello, preparaVerifica, provaLampo,
// apriSpiegazione, trovaNodo, concettoDelNodo, Riconoscimento, provaMicrofono, messaggioVoce, erroreVoce,
// sb, corrente, mappa, modo, MSG_SENZA_PUNTI.

/* =================================================================== mappa per paragrafi */
// I concetti si raggruppano come nel libro: per titolo di paragrafo, poi per pagina, poi per
// foto. Tutto dalla trascrizione che c'è già: nessuna chiamata al modello.

const RIGA_PAGINA = /^\s*\[?\s*(?:pag(?:ina)?\.?|p\.)\s*(\d{1,3})\s*\]?\s*$/i; // «pag. 24», «[Pagina 24]»
const RIGA_NUMERO = /^\s*[-–]?\s*(\d{1,3})\s*[-–]?\s*$/;                       // numero di pagina stampato, da solo
const MIN_PARAGRAFO = 40; // caratteri: un titolo è seguito da una riga di testo vero

// Titolo di paragrafo: riga corta, senza punto in fondo, con la maiuscola, seguita da un paragrafo.
// ponytail: riconoscimento a occhio; una riga corta di appunti a mano può sembrare un titolo.
function titoloDiRiga(riga, dopo) {
  const t = String(riga).trim().replace(/^#{1,6}\s*/, "").replace(/^\*\*(.+)\*\*$/, "$1").trim();
  if (t.length < 3 || t.length > 70 || t.split(/\s+/).length > 9 || /[.,;:!?]$/.test(t) || /^[-•*]/.test(t) || /^\[/.test(t)) return null;
  if (!/^(?:\d+(?:\.\d+)*\.?\s+)?[A-ZÀ-Ý«"]/.test(t) || String(dopo || "").trim().length < MIN_PARAGRAFO) return null;
  return t.replace(/^\d+(?:\.\d+)*\.?\s+/, "");
}

// Dove sta una frase nel testo piatto: intera, poi le prime o le ultime parole.
function doveSta(piano, frase) {
  const p = piatto(frase).split(" ").filter(Boolean);
  for (const prova of [p, p.slice(0, 6), p.slice(-6), p.slice(0, 3)]) {
    if (prova.length < 2 && p.length >= 2) continue;
    const i = piano.indexOf(" " + prova.join(" ") + " ");
    if (prova.length && i >= 0) return i + 1;
  }
  return -1;
}

// trascrizione: il testo letto dalle foto; nodi: i concetti in ordine [{ id, ancora }]; nFoto: quante foto.
// → [{ n, titolo, pagine: [da, a] | null, ids }] in ordine di lettura, solo i blocchi con dei punti.
function blocchiMappa(trascrizione, nodi, nFoto) {
  const righe = String(trascrizione || "").split("\n");
  // Testo piatto con l'inizio di ogni riga: le frasi si cercano lì.
  const inizi = []; let piano = " ";
  righe.forEach((r) => { inizi.push(piano.length); piano += piatto(r) + " "; });
  const rigaDi = (pos) => { let k = 0; while (k + 1 < inizi.length && inizi[k + 1] <= pos) k++; return k; };

  // Pagine: «pag. 24» vale da lì in avanti. Un numero da solo è il numero stampato: se la
  // trascrizione comincia con un numero sta in cima alla pagina, altrimenti in fondo (vale per
  // il testo sopra). Vale solo se segue le pagine prima (un «3» dopo il 24 non è una pagina).
  const esplicite = righe.map((r, i) => (RIGA_PAGINA.test(r) ? { i, p: +r.match(RIGA_PAGINA)[1] } : null)).filter(Boolean);
  const numeri = []; righe.forEach((r, i) => { const m = r.match(RIGA_NUMERO); if (m && (!numeri.length || +m[1] > numeri[numeri.length - 1].p)) numeri.push({ i, p: +m[1] }); });
  const segni = esplicite.length ? esplicite : numeri;
  const inCima = esplicite.length || (segni.length && !righe.slice(0, segni[0].i).join("").trim());
  const paginaDi = (k) => {
    if (!segni.length) return null;
    if (inCima) { const s = segni.filter((x) => x.i <= k).pop(); return s ? s.p : null; }
    const s = segni.find((x) => x.i >= k);
    return s ? s.p : segni[segni.length - 1].p + 1;
  };

  // Titoli di paragrafo.
  const titoli = [];
  righe.forEach((r, i) => {
    if (RIGA_PAGINA.test(r) || RIGA_NUMERO.test(r)) return;
    const dopo = righe.slice(i + 1).find((x) => x.trim() && !RIGA_PAGINA.test(x) && !RIGA_NUMERO.test(x));
    const t = titoloDiRiga(r, dopo);
    if (t) titoli.push({ i, t });
  });

  // Ogni punto alla sua riga; una frase non trovata segue il punto prima.
  let ultima = 0;
  const posti = (nodi || []).map((n) => {
    const pos = doveSta(piano, n.ancora);
    const k = pos >= 0 ? rigaDi(pos) : null;
    const dove = pos >= 0 ? pos : ultima;
    ultima = dove;
    return { id: n.id, pos: dove, riga: k == null ? rigaDi(dove) : k };
  });

  // Il modo più fine che dà almeno due blocchi: paragrafi, pagine, foto.
  const perTitolo = (x) => { const t = titoli.filter((y) => y.i <= x.riga).pop(); return t ? "t" + t.i : "t-"; };
  const perPagina = (x) => "p" + paginaDi(x.riga);
  // La trascrizione non segna dove finisce una foto (si legge a gruppi di quattro): le parti sono
  // tante quante le foto e di lunghezza uguale, ma si chiamano «Parte N», non «Foto N», perché è una stima.
  const perFoto = (x) => "f" + Math.min(nFoto, 1 + Math.floor(x.pos / Math.max(1, piano.length) * nFoto));
  const quanti = (chiave) => new Set(posti.map(chiave)).size;
  const chiave = titoli.length && quanti(perTitolo) > 1 ? perTitolo : (segni.length && quanti(perPagina) > 1 ? perPagina : (nFoto > 1 ? perFoto : null));

  const blocchi = [];
  posti.slice().sort((x, y) => x.pos - y.pos).forEach((x) => {
    const k = chiave ? chiave(x) : "uno";
    let b = blocchi.find((y) => y.k === k);
    if (!b) {
      const t = chiave === perTitolo ? titoli.find((y) => "t" + y.i === k) : null;
      b = { k, titolo: t ? t.t : (chiave === perFoto ? "Parte " + k.slice(1) : ""), pagine: null, ids: [] };
      blocchi.push(b);
    }
    b.ids.push(x.id);
    const p = paginaDi(x.riga);
    if (p != null) b.pagine = b.pagine ? [Math.min(b.pagine[0], p), Math.max(b.pagine[1], p)] : [p, p];
  });
  return blocchi.map((b, i) => ({ n: i + 1, titolo: b.titolo, pagine: b.pagine, ids: b.ids }));
}

// «Dove e quando — pag. 24»; senza titolo «Pagina 24»; senza niente «L'inizio».
function etichettaBlocco(b) {
  const pag = b.pagine ? (b.pagine[0] === b.pagine[1] ? String(b.pagine[0]) : b.pagine[0] + "-" + b.pagine[1]) : "";
  if (!b.titolo) return pag ? (b.pagine[0] === b.pagine[1] ? "Pagina " : "Pagine ") + pag : "L'inizio";
  return b.titolo + (pag ? (b.pagine[0] === b.pagine[1] ? " — pag. " : " — pagg. ") + pag : "");
}

// I blocchi dell'argomento aperto, dai nodi della mappa.
const blocchiDi = (a, albero) => blocchiMappa(a.trascrizione, (albero && albero.nodi) || [], (a.foto || []).length);

// Il punto toccato si apre sotto: la frase del quaderno evidenziata e «Provami su questo».
// n: nodo della mappa; ctx: { concetto: nodo di primo livello, errore, senzaConcetto }.
function htmlPuntoAperto(n, ctx) {
  const c = ctx.concetto || n, sotto = c.id !== n.id;
  const breve = typeof c.sintesi === "string" ? c.sintesi.trim() : "";
  return '<div class="m-aperto">' +
    '<p class="occhiello">Sul tuo quaderno</p><p class="quaderno">' + evidenzia(n.ancora) + "</p>" +
    (ctx.errore ? '<p class="avviso-appunti" role="note">' + esc(notaQuaderno(ctx.errore)) + "</p>" : "") +
    (breve ? '<p class="occhiello">In breve' + (sotto ? ", su «" + esc(c.titolo) + "»" : "") + '</p><p class="in-breve">' + esc(breve) + "</p>" : "") +
    (ctx.senzaConcetto ? '<p class="legenda">Questo punto non c\'è più nell\'argomento: tocca Rifai la mappa.</p>'
      : '<div class="bottoni"><button type="button" class="azione" data-azione="prova">' + (sotto ? "Provami su «" + esc(c.titolo) + "»" : "Provami su questo") + "</button>" +
        '<button type="button" class="link" data-azione="spiega">Spiegamelo meglio</button></div>') +
    "</div>";
}

let puntoAperto = null; // { g, concetto, dalDb } del punto aperto sotto

function chiudiPunto() {
  if (!puntoAperto) return;
  const { g } = puntoAperto, box = g.nextElementSibling;
  if (box && box.classList.contains("m-aperto")) box.remove();
  g.setAttribute("aria-expanded", "false");
  puntoAperto = null;
}
function apriPunto(g) {
  const eraAperto = g.getAttribute("aria-expanded") === "true";
  chiudiPunto();
  if (eraAperto) return;
  const n = mappa && trovaNodo(mappa.albero.nodi, g.dataset.id);
  if (!n || !n.ancora) return;
  const concetto = concettoDelNodo(mappa.albero, n.id);
  const dalDb = concetto && (corrente.concetti || []).find((c) => c.id === concetto.id);
  g.insertAdjacentHTML("afterend", htmlPuntoAperto(n, { concetto, errore: dalDb && dalDb.errore_appunti, senzaConcetto: !!concetto && !dalDb }));
  g.setAttribute("aria-expanded", "true");
  puntoAperto = { g, concetto, dalDb };
}
function azionePunto(b) {
  if (!puntoAperto || !puntoAperto.dalDb) return;
  const { concetto, dalDb } = puntoAperto;
  if (b.dataset.azione === "prova") provaLampo(dalDb);
  else apriSpiegazione({ concetto_id: concetto.id, titolo: concetto.titolo, ancora: concetto.ancora, materia: corrente.materia });
}

/* =================================================================== «Le 5 cose da sapere» */
// La genera la funzione `modello` (azione punti_chiave) e l'app la tiene in `punti_chiave`, una
// riga per argomento. Finché la tabella non c'è (migration non applicata) la lettura fallisce
// in silenzio e si genera ogni volta. «Occhio a questo» si calcola qui, dalle prove: è sempre fresco.

const titoloCinque = (n) => (n === 1 ? "La cosa da sapere" : "Le " + n + " cose da sapere");
const testoProvami = (n) => (n === 1 ? "Ora provami su questa" : "Ora provami su queste " + n);
const cinqueValide = (c) => !!c && Array.isArray(c.punti) && c.punti.length > 0;

// Il punto con più risposte sbagliate (a pari numero il più recente) e la sua ultima risposta
// sbagliata; senza prove sbagliate, l'errore degli appunti del punto più importante.
// domande: righe di `domande` con sessioni(data) e risposte(testo, scelta, punteggio).
function occhioDaProve(concetti, domande) {
  const perId = Object.fromEntries((concetti || []).map((c) => [c.id, c]));
  const sbagliate = (domande || []).filter((d) => perId[d.concetto_id] && (d.risposte || []).length && Number(d.risposte[0].punteggio || 0) < SBAGLIATA)
    .map((d) => ({ d, r: d.risposte[0], quando: Date.parse(d.sessioni && d.sessioni.data) || 0 }));
  if (sbagliate.length) {
    const conto = {};
    sbagliate.forEach((x) => { const c = conto[x.d.concetto_id] || (conto[x.d.concetto_id] = { n: 0, quando: 0 }); c.n++; c.quando = Math.max(c.quando, x.quando); });
    const id = Object.keys(conto).sort((a, b) => conto[b].n - conto[a].n || conto[b].quando - conto[a].quando)[0];
    const x = sbagliate.filter((y) => y.d.concetto_id === id).sort((a, b) => b.quando - a.quando)[0];
    const mia = x.d.tipo === "chiusa" ? ((x.d.opzioni || [])[x.r.scelta] || "") : String(x.r.testo || "").trim();
    return { concetto: perId[id], domanda: x.d.testo, mia };
  }
  const c = (concetti || []).filter((y) => y.errore_appunti).sort((a, b) => (b.peso || 2) - (a.peso || 2) || (a.ordine || 0) - (b.ordine || 0))[0];
  return c ? { concetto: c, nota: notaQuaderno(c.errore_appunti) } : null;
}
function htmlOcchio(o) {
  if (!o) return "";
  const cosa = o.nota ? '<p class="errore-appunti">' + esc(o.nota) + "</p>"
    : "<p>Alla domanda «" + esc(o.domanda) + "» " + (o.mia ? "hai risposto «" + esc(o.mia) + "»." : "non hai risposto.") + "</p>";
  return cosa + (o.concetto && o.concetto.ancora ? '<p class="rileggi">Rileggi: ' + evidenzia(o.concetto.ancora) + "</p>" : "");
}

// dati: { punti, catena, parole, domanda }; ctx: { occhio }. Le sezioni vuote non compaiono.
function htmlCinque(dati, ctx = {}) {
  const punti = '<ol class="cinque-punti">' + dati.punti.map((p, i) => '<li><span class="cinque-n" aria-hidden="true">' + (i + 1) + "</span><div>" +
    (p.testo ? '<p class="cinque-testo"><b>' + esc(p.etichetta) + ":</b> " + esc(p.testo) + '</p><p class="cinque-chiave">' + evidenzia(p.chiave) + "</p>"
      : '<p class="cinque-testo"><b>' + esc(p.etichetta) + ":</b> " + evidenzia(p.chiave) + "</p>") + "</div></li>").join("") + "</ol>";
  const catena = (dati.catena || []).length ? '<h3 class="sez-cinque">Per ragionare: causa e effetto</h3><div class="catena">' + dati.catena.map((x, i) =>
    (i ? '<p class="quindi"><span aria-hidden="true">↓</span> quindi</p>' : "") +
    '<div class="anello">' + (x.testo ? "<p>" + esc(x.testo) + "</p>" : "") + '<p class="cinque-chiave">' + evidenzia(x.ancora) + "</p></div>").join("") + "</div>" : "";
  const parole = (dati.parole || []).length ? '<h3 class="sez-cinque">Le parole che fanno bella figura</h3><ul class="parole-belle">' +
    dati.parole.map((w) => "<li>" + esc(w) + "</li>").join("") + "</ul>" : "";
  const occhio = htmlOcchio(ctx.occhio);
  const d = dati.domanda;
  const prof = d ? '<p class="occhiello">La domanda che ti farà la prof</p><p class="domanda-prof">' + esc(d.testo) + '</p><p class="rileggi">Per rispondere rileggi: ' + evidenzia(d.ancora) + "</p>" : "";
  return punti + catena + parole + (occhio || prof ? '<h3 class="sez-cinque">Occhio a questo</h3>' + occhio + prof : "");
}

/* ---- nel browser ---- */

let cinque = null; // { argomento_id, dati, occhio }
let cinqueInCorso = null; // id dell'argomento che si sta generando

async function leggiCinque(a) {
  try {
    const { data, error } = await sb.from("punti_chiave").select("contenuto").eq("argomento_id", a.id).maybeSingle();
    return !error && data && cinqueValide(data.contenuto) ? data.contenuto : null;
  } catch (e) { return null; } // tabella non ancora creata: si genera
}
async function salvaCinque(a, contenuto) {
  try { await sb.from("punti_chiave").upsert({ argomento_id: a.id, contenuto, generata: new Date().toISOString() }, { onConflict: "argomento_id,studente_id" }); }
  catch (e) { /* senza cache si rigenera la prossima volta */ }
}
async function leggiOcchio(a) {
  const { data, error } = await sb.from("domande").select("concetto_id, testo, tipo, opzioni, sessioni(data), risposte(testo, scelta, punteggio)")
    .eq("argomento_id", a.id).limit(500);
  return occhioDaProve(a.concetti, error ? [] : data);
}

function apriCinque(a, rifai) {
  corrente = a;
  errore($("err-cinque"), ""); $("cinque-corpo").innerHTML = ""; $("cinque-azioni").hidden = true;
  $("t-cinque").textContent = titoloCinque(5);
  vai("cinque", a.materia, a.titolo);
  if (!a.concetti.length) { avviso($("err-cinque"), MSG_SENZA_PUNTI); return; }
  caricaCinque(a, rifai);
}
async function caricaCinque(a, rifai) {
  if (cinqueInCorso === a.id) return;
  cinqueInCorso = a.id;
  attesa($("stato-cinque"), ["Rileggo gli appunti", "Scelgo le cose più importanti", "Controllo che ogni frase sia sul tuo quaderno"]);
  try {
    const [salvate, occhio] = await Promise.all([rifai ? null : leggiCinque(a), leggiOcchio(a).catch(() => null)]);
    let dati = salvate;
    if (!dati) {
      const r = await conRiprova(() => modello({ azione: "punti_chiave", argomento_id: a.id }));
      dati = { punti: r.punti, catena: r.catena || [], parole: r.parole || [], domanda: r.domanda || null };
      salvaCinque(a, dati);
    }
    if (corrente !== a) return;
    cinque = { argomento_id: a.id, dati, occhio };
    disegnaCinque();
  } catch (e) {
    if (corrente === a) errore($("err-cinque"), e.dati && e.dati.errore === "nessun_punto"
      ? "Non ho trovato frasi del quaderno abbastanza chiare per le cose da sapere. Aggiungi una foto più nitida e riprova."
      : messaggioModello(e, "Non sono riuscito a preparare le cose da sapere. Riprova fra un momento."));
  } finally {
    cinqueInCorso = null;
    if (corrente === a) attesa($("stato-cinque"), null);
  }
}
function disegnaCinque() {
  const n = cinque.dati.punti.length;
  $("t-cinque").textContent = titoloCinque(n);
  $("nome-passo").textContent = titoloCinque(n);
  $("cinque-corpo").innerHTML = htmlCinque(cinque.dati, { occhio: cinque.occhio });
  const ids = puntiDelleCinque();
  $("btn-cinque-provami").textContent = testoProvami(n);
  $("btn-cinque-provami").hidden = !ids.length;
  $("cinque-azioni").hidden = false;
}
// I concetti delle 5 cose che ci sono ancora nell'argomento, senza doppioni.
function puntiDelleCinque() {
  const ids = [...new Set(cinque.dati.punti.map((p) => p.concetto_id))];
  return ids.map((id) => corrente.concetti.find((c) => c.id === id)).filter(Boolean);
}

// [Ora provami su queste 5]. Il ripasso guidato (#21) non c'è ancora: per ora parte una verifica
// solo su quei punti (una prova lampo se è uno solo).
// #21: quando arriva il ripasso guidato, si sostituisce solo questa funzione.
function avviaRipassoPunti(a, concetti, btn, elStato, elErr) {
  if (!concetti.length) return;
  modo = "argomento"; corrente = a;
  preparaVerifica([a], btn, elStato, elErr, concetti.length === 1 ? { concetto: concetti[0] } : { concetti: concetti.map((c) => ({ id: c.id, titolo: c.titolo })) });
}

/* =================================================================== «Raccontalo in 2 minuti» */

const MAX_ASCOLTO_RACCONTO = 4 * 60 * 1000; // dopo 4 minuti si ferma da solo
const ESITO_RACCONTO = { detto: ["verde", "Detto"], impreciso: ["giallo", "Impreciso"], saltato: ["rosso", "Saltato"] };

// r: { esiti, toccati, totale } → [titolo, saltati]
function frasiRacconto(r, concetti) {
  const tit = (id) => ((concetti || []).find((c) => c.id === id) || {}).titolo;
  const saltati = (r.esiti || []).filter((e) => e.esito === "saltato").map((e) => tit(e.concetto_id)).filter(Boolean);
  if (!r.toccati) return ["Non ho sentito nessun punto. Riprova seguendo i blocchi.", ""];
  if (r.toccati === r.totale) return [r.totale === 1 ? "Hai toccato il punto." : "Hai toccato tutti i " + r.totale + " punti.", ""];
  return ["Hai toccato " + r.toccati + (r.toccati === 1 ? " punto" : " punti") + " su " + r.totale + ".", saltati.length ? "Hai saltato: " + saltati.join(", ") + "." : ""];
}
// Prima i saltati, poi gli imprecisi, poi i detti; ognuno con la frase del quaderno.
function htmlEsitoRacconto(r, concetti) {
  const [titolo, saltati] = frasiRacconto(r, concetti);
  const perId = Object.fromEntries((concetti || []).map((c) => [c.id, c]));
  const ordine = { saltato: 0, impreciso: 1, detto: 2 };
  const righe = (r.esiti || []).filter((e) => perId[e.concetto_id]).sort((a, b) => ordine[a.esito] - ordine[b.esito]).map((e) => {
    const c = perId[e.concetto_id], [s, parola] = ESITO_RACCONTO[e.esito] || ESITO_RACCONTO.saltato;
    return '<div class="esito-c compatto" data-s="' + s + '"><h3><span class="tit">' + esc(c.titolo) + '</span><span class="sem" data-s="' + s + '"><i aria-hidden="true">' + segnoStato(s) + "</i> " + parola + "</span></h3>" +
      (e.frase_detta ? '<p class="detto">Hai detto: «' + esc(e.frase_detta) + "»</p>" : "") +
      (e.esito !== "detto" && c.ancora ? '<p class="rileggi">Sul tuo quaderno: ' + evidenzia(c.ancora) + "</p>" : "") + "</div>";
  }).join("");
  return '<p class="rc-titolo">' + esc(titolo) + "</p>" + (saltati ? '<p class="aiuto">' + esc(saltati) + "</p>" : "") + righe;
}

let ascoltoRacconto = null; // { stop } mentre ascolta, o mentre aspetta il permesso del microfono
let argomentoRacconto = null; // id dell'argomento del testo nel riquadro
let raccontoInCorso = false;

function apriRacconto(a) {
  fermaRacconto();
  // Il racconto scritto resta solo se si riapre lo stesso argomento.
  if (argomentoRacconto !== a.id) { $("rc-testo").value = ""; argomentoRacconto = a.id; }
  $("rc-esito").innerHTML = ""; errore($("err-rc"), ""); $("rc-ascolto").textContent = ""; $("rc-tempo").textContent = "";
  if (!a.concetti.length) { $("rc-scaletta").innerHTML = '<li class="legenda">' + esc(MSG_SENZA_PUNTI) + "</li>"; return; }
  const nodi = mappa && mappa.argomento_id === a.id ? mappa.albero.nodi : a.concetti;
  const tit = Object.fromEntries(a.concetti.map((c) => [c.id, c.titolo]));
  $("rc-scaletta").innerHTML = blocchiMappa(a.trascrizione, nodi, (a.foto || []).length).map((b) =>
    '<li><b>' + esc(etichettaBlocco(b)) + "</b><span>" + esc(b.ids.map((id) => tit[id]).filter(Boolean).join(" · ")) + "</span></li>").join("");
}
// Uscendo dalla linguetta o dalla vista: niente più ascolto.
function fermaRacconto() { if (ascoltoRacconto) ascoltoRacconto.stop(true); }

async function raccontaAVoce() {
  if (ascoltoRacconto) { if (!ascoltoRacconto.inAttesa) ascoltoRacconto.stop(); return; } // durante l'attesa del permesso il tocco non conta
  errore($("err-rc"), "");
  if (!Riconoscimento) { errore($("err-rc"), "Questo browser non ha il riconoscimento vocale: usa Chrome o Safari, oppure scrivi il racconto qui sotto."); return; }
  // Segnaposto durante l'attesa del permesso: un secondo tocco o l'uscita dalla vista lo annullano,
  // e il riconoscimento parte solo se nessuno l'ha annullato (mai due microfoni, mai uno lasciato acceso).
  const segnaposto = { inAttesa: true, annullato: false, stop() { this.annullato = true; if (ascoltoRacconto === this) ascoltoRacconto = null; } };
  ascoltoRacconto = segnaposto;
  const permesso = await provaMicrofono();
  if (segnaposto.annullato) return;
  ascoltoRacconto = null;
  if (!permesso) { errore($("err-rc"), messaggioVoce(erroreVoce)); return; }
  const r = new Riconoscimento(); r.lang = "it-IT"; r.continuous = true; r.interimResults = true;
  const btn = $("btn-rc-parla"), ta = $("rc-testo"), prima = ta.value.trim();
  let finale = "", parziale = "", ultimo = Date.now(), finito = false;
  const inizio = Date.now();
  const detto = () => (prima + " " + finale + " " + parziale).trim();
  const smetti = () => { finito = true; clearInterval(orologio); ascoltoRacconto = null; btn.textContent = "Comincia a raccontare"; $("rc-voce").dataset.stato = ""; $("rc-voce").hidden = true; try { r.stop(); } catch (e) { /* già fermo */ } };
  const chiudi = (uscendo) => {
    if (finito) return;
    smetti();
    if (!uscendo && (finale || parziale)) controllaRacconto();
  };
  r.onresult = (ev) => {
    parziale = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) { if (ev.results[i].isFinal) finale += " " + ev.results[i][0].transcript; else parziale += ev.results[i][0].transcript; }
    ultimo = Date.now(); ta.value = detto();
  };
  r.onerror = (ev) => { if (ev.error !== "no-speech" && ev.error !== "aborted") { smetti(); errore($("err-rc"), messaggioVoce(ev.error)); } };
  r.onend = () => { if (!finito) { try { r.start(); } catch (e) { chiudi(); } } }; // Safari si ferma da solo: si riparte
  const orologio = setInterval(() => {
    const s = Math.round((Date.now() - inizio) / 1000);
    $("rc-tempo").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    if (Date.now() - inizio > MAX_ASCOLTO_RACCONTO || Date.now() - ultimo > ((finale || parziale) ? 8000 : 15000)) chiudi();
  }, 250);
  ascoltoRacconto = { stop: chiudi };
  btn.textContent = "Ho finito"; $("rc-voce").hidden = false; $("rc-voce").dataset.stato = "ascolto";
  $("rc-ascolto").textContent = "Ti ascolto: parti dal primo blocco."; $("rc-esito").innerHTML = "";
  try { r.start(); } catch (e) { chiudi(); }
}

async function controllaRacconto() {
  const a = corrente, testo = $("rc-testo").value.trim();
  errore($("err-rc"), "");
  if (raccontoInCorso || !a) return;
  if (testo.split(/\s+/).length < 5) { errore($("err-rc"), "Il racconto è troppo corto. Tocca Comincia a raccontare e parla per almeno mezzo minuto, oppure scrivilo qui sopra."); return; }
  raccontoInCorso = true; $("btn-rc-controlla").disabled = true;
  attesa($("stato-rc"), ["Confronto il racconto con i tuoi punti", "Cerco quelli che hai saltato"]);
  try {
    const r = await conRiprova(() => modello({ azione: "racconto", argomento_id: a.id, testo }));
    if (corrente === a) { $("rc-esito").innerHTML = htmlEsitoRacconto(r, a.concetti); $("rc-esito").scrollIntoView({ block: "start", behavior: "smooth" }); }
  } catch (e) {
    if (corrente === a) errore($("err-rc"), messaggioModello(e, "Non sono riuscito a controllare il racconto. Il testo resta qui: riprova fra un momento."));
  } finally {
    raccontoInCorso = false; $("btn-rc-controlla").disabled = false; attesa($("stato-rc"), null);
  }
}

function collegaStudio() {
  $("btn-cinque").addEventListener("click", () => apriCinque(corrente));
  $("btn-menu-cinque").addEventListener("click", () => apriCinque(corrente));
  $("btn-cinque-rifai").addEventListener("click", () => { if (corrente) apriCinque(corrente, true); });
  $("btn-cinque-stampa").addEventListener("click", () => window.print());
  $("btn-cinque-provami").addEventListener("click", () => { if (cinque && corrente) avviaRipassoPunti(corrente, puntiDelleCinque(), $("btn-cinque-provami"), $("stato-cinque"), $("err-cinque")); });
  $("tab-racconto").addEventListener("click", () => mostraPannello("racconto"));
  $("btn-rc-parla").addEventListener("click", raccontaAVoce);
  $("btn-rc-controlla").addEventListener("click", () => { fermaRacconto(); controllaRacconto(); });
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-cinque")) collegaStudio();
