// Profili e libreria (issue #12). Script classico caricato dopo app.js: usa $, esc, tinta,
// dataIt, votoIt, contaVoci, apriScheda, apriCodice, apriMappa, preparaVerifica, vai,
// leggiLocale, salvaLocale, ordinaProfili, CHIAVE_PROFILI, CHIAVE_ULTIMO e lo stato dell'app.
// Semaforo sempre con forma e parola (semaforo.js).

/* =================================================================== parti pure */

const STATI_BARRA = ["verde", "giallo", "rosso", "mai"];

// Concetti (o tipi di esercizio) di un argomento contati per stato.
function contaStati(a) {
  const voci = a.percorso === "esercizi" ? (a.tipi || []) : (a.concetti || []);
  const conta = { verde: 0, giallo: 0, rosso: 0, mai: 0 };
  voci.forEach((v) => { conta[statoValido(v.stato)]++; });
  return conta;
}

// Somma su tutti gli argomenti: i chip ● ▲ ✕ in cima alla libreria.
function riepilogoStati(argomenti) {
  return (argomenti || []).reduce((t, a) => {
    const c = contaStati(a);
    STATI_BARRA.forEach((s) => { t[s] += c[s]; });
    return t;
  }, { verde: 0, giallo: 0, rosso: 0, mai: 0 });
}

// L'argomento da ripassare prima: più rossi, poi più gialli, poi il più vecchio. null se
// nessuno ha rossi né gialli.
function daRipassarePrima(argomenti) {
  const candidati = (argomenti || []).map((a) => ({ a, c: contaStati(a) })).filter((x) => x.c.rosso || x.c.giallo);
  candidati.sort((x, y) => y.c.rosso - x.c.rosso || y.c.giallo - x.c.giallo ||
    String(x.a.aggiornato || "").localeCompare(String(y.a.aggiornato || "")));
  return candidati.length ? candidati[0].a : null;
}

// Il concetto per la prova lampo: il rosso più importante, poi il giallo più importante.
function concettoPiuDebole(a) {
  const peso = (s) => ({ rosso: 0, giallo: 1 }[s] ?? 9);
  const voci = [...(a.concetti || [])].filter((c) => c.stato === "rosso" || c.stato === "giallo");
  voci.sort((x, y) => peso(x.stato) - peso(y.stato) || (y.peso || 2) - (x.peso || 2) || (x.ordine || 0) - (y.ordine || 0));
  return voci[0] || null;
}

/* ---- issue #26: Oggi e argomento ---- */

const punti = (n) => n + (n === 1 ? " punto" : " punti");
const elencoIt = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]);

// La riga sotto «Ciao Giulia.»: una frase vera, calcolata dai punti di tutti gli argomenti.
function fraseOggi(argomenti) {
  const lista = argomenti || [];
  if (!lista.length) return "Fotografa i tuoi appunti: da lì parte tutto.";
  const tot = riepilogoStati(lista);
  if (tot.rosso) {
    const materie = [...new Set(lista.filter((a) => contaStati(a).rosso).map((a) => a.materia))];
    return "Hai " + punti(tot.rosso) + " da ripassare" + (materie.length === 1 ? " in " + materie[0] : ", in " + elencoIt(materie)) + ".";
  }
  if (tot.giallo) return "Hai " + punti(tot.giallo) + (tot.giallo === 1 ? " segnato" : " segnati") + " Quasi: basta un ripasso veloce.";
  if (tot.mai) return "Hai " + punti(tot.mai) + " ancora da provare: comincia da lì.";
  return "Tutto verde: oggi puoi fotografare qualcosa di nuovo.";
}

// «5 punti: 2 li sai, 1 quasi, 1 da ripassare, 1 ancora da provare»
function rigaStatoArgomento(a) {
  const c = contaStati(a), tot = STATI_BARRA.reduce((s, k) => s + c[k], 0);
  const parole = { verde: (n) => (n === 1 ? "lo sai" : "li sai"), giallo: () => "quasi", rosso: () => "da ripassare", mai: () => "ancora da provare" };
  return punti(tot) + ": " + STATI_BARRA.filter((k) => c[k]).map((k) => c[k] + " " + parole[k](c[k])).join(", ");
}

