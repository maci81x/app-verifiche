// Pronta per la verifica. Nasce dal prototipo validato (prototipo/prova-verifiche.html):
// stessa struttura, stesse viste, stessi testi. Al posto della sessione claude.ai ci
// sono Supabase (dati, foto, profili) e la Edge Function `modello` (lettura delle
// foto, concetti, domande con filtro di ancoraggio, correzione).
//
// Le funzioni pure stanno al primo livello del file, così i test le caricano con vm
// senza browser (come in Shanghai Card). Tutto ciò che tocca il DOM parte da avvia().
"use strict";

const SB_URL = "https://nnzkmjpylwtinplepxgz.supabase.co";
const SB_KEY = "sb_publishable_WTCYzSgAc_rVk7r04sdT8w_VFUwzFHJ"; // chiave pubblica: la sicurezza la fanno le policy RLS
const BUCKET = "fonti";
const LATO_MAX = 2000, PER_GRUPPO = 4, ATTESA_RIPROVA = 1800;
const GRUPPO_ILLEGGIBILE = "[gruppo di foto non leggibile]";

/* =================================================================== logica pura */

const MATERIE = [
  ["matematica", ["matemat", "geometr", "algebr", "aritmet"], 196, 62],
  ["storia", ["storia", "storic", "civilt", "medioev"], 24, 62],
  ["geografia", ["geograf"], 168, 52],
  ["scienze", ["scienz", "biolog", "chimic", "fisica"], 280, 44],
  ["inglese", ["ingles", "english"], 320, 46],
  ["spagnolo", ["spagnol", "frances", "tedesc"], 42, 68],
  ["arte", ["arte", "immagin", "disegn"], 350, 52],
  ["tecnologia", ["tecnolog", "informat"], 150, 44],
  ["musica", ["music"], 262, 48],
  ["motoria", ["motoria", "educazione fisica", "sportiv"], 95, 46],
  ["italiano", ["italian", "grammat", "letterat", "epic", "antolog"], 224, 56],
];
function slugMateria(nome) {
  const n = String(nome || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return MATERIE.find((m) => m[1].some((k) => n.indexOf(k) >= 0)) || null;
}

/* 0% -> 3, 60% -> 6 (sufficienza), 100% -> 10, come la scala italiana (prototipo) */
function voto(indice) {
  const v = indice <= 60 ? 3 + indice * 3 / 60 : 6 + (indice - 60) * 4 / 40;
  return Math.max(3, Math.min(10, Math.round(v * 2) / 2));
}
function votoIt(v) { return String(v).replace(".5", ",5").replace(/\.0$/, ""); }
function statoDaMedia(m) { return m >= 8 ? "verde" : (m >= 5 ? "giallo" : "rosso"); }
function fasciaVoto(v) { return v >= 8 ? "verde" : (v >= 6 ? "giallo" : "rosso"); }

function mescola(n) {
  const a = []; for (let i = 0; i < n; i++) a.push(i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function aGruppi(lista, n = PER_GRUPPO) {
  const g = []; for (let i = 0; i < lista.length; i += n) g.push(lista.slice(i, i + n)); return g;
}

// Pagine del materiale, per decidere quanti concetti chiedere: una per foto,
// più una ogni 2000 caratteri di testo scritto a mano.
function pagineMateriale(nFoto, testoManuale) {
  const t = String(testoManuale || "").trim().length;
  return Math.max(1, nFoto + (t ? Math.ceil(t / 2000) : 0));
}

// Esito di una prova (prototipo, mostraEsito): media per concetto, indice pesato, voto.
// domande: [{ id, concetto_id, peso }]; punti: { [id]: 0..10 }
function calcolaEsito(domande, punti) {
  const perC = {};
  for (const d of domande) {
    const x = perC[d.concetto_id] || (perC[d.concetto_id] = { s: 0, n: 0, peso: d.peso || 1 });
    x.s += punti[d.id]; x.n++;
  }
  let pesoTot = 0, puntiTot = 0;
  const concetti = Object.keys(perC).map((cid) => {
    const x = perC[cid], media = x.s / x.n;
    pesoTot += x.peso; puntiTot += media * x.peso;
    return { concetto_id: cid, media, stato: statoDaMedia(media), peso: x.peso };
  });
  const indice = pesoTot ? Math.round(puntiTot / pesoTot * 10) : 0;
  const rossiPesanti = concetti.filter((c) => c.stato === "rosso" && c.peso >= 2).length;
  return { indice, voto: voto(indice), concetti, rossiPesanti, pronta: indice >= 75 && !rossiPesanti };
}

// Andamento di una materia sulle ultime dieci prove (prototipo, disegnaStorico).
function andamento(votiInOrdine) {
  const v = votiInOrdine.slice(-10);
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  const delta = v.length > 1 ? v[v.length - 1] - v[0] : 0;
  return { voti: v, media: Math.round(media * 2) / 2, verso: delta > 0.4 ? "su" : (delta < -0.4 ? "giu" : "pari") };
}

/* ---- voce: cosa ha detto l'alunna ---- */

function piatto(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
const NON_LO_SO = /^(non (lo )?so|boh|non me lo ricordo|non ricordo|non mi ricordo|passo|vai avanti|salta)$/;
function eNonLoSo(detto) { return NON_LO_SO.test(piatto(detto)); }

// Quale opzione ha scelto a voce: "la b", "lettera c", "la seconda", oppure il testo
// dell'opzione. -1 se non si capisce: meglio richiedere che indovinare.
function opzioneDetta(detto, opzioni) {
  const t = piatto(detto);
  if (!t) return -1;
  const lettere = { a: 0, b: 1, bi: 1, c: 2, ci: 2, d: 3, di: 3 };
  const m = t.match(/^(?:(?:la|lettera|risposta|e la|e)\s+)*(a|b|bi|c|ci|d|di)$/);
  if (m) return lettere[m[1]];
  const ord = ["prima", "seconda", "terza", "quarta"].findIndex((o) => new RegExp("\\b" + o + "\\b").test(t));
  if (ord >= 0 && ord < opzioni.length) return ord;
  let migliore = -1, punteggio = 0;
  opzioni.forEach((o, i) => {
    const parole = piatto(o).split(" ").filter((w) => w.length > 2 || /\d/.test(w));
    if (!parole.length) return;
    const p = parole.filter((w) => (" " + t + " ").includes(" " + w + " ")).length / parole.length;
    if (p > punteggio) { punteggio = p; migliore = i; }
  });
  return punteggio >= 0.6 ? migliore : -1;
}

// Come la prof quando l'alunna si blocca: riformula con un aiuto. Senza chiamare il modello,
// per non far aspettare: l'aiuto è il primo elemento atteso della risposta.
// ponytail: aiuto a modello fisso; se suona meccanico, farlo generare alla funzione.
function domandaGuidata(d) {
  if (d.tipo === "chiusa")
    return "Ti aiuto: te le rileggo con calma. " + d.testo + " " + leggiOpzioni(d);
  const aiuto = (d.elementi || [])[0];
  return "Proviamo così. " + (aiuto ? "Parti da qui: " + aiuto + ". " : "") + d.testo;
}
function leggiOpzioni(d) {
  return (d._ord || d.opzioni.map((_, i) => i)).map((j, pos) => "ABCD"[pos] + ": " + d.opzioni[j] + ".").join(" ");
}

// "Cosa studiare": per ogni concetto lo stato della sua prova più recente (media dei
// punti in quella prova: è lo stesso stato che salvaProva scrive sul concetto),
// quante volte è stato sbagliato (sotto 8, come "solo quelle sbagliate"), rossi in
// cima; a pari stato prima quello verificato più di recente.
// righe: [{ concetto_id, sessione_id, data, punteggio }].
const SBAGLIATA = 8, ORDINE_STATO = { rosso: 0, giallo: 1, mai: 2, verde: 3 };
function testoVolte(x) {
  if (x.sbagliato) return "sbagliato " + x.sbagliato + (x.sbagliato === 1 ? " volta" : " volte");
  return x.stato === "mai" ? "mai verificato" : "mai sbagliato";
}
// Titolo e materia di una prova su uno o più argomenti (il ripasso ne mescola diversi).
function titoloEMateria(args, ripasso) {
  const mats = [...new Set(args.map((a) => a.materia))];
  return {
    materia: mats.length === 1 ? mats[0] : "varie",
    titolo: ripasso ? ("Ripasso" + (mats.length === 1 ? " di " + mats[0] : " del quadrimestre")) : args[0].titolo,
  };
}
function cosaStudiare(concetti, righe) {
  const perConcetto = {};
  (righe || []).filter((r) => r.concetto_id).forEach((r) => {
    (perConcetto[r.concetto_id] = perConcetto[r.concetto_id] || []).push(r);
  });
  return (concetti || []).map((c) => {
    const mie = perConcetto[c.id] || [];
    const quando = (r) => Date.parse(r.data) || 0;
    const ultimaVolta = mie.reduce((m, r) => Math.max(m, quando(r)), 0);
    const ultima = mie.filter((r) => quando(r) === ultimaVolta);
    const media = ultima.length ? ultima.reduce((s, r) => s + Number(r.punteggio || 0), 0) / ultima.length : null;
    return {
      id: c.id, titolo: c.titolo, ancora: c.ancora, errore_appunti: c.errore_appunti || null,
      peso: c.peso || 2, ordine: c.ordine || 0, media, ultimaVolta,
      stato: media == null ? "mai" : statoDaMedia(media),
      sbagliato: mie.filter((r) => Number(r.punteggio || 0) < SBAGLIATA).length,
    };
  }).sort((x, y) => ORDINE_STATO[x.stato] - ORDINE_STATO[y.stato] || y.ultimaVolta - x.ultimaVolta ||
    y.sbagliato - x.sbagliato || y.peso - x.peso || x.ordine - y.ordine);
}

// Mappa concettuale in SVG, senza librerie. Sotto i 600px albero indentato in verticale
// (sull'iPhone niente scorrimento orizzontale), da 600px in su in orizzontale.
// La larghezza del testo è stimata (carattere ≈ 0,56 del corpo): il riquadro va a capo prima.
const MAPPA = {
  soglia: 600, margine: 8, rientro: 18, spazio: 28, px: 10, py: 7, stacco: 6, staccoRami: 14,
  interlinea: 1.3, carattere: 0.56, pallino: 14, corpo: [17, 15, 13.5, 12.5],
};
const arrotonda = (v) => Math.round(v * 10) / 10;

// Spezza il testo in righe di al massimo `caratteri`; una parola troppo lunga va a capo col trattino.
function aCapo(testo, caratteri) {
  const max = Math.max(4, caratteri);
  const righe = [];
  let riga = "";
  String(testo || "").split(/\s+/).filter(Boolean).forEach((parola) => {
    let p = parola;
    while (p.length > max) {
      if (riga) { righe.push(riga); riga = ""; }
      righe.push(p.slice(0, max - 1) + "-"); p = p.slice(max - 1);
    }
    if (!riga) riga = p;
    else if ((riga + " " + p).length <= max) riga += " " + p;
    else { righe.push(riga); riga = p; }
  });
  if (riga || !righe.length) righe.push(riga);
  return righe;
}

// Riquadro di un nodo largo `larghezza`: quante lettere ci stanno, le righe e l'altezza.
const FONTE_WEB = "web", ETICHETTA_WEB = "dal web";
function misuraNodo(n, livello, larghezza, carattere) {
  const corpo = MAPPA.corpo[livello];
  const utile = larghezza - 2 * MAPPA.px - (livello === 1 ? MAPPA.pallino : 0);
  const caratteri = Math.max(4, Math.floor(utile / (corpo * carattere)));
  // Un nodo arrivato dal web porta sempre l'etichetta, anche in stampa (issue #4).
  const righe = [...aCapo(n.titolo, caratteri), ...(n.fonte === FONTE_WEB ? [ETICHETTA_WEB] : [])];
  return { caratteri, righe, w: arrotonda(larghezza), h: arrotonda(2 * MAPPA.py + righe.length * corpo * MAPPA.interlinea) };
}
const nodoMappa = (n, livello, x, y, m) => ({
  id: n.id || "radice", livello, titolo: n.titolo || "", ancora: n.ancora || "", fonte: n.fonte || "",
  toccabile: !!(n.ancora || n.url), // al tocco mostra la frase degli appunti, o testo e link del web
  x: arrotonda(x), y: arrotonda(y), w: m.w, h: m.h, righe: m.righe, caratteri: m.caratteri,
});
const livelliMappa = (n) => 1 + (n.figli || []).reduce((p, f) => Math.max(p, livelliMappa(f)), 0);

function mappaVerticale(radice, w, carattere) {
  const nodi = [], linee = [];
  let y = MAPPA.margine;
  const posa = (n, livello, padre) => {
    if (livello === 1) y += MAPPA.staccoRami - MAPPA.stacco;
    const x = MAPPA.margine + livello * MAPPA.rientro;
    const nodo = nodoMappa(n, livello, x, y, misuraNodo(n, livello, w - x - MAPPA.margine, carattere));
    nodi.push(nodo);
    // dal bordo basso del padre scende e piega verso il figlio
    if (padre) linee.push({ livello, fonte: nodo.fonte, d: "M" + arrotonda(padre.x + 9) + " " + arrotonda(padre.y + padre.h) + " V" + arrotonda(nodo.y + nodo.h / 2) + " H" + nodo.x });
    y = nodo.y + nodo.h + MAPPA.stacco;
    (n.figli || []).forEach((f) => posa(f, livello + 1, nodo));
  };
  posa(radice, 0, null);
  return { w, h: Math.ceil(y - MAPPA.stacco + MAPPA.margine), verticale: true, nodi, linee };
}

function mappaOrizzontale(radice, w, carattere) {
  const colonne = livelliMappa(radice);
  const col = (w - 2 * MAPPA.margine - MAPPA.spazio * (colonne - 1)) / colonne;
  const misure = new Map(), nodi = [], linee = [];
  // altezza di ogni sotto-albero: il padre sta a metà dei suoi figli
  const alto = (n, livello) => {
    const m = misuraNodo(n, livello, col, carattere), stacco = livello === 0 ? MAPPA.staccoRami : MAPPA.stacco;
    const figli = (n.figli || []).reduce((s, f, i) => s + alto(f, livello + 1) + (i ? stacco : 0), 0);
    const tot = Math.max(m.h, figli);
    misure.set(n, { m, figli, tot, stacco });
    return tot;
  };
  const posa = (n, livello, sopra, padre) => {
    const { m, figli, tot, stacco } = misure.get(n);
    const nodo = nodoMappa(n, livello, MAPPA.margine + livello * (col + MAPPA.spazio), sopra + (tot - m.h) / 2, m);
    nodi.push(nodo);
    if (padre) {
      const x1 = arrotonda(padre.x + padre.w), y1 = arrotonda(padre.y + padre.h / 2), y2 = arrotonda(nodo.y + nodo.h / 2);
      const xm = arrotonda((x1 + nodo.x) / 2);
      linee.push({ livello, fonte: nodo.fonte, d: "M" + x1 + " " + y1 + " C" + xm + " " + y1 + " " + xm + " " + y2 + " " + nodo.x + " " + y2 });
    }
    let t = sopra + (tot - figli) / 2;
    (n.figli || []).forEach((f) => { posa(f, livello + 1, t, nodo); t += misure.get(f).tot + stacco; });
  };
  const tot = alto(radice, 0);
  posa(radice, 0, MAPPA.margine, null);
  return { w, h: Math.ceil(tot + 2 * MAPPA.margine), verticale: false, nodi, linee };
}

// albero: { titolo, nodi: [{ id, titolo, ancora, fonte, figli }] } → posizioni di nodi e linee.
// carattere: larghezza stimata di una lettera rispetto al corpo; il browser la alza se il testo sborda.
function layoutMappa(albero, larghezza, carattere = MAPPA.carattere) {
  const w = Math.max(280, Math.floor(larghezza));
  const radice = { id: "radice", titolo: albero.titolo, figli: albero.nodi || [] };
  return w < MAPPA.soglia ? mappaVerticale(radice, w, carattere) : mappaOrizzontale(radice, w, carattere);
}

// stati: { [concetto_id]: "rosso" | "giallo" | "verde" | "mai" } per il pallino dei concetti
function svgMappa(layout, stati) {
  const conFonte = (f) => (f === FONTE_WEB ? ' data-fonte="web"' : "");
  const parti = layout.linee.map((k) => '<path class="m-linea" data-l="' + k.livello + '"' + conFonte(k.fonte) + ' d="' + k.d + '"/>');
  layout.nodi.forEach((n) => {
    const corpo = MAPPA.corpo[n.livello], dx = n.livello === 1 ? MAPPA.pallino : 0;
    const etichetta = (i) => n.fonte === FONTE_WEB && i === n.righe.length - 1 ? ' class="m-etichetta"' : "";
    const righe = n.righe.map((t, i) => '<tspan' + etichetta(i) + ' x="' + arrotonda(n.x + MAPPA.px + dx) + '" y="' +
      arrotonda(n.y + MAPPA.py + corpo * (0.95 + i * MAPPA.interlinea)) + '">' + esc(t) + "</tspan>").join("");
    const pallino = n.livello === 1
      ? '<circle class="m-pallino" data-s="' + esc((stati || {})[n.id] || "mai") + '" cx="' + arrotonda(n.x + MAPPA.px + 4) +
        '" cy="' + arrotonda(n.y + MAPPA.py + corpo * 0.62) + '" r="4.5"/>'
      : "";
    parti.push('<g class="m-nodo" data-id="' + esc(n.id) + '" data-l="' + n.livello + '"' + conFonte(n.fonte) +
      (n.toccabile ? ' tabindex="0" role="button"' : "") + ' aria-label="' + esc(n.titolo) + '">' +
      '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="10"/>' + pallino +
      '<text style="font-size:' + corpo + 'px">' + righe + "</text></g>");
  });
  return '<svg class="mappa" viewBox="0 0 ' + layout.w + " " + layout.h + '" width="100%" aria-label="Mappa concettuale">' + parti.join("") + "</svg>";
}

/* =================================================================== stato */

let sb = null;              // client Supabase del profilo attivo
let profilo = null;         // { id, nome, chiave }
let argomenti = [], sessioni = [], filtroMat = "";
let foto = [], corrente = null, modo = "argomento";
let domande = [], idx = 0, risposte = {}, scartate = 0, argsProva = [];
let livello = "medio", tipo = "miste", modalita = "scritta";
let titoloProva = "", materiaProva = "", timer = null;
let dettaglio = [], soloErrori = false;
// Ultimo "Cosa studiare" e ultimo esito mostrati: li riusa la stampa (stampa.js).
let listaStudiare = [], esitoMostrato = null;

/* =================================================================== utilità DOM */

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]); }
function dataOraIt(iso) { try { return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
function dataIt(iso) { try { return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" }); } catch (e) { return ""; } }
function tinta(el, nome) {
  const m = slugMateria(nome);
  if (!m) { el.style.removeProperty("--h"); el.style.removeProperty("--s"); return; }
  el.style.setProperty("--h", m[2]); el.style.setProperty("--s", m[3] + "%");
}
function attesa(el, frasi) {
  if (timer) { clearInterval(timer); timer = null; }
  if (!frasi) { el.innerHTML = ""; return; }
  let i = 0;
  el.innerHTML = '<div class="stato"><span class="punto"></span><span id="frase-' + el.id + '">' + esc(frasi[0]) + "</span></div>";
  timer = setInterval(() => { i = (i + 1) % frasi.length; const f = $("frase-" + el.id); if (f) f.textContent = frasi[i]; }, 3200);
}
function passoAttesa(el, testo) { const f = el.querySelector("span[id^=frase-]"); if (f) f.textContent = testo; }
function errore(el, t) { el.innerHTML = t ? '<div class="errore">' + esc(t) + "</div>" : ""; }
function avviso(el, t) { el.innerHTML = t ? '<div class="avviso">' + esc(t) + "</div>" : ""; }

// Conferma a doppio tocco (prototipo): il primo tocco cambia la scritta, il secondo esegue.
function doppioTocco(btn, testoConferma, fn) {
  if (btn.dataset.c !== "1") {
    btn.dataset.c = "1"; btn.dataset.orig = btn.textContent; btn.textContent = testoConferma;
    setTimeout(() => { if (btn.dataset.c === "1") { btn.dataset.c = ""; btn.textContent = btn.dataset.orig; } }, 5000);
    return;
  }
  btn.dataset.c = ""; btn.textContent = btn.dataset.orig; fn();
}

const VISTE = { profili: ["Profilo", 0], codice: ["Codice", 0], impostazioni: ["Impostazioni", 0], libreria: ["Libreria", 0], materiale: ["Materiale", 1], concetti: ["Concetti", 2], scheda: ["Argomento", 0], mappa: ["Mappa", 0], stampa: ["Stampa", 0], spiega: ["Spiegamelo meglio", 0], storico: ["Storico", 0], ripasso: ["Ripasso", 2], verifica: ["Verifica", 3], esito: ["Esito", 4] };
function vai(v, materia) {
  if (v !== "verifica") fermaVoce();
  Object.keys(VISTE).forEach((k) => { $("v-" + k).hidden = (k !== v); });
  document.body.dataset.vista = v; // in stampa il CSS nasconde tutto tranne il documento
  const info = VISTE[v];
  $("nome-passo").textContent = info[0];
  document.querySelectorAll(".tacche i").forEach((el) => { el.dataset.on = (+el.dataset.t <= info[1]) ? "1" : "0"; });
  $("conta-passo").textContent = info[1] ? ("passo " + info[1] + " di 4") : (profilo ? profilo.nome : "");
  $("btn-rail-indietro").hidden = (v === "libreria" || v === "profili" || v === "codice" || v === "impostazioni");
  const chip = $("chip-materia");
  if (materia) { chip.hidden = false; chip.textContent = materia; tinta(document.documentElement, materia); }
  else if (VISTE[v][1] === 0 && v !== "scheda" && v !== "storico") { chip.hidden = true; tinta(document.documentElement, null); }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =================================================================== profili */
// Ogni studentessa è un utente Supabase distinto, creato dalla funzione `profili`
// quando il genitore aggiunge il profilo dalle impostazioni: email e password le
// genera il server e non escono mai da lì. Da qualsiasi telefono la ragazza tocca
// il suo nome e digita il codice: la funzione `accedi` controlla il codice (e il
// blocco dopo tre errori) sul server e restituisce la sessione del profilo, che
// sul telefono vive in una chiave diversa di localStorage per ogni profilo.
// localStorage tiene anche una copia dei nomi, solo per disegnare subito la
// schermata, e l'ultimo profilo usato.

const CHIAVE_PROFILI = "verifiche-profili", CHIAVE_ULTIMO = "verifiche-ultimo";
const MSG_RETE_PROFILI = "Non riesco a caricare i profili: controlla la connessione.";
const MSG_NESSUN_PROFILO = "Ancora nessun profilo: il genitore li crea da Impostazioni, qui sotto.";

const chiaveSessione = (id) => "sb-verifiche-" + id;

// Dalla risposta di accedi/elenco ai profili da disegnare: scarta ciò che non è un profilo.
function profiliDaElenco(dati) {
  if (!Array.isArray(dati)) return null;
  return dati
    .filter((s) => s && typeof s.id === "string" && typeof s.nome === "string" && s.nome.trim())
    .map((s) => ({ id: s.id, nome: s.nome, classe: s.classe || "", chiave: chiaveSessione(s.id) }));
}
// L'ultimo profilo usato in cima, gli altri nell'ordine del server.
function ordinaProfili(lista, ultimoId) {
  const primo = lista.filter((p) => p.id === ultimoId);
  return primo.concat(lista.filter((p) => p.id !== ultimoId));
}
// Risposta di accedi/entra → cosa fare sulla schermata del codice.
function esitoAccesso(status, dati) {
  const d = dati || {};
  if (status === 200 && d.ok && d.access_token && d.refresh_token) return { tipo: "dentro", sessione: { access_token: d.access_token, refresh_token: d.refresh_token } };
  const s = Math.max(0, Math.ceil(Number(d.attendi) || 0));
  if (status === 401 && s > 0) return { tipo: "attendi", secondi: s };
  if (status === 401) return { tipo: "sbagliato" };
  return { tipo: "errore" };
}
function testoAttesa(s) { return "Troppi tentativi. Riprova fra " + s + (s === 1 ? " secondo." : " secondi."); }

function leggiLocale(chiave, predefinito) { try { const v = JSON.parse(localStorage.getItem(chiave)); return v == null ? predefinito : v; } catch (e) { return predefinito; } }
function salvaLocale(chiave, v) { try { localStorage.setItem(chiave, JSON.stringify(v)); } catch (e) { /* niente: è solo una copia */ } }

const clients = {};
function clientPer(chiave) {
  return clients[chiave] || (clients[chiave] = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { storageKey: chiave, persistSession: true, autoRefreshToken: true },
  }));
}

// Funzione anonima: solo la chiave pubblica, nessuna sessione.
async function accedi(corpo) {
  const r = await fetch(SB_URL + "/functions/v1/accedi", {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SB_KEY },
    body: JSON.stringify(corpo),
  });
  return { status: r.status, dati: await r.json().catch(() => null) };
}

function bottoneNome(p, classe) {
  const b = document.createElement("button"); b.type = "button"; if (classe) b.className = classe;
  const i = document.createElement("span"); i.className = "iniziale"; i.textContent = p.nome.slice(0, 1).toUpperCase();
  b.appendChild(i);
  return b;
}
function disegnaProfili(lista) {
  const box = $("scelta-profilo"); box.innerHTML = "";
  lista.forEach((p) => {
    const b = bottoneNome(p);
    const t = document.createElement("span"); t.innerHTML = "<b>" + esc(p.nome) + "</b><small>" + esc(p.classe || "") + "</small>";
    b.appendChild(t); b.onclick = () => apriCodice(p); box.appendChild(b);
  });
  // In libreria: gli altri profili, per passare all'altra (con il suo codice).
  const r = $("profili"); r.innerHTML = "";
  lista.forEach((p) => {
    const b = bottoneNome(p);
    b.setAttribute("aria-pressed", profilo && p.id === profilo.id ? "true" : "false");
    b.appendChild(document.createTextNode(p.nome));
    b.onclick = () => { if (!profilo || p.id !== profilo.id) apriCodice(p); };
    r.appendChild(b);
  });
}
function disegnaProfiliSalvati() {
  disegnaProfili(ordinaProfili(leggiLocale(CHIAVE_PROFILI, []), leggiLocale(CHIAVE_ULTIMO, null)));
}
// Disegna subito la copia locale, poi l'elenco vero dal server.
async function caricaProfili() {
  const ultimo = leggiLocale(CHIAVE_ULTIMO, null);
  disegnaProfiliSalvati();
  let lista = null;
  try {
    const r = await accedi({ azione: "elenco" });
    lista = r.status === 200 ? profiliDaElenco(r.dati) : null;
  } catch (e) { console.warn("elenco profili:", e); }
  if (!lista) { errore($("err-profili"), MSG_RETE_PROFILI); return; }
  salvaLocale(CHIAVE_PROFILI, lista);
  disegnaProfili(ordinaProfili(lista, ultimo));
  if (lista.length) errore($("err-profili"), ""); else avviso($("err-profili"), MSG_NESSUN_PROFILO);
}

// Il blocco dopo tre errori lo decide il server: qui solo il conto alla rovescia.
let codiceProfilo = null, codiceDigitato = "", timerBlocco = null, bloccoFino = {};
function apriCodice(p) {
  codiceProfilo = p; codiceDigitato = "";
  $("cod-nome").textContent = p.nome;
  $("cod-iniziale").textContent = p.nome.slice(0, 1).toUpperCase();
  $("cod-msg").textContent = "";
  aggiornaPallini(); mostraBlocco();
  vai("codice");
}
function aggiornaPallini() {
  $("cod-pallini").querySelectorAll("i").forEach((el, i) => { el.dataset.on = i < codiceDigitato.length ? "1" : "0"; });
}
const secondiAttesa = (id) => Math.max(0, Math.ceil(((bloccoFino[id] || 0) - Date.now()) / 1000));
function mostraBlocco() {
  clearInterval(timerBlocco);
  const aggiorna = () => {
    const s = codiceProfilo ? secondiAttesa(codiceProfilo.id) : 0;
    $("tastierino").setAttribute("aria-disabled", s ? "true" : "false");
    if (s) $("cod-msg").textContent = testoAttesa(s);
    else { clearInterval(timerBlocco); if (/Troppi/.test($("cod-msg").textContent)) $("cod-msg").textContent = ""; }
  };
  aggiorna(); timerBlocco = setInterval(aggiorna, 1000);
}
let controllo = false; // un codice alla volta mentre il server risponde
function tasto(n) {
  if (n === "esci") { clearInterval(timerBlocco); vai(profilo ? "libreria" : "profili"); return; }
  if (controllo || secondiAttesa(codiceProfilo.id)) return;
  if (n === "canc") codiceDigitato = codiceDigitato.slice(0, -1);
  else if (codiceDigitato.length < 4) codiceDigitato += n;
  aggiornaPallini();
  if (codiceDigitato.length === 4) verificaCodice();
}
function sbagliato(msg) {
  const pal = $("cod-pallini"); pal.classList.remove("scuoti"); void pal.offsetWidth; pal.classList.add("scuoti");
  $("cod-msg").textContent = msg; codiceDigitato = ""; aggiornaPallini();
}
// Una sola strada: anche con una sessione già sul telefono il codice lo controlla il server.
async function verificaCodice() {
  const p = codiceProfilo;
  controllo = true; $("tastierino").setAttribute("aria-disabled", "true");
  let es;
  try {
    const r = await accedi({ azione: "entra", studente_id: p.id, pin: codiceDigitato });
    es = esitoAccesso(r.status, r.dati);
  } catch (e) { console.warn("accesso:", e); es = { tipo: "rete" }; }
  controllo = false; $("tastierino").setAttribute("aria-disabled", "false");
  if (p !== codiceProfilo) return; // nel frattempo è tornata indietro

  if (es.tipo === "attendi") { bloccoFino = { ...bloccoFino, [p.id]: Date.now() + es.secondi * 1000 }; sbagliato(""); mostraBlocco(); return; }
  if (es.tipo === "sbagliato") { sbagliato("Codice sbagliato."); return; }
  if (es.tipo !== "dentro") { sbagliato(es.tipo === "rete" ? "Non riesco a controllare il codice: serve la connessione." : "Non riesco a entrare adesso. Riprova fra poco."); return; }

  const client = clientPer(chiaveSessione(p.id));
  const { error } = await client.auth.setSession(es.sessione);
  if (error) { console.warn("sessione:", error); sbagliato("Non riesco a entrare adesso. Riprova fra poco."); return; }
  salvaLocale(CHIAVE_ULTIMO, p.id);
  entraProfilo(p, client);
}
async function entraProfilo(p, client) {
  clearInterval(timerBlocco);
  sb = client; profilo = p;
  const { data: st } = await sb.from("studenti").select("scelte").eq("id", p.id).maybeSingle();
  if (st && st.scelte) { livello = st.scelte.livello || livello; tipo = st.scelte.tipo || tipo; modalita = st.scelte.modalita || modalita; }
  errore($("err-profili"), "");
  caricaLibreria(); vai("libreria");
}

/* ---- impostazioni: solo il genitore, con il suo account, mai salvato sul telefono ---- */

let genitore = null;
async function genEntra() {
  const email = $("gen-email").value.trim(), password = $("gen-password").value;
  errore($("err-imp"), "");
  if (!email || !password) { errore($("err-imp"), "Scrivi email e password del genitore."); return; }
  const client = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "sb-verifiche-genitore" } });
  $("btn-gen-entra").disabled = true;
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  $("btn-gen-entra").disabled = false; $("gen-password").value = "";
  if (error) { errore($("err-imp"), "Email o password non corretti."); return; }
  if (!data.user.app_metadata || data.user.app_metadata.ruolo !== "genitore") {
    await client.auth.signOut({ scope: "local" }); errore($("err-imp"), "Questo account non è segnato come genitore."); return;
  }
  genitore = client;
  $("imp-accesso").hidden = true; $("imp-pannello").hidden = false;
  disegnaImpostazioni();
}
function genEsci() {
  if (genitore) genitore.auth.signOut({ scope: "local" });
  genitore = null;
  $("imp-accesso").hidden = false; $("imp-pannello").hidden = true;
  $("gen-email").value = ""; $("gen-password").value = "";
  ["np-nome", "np-classe", "np-codice"].forEach((id) => { $(id).value = ""; });
  errore($("err-imp"), ""); caricaProfili(); vai(profilo ? "libreria" : "profili");
}
async function funzioneProfili(corpo) {
  const { data } = await genitore.auth.getSession();
  const r = await fetch(SB_URL + "/functions/v1/profili", {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SB_KEY, authorization: "Bearer " + data.session.access_token },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.errore || "errore " + r.status);
  return j;
}
const codiceValido = (c) => /^\d{4}$/.test(String(c || ""));

