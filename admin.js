// Pannello dell'amministratore (issue #30, grafica #34). La pagina non decide niente: ogni dato e ogni azione passano
// dalla Edge Function `admin`, che pretende app_metadata.ruolo = "admin" e la verifica in due passaggi fatta (aal2).
// Niente resta sul dispositivo: sessione solo in memoria (persistSession: false), nessuno storage del browser.
// Primo accesso: si registra il TOTP (Supabase Auth MFA) PRIMA che il ruolo admin venga assegnato con SQL.
// Le funzioni pure stanno in cima (le prova test/admin.test.js con vm); tutto ciò che tocca il DOM parte da avvia().
"use strict";
const SB_URL = "https://nnzkmjpylwtinplepxgz.supabase.co";
const SB_KEY = "sb_publishable_WTCYzSgAc_rVk7r04sdT8w_VFUwzFHJ";
const SITO_ADMIN = "https://maci81x.github.io/app-verifiche/";
// Lo stesso QR dell'app (famiglia.js): famiglia.js non si può caricare qui perché dipende da app.js. Un test confronta i due.
const QR_JS = { src: "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
  integrity: "sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1" };

/* =================================================================== logica pura */

// I tre riquadri in alto: stringhe pronte da mostrare.
function fasciaNumeri(r, c) {
  return {
    posti: (Number(r && r.posti_occupati) || 0) + " / " + (Number(r && r.posti_esterni) || 0),
    oggi: String((c && c.oggi && c.oggi.chiamate) || 0),
    mese: dollari(c && c.mese && c.mese.costo),
  };
}

// Famiglie con i loro figli annidati; i profili senza famiglia restano visibili a parte.
function righeFamiglie(r) {
  const figli = (r && r.figli) || [];
  const famiglie = ((r && r.famiglie) || []).map((f) => ({
    ...f,
    tipo: f.esterna ? (f.prova ? "esterna, di prova" : "esterna") : "esistente",
    figli: figli.filter((s) => s.famiglia_id === f.id),
  }));
  const note = new Set(famiglie.map((f) => f.id));
  return { famiglie, senzaFamiglia: figli.filter((s) => !note.has(s.famiglia_id)) };
}

// Conferma scritta nella pagina, mai un popup: il primo tocco cambia il testo del pulsante, il secondo entro `ms`
// esegue una volta sola e rimette il testo; scaduto il tempo si torna al primo tocco.
function confermaInPagina(btn, testo, fn, ms = 6000) {
  if (btn.dataset.inConferma === "1") {
    clearTimeout(btn._timer);
    btn.dataset.inConferma = "";
    btn.textContent = btn.dataset.testo;
    btn.disabled = true; // niente seconda chiamata mentre l'azione parte (il ridisegno crea pulsanti nuovi)
    fn();
    return;
  }
  btn.dataset.testo = btn.textContent;
  btn.dataset.inConferma = "1";
  btn.textContent = testo;
  if (typeof annuncia === "function") annuncia(testo); // anche nella riga di stato, letta dai lettori di schermo
  btn._timer = setTimeout(() => { btn.dataset.inConferma = ""; btn.textContent = btn.dataset.testo; }, ms);
}

const dataIt = (iso) => (iso ? new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const meseIt = () => new Date().toLocaleDateString("it-IT", { month: "long", timeZone: "Europe/Rome" });

/* =================================================================== pagina */

let sb = null, fattore = null, sfida = null, nomi = {};
const $ = (id) => document.getElementById(id);
const annuncia = (t) => { if (typeof document !== "undefined") msg(t); };
const msg = (t, e) => { $("a-msg").textContent = t || ""; $("a-msg").className = e ? "errore" : ""; };
// Piccolo costruttore di elementi: solo textContent, mai HTML da dati.
function el(tag, prop, ...figli) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(prop || {})) {
    if (k === "testo") n.textContent = v;
    else if (k.startsWith("data-") || k === "aria-label" || k === "for") n.setAttribute(k, v);
    else n[k] = v;
  }
  for (const f of figli) if (f != null) n.append(f);
  return n;
}
const td = (etichetta, ...figli) => el("td", { "data-etichetta": etichetta }, ...figli);

