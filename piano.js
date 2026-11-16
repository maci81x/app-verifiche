// Oggi e Settimana (issue #20): piano del giorno con ripetizione dilazionata.
// Script classico caricato per ultimo: usa $, esc, tinta, voto, votoIt, statoValido, segnoStato,
// parolaStato, htmlStato (semaforo.js, app.js), giornoDi (compito.js), modo/corrente/preparaVerifica.
// Le parti pure stanno in cima (test/piano.test.js); il DOM parte da disegnaPianoOggi.
//
// Le tabelle ripasso_stato (migration di questo ticket) e scadenze/giorni_diario (#19) possono
// non esserci ancora: ogni lettura che fallisce vale come elenco vuoto e il piano si fa con
// i soli dati che ci sono (stati dei concetti e sessioni).

/* =================================================================== parti pure */

const FACILITA_INIZIALE = 2.5, FACILITA_MIN = 1.3, FACILITA_MAX = 3;
const ESITO_BUONO = 8, ESITO_SCARSO = 5; // come statoDaMedia: verde da 8, rosso sotto 5
const GIORNI_VERIFICA = 5; // le verifiche entro 5 giorni entrano nel piano, pesate per vicinanza
const PUNTI_MIN = 4, PUNTI_MAX = 6, SECONDI_OBIETTIVO = 600;
// ponytail: senza almeno 5 risposte con i secondi misurati si assumono 2 minuti a punto
// (10 minuti / 5 punti, l'obiettivo della issue #20). Appena ci sono risposte misurate vale la loro media.
const SECONDI_SENZA_MISURA = 120, MIN_MISURE = 5;

const giornoPiu = (g, n) => { const [a, m, d] = g.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
const giorniFra = (da, a) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(da + "T00:00:00Z")) / 864e5);

const arrotondaA = (x, cifre) => Math.round(x * 10 ** cifre) / 10 ** cifre;
const piattaMateria = (m) => String(m || "").trim().toLowerCase();

