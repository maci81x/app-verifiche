// Issue #28, la parte dell'app che dipende dalla classe:
//  - l'errore tipico detto per nome, con la spiegazione del programma (dal server: errore_tipico);
//  - il mini-ripasso del prerequisito di un anno prima (2-3 esercizi) prima di tornare all'esercizio.
// Script classico caricato dopo compito.js: usa $, esc, attesa, errore, modello, conRiprovaEsercizi,
// messaggioModello, formulaHtml, caricaKatex, rendiFormule.

/* ---- parti pure ---- */

// La classe del profilo come numero: "2", "2ª media", "terza" → 2/3; altrimenti null.
function classeNumero(classe) {
  const c = String(classe == null ? "" : classe).trim().toLowerCase();
  if (!c || /element|superior/.test(c)) return null;
  const parola = { prima: 1, seconda: 2, terza: 3 }[c.split(/\s+/)[0]];
  if (parola) return parola;
  const m = c.match(/^([123])(?![0-9])/);
  return m ? Number(m[1]) : null;
}

// Il riquadro dell'errore tipico; con il prerequisito, la proposta del mini-ripasso. dove = id unico del posto.
function htmlErroreTipico(r, dove) {
  if (!r || !r.errore_tipico) return "";
  const e = r.errore_tipico, p = r.prerequisito;
  return '<div class="errore-tipico"><p><span class="etichetta-errore">Errore tipico</span> <b>' + esc(e.errore) + "</b></p>" +
    '<p class="spiega-es">' + esc(e.spiegazione) + "</p>" +
    (p ? '<div class="prerequisito" id="pr-' + esc(dove) + '"><p>Viene da «' + esc(p.titolo) + "» della " + p.classe + "ª media. Prima un mini-ripasso, poi torni all'esercizio.</p>" +
      '<button type="button" class="minore" data-prereq="' + esc(dove) + '" data-titolo="' + esc(p.titolo) + '" data-esempio="' + esc(e.esempio) + '">Ripassa «' + esc(p.titolo) + "»</button>" +
      '<div class="pr-lista" id="pr-' + esc(dove) + '-lista"></div></div>' : "") + "</div>";
}

// Esito del mini-ripasso: quante giuste al primo tentativo su quante fatte.
function esitoMiniRipasso(esiti) {
  const fatte = esiti.filter((x) => x !== undefined).length, giuste = esiti.filter(Boolean).length;
  if (!fatte) return "";
  return giuste === fatte ? "Ripasso fatto: " + giuste + " su " + fatte + ". Adesso torna all'esercizio."
    : giuste + " su " + fatte + " al primo colpo. Guarda come si fa in quelle che non tornano, poi torna all'esercizio.";
}

/* ---- vista ---- */

const miniRipassi = {}; // dove → { esercizi, esiti }
async function apriMiniRipasso(dove, titolo, esempio) {
  const lista = $("pr-" + dove + "-lista"), btn = document.querySelector('[data-prereq="' + dove + '"]');
  if (!lista || (btn && btn.disabled)) return;
  if (btn) btn.disabled = true;
  attesa(lista, ["Preparo tre esercizi su «" + titolo + "»", "Rifaccio i conti"]);
  try {
    const r = await conRiprovaEsercizi(() => modello({ azione: "esercizi_genera", mirati: true,
      modello: { testo: "Ripasso di «" + titolo + "». L'errore da evitare: " + esempio, concetto: titolo, calcolo: "" } }));
    miniRipassi[dove] = { esercizi: (r.esercizi || []).slice(0, 3), esiti: [] };
    lista.innerHTML = miniRipassi[dove].esercizi.map((e, i) => {
      const id = "pr-" + dove + "-" + i;
      return '<article class="esercizio"><p class="occhiello">Ripasso ' + (i + 1) + " di " + miniRipassi[dove].esercizi.length + '</p><p class="consegna">' + testoConFormule(e.testo) + "</p>" +
        '<label for="' + id + '"><b>La tua risposta</b></label><div class="prova-riga"><input type="text" id="' + id + '" inputmode="decimal" autocomplete="off" placeholder="La tua risposta">' +
        '<button type="button" class="minore" data-pr-giudica="' + dove + '" data-i="' + i + '">Controlla</button></div><div class="prova-esito" id="' + id + '-esito" aria-live="polite"></div>' +
        '<details class="come-si-fa" id="' + id + '-sol" hidden><summary>Ecco come si fa</summary><ol class="passaggi">' +
        (e.passaggi || []).map((x) => "<li>" + esc(x.testo) + (x.formula ? '<span class="riga-formula">' + formulaHtml(x.formula) + "</span>" : "") + "</li>").join("") + "</ol></details></article>";
    }).join("") + '<p class="aiuto" id="pr-' + dove + '-fine" aria-live="polite"></p>';
    caricaKatex().then((ok) => { if (ok) rendiFormule(lista); });
  } catch (e) {
    errore(lista, messaggioModello(e, "Non sono riuscito a preparare il ripasso con i conti giusti. Riprova fra un momento."));
    if (btn) btn.disabled = false;
  }
}
async function giudicaMiniRipasso(dove, i) {
  const m = miniRipassi[dove], e = m && m.esercizi[i], id = "pr-" + dove + "-" + i, campo = $(id), out = $(id + "-esito");
  if (!e || !campo) return;
  if (!campo.value.trim()) { out.innerHTML = "<p>Scrivi la tua risposta, poi tocca Controlla.</p>"; return; }
  try {
    const r = await modello({ azione: "prova_tu", atteso: e.risultato, risposta: campo.value.trim(), testo: e.testo });
    if (m.esiti[i] === undefined) m.esiti[i] = !!r.giusto;
    out.innerHTML = r.giusto ? '<p><span class="sem" data-s="verde"><i aria-hidden="true">●</i> Ci sei</span></p>'
      : '<p><span class="sem" data-s="rosso"><i aria-hidden="true">✕</i> Non ancora</span> Guarda come si fa qui sotto.</p>' + htmlErroreTipico({ errore_tipico: r.errore_tipico }, dove + "-x" + i);
    if (!r.giusto) { $(id + "-sol").hidden = false; $(id + "-sol").open = true; }
    if (m.esiti.filter((x) => x !== undefined).length === m.esercizi.length) $("pr-" + dove + "-fine").textContent = esitoMiniRipasso(m.esiti);
  } catch (err) { out.innerHTML = "<p>" + esc(messaggioModello(err, "Non riesco a controllare adesso. Riprova fra un momento.")) + "</p>"; }
}

if (typeof document !== "undefined") document.addEventListener("click", (ev) => {
  const a = ev.target.closest && ev.target.closest("[data-prereq]");
  if (a) { apriMiniRipasso(a.dataset.prereq, a.dataset.titolo, a.dataset.esempio); return; }
  const g = ev.target.closest && ev.target.closest("[data-pr-giudica]");
  if (g) giudicaMiniRipasso(g.dataset.prGiudica, Number(g.dataset.i));
});
