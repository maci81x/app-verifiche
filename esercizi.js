// Esercizi di matematica (issue #5). Per le materie di matematica la ragazza sceglie
// "Teoria" (concetti, come per le altre materie) o "Esercizi": le foto si leggono, la
// funzione `modello` (azione esercizi_tipi) riconosce i tipi di esercizio, ognuno con un
// esercizio vero come ancora, e la ragazza conferma quelli giusti. Niente modalità orale.
// Script classico caricato dopo app.js: usa $, esc, vai, modello, conRiprova, trascrivi,
// conservaFoto, ridimensiona, attesa, passoAttesa, errore, avviso, messaggioModello,
// caricaLibreria, apriScheda, slugMateria, sb, foto, argomenti, corrente, GRUPPO_ILLEGGIBILE.
// Dalla fetta #7 usa anche svgFigura (figure.js) e formulaHtml, caricaKatex, rendiFormule (formule.js).

/* =================================================================== parti pure */

const PERCORSO_ESERCIZI = "esercizi";
const eMatematica = (materia) => { const m = slugMateria(materia); return !!m && m[0] === "matematica"; };
const conEsercizi = (a) => !!a && a.percorso === PERCORSO_ESERCIZI;

// "3 concetti" o "2 tipi di esercizio", per le schede della libreria.
function contaVoci(a) {
  if (!conEsercizi(a)) return a.concetti.length + " concetti";
  const n = (a.tipi || []).length;
  return n + (n === 1 ? " tipo di esercizio" : " tipi di esercizio");
}

// Il testo letto è vuoto se non c'è niente o se tutti i gruppi di foto erano illeggibili.
const lettoVuoto = (testi) => !testi.join("").trim() || testi.every((t) => t === GRUPPO_ILLEGGIBILE);

// Righe da salvare in esercizi_tipi: solo quelli spuntati, in ordine dopo gli esistenti.
function righeTipi(argomentoId, tipi, scelti, primoOrdine = 0) {
  return tipi.filter((_, i) => scelti[i]).map((t, i) => ({
    argomento_id: argomentoId, titolo: t.titolo, ancora: t.ancora, difficolta: t.difficolta, figura: !!t.figura, ordine: primoOrdine + i,
  }));
}

// Una scheda di esercizio: consegna, dati, figura; passaggi e risultato solo dentro
// "Mostra la soluzione", così non si vedono finché la ragazza non li chiede.
function htmlEsercizio(e, i) {
  const risultato = e.risultato.valore + (e.risultato.unita ? " " + e.risultato.unita : "");
  const passaggi = (e.passaggi || []).map((p) =>
    "<li>" + esc(p.testo) + (p.formula ? '<span class="riga-formula">' + formulaHtml(p.formula) + "</span>" : "") + "</li>").join("");
  return '<article class="esercizio">' +
    '<p class="occhiello">Esercizio ' + (i + 1) + " · " + esc(e.tipo) + "</p>" +
    '<p class="consegna">' + esc(e.testo) + "</p>" +
    (e.dati ? '<p class="dati-es">Dati: ' + esc(e.dati) + "</p>" : "") +
    (e.figura ? '<div class="figura-es">' + svgFigura(e.figura) + "</div>" : "") +
    "<details><summary>Mostra la soluzione</summary>" +
    (passaggi ? '<ol class="passaggi">' + passaggi + "</ol>" : "") +
    '<p class="risultato-es">Risultato: <b>' + esc(risultato) + "</b></p></details></article>";
}

// Quanti esercizi il controllo dei conti ha tolto, detto in breve.
function notaScartatiEsercizi(n) {
  if (!n) return "";
  return n === 1 ? "1 esercizio l'ho tolto perché il risultato non tornava al ricalcolo."
    : n + " esercizi li ho tolti perché il risultato non tornava al ricalcolo.";
}

/* =================================================================== scelta Teoria / Esercizi */

function percorsoScelto() {
  if (!eMatematica($("materia").value)) return "teoria";
  const r = document.querySelector('input[name="percorso"]:checked');
  return r ? r.value : "teoria";
}
function aggiornaSceltaPercorso() {
  $("scelta-percorso").hidden = !eMatematica($("materia").value);
}

/* =================================================================== lettura e tipi */