async function admin(corpo) {
  const { data: d } = await sb.auth.getSession();
  const r = await fetch(SB_URL + "/functions/v1/admin", { method: "POST",
    headers: { "content-type": "application/json", apikey: SB_KEY, authorization: "Bearer " + (d.session ? d.session.access_token : "") },
    body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.errore || "errore " + r.status);
  return j;
}

async function entra() {
  msg("");
  const { error } = await sb.auth.signInWithPassword({ email: $("a-email").value.trim(), password: $("a-password").value });
  $("a-password").value = "";
  if (error) { msg("Email o password non giuste.", true); return; }
  const { data: f, error: e2 } = await sb.auth.mfa.listFactors();
  if (e2) { msg("Non riesco a leggere la verifica in due passaggi.", true); return; }
  fattore = (f.totp || []).find((x) => x.status === "verified") || null;
  if (!fattore) {
    const { data: n, error: e3 } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "10+ admin " + Date.now() });
    if (e3) { msg("Non riesco a preparare la verifica in due passaggi: " + e3.message, true); return; }
    fattore = n;
    $("a-qr-totp").replaceChildren(el("img", { src: n.totp.qr_code, alt: "QR per l'app di autenticazione", width: 200, height: 200 }));
    $("a-segreto").textContent = n.totp.secret; $("a-nuovo").hidden = false;
  }
  const { data: c, error: e4 } = await sb.auth.mfa.challenge({ factorId: fattore.id });
  if (e4) { msg("Non riesco a chiedere il codice: " + e4.message, true); return; }
  sfida = c;
  $("a-accesso").hidden = true; $("a-totp").hidden = false; $("a-codice").focus();
}

async function verifica() {
  msg("");
  const { error } = await sb.auth.mfa.verify({ factorId: fattore.id, challengeId: sfida.id, code: $("a-codice").value.trim() });
  $("a-codice").value = "";
  if (error) { msg("Codice non giusto. Riprova con quello nuovo.", true); const { data: c } = await sb.auth.mfa.challenge({ factorId: fattore.id }); sfida = c; return; }
  $("a-totp").hidden = true; $("a-nuovo").hidden = true;
  $("a-segreto").textContent = ""; $("a-qr-totp").replaceChildren(); // il segreto TOTP non resta nella pagina
  try { await disegna(); $("a-pannello").hidden = false; $("a-esci").hidden = false; $("a-esci").focus(); }
  catch (e) { msg(/amministratore/.test(e.message) ? "Verifica fatta. Il ruolo di amministratore non c'è ancora: va assegnato con SQL, poi esci e rientra." : "Non riesco a leggere i dati: " + e.message, true); }
}

function disegnaInvito(codice) {
  const box = $("a-invito");
  if (!codice) { box.replaceChildren(el("p", { className: "vuoto", testo: "—" })); return; }
  const link = SITO_ADMIN + "?invito=" + encodeURIComponent(codice);
  const qr = el("div", { className: "qr", hidden: true, "aria-label": "QR del link d'invito" });
  qr.setAttribute("role", "img");
  const copia = el("button", { type: "button", className: "azione", testo: "Copia il link" });
  copia.onclick = async () => {
    try { await navigator.clipboard.writeText(link); msg("Link copiato."); }
    catch (e) { msg("Non riesco a copiare: tieni premuto sul link qui sotto e copialo.", true); }
  };
  const mostra = el("button", { type: "button", testo: "Mostra il QR" });
  mostra.onclick = () => mostraQr(link, qr);
  box.replaceChildren(el("span", { className: "invito-codice", testo: codice }), el("code", { className: "invito-link", testo: link }),
    el("div", { className: "riga" }, copia, mostra), qr);
}
function caricaQr() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = QR_JS.src; s.integrity = QR_JS.integrity; s.crossOrigin = "anonymous";
    s.onload = ok; s.onerror = () => no(new Error("QR non caricato"));
    document.head.appendChild(s);
  });
}
async function mostraQr(link, box) {
  try {
    await caricaQr();
    const q = window.qrcode(0, "M"); q.addData(link); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); // SVG della libreria con SRI, nessun dato dell'utente
    box.hidden = false;
  } catch (e) { msg("Non riesco a disegnare il QR. Controlla la connessione e riprova.", true); }
}