let figlie = [];
async function disegnaImpostazioni() {
  const box = $("imp-profili"); box.innerHTML = "";
  const { data, error } = await genitore.from("studenti").select("id, nome, classe").order("nome");
  if (error) { errore($("err-imp"), "Non riesco a leggere i profili. Riprova."); return; }
  figlie = data || [];
  if (!figlie.length) box.innerHTML = '<p class="legenda">Nessuno ancora.</p>';
  figlie.forEach((s) => {
    const d = document.createElement("div"); d.className = "riga-profilo";
    const b = document.createElement("b"); b.textContent = s.nome + (s.classe ? " · " + s.classe : ""); d.appendChild(b);
    const campo = document.createElement("input");
    campo.type = "password"; campo.inputMode = "numeric"; campo.maxLength = 4; campo.autocomplete = "off";
    campo.placeholder = "nuovo codice"; campo.className = "codice-nuovo"; campo.setAttribute("aria-label", "Nuovo codice per " + s.nome);
    const cc = document.createElement("button"); cc.type = "button"; cc.className = "minore"; cc.textContent = "Cambia codice";
    cc.onclick = () => cambiaCodice(s, campo, cc);
    d.appendChild(campo); d.appendChild(cc); box.appendChild(d);
  });
}
async function creaProfilo() {
  const nome = $("np-nome").value.trim(), classe = $("np-classe").value.trim(), codice = $("np-codice").value.trim();
  errore($("err-imp"), "");
  if (!nome) { errore($("err-imp"), "Scrivi il nome."); return; }
  if (!codiceValido(codice)) { errore($("err-imp"), "Il codice deve essere di 4 cifre."); return; }
  if (figlie.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) { errore($("err-imp"), "C'è già un profilo con questo nome."); return; }
  $("btn-np-crea").disabled = true; attesa($("stato-imp"), ["Creo il profilo di " + nome]);
  try {
    await funzioneProfili({ azione: "crea", nome, classe, codice });
    ["np-nome", "np-classe", "np-codice"].forEach((id) => { $(id).value = ""; });
    avviso($("err-imp"), "Profilo di " + nome + " pronto: da qualsiasi telefono tocca il nome e digita il codice.");
    caricaProfili();
  } catch (e) {
    console.warn("crea profilo:", e);
    errore($("err-imp"), "Non sono riuscito a creare il profilo. Riprova.");
  }
  attesa($("stato-imp"), null); $("btn-np-crea").disabled = false;
  disegnaImpostazioni();
}
async function cambiaCodice(s, campo, btn) {
  const codice = campo.value.trim();
  errore($("err-imp"), "");
  if (!codiceValido(codice)) { errore($("err-imp"), "Il codice deve essere di 4 cifre."); campo.focus(); return; }
  btn.disabled = true;
  try {
    await funzioneProfili({ azione: "codice", studente_id: s.id, codice });
    campo.value = "";
    bloccoFino = { ...bloccoFino, [s.id]: 0 };
    avviso($("err-imp"), "Codice di " + s.nome + " cambiato.");
  } catch (e) {
    console.warn("cambia codice:", e);
    errore($("err-imp"), "Non sono riuscito a cambiare il codice. Riprova.");
  }
  btn.disabled = false;
}

