// «Aiutami con un compito» (issue #27): foto dell'esercizio, Ho letto così, indizi a gradini,
// soluzione passo per passo già ricalcolata dal server, domande sulla spiegazione.
// Script classico caricato dopo esercizi.js: usa $, esc, evidenzia, formulaHtml, htmlEsercizio,
// modello, conRiprova, messaggioModello, ridimensiona, base64, attesa, errore, avviso, vai,
// apriFoglio, chiudiFoglio, leggiLocale, salvaLocale, profilo. Niente sul database: i compiti
// restano nella sessione e gli ultimi 5 in localStorage.

/* =================================================================== parti pure */

const MAX_COMPITI = 5;
const chiaveCompiti = (id) => "verifiche-compiti-" + id;
const MSG_CONTI = "Su questo esercizio i conti non mi tornano del tutto. Chiedi alla prof o riprova con una foto più nitida.";
const MSG_CONTI_DOMANDA = "Su questa domanda i conti non mi tornano. Prova a chiederla con altre parole.";

// Un indizio alla volta: non si va oltre quelli che ci sono.
const prossimoIndizio = (mostrati, totale) => Math.min(totale, mostrati + 1);

// Gli indizi già chiesti e cosa si può fare dopo. Il link alla soluzione c'è sempre.
// provo: «Ho capito, provo io», e allora niente altri indizi in vista.
function htmlIndizi(c, mostrati, provo = false) {
  const tot = (c.indizi || []).length;
  const visti = (c.indizi || []).slice(0, mostrati).map((t, i) =>
    '<li class="indizio"><span class="occhiello">Indizio ' + (i + 1) + "</span><p>" + esc(t) + "</p></li>").join("");
  let azioni;
  if (provo) azioni = "";
  else if (!mostrati) azioni = tot ? '<button type="button" class="azione" data-azione="indizio">Dammi un indizio</button>' : "";
  else azioni = '<button type="button" class="minore" data-azione="provo">Ho capito, provo io</button>' +
    (mostrati < tot ? '<button type="button" class="minore" data-azione="indizio">Un altro indizio</button>' : "");
  return (visti ? '<ol class="indizi">' + visti + "</ol>" : "") +
    '<div class="bottoni">' + azioni + "</div>" +
    '<p class="link-riga"><button type="button" class="link" data-azione="soluzione">Fammi vedere tutta la soluzione</button></p>';
}

// Il calcolo come lo scrive il server («1/6 + 2/9 = 7/18») in LaTeX per formule.js.
function calcoloLatex(s) {
  return String(s || "")
    .replace(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g, "\\frac{$1}{$2}")
    .replace(/×/g, "\\times").replace(/\s:\s/g, " \\div ").replace(/·/g, "\\cdot")
    .replace(/\s*€/g, "\\text{ €}");
}
const formulaCalcolo = (s) => '<span class="riga-formula">' + formulaHtml(calcoloLatex(s)) + "</span>";