// Le tre scelte dell'argomento, la consigliata per prima (consiglioArgomento in ripasso.js; senza,
// con dei punti da ripassare «Ripassa con me», altrimenti «Fai la verifica»). Le altre restano nel loro ordine.
const SCELTE = {
  verifica: { titolo: "Fai la verifica", spiega: "Come in classe, scritta. Scegli tu quanto difficile." },
  interroga: { titolo: "Fatti interrogare", spiega: "Ti faccio le domande a voce, come la prof. E ogni tanto ti chiedo «perché?»." },
  ripassa: { titolo: "Ripassa con me", spiega: "Un punto alla volta. Prima provi tu, poi leggiamo cosa c'è sul quaderno. Dieci minuti." },
};
function ordineScelte(a, prima = contaStati(a).rosso ? "ripassa" : "verifica") {
  return [prima, ...["verifica", "interroga", "ripassa"].filter((k) => k !== prima)]
    .map((k, i) => ({ chiave: k, titolo: SCELTE[k].titolo, spiega: SCELTE[k].spiega, consigliata: i === 0 }));
}

// Barra divisa in verde/giallo/rosso (e grigio per i mai provati), larghezze in percentuale.
function htmlBarra(conta) {
  const tot = STATI_BARRA.reduce((s, k) => s + conta[k], 0);
  if (!tot) return "";
  const parti = STATI_BARRA.filter((k) => conta[k]).map((k) =>
    '<i data-s="' + k + '" style="width:' + (Math.round(conta[k] / tot * 1000) / 10) + '%"></i>').join("");
  // Sotto la barra i numeri con la forma: il colore non resta mai da solo.
  const conti = STATI_BARRA.filter((k) => conta[k]).map((k) =>
    '<span class="conto" data-s="' + k + '"><i aria-hidden="true">' + segnoStato(k) + "</i> " + conta[k] + '<span class="solo-lettore"> ' + esc(parolaStato(k).toLowerCase()) + "</span></span>").join("");
  return '<span class="barra-stati" aria-hidden="true">' + parti + '</span><span class="conti-stati">' + conti + "</span>";
}

// Colore dei profili: le tinte delle materie (senza arte, che verrebbe bordeaux), assegnate in
// ordine di id. Due profili non si somigliano e su ogni telefono escono uguali.
function tinteProfili(lista) {
  const tinte = MATERIE.filter((m) => m[0] !== "arte").map((m) => [m[2], m[3]]);
  const ids = [...new Set((lista || []).map((p) => String(p.id)))].sort();
  return Object.fromEntries(ids.map((id, i) => [id, tinte[i % tinte.length]]));
}

// «2ª media · 3 da ripassare». Il numero lo conosce solo il telefono su cui è entrata
// (l'elenco dei profili è pubblico e non deve dire niente dello studio).
// «2» → «2ª media»; una classe scritta per esteso resta com'è.
const classeIt = (c) => (/^\s*[123]\s*$/.test(String(c || "")) ? String(c).trim() + "ª media" : String(c || "").trim());
function sottotitoloProfilo(p, daRipassare) {
  const parti = [];
  if (p.classe) parti.push(classeIt(p.classe));
  if (Number.isInteger(daRipassare)) parti.push(daRipassare ? daRipassare + " da ripassare" : "niente da ripassare");
  return parti.join(", ");
}

/* =================================================================== profili */

const chiaveRipassare = (id) => "verifiche-ripassare-" + id;

function bottoneNome(p, classe, tinte) {
  const b = document.createElement("button"); b.type = "button"; if (classe) b.className = classe;
  const i = document.createElement("span"); i.className = "iniziale"; i.textContent = p.nome.slice(0, 1).toUpperCase();
  const t = (tinte || {})[String(p.id)];
  if (t) { i.style.setProperty("--h-profilo", t[0]); i.style.setProperty("--s-profilo", t[1] + "%"); }
  b.appendChild(i);
  return b;
}

