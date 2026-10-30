// Prova di esercizi di matematica (issue #5, fetta #8): la ragazza scrive il risultato e,
// se vuole, i passaggi (o fotografa il quaderno); la funzione `modello` (azione
// esercizi_correggi) giudica il risultato con un calcolo e spiega il primo passaggio
// sbagliato. Esito a semaforo per tipo di esercizio, salvato come le altre prove.
// Script classico caricato dopo esercizi.js: usa $, esc, errore, avviso, attesa, passoAttesa,
// modello, conRiprova, messaggioModello, trascrivi, ridimensiona, lettoVuoto, statoDaMedia,
// voto, votoIt, formulaHtml, caricaKatex, rendiFormule, caricaLibreria, sb, argomenti,
// eserciziDi, eserciziMostrati, scartatiMostrati.

/* =================================================================== parti pure */

const PUNTI_CON_SOLUZIONE = 5; // risultato giusto ma dopo aver aperto la soluzione

const ESITI_ES = {
  giusto: ["✓", "Giusto"],
  senza_unita: ["≈", "Il numero è giusto, ma manca l'unità di misura"],
  unita_sbagliata: ["≈", "Il numero è giusto, l'unità di misura no"],
  sbagliato: ["✗", "Non torna"],
  non_numerica: ["✗", "Non riesco a leggere un numero"],
  vuota: ["—", "Non hai risposto"],
};
const TIPI_ERRORE_IT = {
  calcolo: "errore di calcolo", formula: "formula sbagliata", segno: "errore di segno", unita: "unità di misura",
  procedimento: "strada sbagliata", altro: "", nessuno: "",
};

// Aprire la soluzione prima di correggere vale come un aiuto: al massimo 5 punti.
const puntiConAiuto = (punti, vista) => (vista ? Math.min(punti, PUNTI_CON_SOLUZIONE) : punti);

// Esito per tipo di esercizio: media dei punti, semaforo, e indice/voto della prova
// (ogni tipo pesa uguale). esercizi: [{ tipo_id, tipo }]; punti: [0..10] nello stesso ordine.
function esitoPerTipo(esercizi, punti) {
  const per = {};
  esercizi.forEach((e, i) => {
    const t = per[e.tipo_id] || (per[e.tipo_id] = { tipo_id: e.tipo_id, titolo: e.tipo, s: 0, n: 0 });
    t.s += punti[i]; t.n++;
  });
  const righe = Object.values(per).map((t) => ({ tipo_id: t.tipo_id, titolo: t.titolo, n: t.n, media: t.s / t.n, stato: statoDaMedia(t.s / t.n) }));
  const indice = righe.length ? Math.round(righe.reduce((s, r) => s + r.media, 0) / righe.length * 10) : 0;
  return { righe, indice, voto: voto(indice) };
}

function htmlSoluzione(e) {
  const passi = (e.passaggi || []).map((p) => "<li>" + esc(p.testo) + (p.formula ? '<span class="riga-formula">' + formulaHtml(p.formula) + "</span>" : "") + "</li>").join("");
  return (passi ? '<ol class="passaggi">' + passi + "</ol>" : "") +
    '<p class="risultato-es">Risultato: <b>' + esc(e.risultato.valore + (e.risultato.unita ? " " + e.risultato.unita : "")) + "</b></p>";
}

