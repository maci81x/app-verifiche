// «Allenati per l'INVALSI» (issue #28, solo 3ª media): domande nel formato della prova al computer
// (scelta multipla, vero/falso, completamento, risposta breve), a tempo, con il punteggio per ambito.
// Script classico caricato dopo poesia.js: usa $, esc, attesa, errore, modello, messaggioModello, vai, profilo,
// classeNumero. Niente database: le domande arrivano dal server (azione invalsi) e il punteggio resta qui.

/* ---- parti pure ---- */

const SECONDI_PER_DOMANDA = 120;
const tempoInvalsi = (n) => n * SECONDI_PER_DOMANDA;
const orologioInvalsi = (s) => { const t = Math.max(0, Math.round(s)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };

const pianoInv = (s) => String(s == null ? "" : s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.!;:]+$/, "").replace(/\s+/g, " ");
const primoNumero = (s) => { const m = String(s == null ? "" : s).replace(/[−–]/g, "-").replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2").match(/-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/); if (!m) return null;
  const [a, b] = m[0].replace(",", ".").split("/"); return b ? Number(a) / Number(b) : Number(a); };

// Scelta multipla e vero/falso: la posizione scelta. Completamento e risposta breve: se la risposta attesa
// è un numero vale il numero (12,5 = 12.5, l'unità non conta); altrimenti la parola, senza maiuscole e punto finale.
function rispostaInvalsiGiusta(d, r) {
  if (d.formato === "scelta_multipla" || d.formato === "vero_falso") return r !== "" && r != null && Number(r) === d.corretta;
  const atteso = primoNumero(d.risposta);
  if (atteso !== null && /^\s*[-−–]?\d/.test(d.risposta)) { const n = primoNumero(r); return n !== null && Math.abs(n - atteso) < 1e-9; }
  return pianoInv(r) !== "" && pianoInv(r) === pianoInv(d.risposta);
}

// { esiti, giuste, totale, ambiti: [{ ambito, giuste, totale }] } nell'ordine in cui compaiono gli ambiti.
function correggiInvalsi(domande, risposte) {
  const esiti = domande.map((d, i) => rispostaInvalsiGiusta(d, (risposte || [])[i]));
  const ambiti = [];
  domande.forEach((d, i) => {
    let a = ambiti.find((x) => x.ambito === d.ambito);
    if (!a) { a = { ambito: d.ambito, giuste: 0, totale: 0 }; ambiti.push(a); }
    a.totale++; if (esiti[i]) a.giuste++;
  });
  return { esiti, giuste: esiti.filter(Boolean).length, totale: domande.length, ambiti };
}

/* ---- vista ---- */

const MATERIE_INV = [["matematica", "Matematica"], ["italiano", "Italiano"], ["inglese", "Inglese: reading e listening"]];
let invalsi = null, orologioInv = null, invalsiOccupato = false;