function disegnaProfili(lista) {
  const box = $("scelta-profilo"); box.innerHTML = "";
  const tinte = tinteProfili(lista);
  lista.forEach((p) => {
    const b = bottoneNome(p, "profilo-card", tinte);
    const sotto = sottotitoloProfilo(p, leggiLocale(chiaveRipassare(p.id), null));
    const t = document.createElement("span"); t.className = "profilo-testo";
    t.innerHTML = "<b>" + esc(p.nome) + "</b>" + (sotto ? "<small>" + esc(sotto) + "</small>" : "");
    b.appendChild(t); b.onclick = () => apriCodice(p); box.appendChild(b);
  });
  // In Oggi: il tondo del profilo aperto, con il suo colore (tocco = cambia profilo).
  const t = $("btn-profilo");
  if (profilo && t) {
    t.textContent = profilo.nome.slice(0, 1).toUpperCase();
    t.setAttribute("aria-label", "Profilo di " + profilo.nome + ": cambia profilo");
    const c = tinte[String(profilo.id)];
    if (c) { t.style.setProperty("--h-profilo", c[0]); t.style.setProperty("--s-profilo", c[1] + "%"); }
  }
}
function disegnaProfiliSalvati() {
  disegnaProfili(ordinaProfili(leggiLocale(CHIAVE_PROFILI, []), leggiLocale(CHIAVE_ULTIMO, null)));
}

/* =================================================================== libreria */

function htmlChip(stato, n) {
  return '<span class="chip-stato" data-s="' + stato + '"><i aria-hidden="true">' + segnoStato(stato) + "</i><b>" + n + "</b> " +
    esc(parolaStato(stato).toLowerCase()) + "</span>";
}

function votoArgomento(a) {
  return a.ultima && a.ultima.voto != null ? votoIt(Number(a.ultima.voto)) : "—";
}

// Card gialla: un solo pulsante pieno. «Ripassa questo» fa la prova lampo sul punto più debole;
// la mappa resta un link. I conteggi stanno una volta sola, sotto la barra.
function htmlPrimo(a, debole) {
  const azione = a.percorso === "esercizi"
    ? '<button type="button" class="azione" data-azione="apri">Apri gli esercizi</button>'
    : debole
      ? '<button type="button" class="azione" data-azione="lampo">Ripassa questo</button>' +
        '<button type="button" class="link" data-azione="mappa">Apri la mappa</button>'
      : '<button type="button" class="azione" data-azione="mappa">Apri la mappa</button>';
  return '<p class="occhiello">Io farei questo</p>' +
    '<h2 class="primo-tit">' + esc(a.titolo) + "</h2>" +
    htmlBarra(contaStati(a)) +
    '<div class="primo-azioni">' + azione + "</div>";
}

function disegnaPrimo(a) {
  const box = $("da-ripassare");
  box.innerHTML = "";
  box.hidden = !a;
  if (!a) return;
  const debole = a.percorso === "esercizi" ? null : concettoPiuDebole(a);
  box.innerHTML = htmlPrimo(a, debole);
  tinta(box, a.materia);
  box.onclick = (e) => {
    const b = e.target.closest("[data-azione]");
    if (!b) return;
    if (b.dataset.azione === "apri") apriScheda(a);
    if (b.dataset.azione === "mappa") { apriScheda(a); apriMappa(a, "mappa"); }
    if (b.dataset.azione === "lampo" && debole) {
      modo = "argomento"; corrente = a;
      preparaVerifica([a], b, $("stato-lib"), $("avviso-db"), { concetto: debole });
    }
  };
}

// Disegno degli stati vuoti (issue #26): un quaderno aperto con una pagina che si solleva,
// inchiostro e giallo. Originale, in linea.
const SVG_VUOTO = '<svg class="disegno-vuoto" width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">' +
  '<path d="M60 22c-12-8-30-9-46-5v62c16-4 34-3 46 5 12-8 30-9 46-5V17c-16-4-34-3-46 5z" fill="var(--carta)" stroke="var(--inchiostro)" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M60 22v62" stroke="var(--inchiostro)" stroke-width="2.5"/>' +
  '<path d="M60 22c10-10 26-14 40-12-6 14-6 30 0 46-14-2-30 2-40 12z" fill="var(--evidenziatore)" stroke="var(--inchiostro)" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M24 38h22M24 48h18M24 58h22" stroke="var(--inchiostro)" stroke-width="2.5" stroke-linecap="round"/></svg>';
