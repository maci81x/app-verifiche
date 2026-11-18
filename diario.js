// «Cosa avete fatto oggi?» (issue #19): le foto della giornata (quaderno, lavagna, libro, diario)
// si leggono una per una (azione trascrivi) e l'azione smista dice dove va ognuna: un argomento
// che c'è già, uno nuovo o nessuno (pagina di solo diario). Le date di verifiche e interrogazioni
// lette sul diario si propongono con una card; si possono anche segnare a mano.
// Le foto si salvano con i percorsi di sempre: conservaFoto e aggiungiTesto (app.js).
// Tabelle scadenze e giorni_diario: migration 20261116061900_scadenze_diario.sql. Finché non c'è,
// le letture falliscono in silenzio (niente card) e le foto si salvano lo stesso.
// Script classico caricato dopo esercizi.js: usa $, esc, evidenzia, tinta, vai, attesa, passoAttesa,
// errore, avviso, modello, conRiprova, messaggioModello, ridimensiona, trascrivi, segnaLetta, inLettura, conservaFoto,
// aggiungiTesto, caricaLibreria, lettoVuoto, sb, profilo, argomenti, GRUPPO_ILLEGGIBILE.

/* ---- parti pure ---- */

const GIORNI_SETTIMANA = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const NOMI_MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI_SERIE = 60; // quanti giorni indietro si leggono per la serie
const TIPI_SCADENZA = ["scritta", "orale"];

