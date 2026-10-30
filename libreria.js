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

// Barra divisa in verde/giallo/rosso (e grigio per i mai provati), larghezze in percentuale.
function htmlBarra(conta) {
  const tot = STATI_BARRA.reduce((s, k) => s + conta[k], 0);
  if (!tot) return "";
  const parti = STATI_BARRA.filter((k) => conta[k]).map((k) =>
    '<i data-s="' + k + '" style="width:' + (Math.round(conta[k] / tot * 1000) / 10) + '%"></i>').join("");
  const detto = STATI_BARRA.filter((k) => conta[k]).map((k) => conta[k] + " " + parolaStato(k).toLowerCase()).join(", ");
  return '<span class="barra-stati" role="img" aria-label="' + esc(detto) + '">' + parti + "</span>";
}

// Colore del profilo: una tinta fissa ricavata dall'id (sempre la stessa su ogni telefono).
function tintaProfilo(id) {
  let h = 0;
  for (const ch of String(id || "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

// «2ª media · 3 da ripassare». Il numero lo conosce solo il telefono su cui è entrata
// (l'elenco dei profili è pubblico e non deve dire niente dello studio).
// «2» → «2ª media»; una classe scritta per esteso resta com'è.
const classeIt = (c) => (/^\s*[123]\s*$/.test(String(c || "")) ? String(c).trim() + "ª media" : String(c || "").trim());
function sottotitoloProfilo(p, daRipassare) {
  const parti = [];
  if (p.classe) parti.push(classeIt(p.classe));
  if (Number.isInteger(daRipassare)) parti.push(daRipassare ? daRipassare + " da ripassare" : "niente da ripassare");
  return parti.join(" · ");
}

/* =================================================================== profili */

const chiaveRipassare = (id) => "verifiche-ripassare-" + id;

function bottoneNome(p, classe) {
  const b = document.createElement("button"); b.type = "button"; if (classe) b.className = classe;
  const i = document.createElement("span"); i.className = "iniziale"; i.textContent = p.nome.slice(0, 1).toUpperCase();
  i.style.setProperty("--h-profilo", tintaProfilo(p.id));
  b.appendChild(i);
  return b;
}

function disegnaProfili(lista) {
  const box = $("scelta-profilo"); box.innerHTML = "";
  lista.forEach((p) => {
    const b = bottoneNome(p, "profilo-card");
    const sotto = sottotitoloProfilo(p, leggiLocale(chiaveRipassare(p.id), null));
    const t = document.createElement("span"); t.className = "profilo-testo";
    t.innerHTML = "<b>" + esc(p.nome) + "</b>" + (sotto ? "<small>" + esc(sotto) + "</small>" : "");
    b.appendChild(t); b.onclick = () => apriCodice(p); box.appendChild(b);
  });
  // In libreria: gli altri profili, per passare all'altra (con il suo codice).
  const r = $("profili"); r.innerHTML = "";
  lista.forEach((p) => {
    const b = bottoneNome(p);
    b.setAttribute("aria-pressed", profilo && p.id === profilo.id ? "true" : "false");
    b.appendChild(document.createTextNode(p.nome));
    b.onclick = () => { if (!profilo || p.id !== profilo.id) apriCodice(p); };
    r.appendChild(b);
  });
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

function disegnaPrimo(a) {
  const box = $("da-ripassare");
  box.innerHTML = "";
  box.hidden = !a;
  if (!a) return;
  const c = contaStati(a);
  const debole = a.percorso === "esercizi" ? null : concettoPiuDebole(a);
  box.innerHTML = '<p class="occhiello">Da ripassare prima</p>' +
    '<h2 class="primo-tit">' + esc(a.titolo) + "</h2>" +
    '<p class="primo-meta">' + esc(a.materia) + " · " + (c.rosso ? htmlStato("rosso") + " " + c.rosso : "") +
    (c.rosso && c.giallo ? " · " : "") + (c.giallo ? htmlStato("giallo") + " " + c.giallo : "") + "</p>" +
    htmlBarra(c) +
    '<div class="bottoni">' +
    (a.percorso === "esercizi"
      ? '<button type="button" class="azione" data-azione="apri">Apri gli esercizi</button>'
      : '<button type="button" class="azione" data-azione="mappa">Apri la mappa</button>' +
        (debole ? '<button type="button" class="minore" data-azione="lampo">Prova lampo</button>' : "")) +
    "</div>";
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

function disegnaLibreria() {
  const som = $("sommario"), lista = $("lista-argomenti");
  const tot = riepilogoStati(argomenti);
  som.innerHTML = argomenti.length
    ? '<div class="chips" role="group" aria-label="Riepilogo dei concetti">' + ["verde", "giallo", "rosso"].map((s) => htmlChip(s, tot[s])).join("") + "</div>"
    : "";
  if (profilo) salvaLocale(chiaveRipassare(profilo.id), tot.rosso);
  disegnaPrimo(daRipassarePrima(argomenti));
  lista.innerHTML = "";
  $("occhiello-lib").hidden = !argomenti.length;
  $("btn-svuota").hidden = !argomenti.length && !sessioni.length;
  if (!argomenti.length) {
    lista.innerHTML = '<div class="vuoto"><b>Qui non c\'è ancora niente</b>Fotografa il primo argomento: da quel momento resta in libreria, con le sue foto, e lo ritrovi per i ripassi.</div>';
    return;
  }
  argomenti.forEach((a) => {
    const b = document.createElement("button"); b.className = "scheda"; b.type = "button";
    tinta(b, a.materia);
    const c = contaStati(a);
    b.innerHTML = '<div class="alto"><span class="tit">' + esc(a.titolo) + "</span>" +
      '<span class="voto-arg" aria-label="' + (a.ultima ? "voto " + votoArgomento(a) : "mai verificato") + '">' + votoArgomento(a) + "</span></div>" +
      htmlBarra(c) +
      '<div class="meta"><span>' + esc(a.materia) + "</span><span>" + contaVoci(a) + "</span><span>" + dataIt(a.aggiornato) + "</span></div>";
    b.onclick = () => apriScheda(a);
    lista.appendChild(b);
  });
}