/* =================================================================== modello */

class Definitivo extends Error {}

// Chiama la Edge Function con il token della studentessa attiva.
async function modello(corpo) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(SB_URL + "/functions/v1/modello", {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SB_KEY, authorization: "Bearer " + (data.session ? data.session.access_token : "") },
    body: JSON.stringify(corpo),
  });
  const json = await r.json().catch(() => ({}));
  if (r.status === 429) throw new Definitivo("rate_limited");
  if (r.status === 401 || r.status === 403) throw new Definitivo("not_granted");
  if (!r.ok) { const e = new Error(json.errore || ("errore " + r.status)); e.dati = json; throw e; }
  return json;
}
// Un secondo tentativo dopo 1,8 secondi, tranne su errori definitivi (prototipo).
async function conRiprova(f) {
  try { return await f(); } catch (e) {
    if (e instanceof Definitivo) throw e;
    await new Promise((r) => setTimeout(r, ATTESA_RIPROVA));
    return f();
  }
}
function messaggioModello(e, predefinito) {
  if (e instanceof Definitivo && e.message === "rate_limited") return "Troppe richieste in poco tempo. Aspetta un minuto e riprova.";
  if (e instanceof Definitivo) return "Non riesco a parlare con il modello: rientra nel profilo e riprova.";
  return predefinito;
}

/* =================================================================== libreria */

async function caricaLibreria() {
  attesa($("stato-lib"), ["Apro la libreria"]);
  const [a, s] = await Promise.all([
    sb.from("argomenti").select("id, materia, titolo, trascrizione, origine, creato, aggiornato, " +
      "concetti(id, titolo, descrizione, ancora, peso, stato, media, tentativi, ordine, errore_appunti), " +
      "fonti(id, tipo, storage_path, riferimento_pagina)").order("aggiornato", { ascending: false }).limit(300),
    sb.from("sessioni").select("*").order("data", { ascending: false }).limit(500),
  ]);
  attesa($("stato-lib"), null);
  if (a.error || s.error) { errore($("avviso-db"), "Non riesco ad aprire la libreria. Controlla la connessione e riprova."); }
  argomenti = (a.data || []).map((x) => {
    x.concetti = (x.concetti || []).sort((p, q) => p.ordine - q.ordine);
    x.foto = (x.fonti || []).filter((f) => f.tipo === "foto" && f.storage_path).sort((p, q) => (p.riferimento_pagina || 0) - (q.riferimento_pagina || 0));
    return x;
  });
  sessioni = s.data || [];
  argomenti.forEach((x) => { x.ultima = sessioni.find((y) => y.argomento_id === x.id) || null; });
  disegnaProfiliSalvati(); disegnaLibreria();
}

