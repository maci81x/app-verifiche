// Poesia a memoria (issue #28, italiano, tutte le classi): si fotografa la poesia, l'app la legge a voce,
// poi nasconde le parole un po' alla volta; chi studia la ripete a voce e l'app segna dove si blocca.
// Script classico caricato dopo classe-app.js: usa $, esc, attesa, errore, modello, messaggioModello, vai,
// chiudiFoglio, profilo, leggiLocale, salvaLocale, ridimensiona, base64, Riconoscimento, provaMicrofono,
// messaggioVoce, erroreVoce. Niente database: le poesie restano sul telefono (le ultime 5).

/* ---- parti pure ---- */

const LIVELLI_POESIA = ["Tutta in vista", "Una parola ogni cinque", "Metà delle parole", "Strofe intere"];
const PAROLA = /[\p{L}\p{N}]+/u;

// Ogni verso in pezzi: parole ({ testo, parola: true, nascosta }) e il resto (spazi, punteggiatura, apostrofi).
// livello 1: una parola ogni cinque; 2: una sì e una no; 3: resta solo la prima parola di ogni strofa.
function nascondiParole(strofe, livello) {
  let k = 0;
  return strofe.map((strofa) => {
    let primaDellaStrofa = true;
    return strofa.map((verso) => (String(verso).match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) || []).map((testo) => {
      if (!PAROLA.test(testo)) return { testo, parola: false };
      const i = k++, prima = primaDellaStrofa; primaDellaStrofa = false;
      const nascosta = livello === 1 ? i % 5 === 4 : livello === 2 ? i % 2 === 1 : livello === 3 ? !prima : false;
      return { testo, parola: true, nascosta };
    }));
  });
}

const pianoPo = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const paroleDi = (s) => pianoPo(s).match(/[\p{L}\p{N}]+/gu) || [];
// Due parole sono la stessa se uguali, o se una comincia con l'altra (mar/mare, ribollir/ribollire).
const stessa = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

// Dove ti blocchi: si segue la poesia parola per parola su quello che ha capito il riconoscimento vocale.
// Le parole lunghe si cercano un po' più avanti (il riconoscimento ne aggiunge o ne sbaglia qualcuna);
// quelle corte (a, gl', de', e) valgono solo al loro posto e, se mancano, non bloccano da sole: il
// blocco si segna dalla prima parola che manca. → { completa, fino, totale, strofa, verso, parola }.
function doveTiBlocchi(strofe, parlato) {
  const attese = [];
  strofe.forEach((s, si) => s.forEach((v, vi) => paroleDi(v).forEach((p) => attese.push({ p, strofa: si + 1, verso: vi + 1 }))));
  const detto = paroleDi(parlato);
  let j = 0, primo = -1;
  for (let i = 0; i < attese.length; i++) {
    const w = attese[i].p;
    const blocca = (da) => ({ completa: false, fino: da, totale: attese.length, strofa: attese[da].strofa, verso: attese[da].verso, parola: attese[da].p });
    if (j >= detto.length) return blocca(primo >= 0 ? primo : i);
    const dove = w.length <= 2 ? (stessa(detto[j], w) ? j : -1) : detto.slice(j, j + 4).findIndex((d) => stessa(d, w));
    if (dove >= 0) { j = w.length <= 2 ? j + 1 : j + dove + 1; primo = -1; continue; }
    if (w.length <= 2) { if (primo < 0) primo = i; continue; }
    return blocca(primo >= 0 ? primo : i);
  }
  return { completa: true, fino: attese.length, totale: attese.length };
}

function fraseBlocco(r) {
  if (r.completa) return "L'hai detta tutta senza fermarti. Prova con più parole nascoste.";
  if (!r.fino) return "Non ho sentito l'inizio. Tocca Ripetila a voce e parti dal primo verso.";
  return "Qui ti blocchi: «" + r.parola + "» (strofa " + r.strofa + ", verso " + r.verso + "). Rileggi quel verso a voce e riprova.";
}