// c: correzione dal server, più punti finali e vista (soluzione aperta prima). e: l'esercizio.
function htmlCorrezione(c, e) {
  const [segno, frase] = ESITI_ES[c.esito] || ESITI_ES.sbagliato;
  const tipoErr = TIPI_ERRORE_IT[c.tipo_errore] || "";
  let h = '<div class="esito-c" data-s="' + statoDaMedia(c.punti) + '"><h3><span class="pallino"></span>' + segno + " " + esc(frase) +
    '<span class="voto">' + c.punti + "/10</span></h3>";
  if (c.vista) h += '<p class="legenda">Avevi aperto la soluzione prima di correggere: questo esercizio vale al massimo ' + PUNTI_CON_SOLUZIONE + " punti.</p>";
  if (c.primo_errore) h += '<p>Primo passaggio da rivedere' + (tipoErr ? " (" + esc(tipoErr) + ")" : "") + ':</p><span class="citazione">' + esc(c.primo_errore) + "</span>";
  if (c.spiegazione) h += '<p class="spiega-es">' + esc(c.spiegazione) + "</p>";
  if (c.esempio) h += '<p class="occhiello">Un esempio simile</p><p class="esempio-es">' + esc(c.esempio) + "</p>";
  if (c.punti < 10) h += '<p class="occhiello">Ecco come si fa</p>' + htmlSoluzione(e);
  return h + "</div>";
}

// Le domande della prova nel formato di `domande`: valori già ammessi dai vincoli (aperta,
// livello medio), concetto_titolo = tipo di esercizio, esercizio completo in jsonb.
function righeDomandeEsercizi(sessioneId, argomentoId, esercizi, ancoraDi) {
  return esercizi.map((e, i) => ({
    sessione_id: sessioneId, argomento_id: argomentoId, concetto_id: null, concetto_titolo: e.tipo,
    ordine: i + 1, tipo: "aperta", livello: "medio", testo: e.testo,
    risposta_attesa: e.risultato.valore + (e.risultato.unita ? " " + e.risultato.unita : ""),
    elementi: [], ancora: ancoraDi[e.tipo_id] || e.testo, esercizio: e,
  }));
}

/* =================================================================== svolgimento */

let soluzioniViste = new Set(), correzioniFatte = null, correzioneInCorso = false;

// Area di risposta sotto ogni esercizio (la aggiunge la vista dopo htmlEsercizio).
function htmlRispostaEsercizio(i) {
  return '<div class="risposta-es">' +
    '<label class="etichetta" for="ris-es-' + i + '">Il tuo risultato</label>' +
    '<input type="text" id="ris-es-' + i + '" autocomplete="off" placeholder="per esempio 15 cm">' +
    '<details class="passaggi-mia"><summary>Scrivi o fotografa i passaggi (se vuoi)</summary>' +
    '<textarea id="pas-es-' + i + '" placeholder="Un passaggio per riga, come sul quaderno"></textarea>' +
    '<label class="scatto piccolo" for="foto-es-' + i + '"><span><b>Fotografa il quaderno</b><small>leggo i tuoi passaggi e li scrivo qui sopra</small></span>' +
    '<input type="file" id="foto-es-' + i + '" accept="image/*"></label>' +
    '<div id="stato-foto-es-' + i + '"></div></details>' +
    '<div id="cor-es-' + i + '"></div></div>';
}

function preparaSvolgimento() {
  soluzioniViste = new Set(); correzioniFatte = null; correzioneInCorso = false;
  $("btn-salva-es").hidden = true;
  document.querySelectorAll("#lista-es .esercizio").forEach((art, i) => {
    art.insertAdjacentHTML("beforeend", htmlRispostaEsercizio(i));
    const sol = art.querySelector("details:not(.passaggi-mia)");
    if (sol) sol.addEventListener("toggle", () => { if (sol.open && !correzioniFatte && !correzioneInCorso) soluzioniViste.add(i); });
    $("foto-es-" + i).addEventListener("change", (ev) => leggiQuaderno(i, [...ev.target.files]));
  });
  $("btn-correggi-es").hidden = !eserciziMostrati.length;
  $("esito-es").innerHTML = "";
}

