// Famiglie esterne (issue #30): iscrizione del genitore su invito, invito con link e QR, «Guarda come lo vede» in sola
// lettura, «Scarica i miei dati», «Elimina la famiglia». Script classico dopo app.js: usa SB_URL, SB_KEY, genitore,
// funzioneProfili, entraProfilo, vai, $, esc, errore, avviso, doppioTocco, soloLettura.
"use strict";

const SITO = "https://maci81x.github.io/app-verifiche/";
const EMAIL_TITOLARE = "[EMAIL DEL TITOLARE]"; // segnaposto fino ai dati veri del titolare (punto aperto sulla #30)
const QR_JS = { src: "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
  integrity: "sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1" };

/* =================================================================== logica pura */

// ?invito=CODICE dall'indirizzo, pulito; "" se manca o non è un codice.
function codiceDaIndirizzo(href) {
  try {
    const c = String(new URL(href).searchParams.get("invito") || "").trim().toLowerCase();
    return /^[a-z0-9]{4,20}$/.test(c) ? c : "";
  } catch (e) { return ""; }
}
const linkInvito = (codice) => SITO + "?invito=" + encodeURIComponent(codice);

// Il figlio è bloccato adesso? E c'è stato un blocco negli ultimi 7 giorni (avviso al genitore)?
function statoBlocco(f, ora = Date.now()) {
  const t = (x) => (x ? Date.parse(x) : NaN);
  return { bloccato: t(f && f.bloccato_fino) > ora, recente: t(f && f.ultimo_blocco) > ora - 7 * 86400000 };
}