/* ---- vista ---- */

const chiavePoesie = (id) => "verifiche-poesie-" + id;
// le poesie salvate, anche se il dato sul telefono è rotto
const poesieSalvate = () => { const l = profilo ? leggiLocale(chiavePoesie(profilo.id), []) : []; return Array.isArray(l) ? l.filter((p) => p && Array.isArray(p.strofe)) : []; };
// uscendo dalla vista: niente più ascolto né lettura a voce
function fermaPoesia() { if (ascoltoPoesia) ascoltoPoesia.stop(); if (typeof window !== "undefined" && window.speechSynthesis) speechSynthesis.cancel(); }
let poesia = null, livelloPoesia = 0, fotoPoesia = [], poesiaOccupata = false, ascoltoPoesia = null;

function apriPoesia() {
  poesia = null; fotoPoesia = [];
  $("po-foto").hidden = false; $("po-studio").hidden = true; $("po-testo").value = "";
  errore($("err-po"), ""); attesa($("stato-po"), null);
  disegnaPoesieSalvate();
  vai("poesia");
}
function disegnaPoesieSalvate() {
  const box = $("po-salvate"); box.innerHTML = "";
  poesieSalvate().forEach((p) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "sessione";
    b.innerHTML = '<div class="alto"><span class="tit">' + esc(p.titolo || p.strofe[0][0]) + "</span></div>" + (p.autore ? '<div class="meta">' + esc(p.autore) + "</div>" : "");
    b.onclick = () => studiaPoesia(p);
    box.appendChild(b);
  });
  $("po-occhiello-salvate").hidden = !box.children.length;
}
async function leggiPoesia(corpo) {
  if (poesiaOccupata) return;
  poesiaOccupata = true; errore($("err-po"), "");
  attesa($("stato-po"), ["Leggo la poesia", "Verso per verso"]);
  try {
    const p = await modello(corpo);
    if (profilo) salvaLocale(chiavePoesie(profilo.id), [{ ...p, livello: 0 }, ...poesieSalvate().filter((x) => x && JSON.stringify(x.strofe) !== JSON.stringify(p.strofe))].slice(0, 5));
    studiaPoesia({ ...p, livello: 0 });
  } catch (e) {
    errore($("err-po"), e.message === "nessuna_poesia" ? "Nella foto non trovo una poesia. Riprova con una foto più vicina, oppure scrivila qui sotto."
      : messaggioModello(e, "Non sono riuscito a leggere la poesia. Riprova fra un momento."));
  }
  attesa($("stato-po"), null); poesiaOccupata = false;
}
function studiaPoesia(p) {
  poesia = p; livelloPoesia = p.livello || 0;
  $("po-foto").hidden = true; $("po-studio").hidden = false;
  $("po-titolo").textContent = p.titolo || "La tua poesia"; $("po-autore").textContent = p.autore || ""; $("po-autore").hidden = !p.autore;
  $("po-esito").textContent = ""; $("po-ascolto").textContent = "";
  disegnaPoesia();
  window.scrollTo(0, 0);
}
function disegnaPoesia() {
  document.querySelectorAll("[data-livello-po]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.livelloPo) === livelloPoesia)));
  $("po-versi").innerHTML = nascondiParole(poesia.strofe, livelloPoesia).map((s) => '<p class="strofa">' + s.map((v) => v.map((t) =>
    t.parola && t.nascosta ? '<span class="buco" aria-label="parola nascosta">' + "_".repeat(Math.min(12, t.testo.length)) + "</span>" : esc(t.testo)).join("")).join("<br>") + "</p>").join("");
}
function salvaLivelloPoesia() {
  if (!profilo || !poesia) return;
  salvaLocale(chiavePoesie(profilo.id), poesieSalvate().map((x) => (x && JSON.stringify(x.strofe) === JSON.stringify(poesia.strofe) ? { ...x, livello: livelloPoesia } : x)));
}
function leggimiPoesia() {
  if (!window.speechSynthesis || !poesia) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(poesia.strofe.map((s) => s.join(", ")).join(". "));
  u.lang = "it-IT"; u.rate = 0.85;
  const it = speechSynthesis.getVoices().find((v) => /^it/i.test(v.lang)); if (it) u.voice = it;
  speechSynthesis.speak(u);
}
// Ascolta finché non tocca «Ho finito» o resta in silenzio 4 secondi; poi dice dove si è bloccat*.
async function ripetiPoesia() {
  if (ascoltoPoesia) { ascoltoPoesia.stop(); return; }
  if (!Riconoscimento) { $("po-esito").textContent = "Questo browser non ha il riconoscimento vocale: usa Chrome o Safari."; return; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (!(await provaMicrofono())) { $("po-esito").textContent = messaggioVoce(erroreVoce); return; }
  const r = new Riconoscimento(); r.lang = "it-IT"; r.continuous = true; r.interimResults = true;
  let finale = "", parziale = "", ultimo = Date.now(), finito = false;
  const btn = $("btn-po-ripeti");
  const chiudi = () => {
    if (finito) return; finito = true; clearInterval(orologio); ascoltoPoesia = null;
    try { r.stop(); } catch (e) { /* già fermo */ }
    btn.textContent = "Ripetila a voce";
    const esito = doveTiBlocchi(poesia.strofe, finale + " " + parziale);
    $("po-esito").textContent = fraseBlocco(esito);
  };
  r.onresult = (ev) => {
    parziale = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) { if (ev.results[i].isFinal) finale += " " + ev.results[i][0].transcript; else parziale += ev.results[i][0].transcript; }
    ultimo = Date.now(); $("po-ascolto").textContent = (finale + " " + parziale).trim();
  };
  r.onerror = (ev) => { if (ev.error !== "no-speech" && ev.error !== "aborted") { finito = true; clearInterval(orologio); ascoltoPoesia = null; btn.textContent = "Ripetila a voce"; $("po-esito").textContent = messaggioVoce(ev.error); } };
  r.onend = () => { if (!finito) { try { r.start(); } catch (e) { chiudi(); } } };
  const orologio = setInterval(() => { if (Date.now() - ultimo > ((finale || parziale) ? 4000 : 12000)) chiudi(); }, 250);
  ascoltoPoesia = { stop: chiudi };
  btn.textContent = "Ho finito"; $("po-esito").textContent = ""; $("po-ascolto").textContent = "Ti ascolto: parti dal primo verso.";
  try { r.start(); } catch (e) { chiudi(); }
}

function collegaPoesia() {
  $("btn-foto-poesia").addEventListener("click", () => { chiudiFoglio("menu-foto"); apriPoesia(); });
  $("foto-poesia").addEventListener("change", async (e) => {
    const file = [...(e.target.files || [])].slice(0, 4); e.target.value = "";
    if (!file.length) return;
    try { fotoPoesia = await Promise.all(file.map(async (f) => base64(await ridimensiona(f)))); }
    catch (err) { errore($("err-po"), "Non riesco ad aprire la foto. Riprova con un'altra."); return; }
    leggiPoesia({ azione: "poesia", immagini: fotoPoesia });
  });
  $("btn-po-scritta").addEventListener("click", () => { const t = $("po-testo").value.trim(); if (t.length < 20) { errore($("err-po"), "Scrivi almeno un paio di versi."); return; } leggiPoesia({ azione: "poesia", testo: t }); });
  document.querySelectorAll("[data-livello-po]").forEach((b) => b.addEventListener("click", () => { livelloPoesia = Number(b.dataset.livelloPo); disegnaPoesia(); salvaLivelloPoesia(); $("po-esito").textContent = ""; }));
  $("btn-po-leggi").addEventListener("click", leggimiPoesia);
  $("btn-po-ripeti").addEventListener("click", ripetiPoesia);
  $("btn-po-altra").addEventListener("click", apriPoesia);
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-poesia")) collegaPoesia();