// Il testo letto con i dati importanti evidenziati (il testo è quello della foto). Tutto escapato.
const valoreDato = (d) => String(d && typeof d === "object" ? d.valore || "" : d || "").trim();
function htmlTestoConDati(testo, dati) {
  const voci = [...new Set((dati || []).map(valoreDato).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!voci.length) return esc(testo);
  // Un dato non si evidenzia dentro un numero più lungo («6» non dentro «1260»).
  const re = new RegExp("(?<![\\d.,/])(?:" + voci.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![\\d,/]|\\.\\d)", "g");
  let fuori = "", da = 0;
  String(testo).replace(re, (m, i) => { fuori += esc(String(testo).slice(da, i)) + evidenzia(m); da = i + m.length; return m; });
  return fuori + esc(String(testo).slice(da));
}

// «Cosa sai»: ogni dato con il suo significato (1/6: la parte spesa per gli anelli).
function htmlSai(dati) {
  return (dati || []).map((d) => { const v = valoreDato(d), s = d && typeof d === "object" ? String(d.significato || "").trim() : "";
    return v ? "<li><b>" + esc(v) + "</b>" + (s ? ": " + esc(s) : "") + "</li>" : ""; }).join("");
}

const risultatoIt = (r) => (r && r.valore ? r.valore + (r.unita ? " " + r.unita : "") : "");

// Passi numerati (toccandone uno si chiede di spiegarlo), risultato, verifica, il trucco.
function htmlSoluzioneCompito(c) {
  const passi = (c.passi || []).map((p, i) =>
    '<li class="passo" data-passo="' + (i + 1) + '"><button type="button" class="passo-tocca" data-passo="' + (i + 1) + '"><span class="solo-lettore">Spiegami il passo ' + (i + 1) + ": </span>" +
    "<b>" + esc(p.titolo) + "</b>" + (p.spiegazione ? "<span>" + esc(p.spiegazione) + "</span>" : "") +
    (p.ancora ? '<span class="dal-quaderno">Sul tuo quaderno: ' + evidenzia(p.ancora) + "</span>" : "") +
    (p.calcolo ? formulaCalcolo(p.calcolo) : "") + "</button></li>").join("");
  const s = c.strategia || {};
  const controlli = (c.verifica && c.verifica.controlli) || (c.verifica && c.verifica.calcolo ? [{ testo: "", calcolo: c.verifica.calcolo }] : []);
  return (c.libro_diverso ? '<p class="avviso">Il libro dice ' + esc(c.soluzione_libro) + ", io ottengo " + esc(risultatoIt(c.risultato)) + ": controlliamo insieme il testo.</p>" : "") +
    (s.nome ? '<div class="strategia"><p>Strategia: <b>' + esc(s.nome) + "</b></p>" + (s.perche ? "<p>" + esc(s.perche) + "</p>" : "") + "</div>" : "") +
    '<ol class="passi-compito">' + passi + "</ol>" +
    (risultatoIt(c.risultato) ? '<p class="risultato-compito">Risultato: <b>' + esc(risultatoIt(c.risultato)) + "</b></p>" : "") +
    (c.verifica && (c.verifica.spiegazione || controlli.length) ? '<div class="verifica-compito"><p class="occhiello">Verifica</p>' +
      (c.verifica.spiegazione ? "<p>" + esc(c.verifica.spiegazione) + "</p>" : "") +
      '<ul class="controlli">' + controlli.map((x) => '<li class="controllo"><span class="spunta" aria-hidden="true">✓</span><span>' + (x.testo ? esc(x.testo) : "") +
        formulaCalcolo(x.calcolo) + "</span></li>").join("") + "</ul></div>" : "") +
    (c.trucco ? '<div class="trucco"><p class="occhiello">Il trucco da ricordare</p><p>' + esc(c.trucco) + "</p></div>" : "");
}

// «Prova tu»: la mini-domanda con un campo per la risposta (numero o frazione).
function htmlProvaTu(p, id) {
  if (!p || !p.testo) return "";
  return '<div class="prova-tu-box"><label for="' + id + '"><b>Prova tu:</b> ' + esc(p.testo) + "</label>" +
    '<div class="prova-riga"><input type="text" id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="La tua risposta">' +
    '<button type="button" class="minore" data-azione="controlla" data-pt="' + id + '">Controlla</button></div>' +
    '<div class="prova-esito" id="' + id + '-esito" aria-live="polite"></div></div>';
}
// Esito dal calcolo del server: «Ci sei» o «Non ancora: guarda il passo N» con come si fa.
function htmlEsitoProvaTu(r, p) {
  if (r.giusto) return '<p><span class="sem" data-s="verde"><i aria-hidden="true">●</i> Ci sei</span>' +
    (r.esito === "senza_unita" ? " Il numero è giusto, manca l'unità: " + esc(p.risultato.unita) + "." : "") + "</p>";
  const cosa = r.esito === "vuota" ? "Scrivi la tua risposta, poi tocca Controlla." : (r.esito === "non_numerica" ? "Scrivi solo il numero o la frazione." : "");
  return '<p><span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Non ancora' + (p.passo && !cosa ? ": guarda il passo " + p.passo : "") + "</span></p>" +
    (cosa ? "<p>" + esc(cosa) + "</p>" : (p.spiegazione ? "<p>" + esc(p.spiegazione) + "</p>" : ""));
}

// Barra divisa in parti uguali, le prime `colorate` piene: le frazioni come fette.
function svgBarraFrazioni(f) {
  if (!f || !(f.parti >= 1)) return "";
  const w = 300, h = 40, lato = w / f.parti;
  const parti = Array.from({ length: f.parti }, (_, i) =>
    '<rect x="' + (i * lato).toFixed(2) + '" y="0" width="' + lato.toFixed(2) + '" height="' + h + '"' + (i < f.colorate ? ' data-colorata="1"' : "") + "/>").join("");
  return '<figure class="barra-frazioni"><svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc((f.etichetta || f.colorate + " su " + f.parti)) + '">' + parti + "</svg>" +
    (f.etichetta ? "<figcaption>" + esc(f.etichetta) + "</figcaption>" : "") + "</figure>";
}

// Una risposta alla domanda: testo, conti in formula, la barra se c'è, il «Prova tu».
function htmlRisposta(r, id) {
  return "<p>" + esc(r.risposta) + "</p>" + (r.calcoli || []).map(formulaCalcolo).join("") + svgBarraFrazioni(r.figura) + htmlProvaTu(r.prova_tu, id);
}

// Gli ultimi 5 compiti, il più recente in cima; lo stesso testo non si ripete.
function salvaCompito(lista, c, quando) {
  return [{ quando, compito: c }, ...(lista || []).filter((x) => x && x.compito && x.compito.testo !== c.testo)].slice(0, MAX_COMPITI);
}
const stessoGiorno = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const compitiDiOggi = (lista, oggi) => (Array.isArray(lista) ? lista : []).filter((x) => x && x.compito && x.compito.testo && x.quando && stessoGiorno(new Date(x.quando), oggi));

/* ---- segnali di difficoltà, esercizi mirati, ripasso 1-3-7 (aggiunte di Roby) ---- */

// I 1-3 concetti con più segnali: indizi chiesti e domande su un passo, «Prova tu» sbagliati o saltati.
function concettiDifficili(segnali, passi) {
  const perConcetto = new Map();
  (segnali || []).forEach((x) => {
    if (!x || !(x.passo >= 1) || (x.tipo === "prova" && x.esito === "giusto")) return;
    const p = (passi || [])[x.passo - 1]; if (!p) return;
    const k = String(p.concetto || p.titolo || "").trim(); if (!k) return;
    const v = perConcetto.get(k) || { concetto: k, passo: x.passo, segnali: 0 };
    v.segnali++; v.passo = Math.min(v.passo, x.passo); perConcetto.set(k, v);
  });
  return [...perConcetto.values()].sort((a, b) => b.segnali - a.segnali || a.passo - b.passo).slice(0, 3);
}
// Complimento preciso solo se è vero: 3 su 3.
function esitoAllenamento(concetto, esiti) {
  const giusti = (esiti || []).filter(Boolean).length;
  return giusti === 3 && esiti.length === 3 ? "«" + concetto + "» adesso lo sai fare: 3 su 3."
    : giusti + " su 3: rifai quello segnato Non ancora, poi provane uno in più.";
}
// Ripasso: un gemello nuovo dopo 1, 3 e 7 giorni; un errore fa ripartire da 1. Giorni di Roma.
const giornoDi = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
const fraGiorni = (ora, g) => giornoDi(new Date(ora.getTime() + g * 86400000));
function nuovoRipasso(c, ora) {
  return { id: String(ora.getTime()), compito: c, giorni: 1, prossimo: fraGiorni(ora, 1), finito: false };
}
function aggiornaRipasso(v, giusto, ora) {
  if (!giusto) return { ...v, giorni: 1, prossimo: fraGiorni(ora, 1) };
  if (v.giorni >= 7) return { ...v, finito: true };
  const giorni = v.giorni === 1 ? 3 : 7;
  return { ...v, giorni, prossimo: fraGiorni(ora, giorni) };
}
const ripassiDovuti = (lista, ora) => (Array.isArray(lista) ? lista : []).filter((v) => v && !v.finito && v.compito && v.prossimo && v.prossimo <= giornoDi(ora));

/* =================================================================== nel browser */

// Le formule si disegnano con KaTeX appena arriva; finché non c'è restano leggibili come testo.
const formuleIn = (id) => caricaKatex().then((ok) => { if (ok) rendiFormule($(id)); });

let compito = null, fotoCompito = [], immaginiCompito = [], indiziMostrati = 0, provoIo = false, chatCompito = [], simili = [], simileOra = 0;
let compitoOccupato = false; // una richiesta al modello alla volta

function apriCompito() {
  compito = null; fotoCompito = []; immaginiCompito = []; indiziMostrati = 0; chatCompito = []; simili = [];
  ["cp-scegli", "cp-letto", "cp-aiuto", "cp-allenati"].forEach((id) => { $(id).hidden = true; });
  $("cp-foto").hidden = false; $("cp-testo").value = ""; disegnaFotoCompito();
  errore($("err-cp"), ""); attesa($("stato-cp"), null); $("cp-chiedi").hidden = true;
  caricaKatex(); // in anticipo: quando arriva la soluzione probabilmente è già pronto
  vai("compito");
}
function disegnaFotoCompito() {
  $("cp-conta-foto").textContent = fotoCompito.length ? fotoCompito.length + (fotoCompito.length === 1 ? " foto" : " foto") + ": puoi aggiungerne altre." : "Una foto dell'esercizio basta.";
}

async function leggiCompito(extra = {}) {
  if (compitoOccupato) return;
  const scritto = $("cp-testo").value.trim();
  errore($("err-cp"), "");
  if (!fotoCompito.length && scritto.length < 20 && !extra.testo) { errore($("err-cp"), "Fotografa l'esercizio, oppure scrivi il testo qui sotto."); return; }
  $("btn-cp-leggi").disabled = true; compitoOccupato = true;
  attesa($("stato-cp"), extra.testo ? ["Rileggo il testo", "Rifaccio i conti uno per uno"] : ["Leggo l'esercizio", "Preparo gli indizi", "Rifaccio i conti uno per uno"]);
  try {
    if (!extra.testo && fotoCompito.length && !immaginiCompito.length)
      immaginiCompito = await Promise.all(fotoCompito.slice(0, 4).map(async (f) => base64(await ridimensiona(f))));
    const corpo = extra.testo ? { azione: "compito", testo: extra.testo } : (scritto && !fotoCompito.length ? { azione: "compito", testo: scritto } : { azione: "compito", immagini: immaginiCompito });
    if (extra.esercizio) corpo.esercizio = extra.esercizio;
    const r = await conRiprovaEsercizi(() => modello(corpo));
    attesa($("stato-cp"), null); $("btn-cp-leggi").disabled = false; compitoOccupato = false;
    if (r.esercizi) { mostraScelta(r.esercizi); return; }
    compito = r; indiziMostrati = 0; provoIo = false; chatCompito = []; segnali = []; proveFatte = new Set();
    mostraLetto();
  } catch (e) {
    attesa($("stato-cp"), null); $("btn-cp-leggi").disabled = false; compitoOccupato = false;
    const m = e.message === "conti_non_tornano" ? MSG_CONTI
      : e.message === "nessun_esercizio" ? "Nella foto non trovo un esercizio. Riprova con una foto più vicina, oppure scrivi il testo."
      : messaggioModello(e, "Non sono riuscito a leggere l'esercizio. Riprova fra un momento.");
    errore($("err-cp"), m);
  }
}

// Più esercizi nella pagina: «Quale vuoi fare?»
function mostraScelta(esercizi) {
  const box = $("cp-elenco"); box.innerHTML = "";
  esercizi.forEach((e) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "scelta";
    b.innerHTML = "<b>" + esc(e.id ? e.id + " · " : "") + esc(e.inizio) + "…</b>";
    b.onclick = () => leggiCompito({ esercizio: (e.id ? e.id + " " : "") + e.inizio });
    box.appendChild(b);
  });
  $("cp-foto").hidden = true; $("cp-scegli").hidden = false;
}