function rigaFamiglia(f) {
  const nome = ((f.nome || "") + " " + (f.cognome || "")).trim() || "Genitore senza nome";
  const chi = td("Genitore e figli", el("b", { testo: nome }), el("br"), el("span", { className: "aiuto", testo: f.email || "" }));
  if (!f.mail_confermata) chi.append(el("br"), el("span", { className: "nota", testo: "✕ Mail non confermata" }));
  chi.append(el("ul", { className: "figli" }, ...(f.figli.length ? f.figli.map((s) => el("li", {}, el("b", { testo: s.nome }),
    " · " + (s.nome_utente || "—") + (s.classe ? " · " + s.classe + "ª" : "") + " · ultimo accesso " + dataIt(s.ultimo_accesso)))
    : [el("li", { testo: "Nessun figlio" })])));
  chi.className = "titolo";
  const iscr = td("Iscrizione", dataIt(f.creato), f.invitata_da_email ? el("span", { className: "aiuto", testo: " · invitata da " + f.invitata_da_email }) : null);
  const ai = el("input", { type: "number", min: 0, max: 1000, value: f.limite_aiuti, inputMode: "numeric", id: "lim-a-" + f.id });
  const ch = el("input", { type: "number", min: 0, max: 10000, value: f.limite_chiamate, inputMode: "numeric", id: "lim-c-" + f.id });
  const salva = el("button", { type: "button", testo: "Salva" });
  salva.onclick = () => azione({ azione: "imposta", famiglia_id: f.id, limite_aiuti: Number(ai.value), limite_chiamate: Number(ch.value) }, "Limiti salvati.");
  const lim = td("Limiti al giorno", el("div", { className: "limiti" }, el("label", { for: ai.id, testo: "aiuti" }), ai,
    el("label", { for: ch.id, testo: "richieste" }), ch, salva));
  const attiva = f.stato === "attiva";
  const azioni = el("div", { className: "azioni" });
  if (attiva) {
    const b = el("button", { type: "button", className: "pericolo", testo: "Sospendi" });
    b.onclick = () => confermaInPagina(b, "Tocca ancora per sospendere", () => azione({ azione: "stato", famiglia_id: f.id, stato: "sospesa" }, "Famiglia sospesa."));
    azioni.append(b);
  } else {
    const b = el("button", { type: "button", testo: "Riattiva" });
    b.onclick = () => azione({ azione: "stato", famiglia_id: f.id, stato: "attiva" }, "Famiglia riattivata.");
    azioni.append(b);
  }
  if (f.esterna && !f.mail_confermata) {
    const b = el("button", { type: "button", className: "pericolo", testo: "Elimina iscrizione" });
    b.onclick = () => confermaInPagina(b, "Tocca ancora: non si annulla", () => azione({ azione: "elimina_famiglia", famiglia_id: f.id }, "Iscrizione eliminata."));
    azioni.append(b);
  }
  const stato = td("Stato", el("span", { className: "stato " + (attiva ? "attiva" : "sospesa"), testo: attiva ? "● Attiva" : "✕ Sospesa" }), azioni);
  return el("tr", {}, chi, td("Tipo", f.tipo), iscr, lim, stato);
}