function statoArg(a) {
  if (!a.ultima) return "mai";
  const i = a.ultima.indice;
  return i >= 75 ? "verde" : (i >= 50 ? "giallo" : "rosso");
}
function disegnaLibreria() {
  const som = $("sommario"), lista = $("lista-argomenti");
  const deboli = argomenti.filter((a) => statoArg(a) === "rosso" || statoArg(a) === "giallo").length;
  const mai = argomenti.filter((a) => !a.ultima).length;
  som.innerHTML = "";
  if (argomenti.length) {
    [[argomenti.length, "argomenti salvati", ""], [deboli, "da ripassare", deboli ? "rosso" : "verde"], [mai, "mai verificati", "giallo"]].forEach((t) => {
      const d = document.createElement("div"); d.className = "tess"; if (t[2]) d.dataset.s = t[2];
      d.innerHTML = "<b>" + t[0] + "</b><span>" + t[1] + "</span>"; som.appendChild(d);
    });
  }
  lista.innerHTML = "";
  $("occhiello-lib").hidden = !argomenti.length;
  $("btn-svuota").hidden = !argomenti.length && !sessioni.length;
  if (!argomenti.length) {
    lista.innerHTML = '<div class="vuoto"><b>Qui non c\'è ancora niente</b>Fotografa il primo argomento: da quel momento resta in libreria, con le sue foto, e lo ritrovi per i ripassi.</div>';
    return;
  }
  argomenti.forEach((a) => {
    const b = document.createElement("button"); b.className = "scheda"; b.type = "button";
    tinta(b, a.materia);
    const st = statoArg(a);
    b.innerHTML = '<div class="alto"><span class="tit">' + esc(a.titolo) + "</span>" +
      '<span class="stato-pill" data-s="' + st + '">' + (a.ultima ? a.ultima.indice + "%" : "mai verificato") + "</span></div>" +
      '<div class="meta"><span>' + esc(a.materia) + "</span><span>" + a.concetti.length + " concetti</span><span>" + a.foto.length + " foto</span><span>" + dataIt(a.aggiornato) + "</span></div>";
    b.onclick = () => apriScheda(a);
    lista.appendChild(b);
  });
}

/* =================================================================== nuovo argomento */

function ridimensiona(file) {
  return new Promise((res) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, LATO_MAX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => res(b || file), "image/jpeg", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}
function base64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function disegnaMiniature() {
  const c = $("miniature"); c.innerHTML = "";
  $("conta-foto").textContent = foto.length ? (foto.length + " foto · aggiungine quante vuoi") : "Nessuna foto ancora";
  foto.forEach((f, i) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img"); img.alt = "foto " + (i + 1); img.src = URL.createObjectURL(f);
    const b = document.createElement("button"); b.type = "button"; b.textContent = "×";
    b.setAttribute("aria-label", "togli la foto " + (i + 1));
    b.onclick = (ev) => { ev.preventDefault(); foto.splice(i, 1); disegnaMiniature(); };
    fig.appendChild(img); fig.appendChild(b); c.appendChild(fig);
  });
}

// Carica le foto ridotte nella cartella della studentessa e le registra in fonti.
// Restituisce i blob nell'ordine, per mandarli subito alla lettura senza riscaricarli.
async function conservaFoto(a, blobs, onPasso) {
  const { count } = await sb.from("fonti").select("id", { count: "exact", head: true }).eq("argomento_id", a.id);
  const tenute = [];
  for (let i = 0; i < blobs.length; i++) {
    onPasso("Metto via le foto (" + (i + 1) + " di " + blobs.length + ")");
    const path = profilo.id + "/" + a.id + "/" + crypto.randomUUID() + ".jpg";
    try {
      await conRiprova(async () => {
        const { error } = await sb.storage.from(BUCKET).upload(path, blobs[i], { contentType: "image/jpeg" });
        if (error) throw error;
      });
      const { error } = await sb.from("fonti").insert({ argomento_id: a.id, tipo: "foto", storage_path: path, riferimento_pagina: (count || 0) + i + 1 });
      if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
    } catch (e) { continue; } // la foto non salvata non si conserva, ma si legge lo stesso
    tenute.push(path);
  }
  return tenute;
}

// Legge le foto a gruppi di quattro, in sequenza (prototipo). Un gruppo che fallisce
// due volte diventa "[gruppo di foto non leggibile]" e si va avanti.
async function trascrivi(blobs, aggiunta, onPasso) {
  const testi = [];
  const gruppi = aGruppi(blobs);
  for (let n = 0; n < gruppi.length; n++) {
    const g = gruppi[n];
    onPasso("Leggo le foto " + (n * PER_GRUPPO + 1) + "-" + (n * PER_GRUPPO + g.length) + " di " + blobs.length);
    try {
      const immagini = await Promise.all(g.map(base64));
      const r = await conRiprova(() => modello({ azione: "trascrivi", immagini, aggiunta }));
      if (r.trascrizione) testi.push(r.trascrizione);
    } catch (e) {
      if (e instanceof Definitivo) throw e;
      testi.push(GRUPPO_ILLEGGIBILE);
    }
  }
  return testi;
}

async function leggiMateriale(manuale) {
  const btn = $("btn-analizza"); btn.disabled = true;
  const st = $("stato-mat");
  attesa(st, ["Preparo le foto"]);
  const materia = $("materia").value.trim(), titolo = $("argomento").value.trim();
  try {
    const blobs = await Promise.all(foto.map(ridimensiona));
    // L'argomento nasce subito: se la lettura si interrompe, foto e testo restano in libreria.
    const { data: a, error } = await sb.from("argomenti")
      .insert({ materia, titolo, origine: foto.length && manuale ? "misto" : (foto.length ? "foto" : "testo") })
      .select("*").single();
    if (error) throw error;
    a.concetti = []; a.foto = [];
    if (manuale) await sb.from("fonti").insert({ argomento_id: a.id, tipo: "testo" });
    await conservaFoto(a, blobs, (t) => passoAttesa(st, t));
    const testi = (manuale ? [manuale] : []).concat(await trascrivi(blobs, false, (t) => passoAttesa(st, t)));
    a.trascrizione = testi.join("\n\n");
    if (!a.trascrizione.trim() || testi.every((t) => t === GRUPPO_ILLEGGIBILE)) throw new Error("vuoto");
    await sb.from("argomenti").update({ trascrizione: a.trascrizione }).eq("id", a.id);
    passoAttesa(st, "Separo i concetti uno per uno");
    const r = await modello({ azione: "concetti", materia, titolo, testo: a.trascrizione, pagine: pagineMateriale(foto.length, manuale) });
    if (!r.concetti.length) throw new Error("vuoto");
    const { data: ins, error: e2 } = await sb.from("concetti")
      .insert(r.concetti.map((c) => ({ argomento_id: a.id, titolo: c.titolo, descrizione: c.descrizione, ancora: c.ancora, peso: c.peso, ordine: c.ordine, errore_appunti: c.errore_appunti })))
      .select("*");
    if (e2) throw e2;
    a.concetti = ins.sort((p, q) => p.ordine - q.ordine);
    attesa(st, null); btn.disabled = false;
    await caricaLibreria();
    corrente = argomenti.find((x) => x.id === a.id) || a;
    concettiTolti = []; mostraConcetti();
  } catch (e) {
    attesa(st, null); btn.disabled = false;
    errore($("err-mat"), messaggioModello(e, "Non sono riuscito a leggere il materiale. Riprova con foto più nitide, inquadrate dritte e senza ombre. Le foto già caricate restano nell'argomento in libreria."));
    caricaLibreria();
  }
}

/* =================================================================== concetti */

let concettiTolti = [];
function mostraConcetti() {
  $("t-concetti").textContent = corrente.titolo;
  const c = $("lista-concetti"); c.innerHTML = "";
  corrente.concetti.forEach((x) => {
    const d = document.createElement("div"); d.className = "concetto";
    const alto = document.createElement("div"); alto.className = "alto";
    const h = document.createElement("h3"); h.textContent = x.titolo;
    const pesi = document.createElement("div"); pesi.className = "pesi";
    pesi.setAttribute("role", "group"); pesi.setAttribute("aria-label", "peso di " + x.titolo);
    [1, 2, 3].forEach((n) => {
      const b = document.createElement("button"); b.type = "button";
      b.setAttribute("aria-label", "peso " + n + " su 3"); b.dataset.pieno = n <= x.peso ? "1" : "0";
      b.onclick = () => { x.peso = n; x._cambiato = true; Array.prototype.forEach.call(pesi.children, (el, j) => { el.dataset.pieno = (j + 1) <= n ? "1" : "0"; }); };
      pesi.appendChild(b);
    });
    const via = document.createElement("button"); via.type = "button"; via.className = "via"; via.textContent = "×";
    via.setAttribute("aria-label", "togli " + x.titolo);
    via.onclick = () => { concettiTolti.push(x.id); corrente.concetti = corrente.concetti.filter((y) => y !== x); mostraConcetti(); };
    alto.appendChild(h); alto.appendChild(pesi); alto.appendChild(via); d.appendChild(alto);
    const p = document.createElement("p"); p.textContent = x.descrizione; d.appendChild(p);
    if (x.ancora) { const q = document.createElement("span"); q.className = "citazione"; q.textContent = x.ancora; d.appendChild(q); }
    if (x.errore_appunti) { const e = document.createElement("span"); e.className = "errore-appunti"; e.textContent = "✎ " + x.errore_appunti; d.appendChild(e); }
    c.appendChild(d);
  });
  disegnaOpzioni("opz-concetti");
  vai("concetti", corrente.materia);
}
async function salvaConcetti() {
  if (concettiTolti.length) await sb.from("concetti").delete().in("id", concettiTolti);
  concettiTolti = [];
  await Promise.all(corrente.concetti.filter((x) => x._cambiato).map((x) => sb.from("concetti").update({ peso: x.peso }).eq("id", x.id)));
  corrente.concetti.forEach((x) => { delete x._cambiato; });
}

/* =================================================================== scheda argomento */

function apriScheda(a) {
  corrente = a; modo = "argomento";
  $("t-scheda").textContent = a.titolo;
  $("meta-scheda").textContent = a.materia + " · " + a.concetti.length + " concetti · salvato il " + dataIt(a.creato) +
    (a.ultima ? (" · ultima verifica " + a.ultima.indice + "% il " + dataIt(a.ultima.data)) : " · mai verificato");
  const sc = $("stato-concetti-scheda"); sc.innerHTML = "";
  a.concetti.slice().sort((x, y) => (x.media == null ? -1 : x.media) - (y.media == null ? -1 : y.media)).forEach((x) => {
    const d = document.createElement("div"); d.className = "esito-c"; d.dataset.s = x.stato || "mai";
    d.innerHTML = '<h3><span class="pallino"></span>' + esc(x.titolo) + '<span class="voto">' + (x.media == null ? "—" : Number(x.media).toFixed(1) + "/10") + "</span></h3>" +
      (x.errore_appunti ? '<span class="errore-appunti">✎ ' + esc(x.errore_appunti) + "</span>" : "");
    sc.appendChild(d);
  });
  disegnaStoricoArgomento(a);
  disegnaFotoScheda(a);
  $("btn-rivedi").hidden = !a.ultima;
  $("btn-rileggi-concetti").hidden = !!a.concetti.length || !a.trascrizione;
  errore($("err-scheda"), "");
  disegnaOpzioni("opz-scheda");
  vai("scheda", a.materia);
}

async function disegnaFotoScheda(a) {
  const fs = $("foto-scheda"); fs.innerHTML = "";
  if (!a.foto.length) { fs.innerHTML = '<p class="legenda">Nessuna foto conservata per questo argomento.</p>'; return; }
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(a.foto.map((f) => f.storage_path), 3600);
  a.foto.forEach((f, i) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img"); img.alt = "pagina " + (i + 1); img.loading = "lazy";
    const u = (data || []).find((x) => x.path === f.storage_path); if (u && u.signedUrl) img.src = u.signedUrl;
    const b = document.createElement("button"); b.type = "button"; b.textContent = "×";
    b.setAttribute("aria-label", "elimina la pagina " + (i + 1));
    b.onclick = () => {
      if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "?"; b.title = "tocca di nuovo per eliminare"; return; }
      eliminaFoto(a, f);
    };
    fig.appendChild(img); fig.appendChild(b); fs.appendChild(fig);
  });
}
// La foto sparisce prima dallo storage, poi dal database: niente riferimenti a file che non esistono.
async function eliminaFoto(a, f) {
  const { error } = await sb.storage.from(BUCKET).remove([f.storage_path]);
  if (error) { errore($("err-scheda"), "Non sono riuscito a cancellare la foto. Riprova."); return; }
  await sb.from("fonti").delete().eq("id", f.id);
  a.foto = a.foto.filter((x) => x !== f);
  disegnaFotoScheda(a); disegnaLibreria();
}

async function eliminaArgomento(a) {
  attesa($("stato-scheda"), ["Cancello l'argomento e le sue foto"]);
  const { data: files } = await sb.storage.from(BUCKET).list(profilo.id + "/" + a.id, { limit: 1000 });
  const paths = (files || []).map((x) => profilo.id + "/" + a.id + "/" + x.name);
  if (paths.length) {
    const { error } = await sb.storage.from(BUCKET).remove(paths);
    if (error) { attesa($("stato-scheda"), null); errore($("err-scheda"), "Non sono riuscito a cancellare le foto. Riprova."); return; }
  }
  const { error } = await sb.from("argomenti").delete().eq("id", a.id);
  attesa($("stato-scheda"), null);
  if (error) { errore($("err-scheda"), "Non sono riuscito a cancellare l'argomento. Riprova."); return; }
  argomenti = argomenti.filter((x) => x !== a);
  await caricaLibreria(); vai("libreria");
}