const FRASI_TIPI = "Riconosco i tipi di esercizio";
let tipiProposti = [], tipiScelti = [], tipiDi = null; // argomento a cui si aggiungono

async function chiediTipi(a, testo, esistenti) {
  return conRiprova(() => modello({ azione: "esercizi_tipi", materia: a.materia, titolo: a.titolo, testo, esistenti }));
}

// Come leggiMateriale, ma le foto si leggono come esercizi e al posto dei concetti escono i tipi.
async function leggiEsercizi(manuale) {
  const btn = $("btn-analizza"), st = $("stato-mat");
  btn.disabled = true; attesa(st, ["Preparo le foto"]);
  const materia = $("materia").value.trim(), titolo = $("argomento").value.trim();
  try {
    const blobs = await Promise.all(foto.map(ridimensiona));
    const { data: a, error } = await sb.from("argomenti")
      .insert({ materia, titolo, percorso: PERCORSO_ESERCIZI, origine: foto.length && manuale ? "misto" : (foto.length ? "foto" : "testo") })
      .select("*").single();
    if (error) throw error;
    if (manuale) await sb.from("fonti").insert({ argomento_id: a.id, tipo: "testo" });
    await conservaFoto(a, blobs, (t) => passoAttesa(st, t));
    const testi = (manuale ? [manuale] : []).concat(await trascrivi(blobs, false, (t) => passoAttesa(st, t), true));
    if (lettoVuoto(testi)) throw new Error("vuoto");
    a.trascrizione = testi.join("\n\n");
    await sb.from("argomenti").update({ trascrizione: a.trascrizione }).eq("id", a.id);
    passoAttesa(st, FRASI_TIPI);
    const r = await chiediTipi(a, a.trascrizione, []);
    attesa(st, null); btn.disabled = false;
    await caricaLibreria();
    mostraTipi(argomenti.find((x) => x.id === a.id) || { ...a, tipi: [] }, r);
  } catch (e) {
    attesa(st, null); btn.disabled = false;
    errore($("err-mat"), messaggioModello(e, "Non sono riuscito a leggere gli esercizi. Riprova con foto più nitide, inquadrate dritte e senza ombre. Le foto già caricate restano nell'argomento in libreria."));
    caricaLibreria();
  }
}

// Foto aggiunte a un argomento di esercizi: si leggono e si cercano solo i tipi nuovi.
async function aggiungiFotoEsercizi(nuove) {
  const a = corrente, st = $("stato-scheda");
  errore($("err-scheda"), ""); attesa(st, ["Leggo le nuove pagine"]);
  try {
    const blobs = await Promise.all(nuove.map(ridimensiona));
    await conservaFoto(a, blobs, (t) => passoAttesa(st, t));
    const testi = await trascrivi(blobs, true, (t) => passoAttesa(st, t), true);
    if (lettoVuoto(testi)) throw new Error("vuoto");
    const testo = testi.join("\n\n");
    a.trascrizione = ((a.trascrizione || "") + "\n\n" + testo).trim();
    await sb.from("argomenti").update({ trascrizione: a.trascrizione }).eq("id", a.id);
    passoAttesa(st, FRASI_TIPI);
    const r = await chiediTipi(a, testo, (a.tipi || []).map((t) => t.titolo));
    attesa(st, null);
    mostraTipi(a, r);
  } catch (e) {
    attesa(st, null);
    errore($("err-scheda"), messaggioModello(e, "Non sono riuscito a leggere le nuove foto. Riprova, magari con più luce."));
  }
}

// Se il riconoscimento si era interrotto, lo si rifà dal testo già letto.
async function ritrovaTipi() {
  const a = corrente, st = $("stato-scheda");
  errore($("err-scheda"), ""); attesa(st, [FRASI_TIPI]);
  try {
    const r = await chiediTipi(a, a.trascrizione, (a.tipi || []).map((t) => t.titolo));
    attesa(st, null); mostraTipi(a, r);
  } catch (e) {
    attesa(st, null); errore($("err-scheda"), messaggioModello(e, "Non sono riuscito a riconoscere gli esercizi. Riprova fra un momento."));
  }
}

/* =================================================================== checklist dei tipi */

const pallini = (n) => "●".repeat(n) + "○".repeat(3 - n);

