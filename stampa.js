// Stampa e PDF (issue #3): mappa, Cosa studiare, verifica da fare sulla carta, esito.
// Si stampa con il browser: window.print() e il foglio di stile @media print, che
// nasconde tutto tranne il documento. Nessun PDF generato sul server.
// Script classico caricato dopo app.js: usa esc, dataIt, votoIt, layoutMappa,
// svgMappa, sborda, mescola, modello, vai e lo stato dell'app.

/* =================================================================== composizione (pura) */

// In bianco e nero il colore non basta: ogni stato ha anche un simbolo e una parola.
// Stesse forme e parole dell'app (semaforo.js): ✕ Da ripassare, ▲ Quasi, ● Lo sai, ○ Mai provato.
const DOCUMENTI_STAMPA = {
  mappa: "Mappa concettuale", studiare: "Cosa studiare", verifica: "Verifica", esito: "Esito della prova",
  esercizi: "Esercizi", esito_esercizi: "Esito degli esercizi",
};
const LARGHEZZA_MAPPA_STAMPA = 700; // circa la larghezza utile di un A4, in pixel CSS
const LETTERE = "ABCD";

function statoStampa(stato) {
  return '<span class="st-stato" data-s="' + statoValido(stato) + '">' + segnoStato(stato) + " " + parolaStato(stato) + "</span>";
}

function testaStampa(tipo, info) {
  return '<header class="st-testa"><p class="st-tipo">' + DOCUMENTI_STAMPA[tipo] + "</p><h1>" + esc(info.titolo) + "</h1>" +
    '<p class="st-chi">' + [info.nome, info.materia, dataIt(info.data)].filter(Boolean).map(esc).join(" · ") + "</p></header>";
}

// Elenco dei nodi con le loro frasi: resta leggibile anche se la mappa è fitta.
function elencoNodi(nodi) {
  if (!nodi || !nodi.length) return "";
  return '<ol class="st-nodi">' + nodi.map((n) => "<li><b>" + esc(n.titolo) + "</b>" +
    (n.fonte === FONTE_WEB
      ? '<span class="st-ancora">' + ETICHETTA_WEB + ": " + esc(n.testo) + " — " + esc(n.url) + "</span>"
      : (n.ancora ? '<span class="st-ancora">' + esc(n.ancora) + "</span>" : "")) + elencoNodi(n.figli) + "</li>").join("") + "</ol>";
}

function corpoMappa({ albero, stati }, carattere) {
  return '<div class="st-mappa">' + svgMappa(layoutMappa(albero, LARGHEZZA_MAPPA_STAMPA, carattere, stati || {})) + "</div>" +
    '<h2>I nodi e le frasi degli appunti</h2>' + elencoNodi(albero.nodi);
}

function corpoStudiare(lista) {
  return '<ol class="st-lista">' + lista.map((x) => '<li class="st-voce">' + statoStampa(x.stato) +
    "<b>" + esc(x.titolo) + '</b><span class="st-volte">' + testoVolte(x) + "</span>" +
    '<span class="st-ancora">Rileggi: «' + esc(x.ancora) + "»</span>" +
    (x.errore_appunti ? '<span class="st-nota">✎ ' + esc(x.errore_appunti) + "</span>" : "") + "</li>").join("") + "</ol>";
}

// Le chiuse escono nell'ordine di _ord (mescolato una volta sola), lo stesso del foglio soluzioni.
const ordineOpzioni = (d) => d._ord || d.opzioni.map((_, i) => i);
// Righe per rispondere: più lunga la risposta attesa, più spazio. Da 4 a 10.
const righeAperta = (d) => Math.min(10, Math.max(4, Math.ceil(String(d.risposta_attesa || "").length / 55) + 2));

function corpoVerifica(domande) {
  const quesiti = domande.map((d) => '<li class="st-quesito"><p>' + esc(d.testo) + "</p>" + (d.tipo === "chiusa"
    ? '<ol class="st-opzioni">' + ordineOpzioni(d).map((j, pos) => "<li><b>" + LETTERE[pos] + ".</b> " + esc(d.opzioni[j]) + "</li>").join("") + "</ol>"
    : '<div class="st-righe">' + '<div class="st-riga"></div>'.repeat(righeAperta(d)) + "</div>") + "</li>").join("");
  const soluzioni = domande.map((d) => {
    if (d.tipo === "chiusa") {
      const pos = ordineOpzioni(d).indexOf(d.corretta);
      return '<li class="st-quesito"><p><b>' + LETTERE[pos] + ". " + esc(d.opzioni[d.corretta]) + "</b></p></li>";
    }
    const elementi = d.elementi || [];
    return '<li class="st-quesito"><p>' + esc(d.risposta_attesa) + "</p>" + (elementi.length
      ? '<p class="st-deve">Deve comparire:</p><ul>' + elementi.map((e) => "<li>" + esc(e) + "</li>").join("") + "</ul>" : "") + "</li>";
  }).join("");
  return '<section class="st-domande"><ol class="st-quesiti">' + quesiti + "</ol></section>" +
    '<section class="st-soluzioni st-salto"><h2>Soluzioni</h2><ol class="st-quesiti">' + soluzioni + "</ol></section>";
}