async function aggiungiFoto(nuove) {
  const a = corrente, st = $("stato-scheda");
  errore($("err-scheda"), "");
  attesa(st, ["Leggo le nuove pagine"]);
  try {
    const blobs = await Promise.all(nuove.map(ridimensiona));
    await conservaFoto(a, blobs, (t) => passoAttesa(st, t));
    const testo = (await trascrivi(blobs, true, (t) => passoAttesa(st, t))).join("\n\n");
    if (!testo.trim()) throw new Error("vuoto");
    a.trascrizione = ((a.trascrizione || "") + "\n\n" + testo).trim();
    await sb.from("argomenti").update({ trascrizione: a.trascrizione }).eq("id", a.id);
    passoAttesa(st, "Cerco i concetti nuovi");
    const r = await modello({ azione: "concetti", testo, pagine: blobs.length, esistenti: a.concetti.map((c) => c.titolo) });
    const primo = a.concetti.reduce((m, c) => Math.max(m, c.ordine + 1), 0);
    if (r.concetti.length)
      await sb.from("concetti").insert(r.concetti.map((c, i) => ({ argomento_id: a.id, titolo: c.titolo, descrizione: c.descrizione, ancora: c.ancora, peso: c.peso, ordine: primo + i, errore_appunti: c.errore_appunti })));
    attesa(st, null);
    await caricaLibreria();
    apriScheda(argomenti.find((x) => x.id === a.id) || a);
    if (!r.concetti.length) avviso($("err-scheda"), "Foto aggiunte. Non ho trovato concetti nuovi: erano già tutti in elenco.");
  } catch (e) {
    attesa(st, null);
    errore($("err-scheda"), messaggioModello(e, "Non sono riuscito a leggere le nuove foto. Riprova, magari con più luce."));
    caricaLibreria();
  }
}

// Se l'estrazione dei concetti si era interrotta, la si rifà dal testo già letto.
async function ritrovaConcetti() {
  const a = corrente, st = $("stato-scheda");
  attesa(st, ["Separo i concetti uno per uno"]);
  try {
    const r = await modello({ azione: "concetti", materia: a.materia, titolo: a.titolo, testo: a.trascrizione, pagine: Math.max(1, a.foto.length) });
    if (!r.concetti.length) throw new Error("vuoto");
    const { error } = await sb.from("concetti").insert(r.concetti.map((c) => ({ argomento_id: a.id, titolo: c.titolo, descrizione: c.descrizione, ancora: c.ancora, peso: c.peso, ordine: c.ordine, errore_appunti: c.errore_appunti })));
    if (error) throw error;
    attesa(st, null);
    await caricaLibreria();
    corrente = argomenti.find((x) => x.id === a.id) || a; concettiTolti = []; mostraConcetti();
  } catch (e) {
    attesa(st, null); errore($("err-scheda"), messaggioModello(e, "Non sono riuscito a ritrovare i concetti. Riprova fra un momento."));
  }
}

/* =================================================================== svuota la memoria */

async function svuotaMemoria() {
  const b = $("btn-svuota"); b.disabled = true;
  attesa($("stato-lib"), ["Cancello argomenti, foto e prove"]);
  // Prima le foto dallo storage: tutte quelle nella cartella della studentessa.
  const { data: cartelle } = await sb.storage.from(BUCKET).list(profilo.id, { limit: 1000 });
  let paths = [];
  for (const c of cartelle || []) {
    const { data: files } = await sb.storage.from(BUCKET).list(profilo.id + "/" + c.name, { limit: 1000 });
    paths = paths.concat((files || []).map((x) => profilo.id + "/" + c.name + "/" + x.name));
  }
  for (const g of aGruppi(paths, 100)) {
    const { error } = await sb.storage.from(BUCKET).remove(g);
    if (error) { attesa($("stato-lib"), null); b.disabled = false; errore($("avviso-db"), "Non sono riuscito a cancellare tutte le foto. Riprova: niente è stato perso a metà."); return; }
  }
  const { error } = await sb.rpc("svuota_memoria");
  attesa($("stato-lib"), null); b.disabled = false;
  if (error) { errore($("avviso-db"), "Foto cancellate, ma non il resto. Riprova."); return; }
  await caricaLibreria();
}

/* =================================================================== opzioni della prova */

const OPZIONI = [
  ["Livello", "livello", [["semplice", "Semplice", "Definizioni, date e termini"],
    ["medio", "Medio", "Come una verifica normale"],
    ["difficile", "Difficile", "Cause, conseguenze e collegamenti"]]],
  ["Tipo di domande", "tipo", [["miste", "Miste", "Un po' a scelta multipla, un po' da spiegare"],
    ["chiuse", "Solo chiuse", "Tutte a scelta multipla"],
    ["aperte", "Solo aperte", "Tutte da spiegare con parole tue"]]],
  ["Ti prepari per", "modalita", [["scritta", "Verifica scritta", "Domande come le trovi sul foglio"],
    ["orale", "Interrogazione", "Te le leggo ad alta voce e rispondi parlando"]]],
];
function valore(ch) { return ch === "livello" ? livello : (ch === "tipo" ? tipo : modalita); }
function imposta(ch, v) {
  if (ch === "livello") livello = v; else if (ch === "tipo") tipo = v; else modalita = v;
  // Le scelte restano come l'ultima volta, anche su un altro telefono.
  sb.from("studenti").update({ scelte: { livello, tipo, modalita } }).eq("id", profilo.id).then(() => {});
}
function disegnaOpzioni(id) {
  const box = $(id); if (!box) return;
  box.innerHTML = "";
  OPZIONI.forEach((g) => {
    const t = document.createElement("p"); t.className = "occhiello"; t.textContent = g[0]; box.appendChild(t);
    const d = document.createElement("div"); d.className = "livelli";
    g[2].forEach((o) => {
      const l = document.createElement("label");
      const i = document.createElement("input"); i.type = "radio"; i.name = g[1] + "-" + id; i.value = o[0];
      if (valore(g[1]) === o[0]) i.checked = true;
      i.onchange = () => imposta(g[1], o[0]);
      const b = document.createElement("b"); b.textContent = o[1];
      const sm = document.createElement("small"); sm.textContent = o[2];
      l.appendChild(i); l.appendChild(b); l.appendChild(sm); d.appendChild(l);
    });
    box.appendChild(d);
  });
}

/* =================================================================== storico e andamento */

function sparkline(voti) {
  if (voti.length < 2) return "";
  const w = 92, h = 26, min = 3, max = 10;
  const punti = voti.map((v, i) => { const x = (i / (voti.length - 1)) * (w - 4) + 2, y = h - 2 - ((v - min) / (max - min)) * (h - 6); return x.toFixed(1) + "," + y.toFixed(1); }).join(" ");
  const ultimo = voti[voti.length - 1], xu = w - 2, yu = h - 2 - ((ultimo - min) / (max - min)) * (h - 6);
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
    '<polyline points="' + punti + '" fill="none" stroke="var(--tinta)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + xu.toFixed(1) + '" cy="' + yu.toFixed(1) + '" r="2.6" fill="var(--tinta)"/></svg>';
}
function rigaSessione(x, titolo) {
  const b = document.createElement("button"); b.className = "sessione"; b.type = "button"; tinta(b, x.materia);
  b.innerHTML = '<div class="alto"><span class="tit">' + esc(titolo) + '</span><span class="v" data-s="' + fasciaVoto(x.voto) + '">' + votoIt(Number(x.voto)) + "</span></div>" +
    '<div class="meta">' + dataOraIt(x.data) + " · " + esc(x.materia) + " · " + (x.modalita === "orale" ? "interrogazione" : "scritta") + " · livello " + esc(x.livello) +
    " · prontezza " + x.indice + "%" + (x.n_errori ? " · " + x.n_errori + (x.n_errori === 1 ? " errore" : " errori") : " · nessun errore") + "</div>";
  b.onclick = () => mostraSessione(x);
  return b;
}
function disegnaStorico() {
  const box = $("andamento"); box.innerHTML = "";
  const perMat = {};
  sessioni.forEach((x) => { (perMat[x.materia] = perMat[x.materia] || []).push(x); });
  const intest = document.createElement("p"); intest.className = "occhiello"; intest.textContent = "Andamento per materia"; box.appendChild(intest);
  Object.keys(perMat).sort().forEach((m) => {
    const lista = perMat[m].slice().sort((a, b) => new Date(a.data) - new Date(b.data));
    const an = andamento(lista.map((x) => Number(x.voto)));
    const d = document.createElement("div"); d.className = "andam"; tinta(d, m);
    d.innerHTML = '<div class="testa"><b>' + esc(m) + "</b><span>" + lista.length + (lista.length === 1 ? " prova" : " prove") + " · ultima " + dataIt(lista[lista.length - 1].data) + "</span></div>" +
      sparkline(an.voti) + '<div><div class="media">' + votoIt(an.media) + '</div><div class="frecc ' + an.verso + '">' + ({ su: "in salita", giu: "in calo", pari: "stabile" })[an.verso] + "</div></div>";
    box.appendChild(d);
  });
  const f = $("filtri-storico"); f.innerHTML = "";
  [""].concat(Object.keys(perMat).sort()).forEach((m) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = m || "Tutte";
    b.setAttribute("aria-pressed", filtroMat === m ? "true" : "false");
    if (m) tinta(b, m);
    b.onclick = () => { filtroMat = m; disegnaStorico(); };
    f.appendChild(b);
  });
  const l = $("lista-sessioni"); l.innerHTML = "";
  const ti = document.createElement("p"); ti.className = "occhiello"; ti.textContent = "Le prove, dalla più recente"; l.appendChild(ti);
  sessioni.filter((x) => !filtroMat || x.materia === filtroMat).forEach((x) => l.appendChild(rigaSessione(x, x.titolo)));
}
function disegnaStoricoArgomento(a) {
  const box = $("storico-arg"); box.innerHTML = "";
  const mie = sessioni.filter((x) => x.argomento_id === a.id);
  if (!mie.length) return;
  const t = document.createElement("p"); t.className = "occhiello"; t.textContent = "Le verifiche di questo argomento"; box.appendChild(t);
  mie.forEach((x) => box.appendChild(rigaSessione(x, dataOraIt(x.data))));
}

// Riapre una prova passata: domande, risposte e semaforo di quel giorno, dal database.
async function mostraSessione(x, daScheda) {
  const { data, error } = await sb.from("domande")
    .select("ordine, tipo, testo, opzioni, corretta, risposta_attesa, concetto_id, concetto_titolo, ancora, concetti(ancora, peso), risposte(testo, scelta, punteggio, commento, guidata)")
    .eq("sessione_id", x.id).order("ordine");
  if (error) { avviso($("avviso-db"), "Non riesco ad aprire questa prova. Riprova."); return; }
  disegnaQuadrante(x.indice, Number(x.voto));
  $("verdetto-t").textContent = x.titolo;
  $("verdetto-p").textContent = dataOraIt(x.data);
  $("voto-num").textContent = "prontezza " + x.indice + "% · livello " + x.livello + " · " + (x.modalita === "orale" ? "interrogazione" : "verifica scritta");
  $("riga-scartate").hidden = true;
  // Semaforo di quel giorno, ricostruito dalle risposte.
  const perC = {};
  (data || []).forEach((d) => {
    const r = (d.risposte || [])[0] || {};
    const k = d.concetto_titolo, c = perC[k] || (perC[k] = { s: 0, n: 0, ancora: (d.concetti && d.concetti.ancora) || d.ancora, concetto_id: d.concetto_id });
    c.s += Number(r.punteggio || 0); c.n++;
  });
  const materia = x.materia === "varie" ? null : x.materia;
  const righe = Object.keys(perC).map((k) => ({ titolo: k, media: perC[k].s / perC[k].n, ancora: perC[k].ancora, concetto_id: perC[k].concetto_id, materia }))
    .map((r) => ({ ...r, stato: statoDaMedia(r.media) }));
  esitoMostrato = { info: { titolo: x.titolo, materia: x.materia, data: x.data }, dati: { indice: x.indice, voto: Number(x.voto), verdetto: "", righe } };
  disegnaSemaforo(righe.map((r) => ({ ...r })));
  dettaglio = (data || []).map((d) => {
    const r = (d.risposte || [])[0] || {};
    return { n: d.ordine, testo: d.testo, tipo: d.tipo, guidata: !!r.guidata,
      mia: d.tipo === "chiusa" ? ((d.opzioni || [])[r.scelta] || "— nessuna risposta") : (r.testo || "— nessuna risposta"),
      giusta: d.tipo === "chiusa" ? ((d.opzioni || [])[d.corretta] || "") : (d.risposta_attesa || ""),
      punti: Number(r.punteggio || 0), commento: r.commento || "", concetto: d.concetto_titolo,
      concetto_id: d.concetto_id, ancora: (d.concetti && d.concetti.ancora) || d.ancora, materia };
  });
  soloErrori = false; disegnaDettaglio();
  $("box-risposte").open = true;
  $("btn-ancora").hidden = !daScheda; $("btn-torna-storico").hidden = !!daScheda;
  errore($("err-esito"), "");
  vai("esito", x.materia === "varie" ? null : x.materia);
}

/* =================================================================== mappa e cosa studiare */
// La mappa la prepara la funzione `modello` (azione mappa) dai concetti e dalla
// trascrizione dell'argomento; l'app la salva in `mappe`, una per argomento, e la
// riapre da lì. "Rigenera" la richiede e sovrascrive. "Cosa studiare" è solo una
// query sulle prove già fatte: nessuna chiamata al modello.

const FRASI_MAPPA = ["Rileggo gli appunti", "Cerco i sotto-punti di ogni concetto", "Controllo che ogni nodo stia negli appunti", "Disegno la mappa"];
let mappa = null; // { argomento_id, albero, generata, scartati } dell'argomento aperto
let mappaInCorso = null; // argomento_id della mappa che il modello sta preparando