function mostraLetto() {
  $("cp-foto").hidden = true; $("cp-scegli").hidden = true; $("cp-aiuto").hidden = true; $("cp-chiedi").hidden = true;
  $("cp-testo-letto").innerHTML = htmlTestoConDati(compito.testo, compito.dati);
  $("cp-libro").hidden = !compito.soluzione_libro;
  $("cp-libro").textContent = compito.soluzione_libro ? "Il libro dice: " + compito.soluzione_libro : "";
  $("cp-correggi").hidden = true; $("cp-testo-nuovo").value = compito.testo;
  $("cp-letto").hidden = false;
  window.scrollTo(0, 0);
}

function mostraAiuto() {
  $("cp-letto").hidden = true; $("cp-aiuto").hidden = false; $("cp-chiedi").hidden = false;
  $("cp-sai").innerHTML = htmlSai(compito.dati);
  $("cp-cerchi").textContent = compito.cerca || "";
  $("cp-blocco-sai").hidden = !(compito.dati || []).length && !compito.cerca;
  disegnaIndizi();
  $("cp-soluzione").hidden = true; $("cp-soluzione").innerHTML = "";
  disegnaChat();
  $("btn-cp-simile").hidden = !compito.matematica; $("btn-cp-gemelli").hidden = !compito.matematica; $("cp-allenati").hidden = true; $("cp-simile").innerHTML = ""; $("btn-cp-simile").textContent = "Fammi un esercizio simile"; simili = [];
  if (profilo) salvaLocale(chiaveCompiti(profilo.id), salvaCompito(leggiLocale(chiaveCompiti(profilo.id), []), compito, new Date().toISOString()));
  window.scrollTo(0, 0);
}
function disegnaIndizi() { $("cp-indizi").innerHTML = htmlIndizi(compito, indiziMostrati, provoIo); }
function mostraSoluzione() {
  $("cp-soluzione").innerHTML = '<h3 class="sez-titolo">La soluzione, passo per passo</h3>' + htmlSoluzioneCompito(compito) + htmlProvaTu(compito.prova_tu, "pt-sol");
  $("cp-soluzione").hidden = false;
  formuleIn("cp-soluzione");
  $("cp-soluzione").scrollIntoView({ block: "start" });
}

