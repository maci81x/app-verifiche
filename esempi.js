// Issue #28 (resto), matematica:
//  - esempi svolti che si ritirano piano piano (worked examples con fading): esempio completo, poi manca
//    l'ultimo passo, poi ne mancano due, poi tocca a te senza passi; se sbaglia si torna allo scalino prima (#24);
//  - esercizi mescolati (interleaving) nei ripassi e nelle prove: mai due dello stesso tipo di fila, se si può.
// Script classico caricato dopo classe-app.js: usa $, esc, attesa, errore, modello, conRiprovaEsercizi,
// messaggioModello, formulaHtml, caricaKatex, rendiFormule, compito, htmlErroreTipico.

/* ---- parti pure ---- */

// Quando il risultato non è ancora giusto si vedono tutti i passi: con cosa farne.
const MSG_ESEMPIO_NON_ANCORA = "Ecco tutti i passi: confrontali con i tuoi e trova il primo diverso.";
const GRADINI_ESEMPI = ["Esempio svolto", "Manca l'ultimo passo", "Mancano due passi", "Adesso tocca a te, senza aiuti"];
// Quanti passi si vedono al gradino g (0-3): al terzo gradino non se ne vede nessuno.
function passiVisibili(passi, g) {
  const n = (passi || []).length, nascosti = g >= 3 ? n : Math.min(n, g);
  return { visibili: n - nascosti, nascosti };
}

// Issue #24: giusto si sale di uno scalino; non ancora si torna a quello prima, mai sotto l'esempio svolto.
// Oltre l'ultimo scalino (4) gli esempi sono finiti. Ogni scalino usa un esempio nuovo (i avanza sempre).
const scalinoDopo = (g, giusto) => (giusto ? g + 1 : Math.max(0, g - 1));
const esempiFiniti = (g) => g >= GRADINI_ESEMPI.length;
const serveAltroEsempio = (stato) => stato.i >= stato.lista.length;
const MSG_SCALINO_PRIMA = "Torni allo scalino prima, con un esempio nuovo.";

// I passi della soluzione: il controllo finale («Controllo: …», «Verifica: …») non è un passo da ritirare.
function passiDaRitirare(passi) {
  const p = [...(passi || [])];
  while (p.length > 1 && /^\s*(controllo|verifica)\b/i.test(p[p.length - 1].testo || "")) p.pop();
  return p;
}

// Round robin per tipo: uno per tipo a turno, nell'ordine in cui i tipi compaiono.
function mescolaPerTipo(lista, chiave) {
  const gruppi = new Map();
  for (const x of lista || []) { const k = chiave(x); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k).push(x); }
  const code = [...gruppi.values()], out = [];
  while (out.length < (lista || []).length) for (const c of code) if (c.length) out.push(c.shift());
  return out;
}
// I ripassi del giorno, alternando le strategie: si impara anche a riconoscere quale usare.
const strategiaDi = (v) => (v.compito && v.compito.strategia && v.compito.strategia.nome) || v.compito.testo;
const ripassiMescolati = (dovuti) => mescolaPerTipo(dovuti, strategiaDi);
// Il prossimo ripasso: il primo con una strategia diversa da quella dell'ultimo fatto (se c'è).
function prossimoRipasso(dovuti, ultima) {
  const m = ripassiMescolati(dovuti || []);
  return m.find((v) => strategiaDi(v) !== ultima) || m[0] || null;
}

/* ---- vista: gli esempi dopo la soluzione di un compito ---- */