// «Guarda come lo vede»: solo letture. L'header x-figlio (che nel database restringe le righe del genitore a quel
// figlio, app.posso_leggere) va solo alle richieste /rest/v1/; GET e HEAD partono, tutto il resto riceve subito 403.
function fetchSoloLettura(figlioId, base = fetch) {
  return async (input, init = {}) => {
    const url = String(typeof input === "string" ? input : input.url);
    const metodo = String(init.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    const auth = url.includes("/auth/v1/");
    if (!auth && metodo !== "GET" && metodo !== "HEAD")
      return new Response(JSON.stringify({ message: "sola lettura" }), { status: 403, headers: { "content-type": "application/json" } });
    if (!url.includes("/rest/v1/")) return base(input, init);
    const headers = new Headers(init.headers || (typeof input === "object" ? input.headers : undefined));
    headers.set("x-figlio", figlioId);
    return base(input, { ...init, headers });
  };
}

/* =================================================================== sola lettura */

let figlioGuardato = null;
// Il token lo dà il client del genitore (niente seconda sessione che rinnova lo stesso token). Se è scaduto si esce.
async function tokenGenitore() {
  const s = genitore && (await genitore.auth.getSession()).data.session;
  if (!s || s.expires_at * 1000 < Date.now() + 5000) {
    setTimeout(() => esciSolaLettura("La sessione del genitore è scaduta. Rientra per guardare di nuovo."), 0);
    throw new Error("sessione del genitore scaduta");
  }
  return s.access_token;
}
function clientSoloLettura(figlioId) {
  return window.supabase.createClient(SB_URL, SB_KEY, { accessToken: tokenGenitore, global: { fetch: fetchSoloLettura(figlioId) } });
}
function guardaFiglio(s) {
  soloLettura = true; figlioGuardato = s;
  $("sola-nome").textContent = s.nome;
  $("banner-sola").hidden = false;
  document.body.dataset.sola = "1";
  entraProfilo({ id: s.id, nome: s.nome, classe: s.classe || "", nome_utente: s.nome_utente || "", chiave: null }, clientSoloLettura(s.id));
}
function esciSolaLettura(msg) {
  if (!soloLettura) return;
  soloLettura = false; figlioGuardato = null;
  $("banner-sola").hidden = true;
  document.body.dataset.sola = "";
  sb = null; profilo = null; argomenti = []; sessioni = [];
  vai("impostazioni");
  if (genitore) disegnaImpostazioni();
  if (msg) avviso($("err-imp"), msg);
}

/* =================================================================== iscrizione */

let iscrizione = { codice: "", versioni: null };
async function famiglie(corpo) {
  const r = await fetch(SB_URL + "/functions/v1/famiglie", {
    method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY }, body: JSON.stringify(corpo),
  });
  return { status: r.status, dati: await r.json().catch(() => ({})) };
}
const MSG_INVITO = {
  solo_invito: "Per ora 10+ è solo su invito. Controlla il codice o chiedi un nuovo link a chi ti ha invitato.",
  posti_esauriti: "Posti esauriti per ora. Riprova più avanti.",
  a_breve: "Le iscrizioni apriranno a breve.",
};
function apriIscrizione(codice) {
  $("isc-codice").value = codice || "";
  $("isc-modulo").hidden = true; $("isc-fatto").hidden = true; $("isc-passo-codice").hidden = false;
  errore($("err-isc"), "");
  vai("iscrizione");
  if (codice) controllaInvito();
}
async function controllaInvito() {
  const codice = $("isc-codice").value.trim().toLowerCase();
  errore($("err-isc"), "");
  if (!codice) { errore($("err-isc"), "Scrivi il codice d'invito."); return; }
  $("btn-isc-codice").disabled = true;
  try {
    const r = await famiglie({ azione: "invito", codice });
    if (r.dati.stato !== "valido") { avviso($("err-isc"), MSG_INVITO[r.dati.stato] || MSG_INVITO.solo_invito); return; }
    iscrizione = { codice, versioni: r.dati.versioni };
    $("isc-passo-codice").hidden = true; $("isc-modulo").hidden = false;
    ["isc-privacy", "isc-condizioni", "isc-dati"].forEach((id) => { $(id).checked = false; }); // mai preselezionate
  } catch (e) {
    console.warn("invito:", e); errore($("err-isc"), "Non riesco a controllare il codice. Controlla la connessione e riprova.");
  } finally { $("btn-isc-codice").disabled = false; }
}
const MSG_CAMPO = {
  nome: "Scrivi il tuo nome (fino a 40 caratteri).", cognome: "Scrivi il tuo cognome (fino a 40 caratteri).",
  email: "Controlla l'email.", password: "La password deve avere almeno 10 caratteri.",
  consensi: "Per iscriverti servono tutte e tre le spunte.",
};
async function inviaIscrizione() {
  errore($("err-isc"), "");
  const spunte = ["isc-privacy", "isc-condizioni", "isc-dati"].every((id) => $(id).checked);
  if (!spunte) { errore($("err-isc"), MSG_CAMPO.consensi); return; }
  const corpo = { azione: "iscrivi", codice: iscrizione.codice, nome: $("isc-nome").value, cognome: $("isc-cognome").value,
    email: $("isc-email").value, password: $("isc-password").value, consensi: iscrizione.versioni };
  $("btn-isc-invia").disabled = true;
  try {
    const r = await famiglie(corpo);
    if (r.status === 400 && r.dati.campo) { errore($("err-isc"), MSG_CAMPO[r.dati.campo] || "Controlla i dati e riprova."); return; }
    if (!r.dati.ok) { avviso($("err-isc"), MSG_INVITO[r.dati.errore] || "Non sono riuscito a iscriverti. Riprova fra poco."); return; }
    $("isc-password").value = "";
    $("isc-modulo").hidden = true; $("isc-fatto").hidden = false;
    $("isc-fatto-testo").textContent = r.dati.prova
      ? "Fatto. Ora entra come genitore con la tua email e la tua password, e aggiungi un figlio."
      : "Ti abbiamo scritto a " + corpo.email.trim() + ". Apri il link nella mail per confermare, poi entra come genitore." +
        (r.dati.mail ? "" : " Se la mail non arriva entro 10 minuti, scrivi a " + EMAIL_TITOLARE + ".");
  } catch (e) {
    console.warn("iscrizione:", e); errore($("err-isc"), "Non riesco a iscriverti adesso. Controlla la connessione e riprova.");
  } finally { $("btn-isc-invia").disabled = false; }
}

/* =================================================================== pannello famiglia */