function rigaTipo(t, i) {
  const l = document.createElement("label"); l.className = "tipo-es";
  const c = document.createElement("input"); c.type = "checkbox"; c.checked = tipiScelti[i];
  c.onchange = () => { tipiScelti = tipiScelti.map((v, j) => (j === i ? c.checked : v)); };
  const corpo = document.createElement("span");
  corpo.innerHTML = "<b>" + esc(t.titolo) + "</b>" +
    '<small>difficoltà <span aria-label="' + t.difficolta + ' su 3">' + pallini(t.difficolta) + "</span>" + (t.figura ? " · con figura" : "") + "</small>" +
    '<span class="citazione">' + esc(t.ancora) + "</span>";
  l.appendChild(c); l.appendChild(corpo);
  return l;
}

// r: { tipi, scartati } dalla funzione. La ragazza toglie quelli sbagliati e conferma.
function mostraTipi(a, r) {
  corrente = a; tipiDi = a;
  tipiProposti = r.tipi || []; tipiScelti = tipiProposti.map(() => true);
  $("t-tipi").textContent = a.titolo;
  const box = $("lista-tipi"); box.innerHTML = "";
  tipiProposti.forEach((t, i) => box.appendChild(rigaTipo(t, i)));
  errore($("err-tipi"), "");
  if (!tipiProposti.length)
    avviso($("err-tipi"), (a.tipi || []).length ? "Non ho trovato tipi di esercizio nuovi: erano già tutti in elenco."
      : "Non ho riconosciuto esercizi in queste foto. Le foto restano nell'argomento: prova ad aggiungerne di più nitide.");
  $("nota-scartati-tipi").textContent = r.scartati
    ? r.scartati + (r.scartati === 1 ? " tipo l'ho tolto" : " tipi li ho tolti") + " perché il suo esercizio non si ritrova nelle foto." : "";
  $("btn-conferma-tipi").hidden = !tipiProposti.length;
  vai("tipi", a.materia);
}

async function confermaTipi() {
  const a = tipiDi, btn = $("btn-conferma-tipi");
  const primo = (a.tipi || []).reduce((m, t) => Math.max(m, t.ordine + 1), 0);
  const righe = righeTipi(a.id, tipiProposti, tipiScelti, primo);
  if (!righe.length) { errore($("err-tipi"), "Lascia almeno un tipo di esercizio, oppure torna indietro."); return; }
  btn.disabled = true;
  const { error } = await sb.from("esercizi_tipi").insert(righe);
  btn.disabled = false;
  if (error) { errore($("err-tipi"), "Non sono riuscito a salvare i tipi di esercizio. Riprova."); return; }
  await caricaLibreria();
  apriScheda(argomenti.find((x) => x.id === a.id) || a);
}

/* =================================================================== scheda dell'argomento */

const BOTTONI_TEORIA = ["btn-ripassa-arg", "btn-mappa", "btn-studiare", "btn-stampa-verifica", "btn-rileggi-concetti", "opz-scheda"];

// Un argomento di esercizi mostra i suoi tipi al posto dei concetti e niente prove di teoria.
function adattaSchedaEsercizi(a) {
  const es = conEsercizi(a);
  $("btn-ritrova-tipi").hidden = !es || !!(a.tipi || []).length || !a.trascrizione;
  $("btn-esercizi").hidden = !es || !(a.tipi || []).length;
  if (!es) return;
  BOTTONI_TEORIA.forEach((id) => { $(id).hidden = true; });
  $("meta-scheda").textContent = a.materia + " · esercizi · " + contaVoci(a) + " · salvato il " + dataIt(a.creato);
  const sc = $("stato-concetti-scheda"); sc.innerHTML = "";
  (a.tipi || []).forEach((t) => {
    const d = document.createElement("div"); d.className = "esito-c"; d.dataset.s = t.stato || "mai";
    d.innerHTML = "<h3>" + esc(t.titolo) + '<span class="voto">' + (t.media == null ? "—" : votoIt(Math.round(t.media * 2) / 2) + "/10") + "</span></h3>" + htmlStato(t.stato) +
      '<span class="citazione">' + esc(t.ancora) + "</span>";
    sc.appendChild(d);
  });
}

/* =================================================================== esercizi simili */

let eserciziDi = null, eserciziMostrati = [], scartatiMostrati = 0; // li riusano correzione (#8) e stampa (#9)