let esempi = null, esempiOccupato = false;
// Esempi come il compito, con i conti verificati: servono almeno due passi della soluzione perché il ritiro si veda.
async function chiediEsempi() {
  const r = await conRiprovaEsercizi(() => modello({ azione: "esercizi_genera", modello: { testo: compito.testo }, quanti: 5 }));
  return (r.esercizi || []).map((e) => ({ ...e, passaggi: passiDaRitirare(e.passaggi) })).filter((e) => e.passaggi.length >= 2);
}
async function apriEsempi() {
  if (esempiOccupato || !compito) return;
  esempiOccupato = true;
  const box = $("cp-esempi"); box.hidden = false;
  attesa($("stato-esempi"), ["Preparo quattro esempi come questo", "Rifaccio i conti"]);
  try {
    const lista = (await chiediEsempi()).slice(0, 4);
    if (lista.length < 2) throw new Error("nessun_verificato");
    esempi = { lista, g: 0, i: 0, provati: [] };
    disegnaEsempio();
  } catch (e) { errore(box, messaggioModello(e, "Non sono riuscito a preparare esempi con i conti giusti. Riprova fra un momento.")); }
  attesa($("stato-esempi"), null); esempiOccupato = false;
}
// Allo scalino g con l'esempio dopo; se gli esempi sono finiti se ne chiedono altri, con la stessa verifica dei conti.
async function vaiAScalino(g) {
  if (esempiOccupato) return;
  esempi.g = g; esempi.i++;
  if (serveAltroEsempio(esempi)) {
    esempiOccupato = true;
    attesa($("stato-esempi"), ["Preparo un altro esempio", "Rifaccio i conti"]);
    try { esempi.lista.push(...(await chiediEsempi())); } catch (e) { /* sotto: messaggio */ }
    attesa($("stato-esempi"), null); esempiOccupato = false;
    if (serveAltroEsempio(esempi)) { esempi.i--; errore($("es-esito") || $("cp-esempi"), "Non sono riuscito a preparare un altro esempio con i conti giusti. Riprova fra un momento."); return; }
  }
  disegnaEsempio();
}
function htmlPassiEsempio(e, quanti, nascosti) {
  return '<ol class="passaggi">' + e.passaggi.map((x, i) => i < quanti
    ? "<li>" + esc(x.testo) + (x.formula ? '<span class="riga-formula">' + formulaHtml(x.formula) + "</span>" : "") + "</li>"
    : '<li class="passo-nascosto">Passo ' + (i + 1) + ": tocca a te</li>").join("") + "</ol>";
}
function disegnaEsempio() {
  const { lista, g, i } = esempi, e = lista[i], v = passiVisibili(e.passaggi, g);
  const ris = esc(e.risultato.valore + (e.risultato.unita ? " " + e.risultato.unita : ""));
  let h = '<p class="occhiello">' + (g + 1) + " di " + GRADINI_ESEMPI.length + ": " + esc(GRADINI_ESEMPI[g]) + '</p><p class="consegna">' + esc(e.testo) + "</p>";
  if (g === 0) h += htmlPassiEsempio(e, v.visibili, 0) + '<p class="risultato-compito">Risultato: <b>' + ris + "</b></p>" +
    '<p class="aiuto">Leggi ogni passo e chiediti perché viene dopo quello prima.</p><div class="bottoni"><button type="button" class="minore" id="btn-es-avanti">Ho capito, avanti</button></div>';
  else h += (v.visibili ? htmlPassiEsempio(e, v.visibili, v.nascosti) : "") +
    '<label for="es-risposta"><b>Il risultato</b></label><div class="prova-riga"><input type="text" id="es-risposta" inputmode="decimal" autocomplete="off" placeholder="La tua risposta">' +
    '<button type="button" class="minore" id="btn-es-controlla">Controlla</button></div><div class="prova-esito" id="es-esito" aria-live="polite"></div>';
  $("cp-esempi").innerHTML = '<h3 class="sez-titolo">Esempi che si ritirano piano piano</h3>' + h;
  caricaKatex().then((ok) => { if (ok) rendiFormule($("cp-esempi")); });
  const av = $("btn-es-avanti"); if (av) av.onclick = () => vaiAScalino(scalinoDopo(0, true));
  const ct = $("btn-es-controlla"); if (ct) ct.onclick = controllaEsempio;
  const campo = $("es-risposta"); if (campo) campo.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); controllaEsempio(); } };
}
async function controllaEsempio() {
  const { lista, g, i } = esempi, e = lista[i], campo = $("es-risposta"), out = $("es-esito");
  if (!campo.value.trim()) { out.innerHTML = "<p>Scrivi il risultato, poi tocca Controlla.</p>"; return; }
  try {
    const r = await modello({ azione: "prova_tu", atteso: e.risultato, risposta: campo.value.trim(), testo: e.testo });
    if (esempi.provati[g] === undefined) esempi.provati[g] = !!r.giusto;
    const dopo = scalinoDopo(g, !!r.giusto);
    out.innerHTML = (r.giusto ? '<p><span class="sem" data-s="verde"><i aria-hidden="true">●</i> Ci sei</span></p>'
      : '<p><span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Non ancora</span> ' + esc(MSG_ESEMPIO_NON_ANCORA) + '</p>' + htmlErroreTipico(r, "esempio-" + g)) +
      (r.giusto ? "" : htmlPassiEsempio(e, e.passaggi.length, 0) + '<p class="aiuto">' + esc(MSG_SCALINO_PRIMA) + "</p>") +
      (esempiFiniti(dopo) ? '<p class="aiuto">' + esc(fineEsempi(esempi.provati)) + "</p>"
        : '<div class="bottoni"><button type="button" class="minore" id="btn-es-dopo">' + esc(GRADINI_ESEMPI[dopo]) + "</button></div>");
    caricaKatex().then((ok) => { if (ok) rendiFormule(out); });
    const bd = $("btn-es-dopo"); if (bd) bd.onclick = () => vaiAScalino(dopo);
    campo.disabled = $("btn-es-controlla").disabled = true; // una risposta per esempio: il prossimo è nuovo
  } catch (err) { out.innerHTML = "<p>" + esc(messaggioModello(err, "Non riesco a controllare adesso. Riprova fra un momento.")) + "</p>"; }
}
// Alla fine: preciso e vero, solo con quello che è successo.
function fineEsempi(provati, quanti = 4) {
  const fatti = provati.filter((x) => x !== undefined), giusti = fatti.filter(Boolean).length;
  if (quanti < 4) return "Hai fatto tutti gli esempi che avevo: " + giusti + " su " + fatti.length + " al primo colpo.";
  return provati[3] ? "L'ultimo l'hai fatto senza passi: " + giusti + " su " + fatti.length + " al primo colpo."
    : giusti + " su " + fatti.length + " al primo colpo. L'ultimo scalino ti è riuscito dopo un passo indietro.";
}