async function leggiQuaderno(i, files) {
  if (!files.length) return;
  const st = $("stato-foto-es-" + i);
  attesa(st, ["Leggo il quaderno"]);
  try {
    const blobs = await Promise.all(files.map(ridimensiona));
    const testi = await trascrivi(blobs, false, (t) => passoAttesa(st, t), true);
    if (lettoVuoto(testi)) throw new Error("vuoto");
    const area = $("pas-es-" + i);
    area.value = (area.value ? area.value + "\n" : "") + testi.join("\n");
    attesa(st, null);
  } catch (e) {
    attesa(st, null);
    errore(st, messaggioModello(e, "Non riesco a leggere questa foto. Riprova con più luce, oppure scrivi i passaggi."));
  }
}

/* =================================================================== correzione ed esito */

async function correggiEsercizi() {
  const btn = $("btn-correggi-es"), st = $("stato-es"), es = eserciziMostrati;
  const risposte = es.map((_, i) => $("ris-es-" + i).value.trim());
  if (!risposte.some(Boolean)) { errore($("err-es"), "Scrivi almeno un risultato prima di correggere."); return; }
  errore($("err-es"), "");
  // Da qui le risposte sono consegnate: niente modifiche, niente nuovi esercizi finché non torna la correzione.
  correzioneInCorso = true;
  const viste = new Set(soluzioniViste);
  bloccaProva(true);
  attesa(st, ["Controllo i risultati", "Leggo i tuoi passaggi"]);
  const pacchetto = es.map((e, i) => ({
    id: "e" + i, testo: e.testo, passaggi: e.passaggi, risultato: e.risultato, verifica: e.verifica,
    risposta: risposte[i], svolgimento: $("pas-es-" + i).value.trim(),
  }));
  try {
    const r = await conRiprova(() => modello({ azione: "esercizi_correggi", pacchetto }));
    if (eserciziMostrati !== es) return; // nel frattempo è cambiata la prova
    const perId = Object.fromEntries(r.correzioni.map((c) => [c.id, c]));
    correzioniFatte = es.map((e, i) => {
      const c = perId["e" + i] || { esito: risposte[i] ? "non_numerica" : "vuota", punti: 0 };
      return { ...c, vista: viste.has(i), punti: puntiConAiuto(c.punti, viste.has(i)), risposta: risposte[i], svolgimento: pacchetto[i].svolgimento };
    });
    mostraCorrezione(es, correzioniFatte, r.analisi_mancante);
  } catch (e) {
    correzioneInCorso = false;
    if (eserciziMostrati === es) bloccaProva(false);
    errore($("err-es"), messaggioModello(e, "Non sono riuscito a correggere. Riprova fra un momento: le tue risposte restano qui."));
    return;
  } finally {
    attesa(st, null); $("btn-altri-es").disabled = false; $("btn-genera-es").disabled = false;
  }
  await salvaConRiprova(es, correzioniFatte);
}

// Durante la correzione: risposte e bottoni fermi.
function bloccaProva(si) {
  document.querySelectorAll("#lista-es input, #lista-es textarea").forEach((x) => { x.disabled = si; });
  ["btn-correggi-es", "btn-altri-es", "btn-genera-es"].forEach((id) => { $(id).disabled = si; });
}

// Se il salvataggio non riesce la correzione resta a schermo e si può riprovare a salvare.
async function salvaConRiprova(es, cor) {
  const btn = $("btn-salva-es");
  btn.hidden = true; btn.disabled = true;
  try {
    await salvaProvaEsercizi(es, cor);
    errore($("err-es"), "");
  } catch (e) {
    errore($("err-es"), "Ho corretto, ma non sono riuscito a salvare la prova nello storico. Il risultato qui sopra resta valido: riprova a salvarla.");
    btn.hidden = false; btn.onclick = () => salvaConRiprova(es, cor);
  } finally {
    btn.disabled = false;
  }
}