const htmlVuoto = (titolo, testo) => '<div class="vuoto">' + SVG_VUOTO + "<b>" + esc(titolo) + "</b>" + esc(testo) + "</div>";

// Card di un argomento con la copertina (la prima foto), titolo, materia, semaforo e voto.
function cardArgomento(a) {
  const b = document.createElement("button"); b.className = "scheda con-copertina"; b.type = "button";
  tinta(b, a.materia);
  const cop = document.createElement("span"); cop.className = "copertina"; cop.setAttribute("aria-hidden", "true");
  disegnaCopertina(cop, a);
  const corpo = document.createElement("span"); corpo.className = "corpo";
  corpo.innerHTML = '<span class="alto"><span class="tit">' + esc(a.titolo) + "</span>" +
    '<span class="voto-arg"><span class="solo-lettore">' + (a.ultima ? "voto " : "nessuna verifica fatta") + "</span>" + (a.ultima ? votoArgomento(a) : '<span aria-hidden="true">—</span>') + "</span></span>" +
    '<span class="materia">' + esc(a.materia) + "</span>" + htmlBarra(contaStati(a));
  b.appendChild(cop); b.appendChild(corpo);
  b.onclick = () => apriScheda(a);
  return b;
}

// Oggi (issue #26, #20): saluto, una frase vera, il piano del giorno (o la card consigliata) e gli argomenti.
function disegnaLibreria() {
  const lista = $("lista-argomenti");
  const tot = riepilogoStati(argomenti);
  if (profilo && libreriaCaricata) salvaLocale(chiaveRipassare(profilo.id), tot.rosso);
  $("ciao").textContent = profilo ? "Ciao " + profilo.nome + "." : "Ciao.";
  $("frase-oggi").textContent = fraseOggi(argomenti);
  // piano.js (issue #20): con dei punti, il piano del giorno prende il posto di «Io farei questo».
  const conPiano = typeof disegnaPianoOggi === "function" && disegnaPianoOggi();
  disegnaPrimo(conPiano ? null : daRipassarePrima(argomenti));
  if (typeof disegnaRipassoOggi === "function") disegnaRipassoOggi(); // compito.js: ripasso 1-3-7 e allenamento di ieri
  if (typeof disegnaInvalsiOggi === "function") disegnaInvalsiOggi(); // invalsi.js: solo per la terza
  if (typeof disegnaEsameOggi === "function") disegnaEsameOggi(); // esame.js: solo per la terza
  if (typeof disegnaGeografiaOggi === "function") disegnaGeografiaOggi(); // geografia.js: solo per la prima
  lista.innerHTML = "";
  $("occhiello-lib").hidden = !argomenti.length;
  if (!argomenti.length) {
    lista.innerHTML = htmlVuoto("Il primo argomento parte da una foto", "Tocca la fotocamera qui sotto e fotografa i tuoi appunti: restano qui e li ritrovi ogni volta che ripassi.");
    return;
  }
  argomenti.forEach((a) => lista.appendChild(cardArgomento(a)));
  caricaCopertine(argomenti);
}

// Argomenti: tutti, divisi per materia, più il ripasso del quadrimestre.
function disegnaArgomenti() {
  const box = $("lista-tutti"); box.innerHTML = "";
  $("btn-ripasso").hidden = !argomenti.length;
  if (!argomenti.length) { box.innerHTML = htmlVuoto("Qui finiscono i tuoi argomenti", "Tocca la fotocamera qui sotto: ogni foto degli appunti diventa un argomento."); return; }
  [...new Set(argomenti.map((a) => a.materia))].sort().forEach((m) => {
    const t = document.createElement("p"); t.className = "occhiello"; t.textContent = m; box.appendChild(t);
    argomenti.filter((a) => a.materia === m).forEach((a) => box.appendChild(cardArgomento(a)));
  });
  caricaCopertine(argomenti);
}