async function disegna() {
  const [r, c, g] = await Promise.all([admin({ azione: "riepilogo" }), admin({ azione: "consumi" }), admin({ azione: "registro" })]);
  nomi = Object.fromEntries(r.figli.map((s) => [s.id, s.nome + (s.cognome ? " " + s.cognome : "")]));
  const n = fasciaNumeri(r, c);
  $("a-n-posti").textContent = n.posti; $("a-n-oggi").textContent = n.oggi; $("a-n-mese").textContent = n.mese;
  $("a-n-mese-et").textContent = "costo stimato di " + meseIt();
  $("a-nuovi-posti").value = r.posti_esterni;
  disegnaInvito(r.invito);
  const { famiglie, senzaFamiglia } = righeFamiglie(r);
  $("a-famiglie").replaceChildren(...famiglie.map(rigaFamiglia));
  $("a-senza-famiglia").replaceChildren(...(senzaFamiglia.length ? [el("p", { className: "aiuto", testo: "Profili senza famiglia: " +
    senzaFamiglia.map((s) => s.nome + " (" + (s.nome_utente || "—") + ")").join(", ") })] : []));
  $("a-profilo").replaceChildren(...r.figli.map((s) => el("option", { value: s.id, testo: nomi[s.id] + " (" + (s.nome_utente || "") + ")" })));
  $("a-consumi").replaceChildren(...(c.righe.length ? c.righe.map((x) => el("tr", {}, td("Giorno", x.giorno), td("Profilo", nomi[x.studente_id] || x.studente_id),
    td("Richieste", String(x.chiamate)), td("Costo stimato", dollari(x.costo))))
    : [el("tr", {}, el("td", { colSpan: 4, className: "vuoto", testo: "Nessuna richiesta negli ultimi 30 giorni" }))]));
  disegnaRegistro(g.righe);
}
function disegnaRegistro(righe) {
  $("a-registro").replaceChildren(...righe.map((x) => el("tr", {}, td("Quando", dataIt(x.creato)), td("Profilo", nomi[x.studente_id] || x.studente_id), td("Motivo", x.motivo))));
  $("a-registro-vuoto").hidden = righe.length > 0;
  $("a-tab-registro").hidden = righe.length === 0;
}

async function azione(corpo, ok) {
  msg("");
  try { await admin(corpo); await disegna(); msg(ok); }
  catch (e) { msg(e.message === "posti_esauriti" ? "Posti pieni: alza prima il tetto dei posti." : "Non riuscito: " + e.message, true); }
}

async function apriContenuti() {
  msg("");
  try {
    const r = await admin({ azione: "contenuti", studente_id: $("a-profilo").value, motivo: $("a-motivo").value });
    const det = el("details", {}, el("summary", { testo: "Dettaglio completo" }), el("pre", { className: "contenuti", testo: JSON.stringify(r, null, 2) }));
    $("a-contenuti").replaceChildren(el("p", { testo: (r.argomenti || []).length + " argomenti, " + (r.sessioni || []).length + " prove" }), det);
    disegnaRegistro((await admin({ azione: "registro" })).righe);
    msg("Contenuti aperti: l'accesso è registrato.");
  } catch (e) { msg(e.message === "servono profilo e motivo" ? "Scrivi il motivo: viene registrato." : "Non riuscito: " + e.message, true); }
}

function avvia() {
  sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: true, storageKey: "sb-verifiche-admin" } });
  $("a-entra").onclick = entra;
  $("a-password").onkeydown = (e) => { if (e.key === "Enter") entra(); };
  $("a-verifica").onclick = verifica;
  $("a-codice").onkeydown = (e) => { if (e.key === "Enter") verifica(); };
  $("a-salva-posti").onclick = () => azione({ azione: "imposta", posti_esterni: Number($("a-nuovi-posti").value) }, "Tetto salvato.");
  $("a-apri").onclick = apriContenuti;
  $("a-esci").onclick = async () => { await sb.auth.signOut({ scope: "local" }).catch(() => {}); location.reload(); };
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("a-entra")) avvia();