function mostraCorrezione(es, cor, analisiMancante) {
  cor.forEach((c, i) => { $("cor-es-" + i).innerHTML = htmlCorrezione(c, es[i]); });
  document.querySelectorAll("#lista-es input, #lista-es textarea").forEach((x) => { x.disabled = true; });
  $("btn-correggi-es").disabled = false;
  const esito = esitoPerTipo(es, cor.map((c) => c.punti));
  const box = $("esito-es");
  box.innerHTML = '<p class="occhiello">Com\'è andata, per tipo di esercizio</p>' +
    esito.righe.map((r) => '<div class="esito-c" data-s="' + r.stato + '"><h3><span class="pallino"></span>' + esc(r.titolo) +
      '<span class="voto">' + votoIt(Math.round(r.media * 2) / 2) + "/10</span></h3><small>" + r.n + (r.n === 1 ? " esercizio" : " esercizi") + "</small></div>").join("") +
    '<p class="legenda">Voto della prova: ' + votoIt(esito.voto) + "." + (analisiMancante ? " I passaggi non sono riuscito a leggerli adesso: i risultati però sono corretti." : "") + "</p>";
  $("btn-correggi-es").hidden = true;
  box.scrollIntoView({ behavior: "smooth", block: "start" });
  caricaKatex().then((ok) => { if (ok) rendiFormule($("lista-es")); });
}

// Prova nello storico (sessione, domande, risposte) e media e stato aggiornati sui tipi.
async function salvaProvaEsercizi(es, cor) {
  const a = eserciziDi, esito = esitoPerTipo(es, cor.map((c) => c.punti));
  const { data: s, error } = await sb.from("sessioni").insert({
    argomento_id: a.id, titolo: a.titolo, materia: a.materia, livello: "medio", tipo: "aperte", modalita: "scritta",
    percorso: "esercizi", indice: esito.indice, voto: esito.voto, n_domande: es.length,
    n_errori: cor.filter((c) => c.punti < 8).length, scartate: scartatiMostrati || 0,
  }).select("id").single();
  if (error) throw error;
  try { await salvaDomandeERisposte(s.id, a, es, cor); }
  catch (e) {
    // Niente prove a metà nello storico: domande e risposte se ne vanno con la sessione.
    await sb.from("sessioni").delete().eq("id", s.id);
    throw e;
  }
  const aggiornati = await Promise.all(esito.righe.map((r) => {
    const t = (a.tipi || []).find((x) => x.id === r.tipo_id);
    return sb.from("esercizi_tipi").update({ media: Math.round(r.media * 10) / 10, stato: r.stato, tentativi: ((t && t.tentativi) || 0) + 1 }).eq("id", r.tipo_id);
  }));
  const sbagliato = aggiornati.find((x) => x.error);
  if (sbagliato) console.error("stato dei tipi non aggiornato:", sbagliato.error);
  await caricaLibreria();
  eserciziDi = argomenti.find((x) => x.id === a.id) || a;
}

async function salvaDomandeERisposte(sessioneId, a, es, cor) {
  const s = { id: sessioneId };
  const ancoraDi = Object.fromEntries((a.tipi || []).map((t) => [t.id, t.ancora]));
  const { data: ds, error: e2 } = await sb.from("domande").insert(righeDomandeEsercizi(s.id, a.id, es, ancoraDi)).select("id, ordine");
  if (e2) throw e2;
  const idPer = Object.fromEntries(ds.map((x) => [x.ordine, x.id]));
  const { error: e3 } = await sb.from("risposte").insert(cor.map((c, i) => ({
    sessione_id: s.id, domanda_id: idPer[i + 1], punteggio: c.punti, guidata: c.vista,
    testo: (c.risposta || "—") + (c.svolgimento ? "\n\nPassaggi:\n" + c.svolgimento : ""),
    commento: [c.primo_errore ? "Primo passaggio da rivedere: " + c.primo_errore : "", c.spiegazione].filter(Boolean).join("\n") || (ESITI_ES[c.esito] || ESITI_ES.sbagliato)[1],
  })));
  if (e3) throw e3;
}

function collegaProvaEsercizi() {
  $("btn-correggi-es").addEventListener("click", correggiEsercizi);
}
