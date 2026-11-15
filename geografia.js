// Quiz di geografia d'Italia per la 1ª (issue #28): regioni, capoluoghi, monti, fiumi e laghi, con una cartina
// da toccare (italia-mappa.js) e quattro bottoni con i nomi (chi non riesce a toccare una regione piccola
// risponde con i bottoni). Solo dati verificati: ogni fatto ha la sua fonte (docs/da-verificare.md).
// Script classico caricato dopo italia-mappa.js: usa $, esc, vai, profilo, classeNumero.

/* ---- dati verificati ---- */
const GEOGRAFIA_ITALIA = {
  fonte_regioni: "https://it.wikipedia.org/wiki/Regioni_d%27Italia",
  regioni: [
    { istat: 1, nome: "Piemonte", capoluogo: "Torino" }, { istat: 2, nome: "Valle d'Aosta", capoluogo: "Aosta", speciale: true },
    { istat: 3, nome: "Lombardia", capoluogo: "Milano" }, { istat: 4, nome: "Trentino-Alto Adige", capoluogo: "Trento", speciale: true },
    { istat: 5, nome: "Veneto", capoluogo: "Venezia" }, { istat: 6, nome: "Friuli-Venezia Giulia", capoluogo: "Trieste", speciale: true },
    { istat: 7, nome: "Liguria", capoluogo: "Genova" }, { istat: 8, nome: "Emilia-Romagna", capoluogo: "Bologna" },
    { istat: 9, nome: "Toscana", capoluogo: "Firenze" }, { istat: 10, nome: "Umbria", capoluogo: "Perugia" },
    { istat: 11, nome: "Marche", capoluogo: "Ancona" }, { istat: 12, nome: "Lazio", capoluogo: "Roma" },
    { istat: 13, nome: "Abruzzo", capoluogo: "L'Aquila" }, { istat: 14, nome: "Molise", capoluogo: "Campobasso" },
    { istat: 15, nome: "Campania", capoluogo: "Napoli" }, { istat: 16, nome: "Puglia", capoluogo: "Bari" },
    { istat: 17, nome: "Basilicata", capoluogo: "Potenza" }, { istat: 18, nome: "Calabria", capoluogo: "Catanzaro" },
    { istat: 19, nome: "Sicilia", capoluogo: "Palermo", speciale: true }, { istat: 20, nome: "Sardegna", capoluogo: "Cagliari", speciale: true },
  ],
  // regioni: tutte quelle giuste per la domanda. dettaglio: quello che si legge dopo la risposta (dati verificati).
  fatti: [
    // monti
    { tipo: "monte", nome: "Monte Bianco", domanda: "Su quale regione si trova il Monte Bianco?", regioni: [2], dettaglio: "Il Monte Bianco è il monte più alto d'Italia e delle Alpi: circa 4800 m, al confine con la Francia.", fonte: "https://it.wikipedia.org/wiki/Monte_Bianco" },
    { tipo: "monte", nome: "Monte Rosa", domanda: "Su quale regione si trova il Monte Rosa?", regioni: [1, 2], dettaglio: "Il Monte Rosa è fra Piemonte e Valle d'Aosta (e la Svizzera). La sua vetta più alta, la Punta Dufour (4634 m), è in Svizzera.", fonte: "https://it.wikipedia.org/wiki/Monte_Rosa" },
    { tipo: "monte", nome: "Monviso", domanda: "In quale regione si trova il Monviso?", regioni: [1], dettaglio: "Il Monviso è alto 3841 m. Lì nasce il Po.", fonte: "https://it.wikipedia.org/wiki/Monviso" },
    { tipo: "monte", nome: "Gran Sasso", domanda: "In quale regione si trova il Gran Sasso?", regioni: [13], dettaglio: "Il Corno Grande del Gran Sasso, 2912 m, è la vetta più alta degli Appennini.", fonte: "https://it.wikipedia.org/wiki/Gran_Sasso_d%27Italia" },
    { tipo: "monte", nome: "Etna", domanda: "In quale regione si trova l'Etna?", regioni: [19], dettaglio: "L'Etna è il vulcano attivo più alto d'Europa: circa 3400 m, e l'altezza cambia con le eruzioni.", fonte: "https://it.wikipedia.org/wiki/Etna" },
    { tipo: "monte", nome: "Vesuvio", domanda: "In quale regione si trova il Vesuvio?", regioni: [15], dettaglio: "Il Vesuvio è un vulcano alto 1281 m, vicino a Napoli.", fonte: "https://it.wikipedia.org/wiki/Vesuvio" },
    { tipo: "monte", nome: "Marmolada", domanda: "Su quale regione si trova la Marmolada?", regioni: [4, 5], dettaglio: "La Marmolada, 3343 m, è la vetta più alta delle Dolomiti, fra Trentino-Alto Adige e Veneto.", fonte: "https://it.wikipedia.org/wiki/Marmolada" },
    // fiumi
    { tipo: "fiume", nome: "Po (sorgente)", domanda: "In quale regione nasce il Po?", regioni: [1], dettaglio: "Il Po nasce dal Monviso. È il fiume più lungo d'Italia: 652 km.", fonte: "https://it.wikipedia.org/wiki/Po" },
    { tipo: "fiume", nome: "Po (corso)", domanda: "Quale di queste regioni attraversa il Po?", regioni: [1, 3, 8, 5], dettaglio: "Il Po attraversa Piemonte, Lombardia, Emilia-Romagna e Veneto e sfocia nell'Adriatico con un delta.", fonte: "https://it.wikipedia.org/wiki/Po" },
    { tipo: "fiume", nome: "Adige", domanda: "In quale regione nasce l'Adige?", regioni: [4], dettaglio: "L'Adige nasce al Passo di Resia e sfocia nell'Adriatico in Veneto. È lungo 410 km, il secondo fiume d'Italia.", fonte: "https://it.wikipedia.org/wiki/Adige" },
    { tipo: "fiume", nome: "Tevere (sorgente)", domanda: "In quale regione nasce il Tevere?", regioni: [8], dettaglio: "Il Tevere nasce dal Monte Fumaiolo, in Emilia-Romagna. È lungo 405 km, il terzo fiume d'Italia.", fonte: "https://it.wikipedia.org/wiki/Tevere" },
    { tipo: "fiume", nome: "Tevere (foce)", domanda: "Il Tevere passa per Roma e sfocia nel mare: in quale regione?", regioni: [12], dettaglio: "Il Tevere attraversa Toscana, Umbria e Lazio e sfocia nel Mar Tirreno.", fonte: "https://it.wikipedia.org/wiki/Tevere" },
    { tipo: "fiume", nome: "Arno", domanda: "In quale regione scorre l'Arno, da dove nasce a dove finisce?", regioni: [9], dettaglio: "L'Arno, 241 km, nasce dal Monte Falterona e passa per Firenze e Pisa.", fonte: "https://it.wikipedia.org/wiki/Arno" },
    { tipo: "fiume", nome: "Piave", domanda: "In quale regione nasce il Piave?", regioni: [6], dettaglio: "Il Piave nasce sul Monte Peralba, a Sappada, che dal 2017 è in Friuli-Venezia Giulia. Attraversa il Veneto e sfocia nell'Adriatico: circa 230 km.", fonte: "https://it.wikipedia.org/wiki/Piave" },
    // laghi
    { tipo: "lago", nome: "Lago di Garda", domanda: "Il lago di Garda tocca quale di queste regioni?", regioni: [3, 5, 4], dettaglio: "Il lago di Garda è il più grande d'Italia, circa 370 km², fra Lombardia, Veneto e Trentino-Alto Adige.", fonte: "https://it.wikipedia.org/wiki/Lago_di_Garda" },
    { tipo: "lago", nome: "Lago Maggiore", domanda: "Il lago Maggiore tocca quale di queste regioni?", regioni: [1, 3], dettaglio: "Il lago Maggiore, circa 212 km², è il secondo d'Italia, fra Piemonte, Lombardia e Svizzera.", fonte: "https://it.wikipedia.org/wiki/Lago_Maggiore" },
    { tipo: "lago", nome: "Lago di Como", domanda: "In quale regione si trova il lago di Como?", regioni: [3], dettaglio: "Il lago di Como è il più profondo d'Italia: oltre 400 m.", fonte: "https://it.wikipedia.org/wiki/Lago_di_Como" },
    { tipo: "lago", nome: "Lago Trasimeno", domanda: "In quale regione si trova il lago Trasimeno?", regioni: [10], dettaglio: "Il Trasimeno, circa 128 km², è il lago più grande dell'Italia peninsulare.", fonte: "https://it.wikipedia.org/wiki/Lago_Trasimeno" },
    { tipo: "lago", nome: "Lago di Bolsena", domanda: "In quale regione si trova il lago di Bolsena?", regioni: [12], dettaglio: "Il lago di Bolsena, circa 114 km², è il più grande lago vulcanico d'Europa.", fonte: "https://it.wikipedia.org/wiki/Lago_di_Bolsena" },
  ],
};

