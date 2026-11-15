// «Esame di terza media» (issue #28): la scaletta del colloquio orale, con i collegamenti fra materie
// a partire dagli argomenti salvati (azione esame). Solo per la terza; l'ultima scaletta resta sul telefono.
// Script classico caricato dopo invalsi.js: usa $, esc, attesa, errore, modello, messaggioModello, vai, profilo,
// leggiLocale, salvaLocale, classeNumero.

/* ---- parte pura ---- */
function htmlScaletta(e) {
  const tappa = (n, a, sotto) => '<li class="tappa-esame"><p class="occhiello">' + esc(a.materia) + '</p><p class="tit-tappa"><b>' + esc(a.titolo) + "</b></p>" + sotto + "</li>";
  return (e.titolo ? "<h2>" + esc(e.titolo) + "</h2>" : "") +
    '<ol class="scaletta-esame">' +
    tappa(0, e.partenza.argomento, '<p class="aiuto">Si parte da qui.</p>' + (e.partenza.apertura ? "<p>Per cominciare: «" + esc(e.partenza.apertura) + "»</p>" : "")) +
    e.tappe.map((t, i) => tappa(i + 1, t.argomento, '<p><span class="etichetta-tappa">Collegamento proposto</span> ' + esc(t.collegamento) + "</p>" +
      (t.concetti.length ? '<p class="aiuto">Dai tuoi appunti: ' + t.concetti.map(esc).join("; ") + "</p>" : ""))).join("") + "</ol>" +
    (e.domande.length ? '<h3 class="sez-titolo">Domande che potrebbero farti</h3><ul class="domande-esame">' + e.domande.map((d) => "<li>" + esc(d.testo) + ' <span class="aiuto">(' + esc(d.argomento.titolo) + ")</span></li>").join("") + "</ul>" : "") +
    (e.consigli.length ? '<h3 class="sez-titolo">Consigli</h3><ul class="domande-esame">' + e.consigli.map((c) => "<li>" + esc(c) + "</li>").join("") + "</ul>" : "");
}

/* ---- vista ---- */
const chiaveEsame = (id) => "verifiche-esame-" + id;
let esameOccupato = false;
function disegnaEsameOggi() {
  const box = $("esame-oggi"); if (!box) return;
  box.innerHTML = profilo && classeNumero(profilo.classe) === 3
    ? '<div class="card-invalsi"><p><b>Esame di terza media</b></p><p class="aiuto">La scaletta del colloquio: da un tuo argomento ai collegamenti con le altre materie.</p>' +
      '<div class="bottoni"><button type="button" class="minore" id="btn-apri-esame">Prepara il colloquio</button></div></div>' : "";
  const b = $("btn-apri-esame"); if (b) b.onclick = apriEsame;
}
function apriEsame() {
  errore($("err-esame"), ""); attesa($("stato-esame"), null);
  const ultima = profilo ? leggiLocale(chiaveEsame(profilo.id), null) : null;
  const valida = ultima && ultima.partenza && Array.isArray(ultima.tappe) && Array.isArray(ultima.domande) && Array.isArray(ultima.consigli);
  $("esame-scaletta").innerHTML = valida ? htmlScaletta(ultima) : "";
  $("btn-esame-prepara").textContent = valida ? "Rifalla con altri collegamenti" : "Prepara la scaletta";
  vai("esame");
}
async function preparaEsame() {
  if (esameOccupato) return;
  esameOccupato = true; errore($("err-esame"), ""); $("btn-esame-prepara").disabled = true;
  attesa($("stato-esame"), ["Guardo i tuoi argomenti", "Cerco i collegamenti fra le materie"]);
  try {
    const e = await modello({ azione: "esame" });
    if (profilo) salvaLocale(chiaveEsame(profilo.id), e);
    $("esame-scaletta").innerHTML = htmlScaletta(e);
    $("btn-esame-prepara").textContent = "Rifalla con altri collegamenti";
  } catch (err) {
    errore($("err-esame"), err.message === "pochi_argomenti" ? "Servono argomenti salvati di almeno due materie. Fotografa gli appunti di un'altra materia e riprova."
      : err.message === "solo_terza" ? "La scaletta dell'esame è per la terza media. Controlla la classe nel profilo."
      : messaggioModello(err, "Non sono riuscito a preparare la scaletta. Riprova fra un momento."));
  }
  attesa($("stato-esame"), null); esameOccupato = false; $("btn-esame-prepara").disabled = false;
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-esame"))
  $("btn-esame-prepara").addEventListener("click", preparaEsame);