function disegnaChat() {
  $("cp-pronte").innerHTML = (compito.domande_pronte || []).map((d) => '<button type="button" class="chip-domanda" data-domanda="' + esc(d) + '">' + esc(d) + "</button>").join("");
  $("cp-chat").innerHTML = chatCompito.map((m, i) => m.chi === "io"
    ? '<p class="msg msg-io">' + esc(m.testo) + "</p>"
    : '<div class="msg msg-app">' + (m.risposta ? htmlRisposta(m.risposta, "pt-c" + i) : "<p>" + esc(m.testo) + "</p>") + "</div>").join("");
}
async function chiediSulCompito(domanda, passoNoto = 0) {
  domanda = String(domanda || "").trim();
  if (!domanda || !compito || compitoOccupato) return;
  compitoOccupato = true;
  const cronologia = chatCompito.map((m) => ({ chi: m.chi, testo: m.testo }));
  chatCompito.push({ chi: "io", testo: domanda }); disegnaChat();
  $("cp-domanda").value = ""; $("btn-cp-chiedi").disabled = true;
  attesa($("stato-chat"), ["Ci penso", "Rifaccio i conti"]);
  try {
    const r = await conRiprovaEsercizi(() => modello({ azione: "compito_domanda", compito, cronologia, domanda }));
    chatCompito.push({ chi: "app", testo: r.risposta, risposta: r });
    segnali.push({ tipo: "domanda", passo: passoNoto || r.passo || 0 });
  } catch (e) {
    chatCompito.push({ chi: "app", testo: e.message === "conti_non_tornano" ? MSG_CONTI_DOMANDA : messaggioModello(e, "Non sono riuscito a rispondere. Riprova fra un momento.") });
  }
  attesa($("stato-chat"), null); $("btn-cp-chiedi").disabled = false; compitoOccupato = false; disegnaChat(); formuleIn("cp-chat");
  const ultimo = $("cp-chat").lastElementChild; if (ultimo) ultimo.scrollIntoView({ block: "nearest" });
}