/* ---- parti pure ---- */
const nomeRegione = (istat) => (GEOGRAFIA_ITALIA.regioni.find((r) => r.istat === istat) || {}).nome || "";
const perPrima = (p) => !!p && classeNumero(p.classe) === 1;
const rispostaGeografia = (q, istat) => q.istat.includes(istat);

// n domande, tipi mescolati (mai due uguali di fila, se si può), quattro scelte di regioni con una sola giusta.
function domandeGeografia(dati, n, rnd = Math.random) {
  const mescola = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const nome = (i) => dati.regioni.find((r) => r.istat === i).nome;
  const code = {
    regione: mescola(dati.regioni).map((r) => ({ tipo: "regione", testo: "Tocca la regione: " + r.nome, giuste: [r.istat], spiegazione: "Il capoluogo è " + r.capoluogo + "." })),
    capoluogo: mescola(dati.regioni).map((r) => ({ tipo: "capoluogo", testo: r.capoluogo + " è il capoluogo di quale regione?", giuste: [r.istat], spiegazione: r.capoluogo + " è il capoluogo della regione " + r.nome + "." })),
  };
  for (const f of mescola(dati.fatti)) (code[f.tipo] = code[f.tipo] || []).push({ tipo: f.tipo, testo: f.domanda, giuste: f.regioni, spiegazione: f.dettaglio });
  const tipi = mescola(Object.keys(code)), out = [];
  for (let giro = 0; out.length < n && tipi.some((t) => code[t].length); giro++) for (const t of tipi) if (code[t].length && out.length < n) out.push(code[t].shift());
  // istat: le regioni giuste (per la cartina); giuste: i loro nomi (per i bottoni)
  return out.map((q) => {
    const giusta = q.giuste[Math.floor(rnd() * q.giuste.length)];
    const altre = mescola(dati.regioni.map((r) => r.istat).filter((i) => !q.giuste.includes(i))).slice(0, 3);
    return { tipo: q.tipo, testo: q.testo, spiegazione: q.spiegazione, istat: q.giuste, giuste: q.giuste.map(nome), scelte: mescola([giusta, ...altre]).map(nome) };
  });
}