function apriMappa(a, pannello) {
  corrente = a; mappa = null; $("btn-rigenera").disabled = mappaInCorso === a.id; $("btn-stampa").disabled = true; $("btn-arricchisci").disabled = true;
  $("t-mappa").textContent = a.titolo;
  errore($("err-mappa"), ""); attesa($("stato-mappa"), null);
  $("disegno-mappa").innerHTML = ""; $("meta-mappa").textContent = ""; $("ancora-mappa").hidden = true;
  vai("mappa", a.materia);
  mostraPannello(pannello);
}

function mostraPannello(p) {
  const suMappa = p === "mappa";
  $("pannello-mappa").hidden = !suMappa; $("pannello-studiare").hidden = suMappa;
  $("tab-mappa").setAttribute("aria-selected", String(suMappa));
  $("tab-studiare").setAttribute("aria-selected", String(!suMappa));
  if (suMappa) caricaMappa(corrente); else caricaStudiare(corrente);
}

async function caricaMappa(a) {
  if (!a.concetti.length) { avviso($("meta-mappa"), "Questo argomento non ha ancora concetti: torna all'argomento e tocca Ritrova i concetti."); $("btn-rigenera").hidden = true; return; }
  $("btn-rigenera").hidden = false;
  if (mappa && mappa.argomento_id === a.id) { disegnaMappa(); return; }
  if (mappaInCorso === a.id) { attesa($("stato-mappa"), FRASI_MAPPA); return; }
  attesa($("stato-mappa"), ["Apro la mappa"]);
  const { data, error } = await sb.from("mappe").select("albero, generata, scartati").eq("argomento_id", a.id).maybeSingle();
  if (corrente !== a) return; // nel frattempo ha cambiato argomento
  attesa($("stato-mappa"), null);
  if (error) { errore($("err-mappa"), "Non riesco ad aprire la mappa. Controlla la connessione e riprova."); return; }
  if (data) { mappa = { argomento_id: a.id, ...data }; disegnaMappa(); return; }
  generaMappa(a);
}

async function generaMappa(a) {
  // Una richiesta per volta, e mai mentre si arricchisce: l'albero arricchito sovrascriverebbe quello nuovo.
  if (mappaInCorso === a.id || arricchimentoInCorso === a.id) return;
  const btn = $("btn-rigenera");
  mappaInCorso = a.id; btn.disabled = true; $("btn-arricchisci").disabled = true; errore($("err-mappa"), "");
  attesa($("stato-mappa"), FRASI_MAPPA);
  try {
    const r = await conRiprova(() => modello({ azione: "mappa", argomento_id: a.id }));
    const nuova = { argomento_id: a.id, albero: { titolo: r.titolo, materia: r.materia, nodi: r.nodi }, scartati: r.scartati || 0, generata: new Date().toISOString() };
    const { error } = await sb.from("mappe").upsert(nuova, { onConflict: "argomento_id,studente_id" });
    if (corrente !== a) return; // nel frattempo ha cambiato argomento: la mappa è salvata, non si disegna
    mappa = nuova; disegnaMappa();
    if (error) avviso($("err-mappa"), "Non sono riuscito a salvare la mappa: la vedi adesso, ma la prossima volta va rifatta.");
  } catch (e) {
    if (corrente !== a) return;
    const nessuno = e.dati && e.dati.errore === "nessun_concetto";
    errore($("err-mappa"), nessuno ? "Questo argomento non ha ancora concetti." : messaggioModello(e, "Non sono riuscito a preparare la mappa. Riprova fra un momento."));
  } finally {
    mappaInCorso = null;
    // Se ha cambiato argomento, l'attesa sullo schermo non è più di questa mappa.
    if (corrente === a) { attesa($("stato-mappa"), null); btn.disabled = false; }
  }
}

// Scrive in `el` l'HTML di componi(carattere) con la stima della larghezza delle lettere;
// se nel browser una riga della mappa sborda dal suo riquadro, riprova con una stima più larga.
function disegnaAdattando(el, componi) {
  for (let car = MAPPA.carattere; car <= 0.8; car += 0.04) {
    el.innerHTML = componi(car);
    if (!sborda(el)) return;
  }
}

function disegnaMappa() {
  if (!mappa || $("v-mappa").hidden || $("pannello-mappa").hidden) return;
  const box = $("disegno-mappa"), larghezza = box.clientWidth || 340;
  const stati = statiConcetti(corrente);
  disegnaAdattando(box, (car) => svgMappa(layoutMappa(mappa.albero, larghezza, car), stati));
  box.dataset.larghezza = String(larghezza);
  const n = contaNodiMappa(mappa.albero.nodi, (x) => x.fonte !== FONTE_WEB), web = contaNodiMappa(mappa.albero.nodi, (x) => x.fonte === FONTE_WEB);
  $("meta-mappa").textContent = n + " nodi presi dagli appunti" + (web ? " e " + web + " dal web" : "") + " · fatta il " + dataIt(mappa.generata) +
    (mappa.scartati ? " · " + mappa.scartati + (mappa.scartati === 1 ? " nodo tolto perché" : " nodi tolti perché") + " non si ritrovava negli appunti" : "") +
    ". Tocca un riquadro per vedere la frase degli appunti.";
  $("ancora-mappa").hidden = true;
  $("btn-stampa").disabled = false;
  $("btn-arricchisci").disabled = arricchimentoInCorso === mappa.argomento_id || mappaInCorso === mappa.argomento_id;
}
// { concetto_id: stato } per il pallino dei concetti sulla mappa (anche quella stampata).
function statiConcetti(a) {
  const stati = {}; a.concetti.forEach((c) => { stati[c.id] = c.stato || "mai"; });
  return stati;
}
const contaNodiMappa = (nodi, conta = () => true) => (nodi || []).reduce((s, n) => s + (conta(n) ? 1 : 0) + contaNodiMappa(n.figli, conta), 0);

// Vero se il testo di un riquadro è più largo del riquadro (misura del browser).
function sborda(box) {
  return Array.prototype.some.call(box.querySelectorAll(".m-nodo"), (g) => {
    const r = g.querySelector("rect"), t = g.querySelector("text");
    if (!r || !t || !t.getBBox) return false;
    try { const b = t.getBBox(); return b.x + b.width > Number(r.getAttribute("x")) + Number(r.getAttribute("width")) - 4; } catch (e) { return false; }
  });
}

function trovaNodo(nodi, id) {
  for (const n of nodi || []) { if (n.id === id) return n; const f = trovaNodo(n.figli, id); if (f) return f; }
  return null;
}
function mostraAncora(g) {
  const n = mappa && trovaNodo(mappa.albero.nodi, g.dataset.id), box = $("ancora-mappa");
  $("disegno-mappa").querySelectorAll(".m-nodo.scelto").forEach((x) => x.classList.remove("scelto"));
  if (!n || !(n.ancora || n.url)) { box.hidden = true; return; }
  g.classList.add("scelto");
  box.innerHTML = n.fonte === FONTE_WEB
    ? "<b>" + esc(n.titolo) + '</b> <span class="etichetta-web">' + ETICHETTA_WEB + "</span><p>" + esc(n.testo) + "</p>" + linkFonte(n)
    : "<b>" + esc(n.titolo) + '</b><span class="citazione">' + esc(n.ancora) + "</span>";
  box.hidden = false;
}

async function caricaStudiare(a) {
  const lista = $("lista-studiare"); lista.innerHTML = "";
  if (!a.concetti.length) { lista.innerHTML = '<p class="legenda">Questo argomento non ha ancora concetti.</p>'; return; }
  attesa($("stato-studiare"), ["Guardo le ultime prove"]);
  // Anche le domande dei ripassi: portano l'argomento da cui vengono.
  const { data, error } = await sb.from("domande").select("concetto_id, sessione_id, sessioni(data), risposte(punteggio)")
    .eq("argomento_id", a.id).limit(2000);
  attesa($("stato-studiare"), null);
  if (corrente !== a) return;
  if (error) { errore($("err-mappa"), "Non riesco a leggere le prove di questo argomento. Riprova."); return; }
  const righe = (data || []).filter((d) => (d.risposte || []).length && d.sessioni).map((d) => ({
    concetto_id: d.concetto_id, sessione_id: d.sessione_id, data: d.sessioni.data, punteggio: d.risposte[0].punteggio,
  }));
  listaStudiare = cosaStudiare(a.concetti, righe);
  listaStudiare.forEach((x) => {
    const d = document.createElement("div"); d.className = "esito-c"; d.dataset.s = x.stato;
    d.innerHTML = '<h3><span class="pallino"></span>' + esc(x.titolo) + '<span class="voto">' + testoVolte(x) + "</span></h3>" +
      '<p>Rileggi qui: <span class="citazione">' + esc(x.ancora) + "</span></p>" +
      (x.errore_appunti ? '<span class="errore-appunti">✎ ' + esc(x.errore_appunti) + "</span>" : "");
    if (x.stato !== "verde") d.appendChild(bottoneSpiega({ concetto_id: x.id, titolo: x.titolo, ancora: x.ancora, materia: a.materia }));
    lista.appendChild(d);
  });
}

/* =================================================================== preparazione della prova */

async function preparaVerifica(args, btn, elStato, elErr) {
  errore(elErr, ""); btn.disabled = true;
  attesa(elStato, modo === "ripasso"
    ? ["Scelgo i concetti più deboli del quadrimestre", "Preparo le domande", "Controllo che ognuna nasca dai tuoi appunti"]
    : ["Preparo le domande", "Controllo che ognuna nasca dai tuoi appunti", "Scarto quelle campate in aria"]);
  if (!args.some((a) => a.concetti.length)) { attesa(elStato, null); btn.disabled = false; errore(elErr, "Non ci sono concetti su cui interrogarti."); return; }
  ({ titolo: titoloProva, materia: materiaProva } = titoloEMateria(args, modo === "ripasso"));
  try {
    const r = await modello({ azione: "domande", argomenti: args.map((a) => a.id), ripasso: modo === "ripasso", livello, tipo, modalita });
    domande = r.domande; scartate = r.scartate || 0; argsProva = args;
    const pesi = {}; args.forEach((a) => a.concetti.forEach((c) => { pesi[c.id] = c.peso; }));
    domande.forEach((d) => { d.peso = pesi[d.concetto_id] || 1; });
    idx = 0; risposte = {};
    attesa(elStato, null); btn.disabled = false;
    vai("verifica", modo === "ripasso" ? null : args[0].materia);
    mostraDomanda();
    if (modalita === "orale") prontaOrale();
  } catch (e) {
    attesa(elStato, null); btn.disabled = false;
    errore(elErr, e.message === "nessuna_ancorata"
      ? "Tutte le domande parlavano di cose che negli appunti non ci sono, quindi le ho scartate. Il materiale è probabilmente troppo scarno: aggiungi una foto."
      : messaggioModello(e, "Non sono riuscito a preparare la verifica. Riprova fra un momento."));
  }
}

/* =================================================================== verifica */