async function esercizioSimile() {
  if (simili.length > simileOra + 1) { simileOra++; $("cp-simile").innerHTML = htmlEsercizio(simili[simileOra], simileOra); formuleIn("cp-simile"); return; }
  const b = $("btn-cp-simile"); b.disabled = true;
  attesa($("stato-simile"), ["Preparo un esercizio simile", "Rifaccio i conti"]);
  try {
    const r = await conRiprovaEsercizi(() => modello({ azione: "esercizi_genera", modello: { testo: compito.testo }, quanti: 5 }));
    simili = r.esercizi || []; simileOra = 0;
    $("cp-simile").innerHTML = simili.length ? htmlEsercizio(simili[0], 0) : "";
    formuleIn("cp-simile");
    b.textContent = "Fammene un altro";
  } catch (e) {
    errore($("cp-simile"), messaggioModello(e, "Non sono riuscito a preparare un esercizio simile con i conti giusti. Riprova fra un momento."));
  }
  attesa($("stato-simile"), null); b.disabled = false;
}

// «I compiti di oggi» in Risultati: si riaprono senza chiamare il modello.
function disegnaCompitiOggi() {
  const box = $("compiti-oggi"); if (!box) return;
  const oggi = profilo ? compitiDiOggi(leggiLocale(chiaveCompiti(profilo.id), []), new Date()) : [];
  box.innerHTML = oggi.length ? '<p class="occhiello">I compiti di oggi</p>' : "";
  oggi.forEach((x) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "sessione";
    b.innerHTML = '<div class="alto"><span class="tit">' + esc(String(x.compito.testo).slice(0, 80)) + "…</span></div>" +
      '<div class="meta">' + esc(x.compito.materia || "compito") + (x.compito.risultato && x.compito.risultato.valore ? ", risultato " + esc(risultatoIt(x.compito.risultato)) : "") + "</div>";
    b.onclick = () => { compito = x.compito; indiziMostrati = 0; provoIo = false; chatCompito = []; simili = []; ["cp-foto", "cp-scegli", "cp-letto"].forEach((id) => { $(id).hidden = true; }); vai("compito"); mostraAiuto(); };
    box.appendChild(b);
  });
}

// Il «Prova tu» con quell'id: quello della soluzione o quello di una risposta della chat.
const provaTuDi = (id) => (id === "pt-sol" ? compito && compito.prova_tu : ((chatCompito[Number(id.slice(4))] || {}).risposta || {}).prova_tu);
async function controllaProvaTu(id) {
  const p = provaTuDi(id), campo = $(id), out = $(id + "-esito");
  if (!p || !campo) return;
  const risposta = campo.value.trim();
  if (!risposta) { out.innerHTML = htmlEsitoProvaTu({ giusto: false, esito: "vuota" }, p); return; }
  try {
    const r = await modello({ azione: "prova_tu", atteso: p.risultato, risposta });
    out.innerHTML = htmlEsitoProvaTu(r, p);
    proveFatte.add(id); segnali.push({ tipo: "prova", passo: p.passo, esito: r.giusto ? "giusto" : "sbagliato" });
  } catch (e) { out.innerHTML = "<p>" + esc(messaggioModello(e, "Non riesco a controllare adesso. Riprova fra un momento.")) + "</p>"; }
}

function collegaCompito() {
  // «Controlla» del Prova tu, ovunque sia (soluzione o chat); Invio nel campo fa lo stesso.
  $("v-compito").addEventListener("click", (e) => { const b = e.target.closest("[data-azione=controlla]"); if (b) controllaProvaTu(b.dataset.pt); });
  $("v-compito").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id && e.target.id.startsWith("pt-")) { e.preventDefault(); controllaProvaTu(e.target.id); } });
  $("foto-compito").addEventListener("change", (e) => {
    Array.prototype.slice.call(e.target.files).forEach((f) => { if (f.type.indexOf("image/") === 0) fotoCompito.push(f); });
    e.target.value = ""; immaginiCompito = []; disegnaFotoCompito();
  });
  $("btn-cp-leggi").addEventListener("click", () => leggiCompito());
  $("btn-cp-si").addEventListener("click", mostraAiuto);
  $("btn-cp-correggi").addEventListener("click", () => { $("cp-correggi").hidden = false; $("cp-testo-nuovo").focus(); });
  $("btn-cp-rileggi").addEventListener("click", () => { const t = $("cp-testo-nuovo").value.trim(); if (t) leggiCompito({ testo: t }); });
  $("cp-indizi").addEventListener("click", (e) => {
    const b = e.target.closest("[data-azione]"); if (!b) return;
    if (b.dataset.azione === "indizio") {
      indiziMostrati = prossimoIndizio(indiziMostrati, compito.indizi.length); disegnaIndizi();
      // gli indizi seguono i passi: l'indizio N è un segnale sul passo N (al più l'ultimo)
      segnali.push({ tipo: "indizio", passo: Math.min(indiziMostrati, (compito.passi || []).length) });
    }
    if (b.dataset.azione === "provo") { provoIo = true; disegnaIndizi(); $("cp-domanda").focus(); }
    if (b.dataset.azione === "soluzione") mostraSoluzione();
  });
  $("cp-soluzione").addEventListener("click", (e) => { const p = e.target.closest(".passo-tocca"); if (p) chiediSulCompito("Spiegami il passo " + p.dataset.passo, Number(p.dataset.passo)); });
  $("cp-pronte").addEventListener("click", (e) => { const b = e.target.closest("[data-domanda]"); if (b) chiediSulCompito(b.dataset.domanda); });
  $("btn-cp-chiedi").addEventListener("click", () => chiediSulCompito($("cp-domanda").value));
  $("cp-domanda").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chiediSulCompito($("cp-domanda").value); } });
  $("btn-cp-simile").addEventListener("click", esercizioSimile);
  $("btn-cp-fine").addEventListener("click", finisciCompito);
  collegaAllenamento();
  // La fotocamera della barra: due scelte grandi in un foglio dal basso.
  $("btn-foto-appunti").addEventListener("click", () => { chiudiFoglio("menu-foto"); nuovoMateriale(); });
  $("btn-foto-compito").addEventListener("click", () => { chiudiFoglio("menu-foto"); apriCompito(); });
  $("menu-foto").addEventListener("click", (e) => { if (e.target.id === "menu-foto") chiudiFoglio("menu-foto"); });
  $("btn-foto-chiudi").addEventListener("click", () => chiudiFoglio("menu-foto"));
  trascinaPerChiudere(document.querySelector("#menu-foto .foglio-menu"), () => chiudiFoglio("menu-foto"));
  $("link-compito").addEventListener("click", apriCompito);
}

