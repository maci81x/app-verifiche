// Mini-lezione a schede (issue #23): 5-7 schede dagli appunti da sfogliare e ascoltare, più 2 video brevi
// scelti sul web (YouTube e Rai). Le schede arrivano dall'azione lezione, i video dall'azione video.
// Script classico caricato dopo geografia.js: usa $, esc, evidenzia, aCapo, attesa, errore, modello, messaggioModello,
// vai, profilo, corrente, leggiLocale, salvaLocale, svgFigura, conEsercizi, apriEsercizi, apriPrepara, apriScheda.
// Niente database: l'ultima lezione e i video di ogni argomento restano sul telefono, finché l'argomento non cambia.

/* ---- parti pure ---- */

const ETICHETTE_SCHEDA = { domanda: "Per cominciare", nomi: "Le parole giuste", regola: "L'idea centrale", esempio: "Un esempio svolto", tocca: "Ora tocca a te" };
const chiaveLezione = (id) => "verifiche-lezione-" + id;
const chiaveVideoLezione = (id) => "verifiche-lezione-video-" + id;
const videoAccesi = (id) => leggiLocale(chiaveVideoSpenti(id), false) !== true;

// Frasi di un testo, con la punteggiatura: ognuna si legge e si evidenzia da sola.
const frasiDi = (t) => (String(t || "").match(/[^.!?]+(?:[.!?]+|$)/g) || []).map((f) => f.trim()).filter(Boolean);
const annoIt = (n) => (n < 0 ? -n + " a.C." : String(n));
// I conti letti a voce: i simboli diventano parole.
const contoAVoce = (c) => String(c).replace(/[×*·]/g, " per ").replace(/[:÷]/g, " diviso ").replace(/=/g, " uguale ").replace(/\//g, " fratto ").replace(/−/g, " meno ");

// Quello che si legge a voce, nello stesso ordine dei data-f di htmlScheda.
function pezziScheda(s) {
  return [s.titolo, ...frasiDi(s.testo), ...(s.ancora ? ["Sul tuo quaderno: " + s.ancora] : []), ...(s.calcoli || []).map(contoAVoce)];
}

// Linea del tempo in verticale (sta meglio sul telefono): anno a sinistra, evento a destra.
function svgLineaTempo(eventi) {
  const W = 320, X = 74, RIGA = 19;
  let y = 14;
  const righe = eventi.map((e) => {
    const parole = aCapo(e.etichetta, 26), cy = y + 6;
    const g = '<circle cx="' + X + '" cy="' + cy + '" r="6" class="lz-punto"/>' +
      '<text x="' + (X - 14) + '" y="' + (cy + 5) + '" text-anchor="end" font-weight="800">' + esc(annoIt(e.anno)) + "</text>" +
      parole.map((p, k) => '<text x="' + (X + 16) + '" y="' + (cy + 5 + k * RIGA) + '">' + esc(p) + "</text>").join("");
    y += Math.max(1, parole.length) * RIGA + 18;
    return g;
  });
  const H = y;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" class="lz-svg" role="img" aria-label="Linea del tempo: ' +
    esc(eventi.map((e) => annoIt(e.anno) + " " + e.etichetta).join("; ")) + '"><line x1="' + X + '" y1="8" x2="' + X + '" y2="' + (H - 8) + '" class="lz-asse"/>' +
    '<g fill="currentColor" font-size="15" font-family="inherit">' + righe.join("") + "</g></svg>";
}

// Schemi semplici: frecce (passi in fila, dall'alto in basso) o gruppi (colonne con titolo e voci).
function svgSchema(f) {
  const W = 320;
  if (f.tipo === "frecce") {
    let y = 4;
    const pezzi = f.passi.map((p, i) => {
      const righe = aCapo(p, 30), h = righe.length * 19 + 18;
      const box = '<rect x="20" y="' + y + '" width="280" height="' + h + '" rx="12" class="lz-box"/>' +
        righe.map((r, k) => '<text x="160" y="' + (y + 23 + k * 19) + '" text-anchor="middle">' + esc(r) + "</text>").join("");
      y += h;
      const freccia = i < f.passi.length - 1 ? '<path d="M160 ' + (y + 3) + "V" + (y + 21) + '" class="lz-asse"/><path d="M153 ' + (y + 15) + "L160 " + (y + 24) + "L167 " + (y + 15) + '" class="lz-asse"/>' : "";
      y += i < f.passi.length - 1 ? 28 : 4;
      return box + freccia;
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + y + '" class="lz-svg" role="img" aria-label="Schema: ' + esc(f.passi.join(", poi ")) + '">' +
      '<g fill="currentColor" font-size="15" font-family="inherit">' + pezzi.join("") + "</g></svg>";
  }
  const n = f.gruppi.length, gap = 10, w = (W - 4 - gap * (n - 1)) / n, car = Math.floor(w / 8.6);
  const colonne = f.gruppi.map((g, i) => {
    const x = 2 + i * (w + gap), titolo = aCapo(g.titolo, car), hT = titolo.length * 19 + 14;
    const voci = g.voci.flatMap((v) => aCapo(v, car - 2).map((r, k) => (k ? "  " : "• ") + r));
    return { h: hT + 10 + voci.length * 19, svg: '<rect x="' + x + '" y="2" width="' + w + '" height="' + hT + '" rx="10" class="lz-box"/>' +
      titolo.map((r, k) => '<text x="' + (x + w / 2) + '" y="' + (22 + k * 19) + '" text-anchor="middle" font-weight="800">' + esc(r) + "</text>").join("") +
      voci.map((r, k) => '<text x="' + (x + 6) + '" y="' + (hT + 24 + k * 19) + '" xml:space="preserve">' + esc(r) + "</text>").join("") };
  });
  const H = Math.max(...colonne.map((c) => c.h)) + 10;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" class="lz-svg" role="img" aria-label="Schema: ' +
    esc(f.gruppi.map((g) => g.titolo + ": " + g.voci.join(", ")).join("; ")) + '"><g fill="currentColor" font-size="15" font-family="inherit">' + colonne.map((c) => c.svg).join("") + "</g></svg>";
}

function htmlFiguraLezione(f) {
  if (!f) return "";
  const svg = f.tipo === "geometria" ? svgFigura(f) : f.tipo === "linea_tempo" ? svgLineaTempo(f.eventi) : svgSchema(f);
  return svg ? '<div class="lz-figura">' + svg + "</div>" : "";
}

function htmlScheda(s) {
  let k = 0;
  const f = () => ' data-f="' + k++ + '"';
  return '<p class="occhiello">' + esc(ETICHETTE_SCHEDA[s.tipo] || "") + "</p>" +
    "<h2" + f() + ">" + esc(s.titolo) + "</h2>" +
    '<p class="lz-testo">' + frasiDi(s.testo).map((x) => '<span class="frase"' + f() + ">" + esc(x) + "</span>").join(" ") + "</p>" +
    (s.ancora ? '<p class="lz-quaderno"' + f() + '><span class="aiuto">Sul tuo quaderno</span><span class="citazione">' + evidenzia(s.ancora) + "</span></p>" : "") +
    ((s.calcoli || []).length ? '<ul class="lz-calcoli">' + s.calcoli.map((c) => "<li" + f() + ">" + esc(c) + "</li>").join("") + "</ul>" : "") +
    htmlFiguraLezione(s.figura);
}

const PLAY = '<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="28" fill="#1A1A1E" fill-opacity=".8"/><path d="M22 17l18 11-18 11z" fill="#fff"/></svg>';
function htmlVideo(v, k) {
  const info = [v.canale, v.durata].filter(Boolean).join(", ");
  return '<li class="lz-video">' +
    (v.embed ? '<button type="button" class="lz-anteprima" data-video="' + k + '" aria-label="' + esc("Guarda il video: " + v.titolo) + '">' +
      (v.anteprima ? '<img src="' + esc(v.anteprima) + '" alt="" loading="lazy" onerror="this.remove()">' : "") + PLAY + "</button>" : "") +
    '<p class="lz-video-titolo"><b>' + esc(v.titolo) + '</b></p><p class="aiuto"><span class="etichetta-web">dal web</span> ' + esc(v.sito) + (info ? ": " + esc(info) : "") + "</p>" +
    (v.embed || !/^https:\/\//.test(v.url) ? "" : '<p class="fonte-web"><a href="' + esc(v.url) + '" target="_blank" rel="noopener noreferrer">Guarda su ' + esc(v.sito) + "</a></p>") + "</li>";
}

const lezioneValida = (x) => !!x && Array.isArray(x.schede) && x.schede.length > 0 && x.schede.every((s) => s && s.tipo && s.titolo && s.testo);

/* ---- vista ---- */

let lezione = null, lezioneOccupata = false, voceLz = 0;

function apriLezione(a, daCapo = false) {
  fermaLezione();
  lezione = { a, schede: [], i: 0, video: null };
  errore($("err-lezione"), ""); $("lz-corpo").hidden = true;
  vai("lezione", a.materia, a.titolo);
  const salvata = leggiLocale(chiaveLezione(a.id), null);
  if (!daCapo && salvata && salvata.aggiornato === a.aggiornato && lezioneValida(salvata)) { lezione.schede = salvata.schede; mostraScheda(0); return; }
  caricaLezione(a);
}
async function caricaLezione(a) {
  if (lezioneOccupata) return;
  lezioneOccupata = true;
  attesa($("stato-lezione"), ["Rileggo i tuoi appunti", "Preparo le schede", "Ricontrollo frasi e conti"]);
  try {
    const r = await modello({ azione: "lezione", argomento_id: a.id });
    if (!lezione || lezione.a.id !== a.id) return; // nel frattempo si è usciti
    lezione.schede = r.schede;
    salvaLocale(chiaveLezione(a.id), { aggiornato: a.aggiornato, schede: r.schede });
    mostraScheda(0);
  } catch (e) {
    errore($("err-lezione"), e.message === "nessun_testo" ? "In questo argomento non ci sono appunti da spiegare. Aggiungi le foto, poi riprova."
      : e.message === "nessuna_lezione" ? "Non sono riuscito a preparare schede fedeli ai tuoi appunti. Riprova fra un momento."
      : messaggioModello(e, "Non sono riuscito a preparare le schede. Controlla la connessione e riprova."));
  } finally { attesa($("stato-lezione"), null); lezioneOccupata = false; }
}

function mostraScheda(i) {
  const n = lezione.schede.length, s = lezione.schede[i], ultima = i === n - 1;
  lezione.i = i;
  $("lz-corpo").hidden = false;
  $("lz-avanzamento").style.width = Math.round(((i + 1) / n) * 100) + "%";
  $("lz-barra").setAttribute("aria-valuenow", String(i + 1)); $("lz-barra").setAttribute("aria-valuemax", String(n));
  $("lz-conta").textContent = "Scheda " + (i + 1) + " di " + n;
  $("lz-scheda").innerHTML = htmlScheda(s);
  $("lz-fine").hidden = !ultima;
  $("btn-lz-indietro").hidden = i === 0;
  // All'ultima scheda l'azione principale è «Mettiti alla prova»: «Fine» diventa secondario.
  $("btn-lz-avanti").textContent = ultima ? "Fine" : "Avanti";
  $("btn-lz-avanti").className = ultima ? "minore" : "azione";
  if (ultima) mostraFine();
  window.scrollTo(0, 0);
  if (lezione.ascolto) leggiScheda(); else fermaVoceLezione(); // ascoltando, la scheda nuova si legge da sola
}

// Ultima scheda: le azioni per provare e i video, se il genitore non li ha spenti.
function mostraFine() {
  const a = lezione.a, es = typeof conEsercizi === "function" && conEsercizi(a) && (a.tipi || []).length;
  $("btn-lz-prova").textContent = es ? "Preparami degli esercizi" : "Mettiti alla prova";
  const box = $("lz-video");
  if (!profilo || !videoAccesi(profilo.id)) { box.hidden = true; return; }
  box.hidden = false;
  const salvati = leggiLocale(chiaveVideoLezione(a.id), null);
  if (salvati && salvati.aggiornato === a.aggiornato && Array.isArray(salvati.video)) { disegnaVideo(salvati.video); return; }
  if (!lezione.video) caricaVideo(a);
}
async function caricaVideo(a) {
  lezione.video = "carico";
  $("lz-video-lista").innerHTML = ""; errore($("err-lz-video"), "");
  attesa($("stato-lz-video"), ["Cerco due video brevi su YouTube e Rai"]);
  try {
    const r = await modello({ azione: "video", argomento_id: a.id });
    if (!lezione || lezione.a.id !== a.id) return;
    salvaLocale(chiaveVideoLezione(a.id), { aggiornato: a.aggiornato, video: r.video });
    disegnaVideo(r.video);
  } catch (e) {
    if (lezione) lezione.video = null;
    errore($("err-lz-video"), e.message === "web_non_disponibile" ? "La ricerca dei video adesso non funziona. Riprova più tardi."
      : messaggioModello(e, "Non sono riuscito a cercare i video. Riprova fra un momento."));
  } finally { attesa($("stato-lz-video"), null); }
}
function disegnaVideo(video) {
  lezione.video = video;
  $("lz-video-lista").innerHTML = video.length ? video.map(htmlVideo).join("")
    : '<li class="aiuto">Non ho trovato video brevi adatti a questo argomento. Le schede bastano: rileggile a voce.</li>';
}
// Il video si carica solo quando lo tocchi, e parte solo con il suo tasto play: niente riproduzione automatica.
function apriVideo(btn) {
  const v = lezione && Array.isArray(lezione.video) ? lezione.video[Number(btn.dataset.video)] : null;
  if (!v || !/^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/.test(v.embed)) return;
  const box = document.createElement("div"); box.className = "lz-player";
  const f = document.createElement("iframe");
  f.src = v.embed; f.title = v.titolo; f.loading = "lazy"; f.referrerPolicy = "strict-origin-when-cross-origin";
  f.allow = "encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
  box.appendChild(f); btn.replaceWith(box);
}

/* ---- «Ascolta»: la scheda letta a voce, frase per frase, con la frase letta segnata ---- */
function fermaVoceLezione() {
  voceLz++;
  if (typeof window !== "undefined" && window.speechSynthesis) speechSynthesis.cancel();
  document.querySelectorAll("#lz-scheda .letta").forEach((el) => el.classList.remove("letta"));
  const b = $("btn-lz-ascolta"); if (b) { b.textContent = "Ascolta"; b.setAttribute("aria-pressed", "false"); }
}
function fermaLezione() { if (lezione) lezione.ascolto = false; fermaVoceLezione(); }
function leggiScheda() {
  if (!window.speechSynthesis || !lezione) return;
  fermaVoceLezione();
  const mio = voceLz, pezzi = pezziScheda(lezione.schede[lezione.i]);
  lezione.ascolto = true;
  $("btn-lz-ascolta").textContent = "Ferma"; $("btn-lz-ascolta").setAttribute("aria-pressed", "true");
  const it = speechSynthesis.getVoices().find((v) => /^it/i.test(v.lang));
  const leggi = (k) => {
    if (mio !== voceLz) return;
    document.querySelectorAll("#lz-scheda .letta").forEach((el) => el.classList.remove("letta"));
    if (k >= pezzi.length) { lezione.ascolto = false; fermaVoceLezione(); return; }
    const el = document.querySelector('#lz-scheda [data-f="' + k + '"]'); if (el) el.classList.add("letta");
    const u = new SpeechSynthesisUtterance(pezzi[k]); u.lang = "it-IT"; u.rate = 0.95; if (it) u.voice = it;
    u.onend = u.onerror = () => leggi(k + 1);
    speechSynthesis.speak(u);
  };
  leggi(0);
}

function collegaLezione() {
  $("btn-lezione").addEventListener("click", () => { if (corrente) apriLezione(corrente); });
  $("btn-lz-ascolta").addEventListener("click", () => { if (lezione && lezione.ascolto) fermaLezione(); else leggiScheda(); });
  $("btn-lz-indietro").addEventListener("click", () => { if (lezione && lezione.i > 0) mostraScheda(lezione.i - 1); });
  $("btn-lz-avanti").addEventListener("click", () => {
    if (!lezione) return;
    if (lezione.i < lezione.schede.length - 1) mostraScheda(lezione.i + 1); else apriScheda(lezione.a);
  });
  $("btn-lz-prova").addEventListener("click", () => {
    const a = lezione.a;
    if (conEsercizi(a) && (a.tipi || []).length) { apriEsercizi(a); return; }
    corrente = a; modalita = "scritta"; apriPrepara();
  });
  $("btn-lz-rifai").addEventListener("click", () => { if (lezione) apriLezione(lezione.a, true); });
  $("lz-video-lista").addEventListener("click", (e) => { const b = e.target.closest(".lz-anteprima"); if (b) apriVideo(b); });
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-lezione")) collegaLezione();