// Durata media di un punto: la media dei secondi delle risposte (una domanda = un punto),
// senza le risposte vuote o lasciate aperte per ore.
function secondiPerPunto(secondi) {
  const v = (secondi || []).filter((s) => Number.isFinite(s) && s >= 3 && s <= 600);
  return v.length < MIN_MISURE ? SECONDI_SENZA_MISURA : Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

// Stato di ripasso dopo una risposta. esito 0-10, sicurezza 'ci' | 'forse' | 'caso' | null.
// Buono: intervallo × facilità. Scarso: intervallo 1. In mezzo: stesso intervallo.
function nuovoStatoRipasso(prima, esito, sicurezza, oggi) {
  let intervallo = Number(prima && prima.intervallo_giorni) || 1;
  let facilita = Number(prima && prima.facilita) || FACILITA_INIZIALE;
  if (esito >= ESITO_BUONO) { intervallo = Math.max(1, Math.round(intervallo * facilita)); facilita += 0.1; }
  else if (esito < ESITO_SCARSO) { intervallo = 1; facilita -= 0.2; }
  intervallo = Math.min(365, intervallo);
  facilita = arrotondaA(Math.min(FACILITA_MAX, Math.max(FACILITA_MIN, facilita)), 2);
  return { prossima: giornoPiu(oggi, intervallo), intervallo_giorni: intervallo, facilita,
    ultima_sicurezza: sicurezza || null, ultimo_esito: arrotondaA(esito, 1) };
}
// Sbagliato dato come «Ci prendo»: domani, prima di tutto il resto.
const prioritaMassima = (s) => !!s && s.ultima_sicurezza === "ci" && s.ultimo_esito != null && s.ultimo_esito < ESITO_SCARSO;

// Sicurezza di ogni concetto in una prova: un «Ci prendo» sbagliato vince, altrimenti l'ultima detta.
function sicurezzePerConcetto(domande, risposte, per) {
  const fuori = {}, fermi = new Set();
  (domande || []).forEach((d) => {
    const s = (risposte[d.id] || {}).sicurezza;
    if (!s || !d.concetto_id || fermi.has(d.concetto_id)) return;
    fuori[d.concetto_id] = s;
    if (s === "ci" && (per[d.id] || {}).punti < ESITO_SCARSO) fermi.add(d.concetto_id);
  });
  return fuori;
}

// I punti su cui si fa il piano: i concetti degli argomenti di teoria con il loro stato di
// ripasso (righe: { [concetto_id]: riga di ripasso_stato }). Gli esercizi hanno i loro tipi, non punti.
function puntiDelPiano(argomenti, righe) {
  return (argomenti || []).filter((a) => a.percorso !== "esercizi").flatMap((a) => (a.concetti || []).map((c) => {
    const r = (righe || {})[c.id] || {};
    return { concetto_id: c.id, titolo: c.titolo, argomento_id: a.id, argomento: a.titolo, materia: a.materia,
      stato: statoValido(c.stato), peso: c.peso || 2, media: c.media == null ? null : Number(c.media),
      prossima: r.prossima || null, intervallo_giorni: r.intervallo_giorni || null,
      ultima_sicurezza: r.ultima_sicurezza || null, ultimo_esito: r.ultimo_esito == null ? null : Number(r.ultimo_esito) };
  }));
}

// n posti divisi in proporzione ai pesi (resto più grande), almeno 1 a testa se bastano.
function ripartisci(n, pesi) {
  if (!pesi.length || n <= 0) return pesi.map(() => 0);
  const tot = pesi.reduce((a, b) => a + b, 0);
  const esatte = pesi.map((p) => (n * p) / tot), quote = esatte.map(Math.floor);
  let resto = n - quote.reduce((a, b) => a + b, 0);
  esatte.map((e, i) => [e - quote[i], i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (resto > 0) { quote[i]++; resto--; } });
  if (n >= pesi.length) quote.forEach((q, i) => { if (!q) { const j = quote.indexOf(Math.max(...quote)); quote[j]--; quote[i] = 1; } });
  return quote;
}


// Il piano del giorno. stati: punti (puntiDelPiano); scadenze: righe di `scadenze`; oggi 'YYYY-MM-DD';
// secondi: durata media misurata di un punto (secondiPerPunto).
// → { punti: [punto + motivo], minuti, secondi_punto, parti: [{ materia, punti, minuti }], scadenze: vicine, prossima }
function pianoDelGiorno(stati, scadenze, oggi, secondi = SECONDI_SENZA_MISURA) {
  const future = (scadenze || []).map((s) => ({ ...s, giorni: giorniFra(oggi, s.data) })).filter((s) => s.giorni >= 0)
    .sort((x, y) => x.giorni - y.giorni);
  const vicine = future.filter((s) => s.giorni <= GIORNI_VERIFICA);
  const scadenzaDi = (p) => vicine.find((s) => (s.argomento_id ? s.argomento_id === p.argomento_id : piattaMateria(s.materia) === piattaMateria(p.materia))) || null;
  const dovuto = (p) => (p.prossima ? p.prossima <= oggi : p.stato !== "verde");
  const vicinanza = (p) => { const s = scadenzaDi(p); return s ? GIORNI_VERIFICA + 1 - s.giorni : 0; };
  const ordine = (x, y) => ORDINE_STATO[x.stato] - ORDINE_STATO[y.stato] || vicinanza(y) - vicinanza(x) ||
    String(x.prossima || "").localeCompare(String(y.prossima || "")) || (y.peso || 2) - (x.peso || 2);

  const tutti = (stati || []).slice().sort(ordine);
  const posti = tutti.length ? Math.min(PUNTI_MAX, Math.max(PUNTI_MIN, Math.round(SECONDI_OBIETTIVO / secondi))) : 0;
  const scelti = [], usati = new Set();
  const prendi = (p, motivo) => { if (scelti.length < posti && !usati.has(p.concetto_id)) { scelti.push({ ...p, motivo }); usati.add(p.concetto_id); } };
  const liberi = (filtro) => tutti.filter((p) => !usati.has(p.concetto_id) && filtro(p));

  const verdi = tutti.filter((p) => p.stato === "verde");
  const riservati = verdi.some((p) => !prioritaMassima(p)) ? 1 : 0; // almeno 1 verde «da rivedere al volo»
  const finoA = posti - riservati;
  tutti.filter(prioritaMassima).forEach((p) => { if (scelti.length < finoA) prendi(p, "subito"); });
  // Le verifiche vicine si dividono i posti in proporzione alla vicinanza.
  const gruppi = vicine.map((s) => ({ s, lista: liberi((p) => p.stato !== "verde" && scadenzaDi(p) === s) })).filter((g) => g.lista.length);
  const quote = ripartisci(finoA - scelti.length, gruppi.map((g) => GIORNI_VERIFICA + 1 - g.s.giorni));
  gruppi.forEach((g, i) => g.lista.slice(0, quote[i]).forEach((p) => prendi(p, "verifica")));
  liberi((p) => p.stato !== "verde" && (dovuto(p) || scadenzaDi(p))).forEach((p) => { if (scelti.length < finoA) prendi(p, scadenzaDi(p) ? "verifica" : "dovuto"); });
  // Il verde al volo: della verifica più vicina, poi il più scaduto.
  const alVolo = liberi((p) => p.stato === "verde").sort((x, y) => vicinanza(y) - vicinanza(x) || Number(dovuto(y)) - Number(dovuto(x)) || ordine(x, y))[0];
  const restanti = liberi((p) => p.stato === "verde" && p !== alVolo && (dovuto(p) || scadenzaDi(p)));
  restanti.slice(0, Math.max(0, posti - scelti.length - (alVolo ? 1 : 0))).forEach((p) => prendi(p, scadenzaDi(p) ? "verifica" : "dovuto"));
  if (alVolo) prendi(alVolo, "al volo");

  const perMateria = {};
  scelti.forEach((p) => { perMateria[p.materia] = (perMateria[p.materia] || 0) + 1; });
  const parti = Object.entries(perMateria).map(([materia, n]) => ({ materia, punti: n, minuti: Math.max(1, Math.round((n * secondi) / 60)) }))
    .sort((x, y) => y.punti - x.punti);
  return { punti: scelti, minuti: scelti.length ? Math.max(1, Math.round((scelti.length * secondi) / 60)) : 0, secondi_punto: secondi,
    parti, scadenze: vicine, prossima: future[0] || null };
}

// Giorni di studio di fila fino a oggi (se oggi non ha ancora studiato, la serie di ieri regge).
function giorniDiFila(giorni, oggi) {
  const set = new Set(giorni || []);
  let g = set.has(oggi) ? oggi : giornoPiu(oggi, -1), n = 0;
  while (set.has(g)) { n++; g = giornoPiu(g, -1); }
  return n;
}
// Il voto se la verifica fosse oggi: media pesata dei punti già provati, sulla scala di voto().
function votoSeFosseOggi(punti) {
  const provati = (punti || []).filter((p) => p.media != null);
  if (!provati.length) return null;
  const peso = provati.reduce((s, p) => s + (p.peso || 1), 0);
  return voto(Math.round((provati.reduce((s, p) => s + p.media * (p.peso || 1), 0) / peso) * 10));
}
function prontezza(punti) {
  const totale = (punti || []).length, verdi = (punti || []).filter((p) => p.stato === "verde").length;
  return { verdi, totale, percento: totale ? Math.round((verdi / totale) * 100) : 0 };
}

const quandoIt = (g) => (g === 0 ? "oggi" : g === 1 ? "domani" : "fra " + g + " giorni");
const minutiIt = (n) => n + (n === 1 ? " minuto" : " minuti");
// «i 10 minuti», «gli 8 minuti», «il minuto»
const iMinuti = (n) => (n === 1 ? "il minuto" : (n === 11 || /^8/.test(String(n)) ? "gli " : "i ") + minutiIt(n));
const materiaIt = (m) => { const t = String(m || "").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
const tipoIt = (t) => (t === "orale" ? "Interrogazione" : "Verifica");

// La riga sotto il saluto: cosa si fa oggi.
function rigaPiano(p) {
  if (!p.scadenze.length) return "Nessuna verifica in vista. Segna una data, o fai " + iMinuti(p.minuti) + " per non dimenticare.";
  const parti = p.parti.map((x, i) => (i === 0 ? minutiIt(x.minuti) + " di " : x.minuti + " di ") + piattaMateria(x.materia));
  return "Oggi " + (parti.length < 2 ? parti.join("") : parti.slice(0, -1).join(", ") + " e " + parti.at(-1)) + ".";
}

// La card scura «I tuoi N minuti di oggi»: i punti con il semaforo e il pulsante giallo.
function htmlPiano(p) {
  const voci = p.punti.map((x) => '<li><span class="sem" data-s="' + x.stato + '"><i aria-hidden="true">' + segnoStato(x.stato) + "</i>" +
    '<span class="solo-lettore">' + esc(parolaStato(x.stato)) + ": </span></span>" +
    '<span class="piano-tit">' + esc(x.titolo) + "<small>" + esc(x.motivo === "al volo" ? "da rivedere al volo" : x.argomento || x.materia) + "</small></span></li>").join("");
  return '<h2 class="piano-titolo">' + (p.minuti === 1 ? "Il tuo minuto" : "I tuoi " + minutiIt(p.minuti)) + " di oggi</h2>" +
    '<ul class="piano-punti">' + voci + "</ul>" +
    '<button type="button" class="piano-parti" data-azione="parti">Parti con ' + iMinuti(p.minuti) + "</button>";
}

// Sette giorni da oggi, con la sigla della materia dove c'è una verifica.
function giorniSettimana(scadenze, oggi) {
  const fmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => {
    const data = giornoPiu(oggi, i), qui = (scadenze || []).filter((s) => s.data === data);
    return { data, nome: fmt.format(new Date(data + "T00:00:00Z")).replace(".", ""), numero: Number(data.slice(8)),
      scadenze: qui, sigle: qui.map((s) => piattaMateria(s.materia).slice(0, 3).toUpperCase()) };
  });
}

/* =================================================================== nel browser */

let statiRipasso = {};   // { [concetto_id]: riga di ripasso_stato }
let datiPiano = { scadenze: [], giorni: [], secondi: [] };
let pianoOggi = null;

// Righe nuove di ripasso_stato dopo una prova, scritte con upsert. Torna false se la scrittura
// non riesce (per esempio la tabella non c'è ancora): la prova resta salvata lo stesso.
async function salvaRipassoStato(client, concetti, sicurezze, oggi) {
  const ora = new Date().toISOString();
  const righe = (concetti || []).map((x) => ({ concetto_id: x.concetto_id,
    ...nuovoStatoRipasso(statiRipasso[x.concetto_id], Number(x.media), (sicurezze || {})[x.concetto_id], oggi), aggiornato: ora }));
  if (!righe.length) return true;
  righe.forEach((r) => { statiRipasso[r.concetto_id] = { ...statiRipasso[r.concetto_id], ...r }; });
  try {
    const { error } = await client.from("ripasso_stato").upsert(righe, { onConflict: "concetto_id,studente_id" });
    return !error;
  } catch (e) { return false; }
}

// Letture per il piano, in parallelo alla libreria. Una tabella che manca vale come vuota.
async function leggiPiano() {
  const oggi = giornoDi(new Date());
  const vuoto = (q) => Promise.resolve(q).then((r) => (r && !r.error && r.data) || [], () => []);
  const [st, sc, gd, rs] = await Promise.all([
    vuoto(sb.from("ripasso_stato").select("concetto_id, prossima, intervallo_giorni, facilita, ultima_sicurezza, ultimo_esito")),
    vuoto(sb.from("scadenze").select("id, materia, tipo, data, argomento_id").gte("data", oggi).order("data").limit(50)),
    vuoto(sb.from("giorni_diario").select("data").order("data", { ascending: false }).limit(60)),
    // ponytail: le ultime 300 risposte con i secondi in ordine qualsiasi (risposte non ha una data); basta per una media
    vuoto(sb.from("risposte").select("secondi").not("secondi", "is", null).limit(300)),
  ]);
  statiRipasso = Object.fromEntries(st.map((r) => [r.concetto_id, r]));
  datiPiano = { scadenze: sc, giorni: gd.map((r) => r.data), secondi: rs.map((r) => r.secondi) };
}

const giorniDiStudio = () => [...datiPiano.giorni, ...(sessioni || []).map((s) => giornoDi(new Date(s.data)))];

function calcolaPiano() {
  const punti = puntiDelPiano(argomenti, statiRipasso);
  return { punti, piano: pianoDelGiorno(punti, datiPiano.scadenze, giornoDi(new Date()), secondiPerPunto(datiPiano.secondi)) };
}

// Oggi: saluto con la verifica più vicina, la riga del giorno, la card scura e tre numeri veri.
// Torna false senza punti (nessun argomento di teoria): Oggi resta com'era.
function disegnaPianoOggi() {
  const box = $("piano-oggi"), numeri = $("numeri-oggi");
  const { punti, piano } = calcolaPiano();
  pianoOggi = piano;
  box.hidden = numeri.hidden = !piano.punti.length;
  $("link-settimana").hidden = !profilo;
  if (!piano.punti.length) return false;
  const s = piano.prossima;
  const ciao = $("ciao");
  ciao.textContent = profilo ? "Ciao " + profilo.nome + "." : "Ciao.";
  if (s && s.giorni <= GIORNI_VERIFICA) {
    const m = document.createElement("span"); m.className = "parola-scadenza"; m.textContent = materiaIt(s.materia); tinta(m, s.materia);
    ciao.append(" ", m, " " + quandoIt(s.giorni) + ".");
  }
  $("frase-oggi").textContent = rigaPiano(piano);
  box.innerHTML = htmlPiano(piano);
  box.onclick = (e) => { const b = e.target.closest("[data-azione=parti]"); if (b) partiConIlPiano(); };
  const daVoto = s ? punti.filter((p) => (s.argomento_id ? p.argomento_id === s.argomento_id : piattaMateria(p.materia) === piattaMateria(s.materia))) : [];
  const v = votoSeFosseOggi(daVoto.some((p) => p.media != null) ? daVoto : punti);
  const fila = giorniDiFila(giorniDiStudio(), giornoDi(new Date()));
  const imparati = punti.filter((p) => p.stato === "verde").length;
  numeri.innerHTML = [[fila, fila === 1 ? "giorno di fila" : "giorni di fila"], [imparati, imparati === 1 ? "punto imparato" : "punti imparati"],
    [v == null ? "—" : votoIt(v), "voto se fosse oggi"]].map(([n, t]) => "<div><b>" + esc(n) + "</b><span>" + esc(t) + "</span></div>").join("");
  return true;
}

// «Parti»: il ripasso guidato sui punti del piano (ripasso.js, issue #21).
function partiConIlPiano() {
  avviaRipassoGuidato(pianoOggi.punti.map((p) => p.concetto_id));
}

// Dopo una prova (salvaProva in app.js): stato di ripasso di ogni concetto.
function aggiornaStatoRipasso(concetti, sicurezze) {
  return salvaRipassoStato(sb, concetti, sicurezze, giornoDi(new Date()));
}

function disegnaSettimana() {
  const oggi = giornoDi(new Date()), { punti, piano } = calcolaPiano();
  pianoOggi = piano;
  $("set-giorni").innerHTML = giorniSettimana(datiPiano.scadenze, oggi).map((g, i) =>
    '<li class="giorno' + (g.scadenze.length ? " con-verifica" : "") + '" data-i="' + i + '"' + (i === 0 ? ' aria-current="date"' : "") + ">" +
    "<span>" + esc(g.nome) + "</span><b>" + g.numero + "</b>" + (g.sigle.length ? "<small>" + esc(g.sigle.join(" ")) + "</small>" : "") +
    (g.scadenze.length ? '<span class="solo-lettore">: ' + esc(g.scadenze.map((s) => tipoIt(s.tipo) + " di " + s.materia).join(", ")) + "</span>" : "") + "</li>").join("");
  giorniSettimana(datiPiano.scadenze, oggi).forEach((g, i) => { if (g.scadenze.length) tinta(document.querySelector('#set-giorni [data-i="' + i + '"]'), g.scadenze[0].materia); });

  const box = $("set-arrivo"); box.innerHTML = "";
  const future = datiPiano.scadenze.map((s) => ({ ...s, giorni: giorniFra(oggi, s.data) })).filter((s) => s.giorni >= 0);
  $("set-vuoto").hidden = !!future.length;
  $("set-vuoto").textContent = piano.minuti ? rigaPiano({ ...piano, scadenze: [] }) : "Nessuna verifica in vista. Fotografa i tuoi appunti: da lì parte il piano.";
  future.forEach((s) => {
    const arg = argomenti.find((a) => a.id === s.argomento_id);
    const suoi = punti.filter((p) => (s.argomento_id ? p.argomento_id === s.argomento_id : piattaMateria(p.materia) === piattaMateria(s.materia)));
    const pr = prontezza(suoi);
    const quando = new Date(s.data + "T12:00:00Z").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const card = document.createElement("div"); card.className = "card-scadenza"; tinta(card, s.materia);
    card.innerHTML = '<p class="occhiello">' + esc(tipoIt(s.tipo) + " di " + piattaMateria(s.materia)) + "</p>" +
      "<b>" + esc(quando) + ", " + esc(quandoIt(s.giorni)) + "</b>" + (arg ? "<span>" + esc(arg.titolo) + "</span>" : "") +
      (pr.totale ? '<span class="barra-pronto" aria-hidden="true"><i style="width:' + pr.percento + '%"></i></span>' +
        "<small>" + pr.verdi + (pr.verdi === 1 ? " punto su " : " punti su ") + pr.totale + " li sai</small>" : "<small>Nessun punto ancora: fotografa gli appunti di questo argomento.</small>");
    box.appendChild(card);
  });
  const pi = $("set-piano");
  pi.hidden = !piano.punti.length;
  pi.innerHTML = piano.punti.length ? htmlPiano(piano) : "";
  pi.onclick = (e) => { const b = e.target.closest("[data-azione=parti]"); if (b) partiConIlPiano(); };
}

function collegaPiano() {
  $("link-settimana").addEventListener("click", () => { disegnaSettimana(); vai("settimana"); });
  $("btn-altri-appunti").addEventListener("click", () => $("btn-nuovo").click()); // il diario (#19) quando ci sarà
}