function caricaQr() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = QR_JS.src; s.integrity = QR_JS.integrity; s.crossOrigin = "anonymous";
    s.onload = ok; s.onerror = () => no(new Error("QR non caricato"));
    document.head.appendChild(s);
  });
}
async function mostraQr(link) {
  try {
    await caricaQr();
    const q = window.qrcode(0, "M"); q.addData(link); q.make();
    $("fam-qr").innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    $("fam-qr").hidden = false;
  } catch (e) { console.warn("qr:", e); errore($("err-imp"), "Non riesco a disegnare il QR. Controlla la connessione e riprova."); }
}
async function condividi(link) {
  try {
    if (navigator.share) { await navigator.share({ title: "10+", text: "Ti invito su 10+, l'app per studiare per le verifiche.", url: link }); return; }
    await navigator.clipboard.writeText(link);
    avviso($("err-imp"), "Link copiato: incollalo dove vuoi.");
  } catch (e) { if (e && e.name !== "AbortError") console.warn("condividi:", e); }
}
async function scaricaDati(btn) {
  btn.disabled = true; errore($("err-imp"), "");
  try {
    const dati = await funzioneProfili({ azione: "esporta" });
    const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "10piu-dati-famiglia.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) { console.warn("esporta:", e); errore($("err-imp"), "Non sono riuscito a preparare i dati. Riprova."); }
  btn.disabled = false;
}
async function eliminaFamiglia(btn) {
  btn.disabled = true; errore($("err-imp"), "");
  try {
    const r = await funzioneProfili({ azione: "elimina_famiglia" });
    // Su questo telefono non resta niente dei figli eliminati.
    const via = new Set((r.figli || []).map((f) => f.id));
    salvaLocale(CHIAVE_PROFILI, leggiLocale(CHIAVE_PROFILI, []).filter((p) => !via.has(p.id)));
    via.forEach((id) => { try { localStorage.removeItem(chiaveSessione(id)); localStorage.removeItem("verifiche-ripassare-" + id); } catch (e) { /* copie locali */ } });
    if (profilo && via.has(profilo.id)) { profilo = null; sb = null; argomenti = []; sessioni = []; }
    await genEsci();
    avviso($("err-profili"), "Famiglia eliminata, con tutti i profili, i dati e le foto.");
  } catch (e) {
    console.warn("elimina famiglia:", e); errore($("err-imp"), "Non sono riuscito a eliminare la famiglia. Riprova.");
    btn.disabled = false;
  }
}
// La parte «Famiglia» del pannello: invito con link, Condividi e QR; dati da scaricare; eliminazione.
function disegnaFamiglia(dati) {
  const box = $("imp-famiglia"); box.replaceChildren();
  if (!dati || !dati.invito) return;
  const link = linkInvito(dati.invito);
  const p = document.createElement("p"); p.className = "aiuto";
  p.innerHTML = "Il tuo codice d'invito: <b>" + esc(dati.invito) + "</b>. Chi si iscrive con il tuo link risulta invitato da te.";
  const l = document.createElement("p"); l.className = "link-invito"; l.textContent = link;
  const bt = document.createElement("div"); bt.className = "bottoni";
  const sh = document.createElement("button"); sh.type = "button"; sh.className = "minore"; sh.textContent = "Condividi il link"; sh.onclick = () => condividi(link);
  const qr = document.createElement("button"); qr.type = "button"; qr.className = "minore"; qr.textContent = "Mostra il QR"; qr.onclick = () => mostraQr(link);
  bt.append(sh, qr);
  const q = document.createElement("div"); q.id = "fam-qr"; q.className = "qr"; q.hidden = true; q.setAttribute("role", "img"); q.setAttribute("aria-label", "QR del link d'invito");
  const d = document.createElement("div"); d.className = "bottoni";
  const sc = document.createElement("button"); sc.type = "button"; sc.className = "minore"; sc.textContent = "Scarica i miei dati"; sc.onclick = () => scaricaDati(sc);
  const el = document.createElement("button"); el.type = "button"; el.className = "minore pericolo"; el.textContent = "Elimina la famiglia";
  el.onclick = () => doppioTocco(el, "Tocca ancora: cancello tutti i profili, i dati, le foto e il tuo account", () => eliminaFamiglia(el));
  d.append(sc, el);
  const n = document.createElement("p"); n.className = "aiuto";
  n.innerHTML = 'Leggi l\'<a href="privacy.html">informativa privacy</a> e le <a href="condizioni.html">condizioni d\'uso</a>.';
  box.append(p, l, bt, q, d, n);
}