/* ---- vista ---- */
let quizGeo = null;
function disegnaGeografiaOggi() {
  const box = $("geografia-oggi"); if (!box) return;
  box.innerHTML = perPrima(profilo)
    ? '<div class="card-invalsi"><p><b>Geografia d\'Italia</b></p><p class="aiuto">Regioni, capoluoghi, monti, fiumi e laghi: tocca la cartina.</p>' +
      '<div class="bottoni"><button type="button" class="minore" id="btn-apri-geografia">Fai il quiz</button></div></div>' : "";
  const b = $("btn-apri-geografia"); if (b) b.onclick = apriGeografia;
}
// La cartina è un aiuto in più per chi tocca: per lo screen reader e per le regioni piccole ci sono i bottoni.
const htmlCartina = () => '<svg class="cartina" viewBox="' + MAPPA_ITALIA.viewBox + '" aria-hidden="true" focusable="false">' +
  MAPPA_ITALIA.regioni.map((r) => '<path data-istat="' + r.istat + '" d="' + r.d + '"></path>').join("") + "</svg>";
function apriGeografia() {
  quizGeo = { domande: domandeGeografia(GEOGRAFIA_ITALIA, 10), i: 0, esiti: [] };
  $("geo-cartina").innerHTML = htmlCartina();
  vai("geografia"); mostraDomandaGeo();
}
function mostraDomandaGeo() {
  const q = quizGeo.domande[quizGeo.i];
  $("geo-fine").hidden = true; $("geo-gioco").hidden = false;
  $("geo-conta").textContent = "Domanda " + (quizGeo.i + 1) + " di " + quizGeo.domande.length;
  $("geo-domanda").textContent = q.testo;
  $("geo-scelte").innerHTML = q.scelte.map((s) => '<button type="button" class="scelta-geo" data-regione="' + esc(s) + '">' + esc(s) + "</button>").join("");
  $("geo-esito").innerHTML = ""; $("btn-geo-avanti").hidden = true;
  document.querySelectorAll("#geo-cartina path").forEach((p) => { p.removeAttribute("data-s"); });
}
function rispondiGeo(istat) {
  const q = quizGeo.domande[quizGeo.i];
  if (quizGeo.esiti[quizGeo.i] !== undefined) return; // una risposta per domanda
  const giusto = rispostaGeografia(q, istat);
  quizGeo.esiti[quizGeo.i] = giusto;
  document.querySelectorAll("#geo-cartina path").forEach((p) => {
    const i = Number(p.dataset.istat);
    if (q.istat.includes(i)) p.dataset.s = "verde"; else if (i === istat) p.dataset.s = "rosso";
  });
  document.querySelectorAll(".scelta-geo").forEach((b) => { b.disabled = true; if (q.giuste.includes(b.dataset.regione)) b.dataset.s = "verde"; else if (b.dataset.regione === nomeRegione(istat)) b.dataset.s = "rosso"; });
  $("geo-esito").innerHTML = (giusto ? '<p><span class="sem" data-s="verde"><i aria-hidden="true">●</i> Ci sei</span></p>'
    : '<p><span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Non ancora</span> ' + (q.giuste.length > 1 ? "Andavano bene: " : "È ") + esc(q.giuste.join(", ")) + ".</p>") +
    "<p>" + esc(q.spiegazione) + "</p>";
  $("btn-geo-avanti").hidden = false; $("btn-geo-avanti").textContent = quizGeo.i + 1 < quizGeo.domande.length ? "Avanti" : "Vedi com'è andata";
  $("btn-geo-avanti").focus();
}
function avantiGeo() {
  if (quizGeo.i + 1 < quizGeo.domande.length) { quizGeo.i++; mostraDomandaGeo(); return; }
  const giuste = quizGeo.esiti.filter(Boolean).length;
  const sbagliate = quizGeo.domande.filter((q, i) => !quizGeo.esiti[i]);
  $("geo-gioco").hidden = true; $("geo-fine").hidden = false;
  $("geo-punteggio").innerHTML = "<h2>" + giuste + " su " + quizGeo.domande.length + "</h2>" +
    (sbagliate.length ? '<p class="aiuto">Da ripassare:</p><ul class="domande-esame">' + sbagliate.map((q) => "<li>" + esc(q.testo) + ": " + esc(q.giuste.join(", ")) + "</li>").join("") + "</ul>"
      : "<p>Tutte giuste al primo colpo.</p>");
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-geografia")) {
  $("geo-cartina").addEventListener("click", (e) => { const p = e.target.closest && e.target.closest("path[data-istat]"); if (p) rispondiGeo(Number(p.dataset.istat)); });
  $("geo-scelte").addEventListener("click", (e) => { const b = e.target.closest(".scelta-geo"); if (b) rispondiGeo(GEOGRAFIA_ITALIA.regioni.find((r) => r.nome === b.dataset.regione).istat); });
  $("btn-geo-avanti").addEventListener("click", avantiGeo);
  $("btn-geo-ancora").addEventListener("click", apriGeografia);
}
