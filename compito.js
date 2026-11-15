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
function htmlTestoConDati(testo, dati) {
  const voci = [...new Set((dati || []).map((d) => String(d).trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!voci.length) return esc(testo);
  // Un dato non si evidenzia dentro un numero più lungo («6» non dentro «1260»).
  const re = new RegExp("(?<![\\d.,/])(?:" + voci.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![\\d,/]|\\.\\d)", "g");
  let fuori = "", da = 0;
  String(testo).replace(re, (m, i) => { fuori += esc(String(testo).slice(da, i)) + evidenzia(m); da = i + m.length; return m; });
  return fuori + esc(String(testo).slice(da));
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

/* =================================================================== nel browser */

// Le formule si disegnano con KaTeX appena arriva; finché non c'è restano leggibili come testo.
const formuleIn = (id) => caricaKatex().then((ok) => { if (ok) rendiFormule($(id)); });

let compito = null, fotoCompito = [], immaginiCompito = [], indiziMostrati = 0, provoIo = false, chatCompito = [], simili = [], simileOra = 0;
let compitoOccupato = false; // una richiesta al modello alla volta

function apriCompito() {
  compito = null; fotoCompito = []; immaginiCompito = []; indiziMostrati = 0; chatCompito = []; simili = [];
  ["cp-scegli", "cp-letto", "cp-aiuto"].forEach((id) => { $(id).hidden = true; });
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
    compito = r; indiziMostrati = 0; provoIo = false; chatCompito = [];
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
  $("cp-sai").innerHTML = (compito.dati || []).map((d) => "<li>" + esc(d) + "</li>").join("");
  $("cp-cerchi").textContent = compito.cerca || "";
  $("cp-blocco-sai").hidden = !(compito.dati || []).length && !compito.cerca;
  disegnaIndizi();
  $("cp-soluzione").hidden = true; $("cp-soluzione").innerHTML = "";
  disegnaChat();
  $("btn-cp-simile").hidden = !compito.matematica; $("cp-simile").innerHTML = ""; $("btn-cp-simile").textContent = "Fammi un esercizio simile"; simili = [];
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
async function chiediSulCompito(domanda) {
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
    if (b.dataset.azione === "indizio") { indiziMostrati = prossimoIndizio(indiziMostrati, compito.indizi.length); disegnaIndizi(); }
    if (b.dataset.azione === "provo") { provoIo = true; disegnaIndizi(); $("cp-domanda").focus(); }
    if (b.dataset.azione === "soluzione") mostraSoluzione();
  });
  $("cp-soluzione").addEventListener("click", (e) => { const p = e.target.closest(".passo-tocca"); if (p) chiediSulCompito("Spiegami il passo " + p.dataset.passo); });
  $("cp-pronte").addEventListener("click", (e) => { const b = e.target.closest("[data-domanda]"); if (b) chiediSulCompito(b.dataset.domanda); });
  $("btn-cp-chiedi").addEventListener("click", () => chiediSulCompito($("cp-domanda").value));
  $("cp-domanda").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chiediSulCompito($("cp-domanda").value); } });
  $("btn-cp-simile").addEventListener("click", esercizioSimile);
  $("btn-cp-fine").addEventListener("click", () => { disegnaLibreria(); vai("libreria"); });
  // La fotocamera della barra: due scelte grandi in un foglio dal basso.
  $("btn-foto-appunti").addEventListener("click", () => { chiudiFoglio("menu-foto"); nuovoMateriale(); });
  $("btn-foto-compito").addEventListener("click", () => { chiudiFoglio("menu-foto"); apriCompito(); });
  $("menu-foto").addEventListener("click", (e) => { if (e.target.id === "menu-foto") chiudiFoglio("menu-foto"); });
  $("btn-foto-chiudi").addEventListener("click", () => chiudiFoglio("menu-foto"));
  trascinaPerChiudere(document.querySelector("#menu-foto .foglio-menu"), () => chiudiFoglio("menu-foto"));
  $("link-compito").addEventListener("click", apriCompito);
}