function mostraDomanda() {
  const d = domande[idx];
  if (d.tipo === "chiusa" && !d._ord) d._ord = mescola(d.opzioni.length); // ogni prova arriva con domande nuove: opzioni mescolate a ogni tentativo
  $("q-conta").textContent = "DOMANDA " + (idx + 1) + " DI " + domande.length;
  $("q-tipo").textContent = (modalita === "orale" ? "ti chiede · " : "") + (d.tipo === "aperta" ? "risposta aperta" : "scelta multipla");
  $("q-prog").style.width = Math.round(idx / domande.length * 100) + "%";
  const da = $("q-da");
  if (modo === "ripasso") { da.hidden = false; da.textContent = "da: " + d.argomento_titolo; tinta(document.documentElement, d.materia); }
  else da.hidden = true;
  $("q-testo").textContent = d.testo;
  const corpo = $("q-corpo"); corpo.innerHTML = "";
  if (d.tipo === "chiusa") {
    const box = document.createElement("div"); box.className = "opzioni";
    d._ord.forEach((j, pos) => {
      const l = document.createElement("label");
      const i = document.createElement("input"); i.type = "radio"; i.name = d.id; i.value = j;
      if (risposte[d.id] && risposte[d.id].scelta === j) i.checked = true;
      const le = document.createElement("span"); le.className = "lettera"; le.textContent = "ABCD"[pos];
      const t = document.createElement("span"); t.textContent = d.opzioni[j];
      l.appendChild(i); l.appendChild(le); l.appendChild(t); box.appendChild(l);
    });
    corpo.appendChild(box);
  } else {
    const ta = document.createElement("textarea"); ta.id = "risp-aperta";
    ta.placeholder = modalita === "orale" ? "Quello che dici compare qui. Puoi anche scrivere." : "Scrivi la tua risposta";
    ta.value = (risposte[d.id] && risposte[d.id].testo) || "";
    corpo.appendChild(ta);
  }
  $("btn-avanti").textContent = idx === domande.length - 1 ? "Consegna" : "Avanti";
  d._inizio = Date.now();
  errore($("err-ver"), "");
}
function salvaCorrente(vuota) {
  const d = domande[idx];
  const secondi = Math.round((Date.now() - (d._inizio || Date.now())) / 1000);
  const guidata = !!(risposte[d.id] && risposte[d.id].guidata);
  if (d.tipo === "chiusa") {
    const sel = document.querySelector('input[name="' + d.id + '"]:checked');
    if (!vuota && !sel) return false;
    risposte[d.id] = { tipo: "chiusa", scelta: sel && !vuota ? +sel.value : null, secondi, guidata };
  } else {
    const t = ($("risp-aperta") || { value: "" }).value.trim();
    if (!vuota && !t) return false;
    risposte[d.id] = { tipo: "aperta", testo: vuota ? "" : t, secondi, guidata };
  }
  return true;
}
function avanza() {
  if (idx < domande.length - 1) { idx++; mostraDomanda(); window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  $("q-prog").style.width = "100%"; correggi(); return false;
}

/* =================================================================== interrogazione a voce */
// L'app legge la domanda, ascolta la risposta dal microfono e passa alla successiva
// da sola. Se l'alunna si blocca, riformula una volta con un aiuto (risposta guidata).
// I bottoni restano attivi per chi preferisce toccare.

const Riconoscimento = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
let voceAttiva = false, ascoltatore = null, orologio = null;

function statoVoce(stato, titolo, testo) {
  const v = $("voce"); v.hidden = false; v.dataset.stato = stato;
  $("voce-stato").textContent = titolo; $("voce-testo").textContent = testo || "";
}
function parla(testo) {
  return new Promise((res) => {
    if (!window.speechSynthesis) return res();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(testo);
    u.lang = "it-IT"; u.rate = 0.95;
    const it = speechSynthesis.getVoices().find((v) => /^it/i.test(v.lang));
    if (it) u.voice = it;
    u.onend = u.onerror = () => res();
    statoVoce("parla", "Ti leggo la domanda", "");
    speechSynthesis.speak(u);
  });
}
// Ascolta finché l'alunna non resta zitta per qualche secondo. Restituisce il testo detto.
function ascolta(silenzioMs) {
  return new Promise((res) => {
    if (!Riconoscimento) return res(null);
    const r = new Riconoscimento();
    r.lang = "it-IT"; r.continuous = true; r.interimResults = true;
    let finale = "", parziale = "", ultimoSuono = Date.now(), finito = false;
    const inizio = Date.now();
    const chiudi = () => { if (finito) return; finito = true; clearInterval(orologio); try { r.stop(); } catch (e) { /* già fermo */ } res((finale + " " + parziale).trim()); };
    r.onresult = (ev) => {
      parziale = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finale += " " + ev.results[i][0].transcript; else parziale += ev.results[i][0].transcript;
      }
      ultimoSuono = Date.now();
      const detto = (finale + " " + parziale).trim();
      statoVoce("ascolto", "Ti ascolto", detto);
      const ta = $("risp-aperta"); if (ta) ta.value = detto;
      if (/\b(ho finito|basta cosi)$/.test(piatto(detto))) chiudi();
    };
    r.onerror = (ev) => { if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { finito = true; clearInterval(orologio); res(null); } };
    r.onend = () => { if (!finito) { try { r.start(); } catch (e) { chiudi(); } } }; // Safari si ferma da solo: si riparte finché non tace
    ascoltatore = { stop: chiudi };
    statoVoce("ascolto", "Ti ascolto", "rispondi quando vuoi");
    clearInterval(orologio);
    orologio = setInterval(() => {
      const s = Math.round((Date.now() - inizio) / 1000);
      $("voce-tempo").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      const zitta = Date.now() - ultimoSuono;
      // Prima che inizi a parlare si aspetta di più: sta pensando.
      if ((finale || parziale) ? zitta > silenzioMs : zitta > 12000) chiudi();
    }, 250);
    try { r.start(); } catch (e) { chiudi(); }
  });
}
function fermaVoce() {
  voceAttiva = false;
  if (ascoltatore) { ascoltatore.stop(); ascoltatore = null; }
  if (typeof window !== "undefined" && window.speechSynthesis) speechSynthesis.cancel();
  clearInterval(orologio);
  if ($("voce")) { $("voce").hidden = true; $("btn-ripeti").hidden = true; $("btn-pausa").hidden = true; }
}

async function domandaAVoce() {
  const d = domande[idx];
  const testoLetto = d.tipo === "chiusa" ? d.testo + " " + leggiOpzioni(d) : d.testo;
  for (let tentativo = 0; tentativo < 2 && voceAttiva; tentativo++) {
    await parla(tentativo === 0 ? testoLetto : domandaGuidata(d));
    if (!voceAttiva) return null;
    const detto = await ascolta(d.tipo === "chiusa" ? 2000 : 3500);
    if (detto === null) return null; // microfono negato o non disponibile
    if (!voceAttiva) return null;
    if (detto && !eNonLoSo(detto)) {
      if (d.tipo === "aperta") return { testo: detto, guidata: tentativo > 0 };
      const j = opzioneDetta(detto, d._ord.map((k) => d.opzioni[k]));
      if (j >= 0) return { scelta: d._ord[j], guidata: tentativo > 0 };
    }
    if (tentativo === 0) risposte[d.id] = Object.assign(risposte[d.id] || {}, { guidata: true });
  }
  return { vuota: true };
}

// iPhone fa parlare e ascoltare la pagina solo dopo un tocco: l'interrogazione
// comincia con un tocco su Comincia, poi va avanti da sola.
function prontaOrale() {
  $("btn-pausa").hidden = false; $("btn-pausa").textContent = "Comincia l'interrogazione";
  statoVoce("", "Pronta?", Riconoscimento ? "Tocca Comincia: da lì ti leggo le domande e ascolto le risposte." : "Ti leggo le domande; rispondi con il microfono della tastiera o scrivendo.");
}
function sbloccaVoce() {
  if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
}

async function avviaOrale() {
  sbloccaVoce();
  voceAttiva = true;
  $("btn-ripeti").hidden = false; $("btn-pausa").hidden = false; $("btn-pausa").textContent = "Pausa";
  mostraDomanda();
  if (!Riconoscimento) {
    statoVoce("", "Il microfono qui non funziona", "Ti leggo le domande; rispondi con il microfono della tastiera o scrivendo.");
  }
  while (voceAttiva) {
    const d = domande[idx];
    if (!Riconoscimento) { await parla(d.tipo === "chiusa" ? d.testo + " " + leggiOpzioni(d) : d.testo); return; }
    const r = await domandaAVoce();
    if (!voceAttiva) return;
    if (r === null) { voceAttiva = false; statoVoce("", "Microfono non disponibile", "Consenti il microfono nelle impostazioni, oppure rispondi scrivendo."); return; }
    if (r.vuota) salvaCorrente(true);
    else {
      if (d.tipo === "chiusa") { const i = document.querySelector('input[name="' + d.id + '"][value="' + r.scelta + '"]'); if (i) i.checked = true; }
      else $("risp-aperta").value = r.testo;
      salvaCorrente(false);
      if (r.guidata) risposte[d.id].guidata = true;
    }
    if (!avanza()) { voceAttiva = false; fermaVoce(); return; }
  }
}

/* =================================================================== correzione ed esito */

async function correggi() {
  fermaVoce();
  $("btn-avanti").disabled = true; $("btn-nonso").disabled = true;
  attesa($("stato-ver"), ["Correggo le risposte", "Valuto completezza, correttezza e linguaggio", "Salvo la prova nello storico"]);
  const pacchetto = domande.filter((d) => d.tipo === "aperta" && (risposte[d.id] || {}).testo)
    .map((d) => ({ id: d.id, domanda: d.testo, risposta_attesa: d.risposta_attesa, elementi: d.elementi || [], risposta_alunna: risposte[d.id].testo }));
  let val = [];
  try {
    if (pacchetto.length) val = (await conRiprova(() => modello({ azione: "correggi", modalita, pacchetto }))).valutazioni || [];
  } catch (e) {
    attesa($("stato-ver"), null); $("btn-avanti").disabled = false; $("btn-nonso").disabled = false;
    errore($("err-ver"), messaggioModello(e, "La correzione delle risposte aperte non è riuscita. Tocca di nuovo Consegna fra un momento."));
    return;
  }
  const per = {};
  domande.forEach((d) => {
    const r = risposte[d.id] || {};
    if (d.tipo === "chiusa") {
      const ok = r.scelta != null && r.scelta === d.corretta;
      per[d.id] = { punti: ok ? 10 : 0, commento: ok ? "Giusta." : "La risposta corretta era: " + (d.opzioni[d.corretta] || "—") };
    } else if (!r.testo) per[d.id] = { punti: 0, commento: "Non hai risposto." };
    else {
      const v = val.find((x) => x.id === d.id);
      const tot = v ? Math.min(10, Math.max(0, +v.totale || ((+v.completezza || 0) + (+v.correttezza || 0) + (+v.linguaggio || 0)))) : 5;
      per[d.id] = { punti: tot, commento: v ? v.commento : "Non sono riuscito a valutare questa risposta.",
        rubrica: v ? { completezza: v.completezza, correttezza: v.correttezza, linguaggio: v.linguaggio } : null };
    }
  });
  attesa($("stato-ver"), null); $("btn-avanti").disabled = false; $("btn-nonso").disabled = false;
  await mostraEsito(per);
}

function disegnaQuadrante(indice, v) {
  const r = 44, giro = 2 * Math.PI * r, arco = $("arco");
  arco.setAttribute("stroke-dasharray", (giro * indice / 100).toFixed(1) + " " + giro.toFixed(1));
  arco.setAttribute("stroke", indice >= 75 ? "var(--verde)" : (indice >= 50 ? "var(--giallo)" : "var(--rosso)"));
  $("arco-num").textContent = votoIt(v);
}
// righe: [{ titolo, media, stato, ancora, errore_appunti?, da?, concetto_id?, materia? }], dal più debole
function disegnaSemaforo(righe) {
  const e = $("esito-concetti"); e.innerHTML = "";
  $("occhiello-concetti").hidden = !righe.length;
  righe.sort((a, b) => a.media - b.media).forEach((x) => {
    const d = document.createElement("div"); d.className = "esito-c"; d.dataset.s = x.stato;
    d.innerHTML = '<h3><span class="pallino"></span>' + esc(x.titolo) + '<span class="voto">' + x.media.toFixed(1) + "/10</span></h3>";
    const p = document.createElement("p");
    if (x.stato === "verde") p.textContent = "Acquisito.";
    else p.innerHTML = (x.da ? "Da " + esc(x.da) + ". " : "") + 'Rileggi questo: <span class="citazione">' + esc(x.ancora) + "</span>";
    d.appendChild(p);
    if (x.errore_appunti && x.stato !== "verde") { const s = document.createElement("span"); s.className = "errore-appunti"; s.textContent = "✎ " + x.errore_appunti; d.appendChild(s); }
    if (x.concetto_id && x.stato !== "verde")
      d.appendChild(bottoneSpiega({ concetto_id: x.concetto_id, titolo: x.titolo, ancora: x.ancora, materia: x.materia }));
    e.appendChild(d);
  });
}

function disegnaDettaglio() {
  const det = $("dettaglio"); det.innerHTML = "";
  const lista = soloErrori ? dettaglio.filter((x) => x.punti < 8) : dettaglio;
  $("btn-solo-errori").textContent = soloErrori ? "Mostra tutte le domande" : "Mostra solo quelle sbagliate";
  const sbagliate = dettaglio.filter((x) => x.punti < 8).length;
  $("btn-solo-errori").hidden = !sbagliate || sbagliate === dettaglio.length;
  if (!lista.length) { det.innerHTML = '<p class="legenda" style="padding:14px 0">Nessun errore: sono andate tutte bene.</p>'; return; }
  lista.forEach((x) => {
    const st = x.punti >= 8 ? "verde" : (x.punti >= 5 ? "giallo" : "rosso");
    const w = document.createElement("div"); w.className = "rispo"; w.dataset.s = st;
    let h = '<div class="cap">DOMANDA ' + x.n + " · " + votoIt(x.punti) + "/10" + (x.concetto ? " · " + esc(x.concetto) : "") + "</div>" +
      (x.guidata ? '<span class="guidata">risposta con un aiuto</span>' : "") +
      '<p class="dom">' + esc(x.testo) + "</p>" +
      "<p><b>Hai risposto:</b> " + esc(x.mia) + "</p>";
    if (x.punti < 8 && x.giusta) h += '<p class="giusta"><b>' + (x.tipo === "chiusa" ? "Era: " : "Ci voleva: ") + "</b>" + esc(x.giusta) + "</p>";
    if (x.commento) h += '<p class="com">' + esc(x.commento) + "</p>";
    w.innerHTML = h;
    // Dopo una risposta sbagliata: la spiegazione parte proprio da quell'errore.
    if (x.punti < 8 && x.concetto_id) w.appendChild(bottoneSpiega({
      concetto_id: x.concetto_id, titolo: x.concetto || x.testo, ancora: x.ancora, materia: x.materia,
      errore: { domanda: x.testo, risposta_alunna: x.mia.startsWith("—") ? "" : x.mia, risposta_attesa: x.giusta },
    }));
    det.appendChild(w);
  });
}