/* ---- nel browser: segnali, esercizi mirati, gemelli, ripasso (aggiunte di Roby) ---- */

let segnali = [], proveFatte = new Set(), mirati = null, gemelliOra = [];
const chiaveRipasso = (id) => "verifiche-ripasso-" + id;
const chiaveAllena = (id) => "verifiche-allena-" + id;
const NOMI_GEMELLI = { vicino: "Gemello vicino", lontano: "Gemello lontano", variante: "Gemello con una variante" };

// Una risposta (numero o frazione) giudicata dal calcolo del server, come il «Prova tu».
async function giudica(atteso, risposta) { return modello({ azione: "prova_tu", atteso, risposta }); }
function htmlDomandaConRisposta(id, testoDomanda) {
  return '<label for="' + id + '">' + testoDomanda + "</label>" +
    '<div class="prova-riga"><input type="text" id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="La tua risposta">' +
    '<button type="button" class="minore" data-giudica="' + id + '">Controlla</button></div><div class="prova-esito" id="' + id + '-esito" aria-live="polite"></div>';
}

function finisciCompito() {
  if (!compito) return;
  if (compito.prova_tu && !$("cp-soluzione").hidden && !proveFatte.has("pt-sol")) segnali.push({ tipo: "prova", passo: compito.prova_tu.passo, esito: "saltato" });
  const difficili = compito.matematica ? concettiDifficili(segnali, compito.passi) : [];
  if (profilo && compito.matematica) {
    salvaLocale(chiaveRipasso(profilo.id), [nuovoRipasso(compito, new Date()), ...leggiLocale(chiaveRipasso(profilo.id), []).filter((v) => v && v.compito && v.compito.testo !== compito.testo)].slice(0, 20));
    if (difficili.length) salvaLocale(chiaveAllena(profilo.id), { quando: giornoDi(new Date()), compito, difficili });
  }
  if (!compito.matematica) { disegnaLibreria(); vai("libreria"); return; }
  mostraAllenamento(difficili);
}
function mostraAllenamento(difficili) {
  $("cp-aiuto").hidden = true; $("cp-chiedi").hidden = true; $("cp-allenati").hidden = false;
  $("cp-blocco-difficili").hidden = !difficili.length;
  $("cp-difficili").innerHTML = difficili.map((d) => '<button type="button" class="scelta" data-concetto="' + esc(d.concetto) + '" data-passo="' + d.passo + '"><b>' + esc(d.concetto) + "</b><small>3 esercizi veloci</small></button>").join("");
  $("cp-mirati").innerHTML = ""; $("cp-gemelli").innerHTML = ""; $("cp-blocco-gemelli").hidden = false;
  window.scrollTo(0, 0);
}