const due = (n) => String(n).padStart(2, "0");
// La data del telefono (non UTC: alle 23.30 è ancora oggi).
const oggiLocale = (d = new Date()) => d.getFullYear() + "-" + due(d.getMonth() + 1) + "-" + due(d.getDate());
const giornoUTC = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const spostaGiorni = (iso, n) => new Date(giornoUTC(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
// «giovedì 19 novembre»
function dataLunga(iso) {
  const d = giornoUTC(iso);
  return d ? GIORNI_SETTIMANA[d.getUTCDay()] + " " + d.getUTCDate() + " " + NOMI_MESI[d.getUTCMonth()] : "";
}
// Una data vera (niente 30 febbraio).
const dataVeraIso = (iso) => { const d = giornoUTC(iso); return !!d && d.toISOString().slice(0, 10) === iso; };

// Giorni di fila con almeno una foto: fino a oggi, o fino a ieri se oggi non ce ne sono ancora.
function serieGiorni(date, oggi) {
  const set = new Set(date);
  let g = set.has(oggi) ? oggi : spostaGiorni(oggi, -1), n = 0;
  while (set.has(g)) { n++; g = spostaGiorni(g, -1); }
  return n;
}
const fraseSerie = (n) => (n >= 2 ? n + " giorni di fila con le foto della scuola" : "");

const nomeScadenza = (s) => (s.tipo === "orale" ? "Interrogazione" : "Verifica") + " di " + s.materia;
const prossimeScadenze = (lista, oggi) => (lista || []).filter((s) => s.data >= oggi).sort((a, b) => a.data.localeCompare(b.data));
// La stessa scadenza: materia senza maiuscole, tipo e data (come l'indice unico della tabella).
const chiaveScadenza = (s) => [String(s.materia || "").trim().toLowerCase(), s.tipo, s.data].join("|");
const giaSegnata = (s, lista) => (lista || []).some((x) => chiaveScadenza(x) === chiaveScadenza(s));
const scadenzaValida = (s, oggi) => !!s && !!String(s.materia || "").trim() && TIPI_SCADENZA.includes(s.tipo) && dataVeraIso(s.data) && s.data >= oggi;

// Dove va una foto, detto in una riga. testo = la sua trascrizione: se è vuota la foto non si è letta.
function rigaFoto(r, testo) {
  const a = r.argomento_id ? argomenti.find((x) => x.id === r.argomento_id) : null;
  if (a) return { materia: a.materia, testo: "Aggiunta a «" + a.titolo + "»" };
  if (r.nuovo_titolo) return { materia: r.materia, testo: "Nuovo argomento: " + r.nuovo_titolo };
  if (testo !== undefined && (!String(testo).trim() || testo === GRUPPO_ILLEGGIBILE))
    return { materia: "", testo: "Non riesco a leggere questa foto: rifotografala o scegli tu dove va" };
  return { materia: "", testo: "Solo diario: qui non c'è niente da studiare" };
}

// Le foto da salvare, una volta per argomento: quelle sullo stesso argomento insieme, i nuovi con
// lo stesso titolo e materia insieme. Le pagine di solo diario non si archiviano.
function gruppiDaSalvare(righe) {
  const gruppi = new Map();
  righe.forEach((r, i) => {
    const a = r.argomento_id ? argomenti.find((x) => x.id === r.argomento_id) : null;
    const titolo = String(r.nuovo_titolo || "").trim(), materia = String(r.materia || "").trim();
    if (!a && !(titolo && materia)) return;
    const chiave = a ? a.id : (materia + "|" + titolo).toLowerCase();
    if (!gruppi.has(chiave)) gruppi.set(chiave, a ? { argomento_id: a.id, materia: a.materia, titolo: a.titolo, indici: [] } : { argomento_id: null, materia, titolo, indici: [] });
    gruppi.get(chiave).indici.push(i);
  });
  return [...gruppi.values()];
}

// La card gialla chiara di una data letta sul diario. La frase è quella vera della trascrizione.
function htmlDataLetta(s, i) {
  if (giaSegnata(s, diario.scadenze))
    return '<div class="card-data" id="dl-' + i + '"><p>Già segnata: ' + esc(nomeScadenza(s)) + ", " + esc(dataLunga(s.data)) + ".</p></div>";
  return '<div class="card-data" id="dl-' + i + '"><p>Sul diario ho letto una data: «' + evidenzia(s.testo_letto) + "». La segno?</p>" +
    '<p class="aiuto">' + esc(nomeScadenza(s)) + ", " + esc(dataLunga(s.data)) + ".</p>" +
    '<div class="bottoni"><button type="button" class="minore" data-segna="' + i + '">Sì, segnala</button>' +
    '<button type="button" class="minore" data-non-segna="' + i + '">Non è così</button></div></div>';
}

/* ---- database ---- */

let diario = { pronto: false, scadenze: [], giorni: [], messaggio: "" };

async function caricaDiario(oggi = oggiLocale()) {
  const [s, g] = await Promise.all([
    sb.from("scadenze").select("id, materia, tipo, data, fonte").gte("data", oggi).order("data").limit(50),
    sb.from("giorni_diario").select("data").gte("data", spostaGiorni(oggi, -GIORNI_SERIE)).order("data", { ascending: false }).limit(GIORNI_SERIE + 1),
  ]);
  diario = { pronto: !(s.error || g.error), scadenze: s.data || [], giorni: (g.data || []).map((x) => x.data), messaggio: diario.messaggio || "" };
}

async function salvaScadenza(s, fonte, oggi = oggiLocale()) {
  if (!scadenzaValida(s, oggi)) throw new Error("scadenza non valida");
  const gia = diario.scadenze.find((x) => chiaveScadenza(x) === chiaveScadenza(s));
  if (gia) return gia; // già segnata: non si scrive di nuovo
  const riga = { materia: String(s.materia).trim(), tipo: s.tipo, data: s.data, fonte };
  const { data, error } = await sb.from("scadenze").insert(riga).select("id, materia, tipo, data, fonte").single();
  if (error && error.code === "23505") return null; // l'indice unico l'ha già: va bene così
  if (error) throw error;
  diario.scadenze = prossimeScadenze(diario.scadenze.concat(data), oggi);
  return data;
}

async function togliScadenza(id) {
  const { error } = await sb.from("scadenze").delete().eq("id", id);
  if (error) throw error;
  diario.scadenze = diario.scadenze.filter((s) => s.id !== id);
}

// Un giorno con delle foto, per la serie. Non fa mai fallire chi la chiama.
async function segnaGiorno(n, oggi = oggiLocale()) {
  if (!n || !profilo) return false;
  try {
    const { data: prima, error: e1 } = await sb.from("giorni_diario").select("n_foto").eq("studente_id", profilo.id).eq("data", oggi).maybeSingle();
    if (e1) return false;
    const { error } = await sb.from("giorni_diario").upsert({ data: oggi, n_foto: ((prima && prima.n_foto) || 0) + n }, { onConflict: "studente_id,data" });
    if (error) return false;
    if (!diario.giorni.includes(oggi)) diario.giorni.unshift(oggi);
    return true;
  } catch (e) { return false; }
}

/* ---- vista ---- */

let fotoDiario = [], smistate = null; // smistate: { blobs, testi, righe, scadenze }

// In Oggi: l'invito, la serie e le prossime date.
function disegnaDiarioOggi() {
  const box = $("diario-oggi"); if (!box) return;
  if (!profilo) { box.innerHTML = ""; return; }
  const oggi = oggiLocale();
  const serie = diario.pronto ? fraseSerie(serieGiorni(diario.giorni, oggi)) : "";
  const prossime = diario.pronto ? prossimeScadenze(diario.scadenze, oggi).slice(0, 5) : [];
  box.innerHTML = '<div class="card-invalsi"><p><b>Cosa avete fatto oggi?</b></p>' +
    '<p class="aiuto">Fotografa quaderno, lavagna, libro e diario: metto tutto al suo posto.</p>' +
    (diario.messaggio ? '<div class="avviso">' + esc(diario.messaggio) + "</div>" : "") +
    (serie ? '<p class="serie-diario">' + esc(serie) + "</p>" : "") +
    (prossime.length ? '<ul class="date-diario">' + prossime.map((s) =>
      '<li><span><b>' + esc(dataLunga(s.data)) + "</b><br>" + esc(nomeScadenza(s)) + "</span>" +
      '<button type="button" class="link" data-togli="' + esc(s.id) + '" aria-label="togli ' + esc(nomeScadenza(s) + " di " + dataLunga(s.data)) + '">Togli</button></li>').join("") + "</ul>" : "") +
    '<div class="bottoni"><button type="button" class="minore" id="btn-apri-diario">Fotografa la giornata</button></div></div>';
  $("btn-apri-diario").onclick = apriDiario;
  box.querySelectorAll("[data-togli]").forEach((b) => {
    b.onclick = () => doppioTocco(b, "Tocca di nuovo", async () => {
      diario.messaggio = "";
      try { await togliScadenza(b.dataset.togli); } catch (e) { diario.messaggio = "Non sono riuscito a togliere la data. Riprova."; }
      disegnaDiarioOggi();
    });
  });
}
// Dopo caricaLibreria (app.js): le date e i giorni del profilo, poi si ridisegna la card.
async function aggiornaDiario() {
  try { await caricaDiario(); } catch (e) { diario.pronto = false; }
  disegnaDiarioOggi();
}

function apriDiario() {
  fotoDiario = []; smistate = null; diario.messaggio = ""; // l'esito dell'ultimo salvataggio resta in Oggi fino a qui
  disegnaFotoDiario();
  errore($("err-diario"), ""); attesa($("stato-diario"), null);
  $("dg-a-mano").hidden = true;
  vai("diario");
}

function disegnaFotoDiario() {
  const c = $("dg-miniature"); c.innerHTML = "";
  $("dg-conta-foto").textContent = fotoDiario.length ? fotoDiario.length + " foto. Aggiungine quante vuoi." : "Quaderno, lavagna, libro, diario.";
  fotoDiario.forEach((f, i) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img"); img.alt = "foto " + (i + 1); img.src = URL.createObjectURL(f);
    const b = document.createElement("button"); b.type = "button"; b.textContent = "×";
    b.setAttribute("aria-label", "togli la foto " + (i + 1));
    b.onclick = () => { fotoDiario.splice(i, 1); disegnaFotoDiario(); };
    fig.appendChild(img); fig.appendChild(b); c.appendChild(fig);
  });
  $("btn-smista").disabled = !fotoDiario.length;
}

async function smistaFoto() {
  const btn = $("btn-smista"), st = $("stato-diario");
  if (!fotoDiario.length) return;
  btn.disabled = true; errore($("err-diario"), "");
  attesa(st, ["Preparo le foto"]);
  try {
    const blobs = await Promise.all(fotoDiario.map(ridimensiona));
    // trascrivi dà già un testo per foto (smista vuole una riga per foto), con la spunta sulla miniatura.
    inLettura("dg-miniature", true);
    let testi;
    try { testi = await trascrivi(blobs, false, (t) => passoAttesa(st, t), false, (i) => segnaLetta("dg-miniature", i)); }
    finally { inLettura("dg-miniature", false); }
    if (lettoVuoto(testi)) throw new Error("vuoto");
    passoAttesa(st, "Metto ogni foto al suo posto");
    const r = await conRiprova(() => modello({
      azione: "smista", oggi: oggiLocale(),
      trascrizioni: testi.map((t) => (t === GRUPPO_ILLEGGIBILE ? "" : t)),
      argomenti: argomenti.slice(0, 300).map((a) => ({ id: a.id, materia: a.materia, titolo: a.titolo })),
    }));
    smistate = { blobs, testi, righe: r.foto, scadenze: r.scadenze || [] };
    attesa(st, null);
    mostraSmistate();
  } catch (e) {
    attesa(st, null);
    errore($("err-diario"), messaggioModello(e, "Non sono riuscito a leggere le foto. Riprova con foto più nitide, dritte e senza ombre."));
  }
  btn.disabled = !fotoDiario.length;
}

function mostraSmistate() {
  disegnaRigheSmistate();
  const box = $("dg-date");
  box.innerHTML = smistate.scadenze.map(htmlDataLetta).join("");
  box.querySelectorAll("[data-segna]").forEach((b) => { b.onclick = () => segnaDataLetta(+b.dataset.segna); });
  box.querySelectorAll("[data-non-segna]").forEach((b) => { b.onclick = () => { $("dl-" + b.dataset.nonSegna).remove(); }; });
  errore($("err-smistato"), ""); attesa($("stato-smistato"), null);
  $("btn-dg-salva").disabled = false; $("btn-dg-salva").textContent = "Va bene così";
  vai("smistato");
}

async function segnaDataLetta(i) {
  const card = $("dl-" + i), s = smistate.scadenze[i];
  card.querySelectorAll("button").forEach((b) => { b.disabled = true; });
  try {
    const gia = giaSegnata(s, diario.scadenze);
    await salvaScadenza(s, "diario");
    card.innerHTML = "<p>" + (gia ? "Già segnata: " : "Segnata: ") + esc(nomeScadenza(s)) + ", " + esc(dataLunga(s.data)) + ".</p>";
  } catch (e) {
    card.querySelectorAll("button").forEach((b) => { b.disabled = false; });
    card.insertAdjacentHTML("beforeend", '<div class="errore">Non sono riuscito a segnarla. Riprova fra un momento.</div>');
  }
}

function disegnaRigheSmistate() {
  const ul = $("dg-righe"); ul.innerHTML = "";
  smistate.righe.forEach((r, i) => {
    const d = rigaFoto(r, smistate.testi[i]);
    const li = document.createElement("li"); li.className = "riga-smista";
    const b = document.createElement("button"); b.type = "button"; b.className = "riga-smista-btn";
    b.setAttribute("aria-expanded", "false");
    const img = document.createElement("img"); img.alt = ""; img.src = URL.createObjectURL(smistate.blobs[i]);
    const testo = document.createElement("span"); testo.className = "riga-smista-testo";
    if (d.materia) { const m = document.createElement("span"); m.className = "arg-materia"; m.textContent = d.materia; tinta(m, d.materia); testo.appendChild(m); }
    const t = document.createElement("b"); t.textContent = d.testo; testo.appendChild(t);
    const sotto = document.createElement("small");
    sotto.textContent = "Foto " + (i + 1) + (r.confidenza < 0.6 && d.materia ? ": non ne sono sicuro, controlla" : "") + ". Tocca per cambiare.";
    testo.appendChild(sotto);
    b.appendChild(img); b.appendChild(testo);
    b.onclick = () => apriCambio(li, i, b);
    li.appendChild(b); ul.appendChild(li);
  });
}

// Tocco su una riga: si sceglie l'argomento (o uno nuovo, o solo diario).
function apriCambio(li, i, btn) {
  const vecchio = li.querySelector(".cambia"); if (vecchio) { vecchio.remove(); btn.setAttribute("aria-expanded", "false"); return; }
  btn.setAttribute("aria-expanded", "true");
  const r = smistate.righe[i];
  const scelta = r.argomento_id && argomenti.some((a) => a.id === r.argomento_id) ? r.argomento_id : (r.nuovo_titolo ? "nuovo" : "nessuno");
  const materie = [...new Set(argomenti.map((a) => a.materia))].sort((x, y) => x.localeCompare(y));
  const box = document.createElement("div"); box.className = "cambia";
  box.innerHTML = '<label class="etichetta" for="dg-dove-' + i + '">Dove va la foto ' + (i + 1) + "</label>" +
    '<select id="dg-dove-' + i + '"><option value="nuovo">Nuovo argomento</option><option value="nessuno">Solo diario: niente da studiare</option>' +
    materie.map((m) => '<optgroup label="' + esc(m) + '">' + argomenti.filter((a) => a.materia === m).map((a) =>
      '<option value="' + esc(a.id) + '">' + esc(a.titolo) + "</option>").join("") + "</optgroup>").join("") + "</select>" +
    '<div class="riga-campi" data-nuovo><div><label class="etichetta" for="dg-mat-' + i + '">Materia</label><input type="text" id="dg-mat-' + i + '" list="elenco-materie" autocomplete="off"></div>' +
    '<div><label class="etichetta" for="dg-tit-' + i + '">Argomento</label><input type="text" id="dg-tit-' + i + '" autocomplete="off"></div></div>' +
    '<div class="bottoni"><button type="button" class="minore">Fatto</button></div>';
  li.appendChild(box);
  const sel = box.querySelector("select"), nuovo = box.querySelector("[data-nuovo]");
  sel.value = scelta;
  box.querySelector("#dg-mat-" + i).value = r.argomento_id ? "" : r.materia || "";
  box.querySelector("#dg-tit-" + i).value = r.nuovo_titolo || "";
  const aggiorna = () => { nuovo.hidden = sel.value !== "nuovo"; };
  sel.onchange = aggiorna; aggiorna();
  box.querySelector("button").onclick = () => {
    const v = sel.value;
    if (v === "nessuno") smistate.righe[i] = { ...r, materia: "", argomento_id: null, nuovo_titolo: null };
    else if (v === "nuovo") {
      const materia = box.querySelector("#dg-mat-" + i).value.trim(), titolo = box.querySelector("#dg-tit-" + i).value.trim();
      if (!materia || !titolo) { errore($("err-smistato"), "Scrivi materia e argomento, così lo ritrovi."); return; }
      smistate.righe[i] = { ...r, materia, argomento_id: null, nuovo_titolo: titolo };
    } else {
      const a = argomenti.find((x) => x.id === v);
      smistate.righe[i] = { ...r, materia: a.materia, argomento_id: a.id, nuovo_titolo: null };
    }
    errore($("err-smistato"), "");
    disegnaRigheSmistate();
  };
  sel.focus();
}

// Mette via le foto smistate, gruppo per gruppo, con i percorsi di sempre (conservaFoto, aggiungiTesto).
// Si può ripetere dopo un errore: smistate ricorda le foto già salvate, gli argomenti già creati
// e i testi già aggiunti, così il nuovo tentativo fa solo quello che manca.
async function mettiVia(onPasso) {
  const st = smistate;
  st.salvate = st.salvate || {}; st.creati = st.creati || {}; st.testoFatto = st.testoFatto || {};
  const gruppi = gruppiDaSalvare(st.righe);
  const e = { salvate: 0, nuoviArgomenti: 0, punti: 0, fotoFallite: 0, testoFallito: 0, gruppiFalliti: 0 };
  for (const g of gruppi) {
    const chiave = g.argomento_id || (g.materia + "|" + g.titolo).toLowerCase();
    let a = g.argomento_id ? argomenti.find((x) => x.id === g.argomento_id) : st.creati[chiave];
    try {
      if (!a) {
        const { data, error } = await sb.from("argomenti").insert({ materia: g.materia, titolo: g.titolo, origine: "foto" }).select("*").single();
        if (error) throw error;
        a = st.creati[chiave] = { ...data, concetti: [], foto: [] }; e.nuoviArgomenti++;
      }
    } catch (err) {
      if (err instanceof Definitivo) throw err;
      e.gruppiFalliti++; continue;
    }
    // Una foto per volta: si sa quale è andata e quale no.
    for (const i of g.indici) {
      if (st.salvate[i]) continue;
      if ((await conservaFoto(a, [st.blobs[i]], onPasso)).length) { st.salvate[i] = true; e.salvate++; }
      else e.fotoFallite++;
    }
    // Il testo quando tutte le foto del gruppo sono a posto, una volta sola.
    if (g.indici.some((i) => !st.salvate[i]) || st.testoFatto[chiave]) continue;
    const testo = g.indici.map((i) => st.testi[i]).filter((t) => t && t !== GRUPPO_ILLEGGIBILE).join("\n\n");
    try {
      if (testo.trim()) e.punti += (await aggiungiTesto(a, testo, g.indici.length, onPasso)).length;
      st.testoFatto[chiave] = true;
    } catch (err) {
      if (err instanceof Definitivo) throw err;
      e.testoFallito++;
    }
  }
  return e;
}

const fallita = (e) => e.fotoFallite || e.testoFallito || e.gruppiFalliti;
function messaggioMessaVia(e) {
  if (fallita(e)) {
    const parti = [];
    if (e.fotoFallite) parti.push(e.fotoFallite === 1 ? "1 foto non è stata salvata." : e.fotoFallite + " foto non sono state salvate.");
    if (e.gruppiFalliti) parti.push(e.gruppiFalliti === 1 ? "Non sono riuscito a creare 1 argomento nuovo." : "Non sono riuscito a creare " + e.gruppiFalliti + " argomenti nuovi.");
    if (e.testoFallito) parti.push("Le foto sono salvate, ma non sono riuscito a leggere i punti di " + (e.testoFallito === 1 ? "1 argomento" : e.testoFallito + " argomenti") + ". Non ricaricare le foto.");
    return parti.join(" ") + " Tocca «Riprova»: faccio solo quello che manca.";
  }
  if (!e.salvate) return "Fatto: oggi solo diario.";
  return "Foto messe via" + (e.nuoviArgomenti ? ", " + e.nuoviArgomenti + (e.nuoviArgomenti === 1 ? " argomento nuovo" : " argomenti nuovi") : "") +
    (e.punti ? ", " + e.punti + (e.punti === 1 ? " punto nuovo da studiare." : " punti nuovi da studiare.") : ".");
}

// «Va bene così» (e «Riprova»): se qualcosa manca si resta qui, se no si torna a Oggi.
async function salvaSmistate() {
  const btn = $("btn-dg-salva"), st = $("stato-smistato");
  btn.disabled = true; errore($("err-smistato"), "");
  attesa(st, ["Metto via le foto"]);
  let e;
  try { e = await mettiVia((t) => passoAttesa(st, t)); }
  catch (err) { attesa(st, null); btn.disabled = false; errore($("err-smistato"), messaggioModello(err, "Non sono riuscito a mettere via le foto. Riprova.")); return; }
  attesa(st, null);
  if (fallita(e)) { errore($("err-smistato"), messaggioMessaVia(e)); btn.textContent = "Riprova"; btn.disabled = false; return; }
  // Le pagine di solo diario non si archiviano, ma contano per la serie.
  const gruppi = gruppiDaSalvare(smistate.righe);
  await segnaGiorno(smistate.righe.filter((r, i) => !gruppi.some((g) => g.indici.includes(i))).length);
  diario.messaggio = messaggioMessaVia(e);
  fotoDiario = []; smistate = null; btn.textContent = "Va bene così";
  await caricaLibreria();
  vai("libreria");
}

// Data segnata a mano.
async function segnaAMano() {
  const s = {
    materia: $("dg-materia").value.trim(),
    tipo: (document.querySelector('input[name="dg-tipo"]:checked') || {}).value,
    data: $("dg-data").value,
  };
  const oggi = oggiLocale();
  if (!scadenzaValida(s, oggi)) { errore($("err-diario"), !s.materia ? "Scrivi la materia." : "Scegli un giorno da oggi in poi."); return; }
  errore($("err-diario"), "");
  try {
    const gia = giaSegnata(s, diario.scadenze);
    await salvaScadenza(s, "manuale", oggi);
    avviso($("err-diario"), (gia ? "Era già segnata: " : "Segnata: ") + nomeScadenza(s) + ", " + dataLunga(s.data) + ".");
    $("dg-materia").value = ""; $("dg-data").value = "";
  } catch (e) {
    errore($("err-diario"), "Non sono riuscito a segnare la data. Controlla la connessione e riprova.");
  }
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("v-diario")) {
  $("foto-diario").addEventListener("change", (ev) => { fotoDiario = fotoDiario.concat([...ev.target.files]); ev.target.value = ""; disegnaFotoDiario(); });
  $("btn-smista").addEventListener("click", smistaFoto);
  $("btn-dg-salva").addEventListener("click", salvaSmistate);
  $("link-a-mano").addEventListener("click", () => {
    const f = $("dg-a-mano"); f.hidden = !f.hidden;
    $("dg-data").min = oggiLocale();
    if (!f.hidden) $("dg-materia").focus();
  });
  $("btn-segna").addEventListener("click", segnaAMano);
}