async function mostraEsito(per) {
  const punti = {}; domande.forEach((d) => { punti[d.id] = per[d.id].punti; });
  const es = calcolaEsito(domande, punti);
  disegnaQuadrante(es.indice, es.voto);
  $("voto-num").textContent = "prontezza " + es.indice + "% · livello " + livello + " · " + (modalita === "orale" ? "interrogazione" : "verifica scritta") + " · " + dataOraIt(new Date().toISOString());
  if (es.pronta) { $("verdetto-t").textContent = "Sei pronta."; $("verdetto-p").textContent = "Un ripasso veloce sui punti gialli e sei a posto."; }
  else if (es.rossiPesanti) { $("verdetto-t").textContent = "Non ancora."; $("verdetto-p").textContent = "Ci sono " + es.rossiPesanti + " concetti importanti da rifare da capo, non da ripassare."; }
  else { $("verdetto-t").textContent = "Ci siamo quasi."; $("verdetto-p").textContent = "Rivedi i punti gialli e rifai la verifica."; }
  const rs = $("riga-scartate");
  if (scartate) { rs.hidden = false; rs.textContent = "Ho scartato " + scartate + (scartate === 1 ? " domanda perché non era ancorata" : " domande perché non erano ancorate") + " agli appunti."; }
  else rs.hidden = true;

  const concettoDi = {}; argsProva.forEach((a) => a.concetti.forEach((c) => { concettoDi[c.id] = { c, a }; }));
  const righe = es.concetti.filter((x) => concettoDi[x.concetto_id]).map((x) => {
    const { c, a } = concettoDi[x.concetto_id];
    return { titolo: c.titolo, media: x.media, stato: x.stato, ancora: c.ancora || c.descrizione, errore_appunti: c.errore_appunti,
      da: modo === "ripasso" ? a.titolo : null, concetto_id: c.id, materia: a.materia };
  });
  esitoMostrato = { info: { titolo: titoloProva, materia: materiaProva, data: new Date().toISOString() },
    dati: { indice: es.indice, voto: es.voto, verdetto: $("verdetto-t").textContent + " " + $("verdetto-p").textContent, righe } };
  disegnaSemaforo(righe.map((r) => ({ ...r })));
  dettaglio = domande.map((d, i) => {
    const r = risposte[d.id] || {}, p = per[d.id];
    return { n: i + 1, testo: d.testo, tipo: d.tipo, guidata: !!r.guidata,
      mia: d.tipo === "chiusa" ? (d.opzioni[r.scelta] || "— nessuna risposta") : (r.testo || "— nessuna risposta"),
      giusta: d.tipo === "chiusa" ? (d.opzioni[d.corretta] || "") : (d.risposta_attesa || ""),
      punti: p.punti, commento: p.commento, concetto: d.concetto_titolo, concetto_id: d.concetto_id, ancora: d.ancora, materia: d.materia || materiaProva };
  });
  soloErrori = false; disegnaDettaglio();
  $("btn-ancora").hidden = false; $("btn-torna-storico").hidden = true;
  vai("esito", modo === "ripasso" ? null : argsProva[0].materia);
  try { await salvaProva(es, per); }
  catch (e) { errore($("err-esito"), "Non sono riuscito a salvare questa prova nello storico. Il risultato qui sopra resta valido."); }
}

// Prova nello storico: sessione, domande e risposte, e stato aggiornato di ogni concetto.
async function salvaProva(es, per) {
  const nErrori = domande.filter((d) => per[d.id].punti < 8).length;
  const { data: s, error } = await sb.from("sessioni").insert({
    argomento_id: modo === "ripasso" ? null : argsProva[0].id, titolo: titoloProva, materia: materiaProva,
    livello, tipo, modalita, indice: es.indice, voto: es.voto, n_domande: domande.length, n_errori: nErrori, scartate,
  }).select("*").single();
  if (error) throw error;
  const { data: ds, error: e2 } = await sb.from("domande").insert(domande.map((d, i) => ({
    sessione_id: s.id, argomento_id: d.argomento_id, concetto_id: d.concetto_id, concetto_titolo: d.concetto_titolo,
    ordine: i + 1, tipo: d.tipo, livello, testo: d.testo, opzioni: d.opzioni, corretta: d.corretta,
    risposta_attesa: d.risposta_attesa, elementi: d.elementi || [], ancora: d.ancora,
  }))).select("id, ordine");
  if (e2) throw e2;
  const idPer = {}; ds.forEach((x) => { idPer[x.ordine] = x.id; });
  const { error: e3 } = await sb.from("risposte").insert(domande.map((d, i) => {
    const r = risposte[d.id] || {};
    return { sessione_id: s.id, domanda_id: idPer[i + 1], testo: r.testo || null, scelta: r.scelta == null ? null : r.scelta,
      punteggio: per[d.id].punti, dettaglio_rubrica: per[d.id].rubrica || null, commento: per[d.id].commento,
      secondi: r.secondi == null ? null : r.secondi, guidata: !!r.guidata };
  }));
  if (e3) throw e3;
  const concettoDi = {}; argsProva.forEach((a) => a.concetti.forEach((c) => { concettoDi[c.id] = c; }));
  await Promise.all(es.concetti.filter((x) => concettoDi[x.concetto_id]).map((x) => {
    const c = concettoDi[x.concetto_id];
    c.media = Math.round(x.media * 10) / 10; c.stato = x.stato; c.tentativi = (c.tentativi || 0) + 1;
    return sb.from("concetti").update({ media: c.media, stato: c.stato, tentativi: c.tentativi }).eq("id", c.id);
  }));
  await caricaLibreria();
}

// Argomenti della materia scelta nel ripasso; null (con l'errore a schermo) se non ce ne sono.
function argomentiDelRipasso() {
  const m = document.querySelector('input[name="mat-rip"]:checked').value;
  const scelti = argomenti.filter((a) => !m || a.materia === m);
  if (!scelti.length) { errore($("err-rip"), "Nessun argomento per questa materia."); return null; }
  return scelti;
}

/* =================================================================== avvio */

function collega() {
  collegaStampa();
  collegaAiuto();
  $("btn-rail-indietro").addEventListener("click", () => vai(profilo ? "libreria" : "profili"));
  $("tastierino").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) tasto(b.dataset.n); });
  $("btn-impostazioni").addEventListener("click", () => { errore($("err-imp"), ""); vai("impostazioni"); });
  $("btn-gen-entra").addEventListener("click", genEntra);
  $("gen-password").addEventListener("keydown", (e) => { if (e.key === "Enter") genEntra(); });
  $("btn-gen-esci").addEventListener("click", genEsci);
  $("btn-np-crea").addEventListener("click", creaProfilo);
  $("btn-storico").addEventListener("click", () => {
    if (!sessioni.length) { avviso($("avviso-db"), "Nessuna prova ancora. Lo storico si riempie da solo dalla prima verifica."); return; }
    filtroMat = ""; disegnaStorico(); vai("storico");
  });
  $("btn-torna-lib").addEventListener("click", () => { disegnaLibreria(); vai("libreria"); });
  $("btn-torna-storico").addEventListener("click", () => { disegnaStorico(); vai("storico"); });

  $("btn-nuovo").addEventListener("click", () => {
    foto = []; corrente = null; disegnaMiniature();
    const dl = $("elenco-materie"); dl.innerHTML = "";
    [...new Set(argomenti.map((a) => a.materia))].forEach((m) => { const o = document.createElement("option"); o.value = m; dl.appendChild(o); });
    $("testo-manuale").value = ""; $("materia").value = ""; $("argomento").value = "";
    errore($("err-mat"), ""); vai("materiale");
  });
  $("foto").addEventListener("change", (e) => {
    Array.prototype.slice.call(e.target.files).forEach((f) => { if (f.type.indexOf("image/") === 0) foto.push(f); }); // nessun limite
    e.target.value = ""; disegnaMiniature();
  });
  $("btn-analizza").addEventListener("click", () => {
    const manuale = $("testo-manuale").value.trim();
    errore($("err-mat"), "");
    if (!$("materia").value.trim() || !$("argomento").value.trim()) {
      errore($("err-mat"), "Scrivi materia e argomento: senza quelli non ritrovi più questo materiale in libreria.");
      ($("materia").value.trim() ? $("argomento") : $("materia")).focus(); return;
    }
    if (!foto.length && manuale.length < 40) { errore($("err-mat"), "Aggiungi almeno una foto, oppure scrivi qualche riga di appunti."); return; }
    leggiMateriale(manuale);
  });

  $("btn-salva-basta").addEventListener("click", async () => { await salvaConcetti(); await caricaLibreria(); vai("libreria"); });
  $("btn-genera").addEventListener("click", async () => {
    errore($("err-con"), "");
    if (!corrente.concetti.length) { errore($("err-con"), "Non è rimasto nessun concetto."); return; }
    await salvaConcetti(); modo = "argomento";
    preparaVerifica([corrente], $("btn-genera"), $("stato-con"), $("err-con"));
  });

  $("btn-ripassa-arg").addEventListener("click", () => { modo = "argomento"; preparaVerifica([corrente], $("btn-ripassa-arg"), $("stato-scheda"), $("err-scheda")); });
  $("btn-rivedi").addEventListener("click", () => { if (corrente && corrente.ultima) mostraSessione(corrente.ultima, true); });
  $("btn-rileggi-concetti").addEventListener("click", ritrovaConcetti);
  $("btn-mappa").addEventListener("click", () => apriMappa(corrente, "mappa"));
  $("btn-studiare").addEventListener("click", () => apriMappa(corrente, "studiare"));
  $("tab-mappa").addEventListener("click", () => mostraPannello("mappa"));
  $("tab-studiare").addEventListener("click", () => mostraPannello("studiare"));
  $("btn-rigenera").addEventListener("click", () => { if (corrente) generaMappa(corrente); });
  $("btn-torna-scheda").addEventListener("click", () => apriScheda(argomenti.find((x) => x.id === corrente.id) || corrente));
  const disegno = $("disegno-mappa");
  disegno.addEventListener("click", (e) => { const g = e.target.closest(".m-nodo"); if (g) mostraAncora(g); });
  disegno.addEventListener("keydown", (e) => {
    const g = e.target.closest(".m-nodo");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); mostraAncora(g); }
  });
  // Ruotando il telefono cambia la larghezza: si ridisegna (verticale sotto i 600px).
  let attesaRidisegno = null;
  window.addEventListener("resize", () => {
    clearTimeout(attesaRidisegno);
    attesaRidisegno = setTimeout(() => { if (String(disegno.clientWidth) !== disegno.dataset.larghezza) disegnaMappa(); }, 200);
  });
  $("btn-elimina").addEventListener("click", function () { doppioTocco(this, "Tocca di nuovo per eliminare, foto comprese", () => eliminaArgomento(corrente)); });
  $("foto-piu").addEventListener("change", (e) => {
    const nuove = Array.prototype.slice.call(e.target.files).filter((f) => f.type.indexOf("image/") === 0);
    e.target.value = "";
    if (nuove.length && corrente) aggiungiFoto(nuove);
  });
  $("btn-svuota").addEventListener("click", function () { doppioTocco(this, "Tocca di nuovo: cancello tutto, foto e prove comprese", svuotaMemoria); });

  $("btn-ripasso").addEventListener("click", () => {
    if (!argomenti.length) { avviso($("avviso-db"), "Prima serve almeno un argomento in libreria."); return; }
    const box = $("scelta-materia"); box.innerHTML = "";
    const materie = [...new Set(argomenti.map((a) => a.materia))];
    [["", "Tutte le materie", argomenti.length + " argomenti"]].concat(materie.map((m) => [m, m, argomenti.filter((a) => a.materia === m).length + " argomenti"]))
      .forEach((o, i) => {
        const l = document.createElement("label");
        l.innerHTML = '<input type="radio" name="mat-rip" value="' + esc(o[0]) + '"' + (i === 0 ? " checked" : "") + "><b>" + esc(o[1]) + "</b><small>" + esc(o[2]) + "</small>";
        box.appendChild(l);
      });
    errore($("err-rip"), ""); disegnaOpzioni("opz-ripasso"); vai("ripasso");
  });
  $("btn-genera-ripasso").addEventListener("click", () => {
    const scelti = argomentiDelRipasso();
    if (!scelti) return;
    modo = "ripasso";
    preparaVerifica(scelti, $("btn-genera-ripasso"), $("stato-rip"), $("err-rip"));
  });

  $("btn-avanti").addEventListener("click", () => {
    if (!salvaCorrente(false)) { errore($("err-ver"), "Scegli una risposta, oppure tocca Non lo so."); return; }
    const orale = voceAttiva; fermaVoce();
    if (avanza() && orale) avviaOrale();
  });
  $("btn-nonso").addEventListener("click", () => {
    salvaCorrente(true);
    const orale = voceAttiva; fermaVoce();
    if (avanza() && orale) avviaOrale();
  });
  $("btn-ripeti").addEventListener("click", () => { fermaVoce(); avviaOrale(); });
  $("btn-pausa").addEventListener("click", () => {
    if (voceAttiva) { fermaVoce(); $("btn-pausa").hidden = false; $("btn-ripeti").hidden = false; $("btn-pausa").textContent = "Riprendi"; statoVoce("", "In pausa", "tocca Riprendi quando sei pronta"); }
    else avviaOrale();
  });
  $("btn-solo-errori").addEventListener("click", () => { soloErrori = !soloErrori; disegnaDettaglio(); });
  $("btn-ancora").addEventListener("click", () => {
    if (modo === "ripasso") $("btn-ripasso").click();
    else apriScheda(argomenti.find((a) => a.id === (corrente && corrente.id)) || corrente);
  });
}

async function avvia() {
  collega();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (!window.supabase) { errore($("err-profili"), "Serve la connessione a internet per aprire i tuoi argomenti."); vai("profili"); return; }
  // Si parte sempre dai nomi: tocco il nome, digito il codice, entro.
  vai("profili"); caricaProfili();
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-libreria")) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia); else avvia();
}