async function eserciziMirati(concetto, passo) {
  const p = (compito.passi || [])[passo - 1] || {};
  attesa($("stato-mirati"), ["Preparo tre esercizi su «" + concetto + "»", "Rifaccio i conti"]);
  try {
    const r = await conRiprovaEsercizi(() => modello({ azione: "esercizi_genera", modello: { testo: compito.testo, concetto, calcolo: p.calcolo || "" }, mirati: true }));
    mirati = { concetto, esercizi: r.esercizi || [], extra: r.extra || [], esiti: [] };
    disegnaMirati();
  } catch (e) { errore($("cp-mirati"), messaggioModello(e, "Non sono riuscito a preparare esercizi con i conti giusti. Riprova fra un momento.")); }
  attesa($("stato-mirati"), null);
}
function disegnaMirati() {
  $("cp-mirati").innerHTML = '<h3 class="sez-titolo">' + esc(mirati.concetto) + "</h3>" + mirati.esercizi.map((e, i) =>
    '<article class="esercizio"><p class="occhiello">Esercizio ' + (i + 1) + " di " + mirati.esercizi.length + '</p><p class="consegna">' + esc(e.testo) + "</p>" +
    (e.dati ? '<p class="dati-es">Dati: ' + esc(e.dati) + "</p>" : "") + htmlDomandaConRisposta("mi-" + i, "<b>La tua risposta</b>") +
    '<details class="come-si-fa" id="mi-' + i + '-sol" hidden><summary>Ecco come si fa</summary><ol class="passaggi">' +
    (e.passaggi || []).map((x) => "<li>" + esc(x.testo) + (x.formula ? '<span class="riga-formula">' + formulaHtml(x.formula) + "</span>" : "") + "</li>").join("") +
    "</ol></details></article>").join("") + '<p class="aiuto" id="mi-esito"></p>';
  formuleIn("cp-mirati");
}
async function giudicaMirato(i) {
  const e = mirati.esercizi[i], campo = $("mi-" + i), out = $("mi-" + i + "-esito");
  if (!campo.value.trim()) { out.innerHTML = "<p>Scrivi la tua risposta, poi tocca Controlla.</p>"; return; }
  try {
    const r = await giudica(e.risultato, campo.value.trim());
    mirati.esiti[i] = !!r.giusto;
    out.innerHTML = r.giusto ? '<p><span class="sem" data-s="verde"><i aria-hidden="true">●</i> Ci sei</span></p>'
      : '<p><span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Non ancora</span> Guarda come si fa qui sotto, poi prova quello in più.</p>';
    if (!r.giusto) { $("mi-" + i + "-sol").hidden = false; $("mi-" + i + "-sol").open = true;
      // un esercizio in più dello stesso livello, se c'è
      if (mirati.extra.length) { mirati.esercizi.splice(i + 1, 0, mirati.extra.shift()); mirati.esiti.splice(i + 1, 0, undefined); const fatti = mirati.esiti.slice(); disegnaMirati(); mirati.esiti = fatti; } }
    const risposti = mirati.esiti.slice(0, 3).filter((x) => x !== undefined).length;
    if (risposti === 3 && $("mi-esito")) $("mi-esito").textContent = esitoAllenamento(mirati.concetto, mirati.esiti.slice(0, 3));
  } catch (err) { out.innerHTML = "<p>" + esc(messaggioModello(err, "Non riesco a controllare adesso. Riprova fra un momento.")) + "</p>"; }
}

async function problemiGemelli(c, dove, soloUno = false) {
  const stato = dove === "ripasso" ? $("stato-cp") : $("stato-gemelli");
  attesa(stato, ["Preparo problemi con gli stessi passi", "Rifaccio i conti di ogni passo"]);
  try {
    const r = await conRiprovaEsercizi(() => modello({ azione: "gemelli", compito: c }));
    gemelliOra = soloUno ? [r.gemelli.find((g) => g.tipo === "lontano") || r.gemelli[0]] : r.gemelli;
    disegnaGemelli(dove === "ripasso" ? $("cp-gemelli") : $("cp-gemelli"));
  } catch (e) { errore($("cp-gemelli"), e.message === "nessun_gemello" ? "Non sono riuscito a preparare problemi gemelli con tutti i conti interi. Riprova fra un momento." : messaggioModello(e, "Non sono riuscito a preparare i problemi gemelli. Riprova fra un momento.")); }
  attesa(stato, null);
}
function disegnaGemelli(box) {
  box.innerHTML = gemelliOra.map((g, i) => '<article class="esercizio gemello" data-g="' + i + '"><p class="occhiello">' + esc(NOMI_GEMELLI[g.tipo] || "Problema gemello") + '</p><p class="consegna">' + esc(g.testo) + "</p>" +
    htmlDomandaConRisposta("ge-" + i, "<b>Prova tu:</b> la tua risposta") + '<div class="gradini" id="ge-' + i + '-gradini"></div></article>').join("");
}
function gradinoGemello(i, n) {
  const g = gemelliOra[i], box = $("ge-" + i + "-gradini");
  const passi = g.passi.filter((p) => p.titolo);
  if (n < passi.length) {
    box.innerHTML = '<p class="occhiello">Ti ricordi? Gli stessi passi del problema di partenza</p><ol class="indizi">' + passi.slice(0, n + 1).map((p) => '<li class="indizio"><p>' + esc(p.titolo) + "</p></li>").join("") + "</ol>" +
      '<p class="link-riga"><button type="button" class="link" data-gradino="' + i + '" data-n="' + (n + 1) + '">' + (n + 1 < passi.length ? "Il passo dopo" : "Fammi vedere la soluzione") + "</button></p>";
  } else {
    box.innerHTML = '<ol class="passi-compito">' + g.passi.map((p, k) => '<li class="passo"><div class="passo-tocca"><b>' + esc(p.titolo) + "</b>" + (p.spiegazione ? "<span>" + esc(p.spiegazione) + "</span>" : "") + (p.calcolo ? formulaCalcolo(p.calcolo) : "") + "</div></li>").join("") +
      '</ol><p class="risultato-compito">Risultato: <b>' + esc(risultatoIt(g.risultato)) + '</b></p><p class="aiuto">Stessi passi del problema di partenza: cambia solo la storia.</p>';
    formuleIn(box.id);
  }
}
async function giudicaGemello(i, ripasso) {
  const g = gemelliOra[i], campo = $("ge-" + i), out = $("ge-" + i + "-esito");
  if (!campo.value.trim()) { out.innerHTML = "<p>Scrivi la tua risposta, poi tocca Controlla.</p>"; return; }
  try {
    const r = await giudica(g.risultato, campo.value.trim());
    out.innerHTML = r.giusto ? '<p><span class="sem" data-s="verde"><i aria-hidden="true">●</i> Ci sei</span> Stessi passi del problema di partenza: cambia solo la storia.</p>'
      : '<p><span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Non ancora</span> Rifacciamo i passi insieme.</p>';
    if (!r.giusto) gradinoGemello(i, 0);
    if (ripasso && profilo) {
      const lista = leggiLocale(chiaveRipasso(profilo.id), []).map((v) => (v && v.id === ripasso.id ? aggiornaRipasso(v, !!r.giusto, new Date()) : v));
      salvaLocale(chiaveRipasso(profilo.id), lista); ripassoAperto = null;
    }
  } catch (err) { out.innerHTML = "<p>" + esc(messaggioModello(err, "Non riesco a controllare adesso. Riprova fra un momento.")) + "</p>"; }
}