function corpoEsito({ indice, voto, verdetto, righe }) {
  const ordinate = [...righe].sort((a, b) => a.media - b.media);
  return '<p class="st-voto">Voto stimato ' + votoIt(Number(voto)) + " · prontezza " + Number(indice) + "%</p>" +
    (verdetto ? '<p class="st-verdetto">' + esc(verdetto) + "</p>" : "") +
    '<ol class="st-lista">' + ordinate.map((x) => '<li class="st-voce">' + statoStampa(x.stato) +
      "<b>" + esc(x.titolo) + '</b><span class="st-volte">' + Number(x.media).toFixed(1).replace(".", ",") + "/10</span>" +
      (x.da ? '<span class="st-nota">da ' + esc(x.da) + "</span>" : "") +
      '<span class="st-ancora">' + (x.stato === "verde" ? esc(x.ancora) : "Rileggi: «" + esc(x.ancora) + "»") + "</span>" +
      (x.errore_appunti ? '<span class="st-nota">✎ ' + esc(x.errore_appunti) + "</span>" : "") + "</li>").join("") + "</ol>";
}

/* ---- esercizi di matematica (issue #5, fetta #9) ---- */

// Quadretti da 5 mm per lo svolgimento, disegnati in SVG: i browser di solito non stampano
// gli sfondi, le linee sì. Larghezza 180 mm, altezza in mm.
const QUADRETTO_MM = 5, LARGHEZZA_QUADRETTI_MM = 180;
function svgQuadretti(altezza) {
  const linee = [];
  for (let x = 0; x <= LARGHEZZA_QUADRETTI_MM; x += QUADRETTO_MM) linee.push('<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + altezza + '"/>');
  for (let y = 0; y <= altezza; y += QUADRETTO_MM) linee.push('<line x1="0" y1="' + y + '" x2="' + LARGHEZZA_QUADRETTI_MM + '" y2="' + y + '"/>');
  return '<svg class="st-quadretti" viewBox="0 0 ' + LARGHEZZA_QUADRETTI_MM + " " + altezza + '" aria-hidden="true"><g stroke="#b5b5b5" stroke-width=".2">' + linee.join("") + "</g></svg>";
}
// Spazio per lo svolgimento: più passaggi nella soluzione, più quadretti. Da 30 a 90 mm.
const spazioSvolgimento = (e) => Math.min(90, Math.max(30, 20 + (e.passaggi || []).length * 10));

const risultatoTesto = (e) => e.risultato.valore + (e.risultato.unita ? " " + e.risultato.unita : "");

// Scheda (consegne, figure, quadretti) e, dopo un salto pagina, il foglio delle soluzioni.
function corpoEsercizi(esercizi) {
  const scheda = esercizi.map((e) => '<li class="st-quesito st-esercizio"><p>' + esc(e.testo) + "</p>" +
    (e.dati ? '<p class="st-nota">Dati: ' + esc(e.dati) + "</p>" : "") +
    (e.figura ? '<div class="st-figura">' + svgFigura(e.figura) + "</div>" : "") +
    svgQuadretti(spazioSvolgimento(e)) + "</li>").join("");
  const soluzioni = esercizi.map((e) => '<li class="st-quesito">' +
    '<ol class="st-passaggi">' + (e.passaggi || []).map((p) => "<li>" + esc(p.testo) +
      (p.formula ? ' <span class="st-formula">' + formulaHtml(p.formula) + "</span>" : "") + "</li>").join("") + "</ol>" +
    "<p><b>Risultato: " + esc(risultatoTesto(e)) + "</b></p></li>").join("");
  return '<section class="st-domande"><ol class="st-quesiti">' + scheda + "</ol></section>" +
    '<section class="st-soluzioni st-salto"><h2>Soluzioni</h2><ol class="st-quesiti">' + soluzioni + "</ol></section>";
}

// Esito di una prova di esercizi: semaforo per tipo (simbolo e parola) e ogni esercizio.
// { voto, righe: [{ titolo, media, stato, n }], dettaglio: [{ testo, risposta, giusta, esito, punti }] }
function corpoEsitoEsercizi({ voto, righe, dettaglio }) {
  const ordinate = [...righe].sort((a, b) => a.media - b.media);
  return '<p class="st-voto">Voto della prova ' + votoIt(Number(voto)) + "</p>" +
    '<ol class="st-lista">' + ordinate.map((x) => '<li class="st-voce">' + statoStampa(x.stato) +
      "<b>" + esc(x.titolo) + '</b><span class="st-volte">' + Number(x.media).toFixed(1).replace(".", ",") + "/10 · " +
      x.n + (x.n === 1 ? " esercizio" : " esercizi") + "</span></li>").join("") + "</ol>" +
    "<h2>Esercizio per esercizio</h2>" +
    '<ol class="st-quesiti">' + (dettaglio || []).map((d) => '<li class="st-quesito"><p>' + esc(d.testo) + "</p>" +
      '<p class="st-nota">Hai scritto: ' + esc(d.risposta || "—") + " · giusto: " + esc(d.giusta) + "</p>" +
      "<p><b>" + esc(d.esito) + "</b> · " + d.punti + "/10</p></li>").join("") + "</ol>";
}

const CORPI_STAMPA = {
  mappa: corpoMappa, studiare: corpoStudiare, verifica: corpoVerifica, esito: corpoEsito,
  esercizi: corpoEsercizi, esito_esercizi: corpoEsitoEsercizi,
};

// doc: { tipo, info: { nome, materia, titolo, data }, dati } → l'HTML del documento da stampare.
function componiStampa(doc, carattere = MAPPA.carattere) {
  const corpo = CORPI_STAMPA[doc.tipo];
  if (!corpo) throw new Error("documento sconosciuto: " + doc.tipo);
  return testaStampa(doc.tipo, doc.info) + corpo(doc.dati, carattere);
}

/* =================================================================== vista stampa */

const CHIAVE_AIUTO_STAMPA = "verifiche-aiuto-stampa";
let docStampa = null;          // documento mostrato
let tornaDaStampa = null;      // { vista, materia } a cui riporta Indietro
let verificaDaStampare = null; // { args, ripasso } della verifica da preparare
let sceltaStampa = { livello: "medio", tipo: "miste", quante: 10 };

const infoBase = () => ({ nome: profilo ? profilo.nome : "", data: new Date().toISOString() });

function entraInStampa(materia) {
  const v = document.body.dataset.vista; // la scrive vai()
  if (v !== "stampa") tornaDaStampa = { vista: v, materia: materia === "varie" ? null : materia };
  errore($("err-stampa"), ""); attesa($("stato-stampa"), null);
  // La riga con le istruzioni compare finché non si è stampato almeno una volta.
  $("aiuto-stampa").hidden = !!leggiLocale(CHIAVE_AIUTO_STAMPA, false);
  vai("stampa", tornaDaStampa.materia);
}

function apriStampa(tipo, info, dati) {
  docStampa = { tipo, info: { ...infoBase(), ...info }, dati };
  entraInStampa(docStampa.info.materia);
  $("opz-stampa").hidden = true;
  $("btn-stampa-ora").disabled = false;
  disegnaStampa();
}

// La mappa si ridisegna con una stima più larga se nel browser qualche riga sborda.
function disegnaStampa() {
  disegnaAdattando($("doc-stampa"), (car) => componiStampa(docStampa, car));
  // Le soluzioni degli esercizi hanno formule: KaTeX se c'è, altrimenti restano testo.
  if (docStampa.tipo === "esercizi") caricaKatex().then((ok) => { if (ok) rendiFormule($("doc-stampa")); });
}

function stampaOra() {
  salvaLocale(CHIAVE_AIUTO_STAMPA, true);
  window.print();
}

function esciDaStampa() {
  const t = tornaDaStampa || { vista: profilo ? "libreria" : "profili", materia: null };
  vai(t.vista, t.materia);
}

// Verifica sulla carta: livello, tipo e numero di domande, poi l'azione `domande`
// esistente in modalità scritta. Non salva nessuna prova: non conta per indice e storico.
// Gli stessi numeri di DOMANDE_DA_STAMPARE in _shared/prompt.js (la funzione rifiuta gli altri).
const QUANTE_STAMPA = [[10, "Un compito breve"], [15, "Come in classe"], [20, "Un ripasso lungo"]];
function apriVerificaDaStampare(args, ripasso, elErr) {
  if (!args.some((a) => a.concetti.length)) { errore(elErr, "Non ci sono concetti su cui preparare la verifica."); return; }
  verificaDaStampare = { args, ripasso };
  sceltaStampa = { ...sceltaStampa, livello, tipo };
  const { titolo, materia } = titoloEMateria(args, ripasso);
  docStampa = { tipo: "verifica", info: { ...infoBase(), titolo, materia }, dati: [] };
  entraInStampa(materia);
  $("doc-stampa").innerHTML = "";
  $("btn-stampa-ora").disabled = true;
  $("opz-stampa").hidden = false;
  disegnaSceltaStampa();
}

function disegnaSceltaStampa() {
  const box = $("scelte-stampa"); box.innerHTML = "";
  const gruppi = [OPZIONI[0], OPZIONI[1],
    ["Quante domande", "quante", QUANTE_STAMPA.map(([n, nota]) => [n, String(n), nota])]];
  gruppi.forEach(([titolo, chiave, voci]) => {
    const t = document.createElement("p"); t.className = "occhiello"; t.textContent = titolo; box.appendChild(t);
    const d = document.createElement("div"); d.className = "livelli";
    voci.forEach(([v, nome, nota]) => {
      const l = document.createElement("label");
      const i = document.createElement("input"); i.type = "radio"; i.name = chiave + "-stampa"; i.checked = sceltaStampa[chiave] === v;
      i.onchange = () => { sceltaStampa = { ...sceltaStampa, [chiave]: v }; };
      const b = document.createElement("b"); b.textContent = nome;
      const sm = document.createElement("small"); sm.textContent = nota;
      l.appendChild(i); l.appendChild(b); l.appendChild(sm); d.appendChild(l);
    });
    box.appendChild(d);
  });
}

async function preparaVerificaDaStampare() {
  const richiesta = verificaDaStampare, { args, ripasso } = richiesta, scelta = sceltaStampa;
  const btn = $("btn-prepara-stampa");
  btn.disabled = true; errore($("err-stampa"), "");
  attesa($("stato-stampa"), ["Preparo le domande", "Controllo che ognuna nasca dai tuoi appunti", "Scrivo il foglio delle soluzioni"]);
  try {
    const r = await conRiprova(() => modello({ azione: "domande", argomenti: args.map((a) => a.id), ripasso,
      livello: scelta.livello, tipo: scelta.tipo, modalita: "scritta", quante: scelta.quante }));
    // Nel frattempo ha aperto un altro documento o un'altra verifica: questa risposta non è più sua.
    if (verificaDaStampare !== richiesta || docStampa.tipo !== "verifica") return;
    // Le opzioni si mescolano una volta: domande e soluzioni usano lo stesso ordine.
    docStampa = { ...docStampa, dati: r.domande.map((d) => (d.tipo === "chiusa" ? { ...d, _ord: mescola(d.opzioni.length) } : d)) };
    disegnaStampa();
    $("btn-stampa-ora").disabled = false;
    if (r.domande.length < scelta.quante)
      avviso($("err-stampa"), "Sono uscite " + r.domande.length + " domande invece di " + scelta.quante + ": le altre non erano ancorate agli appunti e le ho scartate.");
  } catch (e) {
    if (verificaDaStampare !== richiesta) return;
    errore($("err-stampa"), e.message === "nessuna_ancorata"
      ? "Tutte le domande parlavano di cose che negli appunti non ci sono, quindi le ho scartate. Aggiungi una foto e riprova."
      : messaggioModello(e, "Non sono riuscito a preparare la verifica. Riprova fra un momento."));
  } finally {
    if (verificaDaStampare === richiesta) { attesa($("stato-stampa"), null); btn.disabled = false; }
  }
}

function collegaStampa() {
  $("btn-stampa-ora").addEventListener("click", stampaOra);
  $("btn-stampa-indietro").addEventListener("click", esciDaStampa);
  $("btn-prepara-stampa").addEventListener("click", preparaVerificaDaStampare);
  $("btn-stampa").addEventListener("click", () => {
    if (mappa && !mappa.provvisoria) apriStampa("mappa", { titolo: corrente.titolo, materia: corrente.materia }, { albero: mappa.albero, stati: statiDellaMappa(corrente) });
  });
  $("btn-stampa-studiare").addEventListener("click", () => {
    if (listaStudiare.length) apriStampa("studiare", { titolo: corrente.titolo, materia: corrente.materia }, listaStudiare);
  });
  $("btn-stampa-verifica").addEventListener("click", () => apriVerificaDaStampare([corrente], false, $("err-scheda")));
  $("btn-stampa-ripasso").addEventListener("click", () => {
    const scelti = argomentiDelRipasso();
    if (scelti) apriVerificaDaStampare(scelti, true, $("err-rip"));
  });
  $("btn-stampa-esito").addEventListener("click", () => {
    if (esitoMostrato) apriStampa("esito", esitoMostrato.info, esitoMostrato.dati);
  });
}
