// Ripasso guidato (issue #21): «prima provi, poi leggi». Un punto alla volta: domanda aperta,
// «Secondo te, ci prendi?», risposta, esito con la rubrica, la frase del quaderno evidenziata.
// Un punto non riuscito torna 2 punti dopo con un'altra domanda; una volta a sessione
// «Spiegalo con parole tue». Alla fine minuti veri, prima e dopo, il piano di domani.
// Script classico caricato dopo piano.js: usa $, esc, vai, modello, conRiprova, attesa, errore,
// avviso, evidenzia, htmlStato, segnoStato, statoValido, statoDaMedia, voto, esitoAperta,
// notaQuaderno, messaggioModello, titoloEMateria, apriSpiegazione, apriPrepara, caricaLibreria,
// disegnaLibreria, ascolta, fermaVoce, messaggioVoce, Riconoscimento, contaStati, ordineScelte,
// disegnaScelte, giornoDi (compito.js) e da piano.js giornoPiu, giorniFra, piattaMateria, minutiIt,
// salvaRipassoStato, pianoDelGiorno, puntiDelPiano, secondiPerPunto, statiRipasso, datiPiano.
// Le parti pure stanno in cima (test/ripasso.test.js).

/* =================================================================== parti pure */

const RG_PUNTI = 5;            // «Dieci minuti»: 5 punti a 2 minuti (come il piano senza misure)
const RG_BUONO = 8, RG_SCARSO = 5; // come statoDaMedia
const GIORNI_CALENDARIO = 7;   // una verifica o interrogazione entro una settimana entra nel consiglio
const NUMERI_IT = ["zero", "un", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"];

// «oggi», «domani», «mercoledì», oltre la settimana «il 30 novembre».
function giornoScadenzaIt(data, oggi) {
  const g = giorniFra(oggi, data), d = new Date(data + "T12:00:00Z");
  if (g === 0) return "oggi";
  if (g === 1) return "domani";
  return g < 7 ? d.toLocaleDateString("it-IT", { weekday: "long", timeZone: "UTC" })
    : "il " + d.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
}

// Cosa fare adesso su un argomento: { chiave: ripassa | verifica | interroga, motivo }.
// Mai provato → ripasso; molti rossi → ripasso; interrogazione in calendario → interrogami;
// quasi tutto verde → verifica; altrimenti il ripasso, se c'è qualcosa da sistemare.
function consiglioArgomento(a, scadenze, oggi) {
  const c = contaStati(a), tot = c.verde + c.giallo + c.rosso + c.mai;
  if (!tot) return { chiave: "verifica", motivo: "" };
  const s = (scadenze || []).map((x) => ({ ...x, giorni: giorniFra(oggi, x.data) }))
    .filter((x) => x.giorni >= 0 && x.giorni <= GIORNI_CALENDARIO &&
      (x.argomento_id ? x.argomento_id === a.id : piattaMateria(x.materia) === piattaMateria(a.materia)))
    .sort((x, y) => x.giorni - y.giorni)[0];
  const quando = s ? (s.tipo === "orale" ? "l'interrogazione" : "la verifica") + " è " + giornoScadenzaIt(s.data, oggi) : "";
  const ripasso = (perche) => ({ chiave: "ripassa", motivo: "Io partirei dal ripasso: " + perche + "." });
  if (c.mai === tot) return ripasso("non hai ancora provato nessun punto");
  if (c.rosso >= 2 || c.rosso * 3 >= tot)
    return ripasso("hai " + (NUMERI_IT[c.rosso] || c.rosso) + (c.rosso === 1 ? " punto rosso" : " punti rossi") + (s ? " e " + quando : ""));
  if (s && s.tipo === "orale") return { chiave: "interroga", motivo: "Io mi farei interrogare: " + quando + "." };
  if (c.verde / tot >= 0.8)
    return { chiave: "verifica", motivo: "Io farei la verifica: " + (c.verde === tot ? "li sai tutti" : c.verde + " punti su " + tot + " li sai") + (s ? ", e " + quando : "") + "." };
  const da = tot - c.verde;
  if (da) return ripasso((da === 1 ? "un punto non lo sai" : da + " punti non li sai") + " ancora del tutto" + (s ? ", e " + quando : ""));
  return { chiave: "verifica", motivo: "" };
}

// I punti di un ripasso dall'argomento: prima i rossi, poi Quasi, mai provati, verdi; a pari stato i più pesanti.
function puntiDaRipassare(concetti, n = RG_PUNTI) {
  return (concetti || []).map((c, i) => ({ c, i }))
    .sort((x, y) => ORDINE_STATO[statoValido(x.c.stato)] - ORDINE_STATO[statoValido(y.c.stato)] || (y.c.peso || 2) - (x.c.peso || 2) || x.i - y.i)
    .slice(0, n).map((x) => x.c.id);
}

// La sessione è una coda di passi: una prova per punto e in fondo «Spiegalo con parole tue».
function codaIniziale(ids) {
  return [...(ids || []).map((id) => ({ concetto_id: id, tipo: "prova" })), { concetto_id: null, tipo: "parole" }];
}
// Dopo la prima prova di un punto: se non è riuscito (sotto 8) torna dopo altri due punti,
// sempre prima di «parole tue». Una volta sola: il ritorno non torna.
function dopoEsito(coda, i, punti) {
  const p = coda[i];
  if (!p || p.tipo !== "prova" || punti >= RG_BUONO) return coda;
  const fondo = coda.findIndex((x) => x.tipo === "parole");
  const dove = Math.min(i + 3, fondo < 0 ? coda.length : fondo);
  return [...coda.slice(0, dove), { concetto_id: p.concetto_id, tipo: "ritorno" }, ...coda.slice(dove)];
}
// «Spiegalo con parole tue» sul punto andato meglio (a parità il più recente).
function concettoParoleTue(fatti) {
  const prove = (fatti || []).filter((f) => f.tipo !== "parole");
  return prove.reduce((m, f) => (!m || f.punti >= m.punti ? f : m), null)?.concetto_id || null;
}
function domandaParoleTue(c) {
  return { id: "d1", tipo: "aperta", testo: "Spiega «" + c.titolo + "» con parole tue, come a un'amica o un amico.",
    risposta_attesa: [c.ancora, c.descrizione].filter(Boolean).join(". "), elementi: [], ancora: c.ancora || "" };
}

function esitoRipasso(punti) {
  if (punti < RG_SCARSO) return { stato: "rosso", testo: "Non ancora. Ora lo leggiamo insieme." };
  if (punti < RG_BUONO) return { stato: "giallo", testo: "Quasi. Guarda cosa manca." };
  return { stato: "verde", testo: "Ci sei." };
}
const barraRipasso = (i, coda) => i + 1 + " di " + coda.length;

const elencoTitoli = (t) => (t.length < 2 ? t.join("") : t.slice(0, -1).join(", ") + " e " + t.at(-1));

// Fine sessione. fatti: [{ concetto_id, tipo, punti, sicurezza }]; prima: { id: stato }; titoli: { id: titolo };
// inizio e fine in millisecondi. Lo stato dopo è la media delle risposte sul punto (prova e ritorno).
function riepilogoRipasso({ fatti, prima, titoli, inizio, fine }) {
  const per = {};
  (fatti || []).filter((f) => f.tipo !== "parole").forEach((f) => { (per[f.concetto_id] = per[f.concetto_id] || []).push(f.punti); });
  const punti = Object.keys(per).map((id) => {
    const media = Math.round((per[id].reduce((s, x) => s + x, 0) / per[id].length) * 10) / 10;
    return { concetto_id: id, titolo: (titoli || {})[id] || "", prima: statoValido((prima || {})[id]), dopo: statoDaMedia(media), media };
  });
  const sistemato = punti.find((p) => p.prima === "rosso" && p.dopo === "verde");
  const sicuri = [...new Set((fatti || []).filter((f) => f.tipo === "prova" && f.sicurezza === "ci" && f.punti < RG_SCARSO).map((f) => f.concetto_id))]
    .map((id) => "«" + ((titoli || {})[id] || "") + "»");
  return {
    minuti: Math.max(1, Math.round((fine - inizio) / 60000)), punti,
    complimento: sistemato ? "«" + sistemato.titolo + "» era da ripassare, adesso lo sai." : null,
    sicuri: sicuri.length ? "Su " + elencoTitoli(sicuri) + " eri a colpo sicuro, ma non ci hai preso: domani " +
      (sicuri.length === 1 ? "lo rivediamo per primo." : "li rivediamo per primi.") : null,
  };
}
// «Domani, 8 minuti: A, B e C.» dal piano del giorno dopo.
function rigaDomani(p) {
  return p && p.punti.length ? "Domani, " + minutiIt(p.minuti) + ": " + elencoTitoli(p.punti.map((x) => x.titolo)) + "." : "";
}

/* =================================================================== nel browser */

let rg = null; // la sessione in corso

// La riga di consiglio dell'hub e le tre scelte con la consigliata in cima.
function disegnaConsiglio(a) {
  const c = consiglioArgomento(a, datiPiano.scadenze, giornoDi(new Date()));
  $("consiglio-scheda").textContent = c.motivo;
  $("consiglio-scheda").hidden = !c.motivo;
  disegnaScelte(a, c.chiave);
}

// Punto d'ingresso pubblico: dall'hub, da «Parti» del piano (#20) e da «Ora provami su queste 5» (#22).
// Torna false se nessuno degli id è un punto della libreria.
function avviaRipassoGuidato(concettiIds) {
  const conc = {};
  argomenti.forEach((a) => (a.concetti || []).forEach((c) => { conc[c.id] = { c, a }; }));
  const ids = [...new Set(concettiIds || [])].filter((id) => conc[id]);
  if (!ids.length) return false;
  const args = [...new Set(ids.map((id) => conc[id].a))];
  rg = { coda: codaIniziale(ids), i: 0, fatti: [], conc, args, inizio: Date.now(), gia: {}, sintesi: {},
    prima: Object.fromEntries(ids.map((id) => [id, statoValido(conc[id].c.stato)])),
    titoli: Object.fromEntries(ids.map((id) => [id, conc[id].c.titolo])) };
  vai("guidato", args.length === 1 ? args[0].materia : null, args.length === 1 ? args[0].titolo : "Ripasso");
  caricaSintesiRipasso(args);
  mostraPasso();
  return true;
}

// «In due righe»: la sintesi già fatta per la mappa. Se non c'è, il riquadro non compare.
async function caricaSintesiRipasso(args) {
  const mio = rg;
  try {
    const { data } = await sb.from("mappe").select("albero").in("argomento_id", args.map((a) => a.id));
    (data || []).forEach((m) => ((m.albero && m.albero.nodi) || []).forEach((n) => {
      if (n.fonte !== "web" && typeof n.sintesi === "string" && n.sintesi.trim()) mio.sintesi[n.id] = n.sintesi.trim();
    }));
  } catch (e) { /* senza sintesi si ripassa lo stesso */ }
}

// La domanda di un passo, chiesta una volta sola (anche in anticipo, mentre si risponde al passo prima).
function domandaDelPasso(p) {
  if (p.domanda) return Promise.resolve(p.domanda);
  if (!p._attesa) {
    const { a } = rg.conc[p.concetto_id];
    p._attesa = conRiprova(() => modello({ azione: "domande", argomenti: [a.id], concetti: [p.concetto_id], livello: "medio", tipo: "aperte",
      modalita: "scritta", una_aperta: true, diverse_da: rg.gia[p.concetto_id] || [] }))
      .then((r) => (p.domanda = r.domande[0]), (e) => { p._attesa = null; throw e; });
  }
  return p._attesa;
}

function mostraPasso() {
  const p = rg.coda[rg.i];
  document.querySelector(".rg-barra").hidden = false;
  $("rg-conta").textContent = barraRipasso(rg.i, rg.coda);
  $("rg-prog").style.width = Math.round((rg.i / rg.coda.length) * 100) + "%";
  errore($("err-rg"), "");
  rg.sicurezza = null;
  if (p.tipo === "parole") {
    p.concetto_id = concettoParoleTue(rg.fatti);
    if (!p.concetto_id) { fineRipasso(); return; } // nessun punto riuscito a partire: niente da spiegare
    p.domanda = domandaParoleTue(rg.conc[p.concetto_id].c);
    disegnaDomanda(p); return;
  }
  $("rg-passo").innerHTML = "";
  attesa($("stato-rg"), p.tipo === "ritorno" ? ["Ti preparo un'altra domanda su questo punto"] : ["Preparo la domanda", "Controllo che nasca dai tuoi appunti"]);
  domandaDelPasso(p).then(() => {
    if (rg && rg.coda[rg.i] === p) { attesa($("stato-rg"), null); disegnaDomanda(p); }
  }, (e) => {
    if (!rg || rg.coda[rg.i] !== p) return;
    attesa($("stato-rg"), null);
    errore($("err-rg"), e.message === "nessuna_ancorata"
      ? "Su questo punto gli appunti sono troppo pochi per una domanda. Passiamo al prossimo."
      : messaggioModello(e, "Non sono riuscito a preparare la domanda. Riprova fra un momento."));
    $("rg-passo").innerHTML = (e.message === "nessuna_ancorata" ? "" : '<button type="button" class="azione" data-azione="riprova">Riprova</button>') +
      '<button type="button" class="minore" data-azione="salta">Salta questo punto</button>';
  });
  const dopo = rg.coda[rg.i + 1];
  if (dopo && dopo.tipo !== "parole") domandaDelPasso(dopo).catch(() => {}); // pronta per il passo dopo
}

function disegnaDomanda(p) {
  const d = p.domanda;
  (rg.gia[p.concetto_id] = rg.gia[p.concetto_id] || []).push(d.testo);
  const occhiello = { prova: "Prima prova tu, senza guardare.", ritorno: "Ci riproviamo, con un'altra domanda.", parole: "Adesso spiegalo tu." }[p.tipo];
  $("rg-passo").innerHTML = '<p class="occhiello">' + occhiello + '</p><h2 class="rg-domanda" id="rg-domanda">' + esc(d.testo) + "</h2>" +
    (p.tipo === "prova" ? '<div class="rg-sicuro" role="group" aria-labelledby="rg-chiedi"><p id="rg-chiedi">Secondo te, ci prendi?</p>' +
      [["ci", "Ci prendo"], ["forse", "Forse"], ["caso", "Vado a caso"]].map(([k, t]) =>
        '<button type="button" data-sicurezza="' + k + '" aria-pressed="false">' + t + "</button>").join("") + "</div>" : "") +
    '<div id="rg-rispondi"' + (p.tipo === "prova" ? " hidden" : "") + ">" +
    '<textarea id="rg-risposta" aria-labelledby="rg-domanda" placeholder="' + (p.tipo === "parole" ? "Spiegalo come lo diresti tu" : "Scrivi quello che ti ricordi") + '"></textarea>' +
    (Riconoscimento ? '<button type="button" class="minore" data-azione="voce">Rispondi a voce</button>' : "") +
    '<button type="button" class="azione" data-azione="fatto">Fatto</button>' +
    '<button type="button" class="link" data-azione="non-ricordo">Non mi ricordo</button></div>';
  p._inizio = Date.now();
  if (p.tipo !== "prova") $("rg-risposta").focus();
}

async function rispondiAVoce(btn) {
  if (ascoltatore) { ascoltatore.stop(); return; } // secondo tocco: ho finito
  btn.textContent = "Ho finito di parlare";
  const detto = await ascolta(3500, "rg-risposta");
  fermaVoce();
  btn.textContent = "Rispondi a voce";
  if (detto === null) errore($("err-rg"), messaggioVoce(erroreVoce));
  else if (detto) $("rg-risposta").value = detto;
}

async function correggiPasso(p, testo) {
  const { c, a } = rg.conc[p.concetto_id], d = p.domanda;
  const secondi = Math.round((Date.now() - (p._inizio || Date.now())) / 1000);
  let es;
  if (!testo) es = esitoAperta(d, "");
  else {
    $("rg-passo").querySelectorAll("button, textarea").forEach((x) => { x.disabled = true; });
    attesa($("stato-rg"), ["Correggo la risposta", "Guardo se hai detto tutto e se è giusto"]);
    try {
      const val = (await conRiprova(() => modello({ azione: "correggi", modalita: "scritta", materia: a.materia, pacchetto: [
        { id: d.id, domanda: d.testo, risposta_attesa: d.risposta_attesa, elementi: d.elementi || [], risposta_alunna: testo }] }))).valutazioni || [];
      es = esitoAperta(d, testo, val.find((x) => x.id === d.id));
    } catch (e) {
      console.warn("correzione del ripasso non riuscita:", e && e.message);
      es = esitoAperta(d, testo, null); // vale 5 e dice di confrontarla da sé, come nella verifica
    }
    attesa($("stato-rg"), null);
  }
  const f = { concetto_id: p.concetto_id, tipo: p.tipo, punti: es.punti, sicurezza: p.tipo === "prova" ? rg.sicurezza : null,
    domanda: d, testo, commento: es.commento, rubrica: es.rubrica || null, secondi };
  rg.fatti.push(f);
  // Solo la prima prova dice quanto ricordava: è quella che decide quando rivedere il punto.
  if (p.tipo === "prova") salvaRipassoStato(sb, [{ concetto_id: p.concetto_id, media: es.punti }], { [p.concetto_id]: rg.sicurezza }, giornoDi(new Date()));
  rg.coda = dopoEsito(rg.coda, rg.i, es.punti);
  disegnaEsitoPasso(p, f, c);
}

function disegnaEsitoPasso(p, f, c) {
  const e = esitoRipasso(f.punti), ancora = (f.domanda.ancora || c.ancora || "").trim(), sintesi = rg.sintesi[c.id];
  $("rg-passo").innerHTML = '<p class="rg-domanda-fatta">' + esc(f.domanda.testo) + "</p>" +
    (f.testo ? '<p class="rg-mia"><b>Hai risposto:</b> ' + esc(f.testo) + "</p>" : "") +
    '<p class="corr-esito"><span class="sem" data-s="' + e.stato + '"><i aria-hidden="true">' + segnoStato(e.stato) + "</i> " + esc(e.testo) + "</span></p>" +
    (f.commento ? '<p class="corr-commento">' + esc(f.commento) + "</p>" : "") +
    (ancora ? '<p class="occhiello">Sul tuo quaderno c\'è scritto così</p><p class="corr-quaderno">' + evidenzia(ancora) + "</p>" : "") +
    (sintesi ? '<p class="occhiello">In due righe</p><p class="rg-sintesi">' + esc(sintesi) + "</p>" : "") +
    (c.errore_appunti ? '<span class="errore-appunti">' + esc(notaQuaderno(c.errore_appunti)) + "</span>" : "") +
    '<div class="rg-bottoni"><button type="button" class="azione" data-azione="avanti">Ok, chiaro. Avanti</button>' +
    '<button type="button" class="minore" data-azione="spiega">Spiegamelo in un altro modo</button></div>';
  window.scrollTo(0, 0);
}

function spiegaPasso() {
  const f = rg.fatti.at(-1), { c, a } = rg.conc[f.concetto_id];
  apriSpiegazione({ concetto_id: c.id, titolo: c.titolo, ancora: c.ancora, materia: a.materia,
    ...(f.punti < RG_BUONO ? { errore: { domanda: f.domanda.testo, risposta_alunna: f.testo, risposta_attesa: f.domanda.risposta_attesa } } : {}) });
}

function avantiRipasso() {
  rg.i++;
  if (rg.i >= rg.coda.length) fineRipasso(); else { mostraPasso(); window.scrollTo(0, 0); }
}

async function fineRipasso() {
  const s = rg, r = riepilogoRipasso({ fatti: s.fatti, prima: s.prima, titoli: s.titoli, inizio: s.inizio, fine: Date.now() });
  document.querySelector(".rg-barra").hidden = true;
  attesa($("stato-rg"), null); errore($("err-rg"), "");
  // Gli stati nuovi in memoria prima del piano di domani.
  r.punti.forEach((p) => { const c = s.conc[p.concetto_id].c; c.media = p.media; c.stato = p.dopo; c.tentativi = (c.tentativi || 0) + 1; });
  const domani = giornoPiu(giornoDi(new Date()), 1);
  const pd = pianoDelGiorno(puntiDelPiano(argomenti, statiRipasso), datiPiano.scadenze, domani, secondiPerPunto(datiPiano.secondi));
  const riga = rigaDomani(pd);
  $("rg-passo").innerHTML = '<h2 class="rg-fine">Per oggi basta.</h2><p class="rg-minuti">Hai ripassato per ' + minutiIt(r.minuti) + ".</p>" +
    (r.complimento ? '<p class="rg-complimento">' + esc(r.complimento) + "</p>" : "") +
    (r.punti.length ? '<ul class="rg-elenco">' + r.punti.map((p) => "<li><b>" + esc(p.titolo) + '</b><span class="rg-stati"><small>prima</small>' +
      htmlStato(p.prima) + "<small>adesso</small>" + htmlStato(p.dopo) + "</span></li>").join("") + "</ul>" : "") +
    (r.sicuri ? '<div class="avviso">' + esc(r.sicuri) + "</div>" : "") +
    (riga ? '<p class="rg-domani">' + esc(riga) + "</p>" : "") +
    '<div class="rg-bottoni"><button type="button" class="azione" data-azione="finito">Ho finito per oggi</button>' +
    (s.args.length === 1 ? '<button type="button" class="minore" data-azione="verifica">Provo subito la verifica</button>' : "") + "</div>" +
    '<div id="avviso-rg"></div>';
  window.scrollTo(0, 0);
  const ok = await salvaRipassoGuidato(s, r);
  if (!ok && $("avviso-rg")) avviso($("avviso-rg"), "Questo ripasso non è entrato nei Risultati. Quello che vedi qui resta valido.");
}

// Nei Risultati come sessione di tipo ripasso. Torna false se non si salva (per esempio prima della
// migration che ammette il tipo): il ripasso a schermo resta, gli stati dei punti si scrivono lo stesso.
async function salvaRipassoGuidato(s, r) {
  if (!s.fatti.length) return true;
  let ok = true;
  try {
    await Promise.all(r.punti.map((p) => { const c = s.conc[p.concetto_id].c;
      return sb.from("concetti").update({ media: c.media, stato: c.stato, tentativi: c.tentativi }).eq("id", c.id); }));
    const prove = s.fatti.filter((f) => f.tipo !== "parole");
    const indice = prove.length ? Math.round((prove.reduce((t, f) => t + f.punti, 0) / prove.length) * 10) : 0;
    const { materia } = titoloEMateria(s.args, s.args.length > 1);
    const { data: ses, error } = await sb.from("sessioni").insert({
      argomento_id: s.args.length === 1 ? s.args[0].id : null, titolo: s.args.length === 1 ? s.args[0].titolo : "Ripasso guidato", materia,
      livello: "medio", tipo: "ripasso", modalita: "scritta", indice, voto: voto(indice),
      n_domande: s.fatti.length, n_errori: s.fatti.filter((f) => f.punti < RG_BUONO).length, scartate: 0,
    }).select("id").single();
    if (error) throw error;
    const { data: ds, error: e2 } = await sb.from("domande").insert(s.fatti.map((f, i) => {
      const { c, a } = s.conc[f.concetto_id];
      return { sessione_id: ses.id, argomento_id: a.id, concetto_id: c.id, concetto_titolo: c.titolo, ordine: i + 1, tipo: "aperta", livello: "medio",
        testo: f.domanda.testo, opzioni: null, corretta: null, risposta_attesa: f.domanda.risposta_attesa || c.ancora || c.titolo,
        elementi: f.domanda.elementi || [], ancora: f.domanda.ancora || c.ancora || "" };
    })).select("id, ordine");
    if (e2) throw e2;
    const idPer = Object.fromEntries(ds.map((x) => [x.ordine, x.id]));
    const { error: e3 } = await sb.from("risposte").insert(s.fatti.map((f, i) => ({
      sessione_id: ses.id, domanda_id: idPer[i + 1], testo: f.testo || null, scelta: null, punteggio: f.punti,
      dettaglio_rubrica: f.rubrica, commento: f.commento, secondi: f.secondi, guidata: false })));
    if (e3) throw e3;
  } catch (e) {
    console.warn("ripasso non salvato:", e && (e.message || e.code));
    ok = false;
  }
  caricaLibreria(); // stati e Risultati aggiornati per quando torna a Oggi
  return ok;
}

function collegaRipasso() {
  $("btn-altro-stampa").addEventListener("click", () => $("btn-stampa-verifica").click());
  $("v-guidato").addEventListener("click", (e) => {
    if (!rg) return;
    const s = e.target.closest("[data-sicurezza]");
    if (s) {
      rg.sicurezza = s.dataset.sicurezza;
      document.querySelectorAll("[data-sicurezza]").forEach((b) => b.setAttribute("aria-pressed", String(b === s)));
      $("rg-rispondi").hidden = false; $("rg-risposta").focus();
      return;
    }
    const b = e.target.closest("[data-azione]");
    if (!b) return;
    const p = rg.coda[rg.i], azione = b.dataset.azione;
    if (azione === "fatto") {
      const t = $("rg-risposta").value.trim();
      if (!t) { errore($("err-rg"), "Scrivi quello che ti ricordi, oppure tocca Non mi ricordo."); return; }
      if (ascoltatore) ascoltatore.stop();
      errore($("err-rg"), ""); correggiPasso(p, t);
    } else if (azione === "non-ricordo") { if (ascoltatore) ascoltatore.stop(); errore($("err-rg"), ""); correggiPasso(p, ""); }
    else if (azione === "voce") rispondiAVoce(b);
    else if (azione === "avanti" || azione === "salta") avantiRipasso();
    else if (azione === "riprova") mostraPasso();
    else if (azione === "spiega") spiegaPasso();
    else if (azione === "finito") { rg = null; disegnaLibreria(); vai("libreria"); }
    else if (azione === "verifica") { corrente = rg.args[0]; modo = "argomento"; modalita = "scritta"; rg = null; apriPrepara(); }
  });
}