// Oggi: il ripasso di un compito (1, 3, 7 giorni) e gli esercizi su quello che ieri ha messo in difficoltà.
let ripassoAperto = null;
function disegnaRipassoOggi() {
  const box = $("ripasso-oggi"); if (!box) return;
  box.innerHTML = "";
  if (!profilo) return;
  const ora = new Date();
  const dovuto = ripassiDovuti(leggiLocale(chiaveRipasso(profilo.id), []), ora)[0];
  const allena = leggiLocale(chiaveAllena(profilo.id), null);
  if (dovuto) box.innerHTML += '<button type="button" class="scelta" id="btn-ripasso-compito"><span class="occhiello">Ripasso</span><b>Ti ricordi il problema di ' +
    esc(dovuto.compito.cerca || "questo compito") + "?</b><small>Eccone uno simile: 2 minuti.</small></button>";
  if (allena && allena.quando && allena.quando < giornoDi(ora) && (allena.difficili || []).length)
    box.innerHTML += '<button type="button" class="scelta" id="btn-allena-ieri"><span class="occhiello">Allenamento</span><b>«' + esc(allena.difficili[0].concetto) +
      "» ti ha messo in difficoltà</b><small>3 esercizi veloci?</small></button>";
}
function apriRipasso() {
  const v = ripassiDovuti(leggiLocale(chiaveRipasso(profilo.id), []), new Date())[0]; if (!v) return;
  ripassoAperto = v; compito = v.compito;
  ["cp-foto", "cp-scegli", "cp-letto", "cp-aiuto"].forEach((id) => { $(id).hidden = true; });
  $("cp-allenati").hidden = false; $("cp-blocco-difficili").hidden = true; $("cp-blocco-gemelli").hidden = true; $("cp-gemelli").innerHTML = "";
  vai("compito"); problemiGemelli(v.compito, "ripasso", true);
}
function apriAllenaIeri() {
  const a = leggiLocale(chiaveAllena(profilo.id), null); if (!a) return;
  compito = a.compito; segnali = [];
  ["cp-foto", "cp-scegli", "cp-letto"].forEach((id) => { $(id).hidden = true; });
  vai("compito"); mostraAllenamento(a.difficili); $("cp-blocco-gemelli").hidden = true;
  salvaLocale(chiaveAllena(profilo.id), null);
}

function collegaAllenamento() {
  $("btn-cp-gemelli").addEventListener("click", () => { mostraAllenamento([]); problemiGemelli(compito, "allenati"); });
  $("btn-cp-gemelli-2").addEventListener("click", () => { $("cp-blocco-gemelli").hidden = true; problemiGemelli(compito, "allenati"); });
  $("btn-cp-oggi").addEventListener("click", () => { disegnaLibreria(); vai("libreria"); });
  $("cp-difficili").addEventListener("click", (e) => { const b = e.target.closest("[data-concetto]"); if (b) eserciziMirati(b.dataset.concetto, Number(b.dataset.passo)); });
  $("cp-allenati").addEventListener("click", (e) => {
    const b = e.target.closest("[data-giudica]");
    if (b && b.dataset.giudica.startsWith("mi-")) giudicaMirato(Number(b.dataset.giudica.slice(3)));
    if (b && b.dataset.giudica.startsWith("ge-")) giudicaGemello(Number(b.dataset.giudica.slice(3)), ripassoAperto);
    const gr = e.target.closest("[data-gradino]"); if (gr) gradinoGemello(Number(gr.dataset.gradino), Number(gr.dataset.n));
  });
  $("ripasso-oggi").addEventListener("click", (e) => {
    if (e.target.closest("#btn-ripasso-compito")) apriRipasso();
    if (e.target.closest("#btn-allena-ieri")) apriAllenaIeri();
  });
}