// La card in Oggi, solo per chi fa la terza.
function disegnaInvalsiOggi() {
  const box = $("invalsi-oggi"); if (!box) return;
  box.innerHTML = profilo && classeNumero(profilo.classe) === 3
    ? '<div class="card-invalsi"><p class="occhiello">Terza media</p><p><b>Allenati per l\'INVALSI</b></p><p class="aiuto">Domande come alla prova al computer, a tempo, con il punteggio per ambito.</p>' +
      '<div class="bottoni"><button type="button" class="minore" id="btn-apri-invalsi">Allenati per l\'INVALSI</button></div></div>' : "";
  const b = $("btn-apri-invalsi"); if (b) b.onclick = apriInvalsi;
}
function apriInvalsi() {
  fermaInvalsi(); invalsi = null;
  $("inv-scegli").hidden = false; $("inv-prova").hidden = true; $("inv-esito").hidden = true;
  errore($("err-inv"), ""); attesa($("stato-inv"), null);
  vai("invalsi");
}
async function preparaInvalsi(materia) {
  if (invalsiOccupato) return;
  invalsiOccupato = true; errore($("err-inv"), "");
  document.querySelectorAll("[data-materia-inv]").forEach((b) => { b.disabled = true; });
  attesa($("stato-inv"), ["Preparo le domande", "Rifaccio i conti"]);
  try {
    const r = await modello({ azione: "invalsi", materia, quante: 5 });
    invalsi = { materia, ...r, fine: Date.now() + tempoInvalsi(r.domande.length) * 1000 };
    mostraProvaInvalsi();
  } catch (e) {
    errore($("err-inv"), e.message === "solo_terza" ? "L'allenamento per l'INVALSI è per la terza media. Controlla la classe nel profilo."
      : e.message === "nessuna_domanda" ? "Non sono riuscito a preparare domande con le risposte giuste. Riprova fra un momento."
      : messaggioModello(e, "Non sono riuscito a preparare le domande. Riprova fra un momento."));
  }
  attesa($("stato-inv"), null); invalsiOccupato = false;
  document.querySelectorAll("[data-materia-inv]").forEach((b) => { b.disabled = false; });
}
function htmlDomandaInvalsi(d, i) {
  const n = '<p class="occhiello">Domanda ' + (i + 1) + ": " + esc(d.ambito) + "</p>";
  if (d.formato === "scelta_multipla" || d.formato === "vero_falso")
    return '<fieldset class="domanda-inv">' + '<legend>' + n + '<span class="consegna">' + esc(d.testo) + "</span></legend>" +
      d.opzioni.map((o, k) => '<label class="opzione-inv"><input type="radio" name="inv-' + i + '" value="' + k + '"> <span>' + esc(o) + "</span></label>").join("") + "</fieldset>";
  return '<div class="domanda-inv">' + n + '<label class="consegna" for="inv-' + i + '">' + esc(d.testo) + "</label>" +
    '<input type="text" id="inv-' + i + '" autocomplete="off" placeholder="' + (d.formato === "completamento" ? "Quello che va al posto di ___" : "La tua risposta") + '"></div>';
}
function mostraProvaInvalsi() {
  $("inv-scegli").hidden = true; $("inv-esito").hidden = true; $("inv-prova").hidden = false;
  const b = invalsi.brano;
  $("inv-brano").innerHTML = !b ? "" : b.ascolto
    ? '<div class="brano-inv"><p><b>Listening</b>: ascolta il brano, poi rispondi. Puoi ascoltarlo due volte, come alla prova.</p><div class="bottoni"><button type="button" class="minore" id="btn-inv-ascolta">Ascolta il brano</button></div></div>'
    : '<div class="brano-inv">' + (b.titolo ? "<h3>" + esc(b.titolo) + "</h3>" : "") + "<p>" + esc(b.testo).replace(/\n+/g, "</p><p>") + "</p></div>";
  let ascolti = 0;
  const btnA = $("btn-inv-ascolta");
  if (btnA) btnA.onclick = () => {
    if (!window.speechSynthesis || ascolti >= 2) return;
    ascolti++; if (ascolti >= 2) btnA.disabled = true;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(b.testo); u.lang = "en-GB"; u.rate = 0.9;
    const en = speechSynthesis.getVoices().find((v) => /^en/i.test(v.lang)); if (en) u.voice = en;
    speechSynthesis.speak(u);
  };
  $("inv-domande").innerHTML = invalsi.domande.map(htmlDomandaInvalsi).join("");
  const tic = () => { const resta = (invalsi.fine - Date.now()) / 1000; $("inv-tempo").textContent = "Tempo: " + orologioInvalsi(resta); if (resta <= 0) consegnaInvalsi(true); };
  clearInterval(orologioInv); orologioInv = setInterval(tic, 1000); tic();
  window.scrollTo(0, 0);
}
function fermaInvalsi() { clearInterval(orologioInv); orologioInv = null; if (typeof window !== "undefined" && window.speechSynthesis) speechSynthesis.cancel(); }
function consegnaInvalsi(scaduto = false) {
  if (!invalsi || !orologioInv) return;
  fermaInvalsi();
  const risposte = invalsi.domande.map((d, i) => {
    if (d.formato === "scelta_multipla" || d.formato === "vero_falso") { const s = document.querySelector('input[name="inv-' + i + '"]:checked'); return s ? s.value : ""; }
    return $("inv-" + i).value;
  });
  const r = correggiInvalsi(invalsi.domande, risposte);
  $("inv-prova").hidden = true; $("inv-esito").hidden = false;
  $("inv-punteggio").innerHTML = (scaduto ? '<p class="aiuto">Tempo finito: ho corretto quello che avevi scritto.</p>' : "") +
    "<h2>" + r.giuste + " su " + r.totale + "</h2>" +
    '<ul class="ambiti-inv">' + r.ambiti.map((a) => {
      const s = a.giuste === a.totale ? ["verde", "●", "Lo sai"] : a.giuste ? ["giallo", "▲", "Quasi"] : ["rosso", "✕", "Da ripassare"];
      return '<li><span>' + esc(a.ambito) + '</span> <span class="sem" data-s="' + s[0] + '"><i aria-hidden="true">' + s[1] + "</i> " + s[2] + "</span> <b>" + a.giuste + " su " + a.totale + "</b></li>";
    }).join("") + "</ul>";
  $("inv-correzione").innerHTML = invalsi.domande.map((d, i) => '<div class="domanda-inv"><p class="occhiello">Domanda ' + (i + 1) + ": " + esc(d.ambito) + "</p><p>" + esc(d.testo) + "</p>" +
    '<p><span class="sem" data-s="' + (r.esiti[i] ? "verde" : "rosso") + '"><i aria-hidden="true">' + (r.esiti[i] ? "●" : "✕") + "</i> " + (r.esiti[i] ? "Ci sei" : "Non ancora") + "</span>" +
    (r.esiti[i] ? "" : " La risposta: <b>" + esc(d.risposta) + "</b>") + "</p>" + (d.spiegazione ? '<p class="aiuto">' + esc(d.spiegazione) + "</p>" : "") + "</div>").join("");
  window.scrollTo(0, 0);
}

function collegaInvalsi() {
  document.querySelectorAll("[data-materia-inv]").forEach((b) => b.addEventListener("click", () => preparaInvalsi(b.dataset.materiaInv)));
  $("btn-inv-consegna").addEventListener("click", () => consegnaInvalsi(false));
  $("btn-inv-ancora").addEventListener("click", apriInvalsi);
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-invalsi")) collegaInvalsi();