function apriEsercizi(a) {
  eserciziDi = a;
  $("t-esercizi").textContent = a.titolo;
  const box = $("scelta-tipi-es"); box.innerHTML = "";
  (a.tipi || []).forEach((t) => {
    const l = document.createElement("label"); l.className = "tipo-es";
    l.innerHTML = '<input type="checkbox" checked value="' + esc(t.id) + '"><span><b>' + esc(t.titolo) + "</b></span>";
    box.appendChild(l);
  });
  $("prep-esercizi").hidden = false; $("btn-altri-es").hidden = true;
  $("lista-es").innerHTML = ""; $("nota-scartati-es").textContent = "";
  $("esito-es").innerHTML = ""; $("btn-correggi-es").hidden = true; eserciziMostrati = [];
  ["btn-stampa-es", "btn-stampa-esito-es", "btn-salva-es"].forEach((id) => { $(id).hidden = true; });
  errore($("err-es"), "");
  vai("esercizi", a.materia);
  caricaKatex(); // in anticipo: quando arrivano gli esercizi probabilmente è già pronto
}

// Come conRiprova, ma senza ripetere una generazione intera quando la risposta è già un
// esito (nessun tipo, nessun esercizio con i conti giusti): lì decide la ragazza se riprovare.
const ESITI_DEFINITIVI = ["nessun_tipo", "nessun_verificato"];
async function conRiprovaEsercizi(f) {
  try { return await f(); } catch (e) {
    if (e instanceof Definitivo || (e.dati && ESITI_DEFINITIVI.includes(e.dati.errore))) throw e;
    await new Promise((r) => setTimeout(r, ATTESA_RIPROVA));
    return f();
  }
}

async function generaEsercizi() {
  const a = eserciziDi, btn = $("btn-genera-es"), st = $("stato-es");
  const tipi = [...document.querySelectorAll("#scelta-tipi-es input:checked")].map((c) => c.value);
  const quanti = Number((document.querySelector('input[name="quanti-es"]:checked') || {}).value) || 5;
  if (!tipi.length) { errore($("err-es"), "Scegli almeno un tipo di esercizio."); return; }
  errore($("err-es"), ""); btn.disabled = true;
  attesa(st, ["Preparo gli esercizi", "Controllo i conti uno per uno", "Disegno le figure"]);
  try {
    const r = await conRiprovaEsercizi(() => modello({ azione: "esercizi_genera", argomento_id: a.id, quanti, tipi }));
    eserciziMostrati = r.esercizi; scartatiMostrati = r.scartati || 0;
    $("lista-es").innerHTML = r.esercizi.map(htmlEsercizio).join("");
    preparaSvolgimento();
    $("nota-scartati-es").textContent = notaScartatiEsercizi(r.scartati);
    $("prep-esercizi").hidden = true; $("btn-altri-es").hidden = false;
    caricaKatex().then((ok) => { if (ok) rendiFormule($("lista-es")); });
  } catch (e) {
    errore($("err-es"), messaggioModello(e, e.dati && e.dati.errore === "nessun_verificato"
      ? "Non sono riuscito a preparare esercizi con i conti giusti. Riprova: ogni volta escono esercizi nuovi."
      : "Non sono riuscito a preparare gli esercizi. Riprova fra un momento."));
  } finally {
    attesa(st, null); btn.disabled = false;
  }
}

function collegaEsercizi() {
  $("btn-esercizi").addEventListener("click", () => apriEsercizi(corrente));
  $("btn-genera-es").addEventListener("click", generaEsercizi);
  collegaProvaEsercizi();
  $("btn-altri-es").addEventListener("click", () => { $("prep-esercizi").hidden = false; $("btn-altri-es").hidden = true; });
  $("btn-es-indietro").addEventListener("click", () => { if (eserciziDi) apriScheda(argomenti.find((x) => x.id === eserciziDi.id) || eserciziDi); });
  $("materia").addEventListener("input", aggiornaSceltaPercorso);
  $("btn-conferma-tipi").addEventListener("click", confermaTipi);
  $("btn-tipi-indietro").addEventListener("click", () => { if (tipiDi) apriScheda(argomenti.find((x) => x.id === tipiDi.id) || tipiDi); });
  $("btn-ritrova-tipi").addEventListener("click", ritrovaTipi);
}
