// Strumenti per materia (issue #24): non si studia tutto allo stesso modo.
//  - storia: linea del tempo con le date scritte negli appunti e gioco «metti in ordine»;
//  - lingue straniere: vocaboli con la pronuncia, flashcard ripetute nel tempo e «Parla tu»;
//  - geografia e scienze: schema da completare con i termini degli appunti.
// Date, vocaboli e termini li estrae l'azione `strumento` della funzione modello, che tiene solo
// quello che sta nella trascrizione. Script classico caricato dopo piano.js: usa $, esc, errore,
// attesa, modello, messaggioModello, vai, corrente, profilo, sb, slugMateria, evidenzia,
// leggiLocale, salvaLocale, Riconoscimento, provaMicrofono, erroreVoce, messaggioVoce (app.js),
// nuovoStatoRipasso, salvaRipassoStato, giornoDi (piano.js, compito.js).
// Le parti pure stanno in cima (test/strumenti-app.test.js); il DOM parte da apriStrumento.

/* =================================================================== parti pure */

const STRUMENTI = {
  date: { titolo: "Linea del tempo", spiega: "Le date dei tuoi appunti in fila. Poi le metti in ordine tu.", attesa: ["Cerco le date nei tuoi appunti", "Le metto in fila"],
    vuoto: "Nei tuoi appunti non ho trovato almeno due date. Fotografa le pagine con le date e riprova." },
  vocaboli: { titolo: "Vocaboli e pronuncia", spiega: "Ascolta, gira le carte, poi prova a dirli tu.", attesa: ["Cerco i vocaboli nei tuoi appunti", "Preparo le carte"],
    vuoto: "Nei tuoi appunti non ho trovato vocaboli con la traduzione scritta accanto. Fotografa la pagina dei vocaboli e riprova." },
  schema: { titolo: "Schema da completare", spiega: "Metti i termini dei tuoi appunti al posto giusto.", attesa: ["Cerco i termini nei tuoi appunti", "Disegno lo schema"],
    vuoto: "Nei tuoi appunti non ho trovato abbastanza termini per uno schema: ne servono almeno tre, ognuno con la sua frase." },
};
function strumentoDi(materia) {
  const m = String(materia || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tipo = /ingles|english|spagnol|frances|tedesc/.test(m) ? "vocaboli"
    : ({ storia: "date", geografia: "schema", scienze: "schema" })[(slugMateria(materia) || [])[0]];
  return tipo ? { tipo, ...STRUMENTI[tipo] } : null;
}

// --- linea del tempo. Ogni evento arriva con anno (numero, negativo prima di Cristo) calcolato dal server.
const ordinaEventi = (eventi) => (eventi || []).slice().sort((x, y) => x.anno - y.anno);
// Un posto è giusto se ha l'anno che ci va: due eventi dello stesso anno vanno bene in tutti e due gli ordini.
function controllaOrdine(lista) {
  const giusto = ordinaEventi(lista), giusti = (lista || []).map((e, i) => e.anno === giusto[i].anno);
  const quanti = giusti.filter(Boolean).length;
  return { giusti, quanti, tutto: quanti === giusti.length };
}
function sposta(lista, da, a) {
  if (a < 0 || a >= lista.length || da === a) return lista.slice();
  const out = lista.slice(), [x] = out.splice(da, 1);
  out.splice(a, 0, x);
  return out;
}
// Mescolati, ma mai già in ordine (se gli anni non sono tutti uguali).
function mescolaEventi(eventi) {
  let m = (eventi || []).slice();
  for (let k = 0; k < 10; k++) {
    for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
    if (!controllaOrdine(m).tutto) return m;
  }
  m = ordinaEventi(eventi).reverse();
  return m;
}

// --- parole intere, maiuscole a parte («ca» non sta dentro «cat»)
const fugaRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reParola = (p, flag = "iu") => new RegExp("(?<![\\p{L}\\p{N}])" + fugaRe(String(p).trim()) + "(?![\\p{L}\\p{N}])", flag);

// --- parla tu: confronto tollerante fra la frase attesa e quella detta.
const CONTRAZIONI = { "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is", "it's": "it is", "we're": "we are",
  "they're": "they are", "don't": "do not", "doesn't": "does not", "isn't": "is not", "aren't": "are not", "can't": "can not",
  "cannot": "can not", "i've": "i have", "i'll": "i will", "let's": "let us", "what's": "what is", "there's": "there is" };
const paroleFrase = (s) => String(s || "").toLowerCase().replace(/[’`]/g, "'").split(/\s+/)
  .flatMap((w) => { const k = w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""); return (CONTRAZIONI[k] || k).split(" "); })
  .map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
// Parole uguali, o con una lettera di differenza se lunghe almeno 4 (colour/color, il riconoscimento sbaglia così).
function quasiUguali(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}
// → { giusta, parole: [{ parola, ok }] della frase attesa, mancanti: [parola], vuota }
// Giusta se manca al più una parola ogni cinque, nell'ordine giusto.
function confrontaFrase(attesa, detta) {
  const originali = String(attesa || "").split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);
  const gruppi = originali.map((w) => paroleFrase(w)), a = gruppi.flat(), d = paroleFrase(detta);
  const t = Array.from({ length: a.length + 1 }, () => new Array(d.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= d.length; j++)
    t[i][j] = quasiUguali(a[i - 1], d[j - 1]) ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
  const presa = new Array(a.length).fill(false);
  for (let i = a.length, j = d.length; i > 0 && j > 0;) {
    if (quasiUguali(a[i - 1], d[j - 1]) && t[i][j] === t[i - 1][j - 1] + 1) { presa[i - 1] = true; i--; j--; }
    else if (t[i - 1][j] >= t[i][j - 1]) i--; else j--;
  }
  let k = 0;
  const parole = originali.map((parola, g) => { const ok = gruppi[g].every(() => presa[k++]); return { parola, ok }; });
  const mancanti = parole.filter((p) => !p.ok).map((p) => p.parola);
  return { giusta: d.length > 0 && mancanti.length <= Math.floor(parole.length / 5), parole, mancanti, vuota: !d.length };
}
const tra = (xs) => elencoIt(xs.map((x) => "«" + x + "»")); // elencoIt: libreria.js
function correzioneGentile(r) {
  if (r.vuota) return "Non ho sentito niente. Tocca Parla tu e dilla ad alta voce.";
  if (r.giusta) return r.mancanti.length ? "Ci sei. Occhio a " + tra(r.mancanti) + "." : "Detta bene.";
  return "Non ancora: " + (r.mancanti.length === 1 ? "manca " : "mancano ") + tra(r.mancanti) + ". Riascoltala e riprova.";
}

// --- flashcard: lo stato di ogni carta segue le regole di ripasso di piano.js.
const ESITI_CARTA = { si: 10, quasi: 6, no: 2 };
const chiaveCarta = (argomentoId, parola) => argomentoId + "|" + String(parola).trim().toLowerCase();
const statoCarta = (prima, scelta, oggi) => nuovoStatoRipasso(prima, ESITI_CARTA[scelta], null, oggi);
// Le carte di oggi: prima quelle scadute (la più vecchia per prima), poi le nuove. Le altre aspettano il loro giorno.
function carteDiOggi(vocaboli, stati, argomentoId, oggi) {
  const st = (v) => (stati || {})[chiaveCarta(argomentoId, v.parola)];
  const scadute = (vocaboli || []).filter((v) => st(v) && st(v).prossima <= oggi).sort((x, y) => st(x).prossima.localeCompare(st(y).prossima));
  return [...scadute, ...(vocaboli || []).filter((v) => !st(v))];
}
// Il concetto dell'argomento la cui frase contiene il vocabolo: è lì che ripasso_stato tiene il conto.
function concettoDelVocabolo(parola, concetti) {
  const c = (concetti || []).find((x) => x.ancora && reParola(parola).test(x.ancora));
  return c ? c.id : null;
}
function mediePerConcetto(risposte) {
  const per = {};
  (risposte || []).forEach((r) => { if (r.concetto_id) (per[r.concetto_id] = per[r.concetto_id] || []).push(r.esito); });
  return Object.entries(per).map(([concetto_id, v]) => ({ concetto_id, media: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 }));
}

// --- schema da completare: la frase del quaderno con il termine coperto.
const mascheraTermine = (ancora, termine) => String(ancora || "").replace(reParola(termine, "giu"), "____");
// Dove stanno i posti numerati nel disegno (viewBox 340 × 340).
function posizioniSchema(forma, n) {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (forma === "ciclo") return idx.map((i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return { x: Math.round(170 + 120 * Math.cos(a)), y: Math.round(170 + 120 * Math.sin(a)) }; });
  if (forma === "strati") return idx.map((i) => ({ x: 44, y: Math.round(n === 1 ? 170 : 44 + (i * 252) / (n - 1)) }));
  const sx = Math.ceil(n / 2), dx = n - sx; // parti: metà a sinistra, metà a destra della figura
  return idx.map((i) => { const lato = i < sx ? 0 : 1, j = lato ? i - sx : i, quanti = lato ? dx : sx;
    return { x: lato ? 300 : 40, y: Math.round(quanti === 1 ? 170 : 50 + (j * 240) / (quanti - 1)) }; });
}
function controllaSchema(posti, etichette) {
  const giusti = etichette.map((e, i) => posti[i] === e.termine), quanti = giusti.filter(Boolean).length;
  return { giusti, quanti, tutto: quanti === giusti.length };
}
// Il disegno: la forma (ciclo con le frecce, strati, figura con le parti) e i posti numerati. Il testo
// dei termini sta nell'elenco sotto, non nel disegno: qui solo numeri, niente da sfuggire.
function svgSchema(spec, posti, esiti) {
  const n = spec.etichette.length, p = posizioniSchema(spec.forma, n);
  let forma = "";
  if (spec.forma === "ciclo") forma = '<circle cx="170" cy="170" r="120" class="sc-linea" fill="none"/>' +
    p.map((q, i) => { const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n, x = 170 + 120 * Math.cos(a), y = 170 + 120 * Math.sin(a), g = (a * 180) / Math.PI + 90;
      return '<path class="sc-freccia" d="M-6,-5 L4,0 L-6,5 Z" transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + g.toFixed(1) + ')"/>'; }).join("");
  else if (spec.forma === "strati") forma = p.map((q, i) => { const h = n === 1 ? 60 : 252 / (n - 1);
    return '<rect class="sc-strato" data-i="' + (i % 2) + '" x="70" y="' + (q.y - h / 2).toFixed(1) + '" width="250" height="' + h.toFixed(1) + '" rx="10"/>' +
      '<line class="sc-linea" x1="62" y1="' + q.y + '" x2="110" y2="' + q.y + '"/>'; }).join("");
  else forma = '<ellipse class="sc-figura" cx="170" cy="170" rx="62" ry="110"/>' +
    p.map((q) => '<line class="sc-linea" x1="' + (q.x < 170 ? q.x + 20 : q.x - 20) + '" y1="' + q.y + '" x2="' + (q.x < 170 ? 128 : 212) + '" y2="' + (150 + (q.y - 170) / 3).toFixed(1) + '"/>').join("");
  const segni = { true: "●", false: "✕" };
  return '<svg class="schema-svg" viewBox="0 0 340 340" role="img" aria-label="Schema: ' + n + ' posti numerati">' + forma +
    p.map((q, i) => '<g class="posto-svg" data-posto="' + i + '" data-pieno="' + (posti[i] ? 1 : 0) + '"' + (esiti ? ' data-esito="' + esiti[i] + '"' : "") + ">" +
      '<circle cx="' + q.x + '" cy="' + q.y + '" r="19"/><text x="' + q.x + '" y="' + (q.y + 6) + '" text-anchor="middle">' + (esiti ? segni[esiti[i]] : i + 1) + "</text></g>").join("") + "</svg>";
}

/* =================================================================== nel browser */

let strumento = null; // { tipo, a, dati, ... } dello strumento aperto
const cacheStrumenti = {}; // argomento|tipo → risposta del modello: dentro la stessa sessione non si richiede
let ascoltoStrumento = null;

function fermaStrumento() {
  if (ascoltoStrumento) { try { ascoltoStrumento.abort(); } catch (e) { /* già fermo */ } ascoltoStrumento = null; }
  if (typeof window !== "undefined" && window.speechSynthesis) speechSynthesis.cancel();
}

function adattaStrumento(a) {
  const s = strumentoDi(a.materia), b = $("btn-strumento");
  b.hidden = !s || !a.trascrizione || a.percorso === "esercizi";
  if (s) b.innerHTML = "<b>" + esc(s.titolo) + "</b><small>" + esc(s.spiega) + "</small>";
}

async function apriStrumento(a) {
  const s = strumentoDi(a.materia);
  if (!s) return;
  fermaStrumento();
  strumento = { tipo: s.tipo, a };
  $("str-corpo").innerHTML = "";
  errore($("err-strumento"), "");
  vai("strumento", a.materia, s.titolo);
  const chiave = a.id + "|" + s.tipo;
  if (!cacheStrumenti[chiave]) {
    attesa($("stato-strumento"), s.attesa);
    try { cacheStrumenti[chiave] = await modello({ azione: "strumento", tipo: s.tipo, argomento_id: a.id }); }
    catch (e) {
      attesa($("stato-strumento"), null);
      const vuoto = e.message === "niente_da_mostrare" ? s.vuoto
        : e.message === "nessuna_lingua" ? "Non capisco quale lingua si studia in questi appunti. Funziona con inglese, spagnolo, francese e tedesco." : null;
      errore($("err-strumento"), vuoto || messaggioModello(e, "Non sono riuscito a leggere i tuoi appunti adesso. Riprova fra un momento."));
      return;
    }
    attesa($("stato-strumento"), null);
  }
  if (!strumento || strumento.a !== a) return; // nel frattempo è uscita
  strumento.dati = cacheStrumenti[chiave];
  ({ date: disegnaLinea, vocaboli: disegnaVocaboli, schema: disegnaSchema })[s.tipo]();
}

const SVG_SU = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const SVG_GIU = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const SVG_ASCOLTA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
const semaforo = (ok, testo) => '<span class="sem" data-s="' + (ok ? "verde" : "rosso") + '"><i aria-hidden="true">' + (ok ? "●" : "✕") + "</i> " + esc(testo) + "</span>";

/* ---- storia: linea del tempo e «metti in ordine» */

function disegnaLinea() {
  const ev = ordinaEventi(strumento.dati.eventi);
  $("str-corpo").innerHTML = '<p class="aiuto">Le date scritte nei tuoi appunti, dalla più antica. Scorri di lato.</p>' +
    '<ol class="linea" tabindex="0" aria-label="Linea del tempo">' + ev.map((e) =>
      "<li><b>" + esc(e.data) + "</b><span>" + esc(e.evento) + '</span><small class="citazione">' + evidenzia(e.ancora) + "</small></li>").join("") + "</ol>" +
    '<div class="bottoni"><button type="button" class="azione" id="btn-ordina">Mettile in ordine tu</button></div>';
  $("btn-ordina").onclick = () => { strumento.ordine = mescolaEventi(strumento.dati.eventi); strumento.controllato = null; disegnaOrdine(); };
}

function disegnaOrdine(fuoco) {
  const o = strumento.ordine, c = strumento.controllato, n = o.length;
  const riga = (e, i) => '<li data-i="' + i + '"' + (c ? ' data-esito="' + (c.giusti[i] ? "giusto" : "no") + '"' : "") + ">" +
    '<span class="maniglia-ord" aria-hidden="true"></span><span class="ev">' + (c ? semaforo(c.giusti[i], c.giusti[i] ? "Al posto giusto" : "Non ancora") : "") +
    "<b>" + esc(e.evento) + "</b>" + (c && c.tutto ? "<small>" + esc(e.data) + "</small>" : "") + "</span>" +
    '<span class="su-giu"><button type="button" class="tondo" data-su="' + i + '" aria-label="Sposta su: ' + esc(e.evento) + '"' + (i === 0 ? " disabled" : "") + ">" + SVG_SU + "</button>" +
    '<button type="button" class="tondo" data-giu="' + i + '" aria-label="Sposta giù: ' + esc(e.evento) + '"' + (i === n - 1 ? " disabled" : "") + ">" + SVG_GIU + "</button></span></li>";
  $("str-corpo").innerHTML = '<p class="aiuto">Dal più antico al più recente. Trascina un evento dalla maniglia, o usa le frecce.</p>' +
    '<ol class="ordina" id="str-ordina">' + o.map(riga).join("") + "</ol>" +
    '<div id="esito-ordine" aria-live="polite">' + (c ? "<p><b>" + (c.tutto ? "Tutti in ordine." : c.quanti + " su " + n + " al posto giusto.") + "</b> " +
      esc(c.tutto ? "Ora sotto ogni evento vedi la sua data." : "Sposta quelli con la ✕ e controlla di nuovo.") + "</p>" : "") + "</div>" +
    '<div class="bottoni">' + (c && c.tutto ? '<button type="button" class="azione" id="btn-ordina-ancora">Mescola e rifai</button><button type="button" class="minore" id="btn-linea">Rivedi la linea</button>'
      : '<button type="button" class="azione" id="btn-controlla-ordine">Controlla</button>') + "</div>";
  const ol = $("str-ordina");
  ol.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const da = Number(b.dataset.su ?? b.dataset.giu), a = b.dataset.su != null ? da - 1 : da + 1;
    strumento.ordine = sposta(strumento.ordine, da, a); strumento.controllato = null;
    disegnaOrdine((b.dataset.su != null ? "su" : "giu") + ":" + a);
  };
  trascinaRighe(ol, (indici) => { strumento.ordine = indici.map((i) => strumento.ordine[i]); strumento.controllato = null; disegnaOrdine(); });
  const ct = $("btn-controlla-ordine"); if (ct) ct.onclick = () => { strumento.controllato = controllaOrdine(strumento.ordine); disegnaOrdine(); $("esito-ordine").scrollIntoView({ block: "nearest" }); };
  const an = $("btn-ordina-ancora"); if (an) an.onclick = () => { strumento.ordine = mescolaEventi(strumento.dati.eventi); strumento.controllato = null; disegnaOrdine(); };
  const li = $("btn-linea"); if (li) li.onclick = disegnaLinea;
  if (fuoco) { const [verso, i] = fuoco.split(":"), b = ol.querySelector("[data-" + verso + '="' + i + '"]:not(:disabled)') || ol.querySelector('[data-i="' + i + '"] button:not(:disabled)'); if (b) b.focus(); }
}

// Trascinamento con i pointer events (mouse, dito su iPhone, penna): si prende la riga dalla maniglia,
// la riga segue il dito fra le altre, al rilascio fine(nuovo ordine degli indici di partenza).
function trascinaRighe(ol, fine) {
  let presa = null;
  ol.onpointerdown = (e) => {
    if (!e.target.closest(".maniglia-ord")) return;
    presa = e.target.closest("li"); presa.dataset.presa = "1";
    // la cattura sulla lista, non sulla riga: la riga si sposta nel DOM e perderebbe la cattura
    try { ol.setPointerCapture(e.pointerId); } catch (x) { /* niente */ }
    e.preventDefault();
  };
  ol.onpointermove = (e) => {
    if (!presa) return;
    const dopo = [...ol.children].find((x) => { if (x === presa) return false; const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (dopo !== presa.nextElementSibling) ol.insertBefore(presa, dopo || null);
  };
  ol.onpointerup = ol.onpointercancel = () => {
    if (!presa) return;
    delete presa.dataset.presa; presa = null;
    fine([...ol.children].map((x) => Number(x.dataset.i)));
  };
}

/* ---- lingue: vocaboli, pronuncia, flashcard, «Parla tu» */

const chiaveCarte = () => "verifiche-carte-" + (profilo ? profilo.id : "");
const puoParlare = () => typeof window !== "undefined" && !!window.speechSynthesis;
function pronuncia(testo, lang) {
  if (!puoParlare()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(testo), voci = speechSynthesis.getVoices();
  u.lang = lang; u.rate = 0.85;
  u.voice = voci.find((v) => v.lang.replace("_", "-") === lang) || voci.find((v) => v.lang.slice(0, 2) === lang.slice(0, 2)) || null;
  speechSynthesis.speak(u);
}
const bottoneAscolta = (testo, etichetta) => puoParlare() ? '<button type="button" class="minore ascolta" data-ascolta="' + esc(testo) + '" aria-label="Ascolta: ' + esc(testo) + '">' + SVG_ASCOLTA + (etichetta ? " " + esc(etichetta) : "") + "</button>" : "";

function disegnaVocaboli() {
  const d = strumento.dati;
  strumento.parte = strumento.parte || (d.vocaboli.length ? "carte" : "parla");
  const tab = (k, t) => '<button type="button" class="segmento" data-parte="' + k + '" aria-pressed="' + (strumento.parte === k) + '">' + t + "</button>";
  $("str-corpo").innerHTML = '<div class="segmenti" role="group" aria-label="Cosa fare">' + (d.vocaboli.length ? tab("carte", "Carte") : "") + tab("parla", "Parla tu") + (d.vocaboli.length ? tab("tutti", "Tutti") : "") + "</div>" +
    '<div id="str-parte"></div>';
  $("str-corpo").querySelector(".segmenti").onclick = (e) => { const b = e.target.closest("[data-parte]"); if (b) { fermaStrumento(); strumento.parte = b.dataset.parte; disegnaVocaboli(); } };
  $("str-corpo").onclick = (e) => { const b = e.target.closest("[data-ascolta]"); if (b) pronuncia(b.dataset.ascolta, d.lingua); };
  if (strumento.parte === "carte") disegnaCarta(true);
  else if (strumento.parte === "parla") disegnaParla(true);
  else $("str-parte").innerHTML = '<ul class="vocaboli">' + d.vocaboli.map((v) => "<li><span><b lang=\"" + esc(d.lingua) + '">' + esc(v.parola) + "</b><small>" + esc(v.traduzione) + "</small></span>" + bottoneAscolta(v.parola) + "</li>").join("") + "</ul>" +
    '<p class="legenda">Coppie copiate dai tuoi appunti.</p>';
}

function disegnaCarta(nuovo) {
  const d = strumento.dati, a = strumento.a, oggi = giornoDi(new Date());
  if (nuovo) { strumento.stati = leggiLocale(chiaveCarte(), {}) || {}; strumento.mazzo = carteDiOggi(d.vocaboli, strumento.stati, a.id, oggi); strumento.fatte = []; strumento.girata = false; }
  const box = $("str-parte"), v = strumento.mazzo[strumento.fatte.length];
  if (!v) {
    const si = strumento.fatte.filter((x) => x.scelta === "si").length;
    box.innerHTML = '<div class="vuoto"><b>' + (strumento.fatte.length ? "Carte di oggi finite" : "Per oggi le carte sono finite") + "</b>" +
      esc(strumento.fatte.length ? si + " su " + strumento.fatte.length + " le sapevi già. Le altre tornano nei prossimi giorni." : "Tornano nei prossimi giorni, quando è il momento di ripassarle.") +
      '</div><div class="bottoni"><button type="button" class="minore" data-parte-vai="parla">Prova Parla tu</button></div>';
    box.querySelector("[data-parte-vai]").onclick = () => { strumento.parte = "parla"; disegnaVocaboli(); };
    return;
  }
  box.innerHTML = '<p class="occhiello">Carta ' + (strumento.fatte.length + 1) + " di " + strumento.mazzo.length + "</p>" +
    '<div class="carta" data-girata="' + (strumento.girata ? 1 : 0) + '"><b lang="' + esc(d.lingua) + '">' + esc(v.parola) + "</b>" +
    (strumento.girata ? '<span class="trad">' + esc(v.traduzione) + "</span>" : '<span class="trad-nascosta">Come si dice in italiano?</span>') + "</div>" +
    '<div class="bottoni">' + bottoneAscolta(v.parola, "Ascolta") + (strumento.girata ? "" : '<button type="button" class="azione" id="btn-gira">Gira la carta</button>') + "</div>" +
    (strumento.girata ? '<p class="aiuto">La sapevi?</p><div class="bottoni scelte-carta">' +
      '<button type="button" class="minore" data-carta="si">' + semaforo(true, "La sapevo") + "</button>" +
      '<button type="button" class="minore" data-carta="quasi"><span class="sem" data-s="giallo"><i aria-hidden="true">▲</i> Quasi</span></button>' +
      '<button type="button" class="minore" data-carta="no">' + semaforo(false, "Non ancora") + "</button></div>" : "");
  const g = $("btn-gira"); if (g) g.onclick = () => { strumento.girata = true; disegnaCarta(); const p = box.querySelector("[data-carta]"); if (p) p.focus(); };
  box.querySelectorAll("[data-carta]").forEach((b) => { b.onclick = () => rispondiCarta(v, b.dataset.carta); });
}

function rispondiCarta(v, scelta) {
  const a = strumento.a, oggi = giornoDi(new Date()), k = chiaveCarta(a.id, v.parola);
  strumento.stati[k] = statoCarta(strumento.stati[k], scelta, oggi);
  salvaLocale(chiaveCarte(), strumento.stati); // stato locale: c'è sempre, anche senza ripasso_stato
  strumento.fatte.push({ scelta, concetto_id: concettoDelVocabolo(v.parola, a.concetti), esito: ESITI_CARTA[scelta] });
  strumento.girata = false;
  // Finito il mazzo: il concetto di ogni vocabolo va in ripasso_stato una volta sola, con la media delle carte.
  // Se la tabella non c'è ancora la scrittura non riesce e resta lo stato locale.
  if (strumento.fatte.length === strumento.mazzo.length) salvaRipassoStato(sb, mediePerConcetto(strumento.fatte), {}, oggi);
  disegnaCarta();
}

function disegnaParla(nuovo) {
  const d = strumento.dati;
  if (nuovo) { strumento.frasi = d.frasi.length ? d.frasi : d.vocaboli.map((v) => v.parola); strumento.iFrase = 0; strumento.scrivi = !Riconoscimento; }
  const f = strumento.frasi[strumento.iFrase % strumento.frasi.length];
  $("str-parte").innerHTML = '<p class="aiuto">' + esc(d.frasi.length ? "Una frase dei tuoi appunti. Ascoltala, poi dilla tu." : "Una parola dei tuoi appunti. Ascoltala, poi dilla tu.") + "</p>" +
    '<p class="frase-lingua" lang="' + esc(d.lingua) + '">' + esc(f) + "</p>" +
    '<div class="bottoni">' + bottoneAscolta(f, "Ascolta") + (Riconoscimento ? '<button type="button" class="azione" id="btn-parla">Parla tu</button>' : "") + "</div>" +
    (strumento.scrivi ? '<label for="parla-scritto" class="etichetta">' + esc(Riconoscimento ? "Oppure scrivila" : "Qui il microfono non funziona: scrivila") + '</label><div class="prova-riga"><input type="text" id="parla-scritto" lang="' + esc(d.lingua) + '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<button type="button" class="minore" id="btn-parla-scritto">Controlla</button></div>' : "") +
    '<div id="parla-esito" aria-live="polite"></div>' +
    (strumento.frasi.length > 1 ? '<p class="link-riga"><button type="button" class="link" id="btn-altra-frase">Un\'altra</button></p>' : "");
  const p = $("btn-parla"); if (p) p.onclick = () => ascoltaFrase(f, p);
  const s = $("btn-parla-scritto"); if (s) s.onclick = () => mostraConfronto(f, [$("parla-scritto").value]);
  const ps = $("parla-scritto"); if (ps) ps.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); s.click(); } };
  const al = $("btn-altra-frase"); if (al) al.onclick = () => { fermaStrumento(); strumento.iFrase++; disegnaParla(); };
}

function mostraConfronto(attesa, detti) {
  // Il riconoscimento propone più letture: vale quella più vicina alla frase attesa.
  const r = detti.map((t) => confrontaFrase(attesa, t)).sort((x, y) => y.parole.filter((p) => p.ok).length - x.parole.filter((p) => p.ok).length)[0] || confrontaFrase(attesa, "");
  $("parla-esito").innerHTML = r.vuota ? "<p>" + esc(correzioneGentile(r)) + "</p>" :
    '<p class="parole-dette" lang="' + esc(strumento.dati.lingua) + '">' + r.parole.map((p) => '<span data-ok="' + (p.ok ? 1 : 0) + '">' + esc(p.parola) + "</span>").join(" ") + "</p>" +
    "<p>" + semaforo(r.giusta, r.giusta ? "Ci sei" : "Non ancora") + " " + esc(correzioneGentile(r)) + "</p>" +
    (detti[0] ? '<p class="legenda">Ho capito: «' + esc(detti[0]) + "»</p>" : "");
}

async function ascoltaFrase(attesa, btn) {
  const lingua = strumento.dati.lingua, out = $("parla-esito");
  if (ascoltoStrumento) return;
  if (!(await provaMicrofono())) { errore(out, messaggioVoce(erroreVoce, lingua)); strumento.scrivi = true; return; }
  fermaStrumento();
  const r = new Riconoscimento();
  r.lang = lingua; r.continuous = false; r.interimResults = false; r.maxAlternatives = 3;
  ascoltoStrumento = r; btn.disabled = true; btn.textContent = "Ti ascolto";
  const fine = (testi, codice) => {
    if (ascoltoStrumento !== r) return;
    ascoltoStrumento = null; btn.disabled = false; btn.textContent = "Parla tu";
    if (codice) { errore(out, messaggioVoce(codice, lingua)); if (!$("parla-scritto")) { strumento.scrivi = true; disegnaParla(); errore($("parla-esito"), messaggioVoce(codice, lingua)); } return; }
    mostraConfronto(attesa, testi);
  };
  r.onresult = (ev) => fine([...ev.results[0]].map((x) => x.transcript));
  // "no-speech" e "aborted" non sono guasti: non ha sentito niente. Gli altri errori dicono cosa fare.
  r.onerror = (ev) => fine([], ev.error === "no-speech" || ev.error === "aborted" ? null : ev.error || "sconosciuto");
  r.onend = () => fine([], null);
  try { r.start(); } catch (e) { fine([], "sconosciuto"); }
}

/* ---- geografia e scienze: schema da completare */

function disegnaSchema(nuovo = true) {
  const d = strumento.dati;
  if (nuovo) { strumento.posti = d.etichette.map(() => null); strumento.scelta = null; strumento.controllato = null; strumento.mazzo = d.etichette.map((e) => e.termine).sort(() => Math.random() - 0.5); }
  const { posti, scelta, controllato: c } = strumento, liberi = strumento.mazzo.filter((t) => !posti.includes(t));
  $("str-corpo").innerHTML = '<h2 class="schema-titolo">' + esc(d.titolo) + "</h2>" +
    '<p class="aiuto">Tocca un termine, poi il posto dove va. Oppure trascinalo sul posto.</p>' +
    svgSchema(d, posti, c ? c.giusti : null) +
    '<div class="etichette" id="str-etichette" aria-label="Termini da sistemare">' + (liberi.length ? liberi.map((t) =>
      '<button type="button" class="etichetta-sc" data-termine="' + esc(t) + '" aria-pressed="' + (scelta === t) + '">' + esc(t) + "</button>").join("") : '<p class="legenda">Tutti i termini sono al loro posto.</p>') + "</div>" +
    '<ol class="posti">' + d.etichette.map((e, i) => '<li data-posto="' + i + '"' + (c ? ' data-esito="' + (c.giusti[i] ? "giusto" : "no") + '"' : "") + '><span class="num" aria-hidden="true">' + (i + 1) + "</span><span>" +
      (c && c.tutto ? '<span class="citazione">' + evidenzia(e.ancora) + "</span>" : '<mark class="evidenzia">' + esc(mascheraTermine(e.ancora, e.termine)) + "</mark>") +
      '<button type="button" class="posto" data-posto="' + i + '" aria-label="Posto ' + (i + 1) + ": " + esc(posti[i] || "vuoto") + '">' +
      (c ? semaforo(c.giusti[i], posti[i] || "vuoto") : posti[i] ? esc(posti[i]) : "metti qui") + "</button></span></li>").join("") + "</ol>" +
    '<div id="esito-schema" aria-live="polite">' + (c ? "<p><b>" + (c.tutto ? "Schema completo." : c.quanti + " su " + posti.length + " al posto giusto.") + "</b> " +
      esc(c.tutto ? "Sotto ogni posto ora c'è la frase intera dei tuoi appunti." : "Togli quelli con la ✕ toccandoli e riprova.") + "</p>" : "") + "</div>" +
    '<div class="bottoni">' + (c && c.tutto ? '<button type="button" class="minore" id="btn-schema-ancora">Rifallo</button>'
      : '<button type="button" class="azione" id="btn-controlla-schema"' + (posti.some((x) => !x) ? " disabled" : "") + ">Controlla</button>") + "</div>";
  const corpo = $("str-corpo");
  corpo.onclick = (e) => {
    const t = e.target.closest("[data-termine]"), p = e.target.closest("[data-posto]");
    if (t) { strumento.scelta = strumento.scelta === t.dataset.termine ? null : t.dataset.termine; disegnaSchema(false); const b = corpo.querySelector('[data-termine="' + CSS.escape(t.dataset.termine) + '"]'); if (b) b.focus(); }
    else if (p) mettiNelPosto(Number(p.dataset.posto), strumento.scelta);
  };
  corpo.querySelectorAll(".posto-svg").forEach((g) => { g.setAttribute("tabindex", "-1"); }); // il disegno si tocca; da tastiera ci sono i bottoni dell'elenco
  trascinaEtichette($("str-etichette"), (termine, posto) => mettiNelPosto(posto, termine));
  const ct = $("btn-controlla-schema"); if (ct) ct.onclick = () => { strumento.controllato = controllaSchema(strumento.posti, d.etichette); disegnaSchema(false); $("esito-schema").scrollIntoView({ block: "nearest" }); };
  const an = $("btn-schema-ancora"); if (an) an.onclick = () => disegnaSchema(true);
}
// Con un termine scelto lo mette nel posto (quello che c'era torna fra i termini); senza, toglie quello che c'è.
function mettiNelPosto(i, termine) {
  const posti = strumento.posti;
  if (termine) { const prima = posti.indexOf(termine); if (prima >= 0) posti[prima] = null; posti[i] = termine; }
  else posti[i] = null;
  strumento.scelta = null; strumento.controllato = null;
  disegnaSchema(false);
}
// Trascinare un termine sul posto con i pointer events (anche col dito): se il dito non si muove è un tocco normale.
function trascinaEtichette(box, metti) {
  let presa = null;
  box.onpointerdown = (e) => {
    const b = e.target.closest("[data-termine]"); if (!b) return;
    presa = { b, x: e.clientX, y: e.clientY, mosso: false };
    try { b.setPointerCapture(e.pointerId); } catch (x) { /* niente */ }
  };
  box.onpointermove = (e) => {
    if (!presa) return;
    const dx = e.clientX - presa.x, dy = e.clientY - presa.y;
    if (!presa.mosso && Math.hypot(dx, dy) < 8) return;
    presa.mosso = true; presa.b.dataset.presa = "1";
    presa.b.style.transform = "translate(" + dx + "px," + dy + "px)";
  };
  box.onpointerup = (e) => {
    if (!presa) return;
    const { b, mosso } = presa; presa = null;
    if (!mosso) return; // il click fa il resto
    b.style.visibility = "hidden";
    const sotto = document.elementFromPoint(e.clientX, e.clientY), posto = sotto && sotto.closest("[data-posto]");
    b.style.visibility = ""; b.style.transform = ""; delete b.dataset.presa;
    b.addEventListener("click", (ev) => ev.stopPropagation(), { capture: true, once: true }); // il click dopo il trascinamento non sceglie
    if (posto) metti(b.dataset.termine, Number(posto.dataset.posto));
  };
  box.onpointercancel = () => { if (presa) { presa.b.style.transform = ""; delete presa.b.dataset.presa; presa = null; } };
}

function collegaStrumento() {
  $("btn-strumento").addEventListener("click", () => { if (corrente) apriStrumento(corrente); });
}
