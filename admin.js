// Pannello dell'amministratore (issue #30). La pagina non decide niente: ogni dato e ogni azione passano dalla Edge
// Function `admin`, che pretende app_metadata.ruolo = "admin" e la verifica in due passaggi fatta (aal2).
// Primo accesso: si registra il TOTP (Supabase Auth MFA) PRIMA che il ruolo admin venga assegnato con SQL.
"use strict";
const SB_URL = "https://nnzkmjpylwtinplepxgz.supabase.co";
const SB_KEY = "sb_publishable_WTCYzSgAc_rVk7r04sdT8w_VFUwzFHJ";
const $ = (id) => document.getElementById(id);
const msg = (t, e) => { $("a-msg").textContent = t || ""; $("a-msg").className = e ? "errore" : ""; };
const cella = (tr, t) => { const td = document.createElement("td"); td.textContent = t == null ? "—" : String(t); tr.appendChild(td); return td; };
const data = (iso) => (iso ? new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: true, storageKey: "sb-verifiche-admin" } });
let fattore = null, sfida = null, nomi = {};

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
    const img = document.createElement("img"); img.src = n.totp.qr_code; img.alt = "QR per l'app di autenticazione"; img.width = 200; img.height = 200;
    $("a-qr").replaceChildren(img); $("a-segreto").textContent = n.totp.secret; $("a-nuovo").hidden = false;
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
  try { await disegna(); $("a-pannello").hidden = false; }
  catch (e) { msg(/amministratore/.test(e.message) ? "Verifica fatta. Il ruolo di amministratore non c'è ancora: va assegnato con SQL, poi esci e rientra." : "Non riesco a leggere i dati: " + e.message, true); }
}

async function disegna() {
  const [r, c, g] = await Promise.all([admin({ azione: "riepilogo" }), admin({ azione: "consumi" }), admin({ azione: "registro" })]);
  nomi = Object.fromEntries(r.figli.map((s) => [s.id, s.nome + (s.cognome ? " " + s.cognome : "")]));
  $("a-posti").textContent = "Occupati " + r.posti_occupati + " su " + r.posti_esterni + " (contano le famiglie esterne attive non di prova; le iscrizioni mai confermate si cancellano dopo 24 ore).";
  $("a-nuovi-posti").value = r.posti_esterni;
  $("a-invito").textContent = r.invito ? "https://maci81x.github.io/app-verifiche/?invito=" + r.invito : "—";

  $("a-famiglie").replaceChildren(...r.famiglie.map((f) => {
    const tr = document.createElement("tr");
    cella(tr, (f.nome || "") + " " + (f.cognome || "") + " · " + (f.email || "") + (f.mail_confermata ? "" : " (mail non confermata)"));
    cella(tr, f.esterna ? (f.prova ? "esterna, di prova" : "esterna") : "esistente");
    cella(tr, data(f.creato));
    cella(tr, f.invitata_da_email || "—");
    const lim = cella(tr, "");
    const ai = document.createElement("input"); ai.type = "number"; ai.value = f.limite_aiuti; ai.setAttribute("aria-label", "Aiuti al giorno"); ai.style.maxWidth = "80px";
    const ch = document.createElement("input"); ch.type = "number"; ch.value = f.limite_chiamate; ch.setAttribute("aria-label", "Richieste al giorno"); ch.style.maxWidth = "90px";
    const sv = document.createElement("button"); sv.type = "button"; sv.textContent = "Salva";
    sv.onclick = () => azione({ azione: "imposta", famiglia_id: f.id, limite_aiuti: Number(ai.value), limite_chiamate: Number(ch.value) }, "Limiti salvati.");
    lim.replaceChildren(document.createTextNode("aiuti "), ai, document.createTextNode(" richieste "), ch, sv);
    const st = cella(tr, f.stato + " ");
    const b = document.createElement("button"); b.type = "button"; b.textContent = f.stato === "attiva" ? "Sospendi" : "Riattiva";
    b.onclick = () => azione({ azione: "stato", famiglia_id: f.id, stato: f.stato === "attiva" ? "sospesa" : "attiva" }, "Stato cambiato.");
    st.appendChild(b);
    if (f.esterna && !f.mail_confermata) {
      const el = document.createElement("button"); el.type = "button"; el.textContent = "Elimina iscrizione";
      el.onclick = () => azione({ azione: "elimina_famiglia", famiglia_id: f.id }, "Iscrizione eliminata.");
      st.appendChild(el);
    }
    return tr;
  }));

  $("a-figli").replaceChildren(...r.figli.map((s) => { const tr = document.createElement("tr"); cella(tr, nomi[s.id]); cella(tr, s.nome_utente); cella(tr, s.classe); cella(tr, data(s.ultimo_accesso)); return tr; }));
  $("a-profilo").replaceChildren(...r.figli.map((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = nomi[s.id] + " (" + (s.nome_utente || "") + ")"; return o; }));
  $("a-consumi").replaceChildren(...c.righe.map((x) => { const tr = document.createElement("tr"); cella(tr, x.giorno); cella(tr, nomi[x.studente_id] || x.studente_id); cella(tr, x.chiamate); cella(tr, x.costo.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $"); return tr; }));
  $("a-registro").replaceChildren(...g.righe.map((x) => { const tr = document.createElement("tr"); cella(tr, data(x.creato)); cella(tr, nomi[x.studente_id] || x.studente_id); cella(tr, x.motivo); return tr; }));
}

async function azione(corpo, ok) {
  msg("");
  try { await admin(corpo); msg(ok); await disegna(); }
  catch (e) { msg(e.message === "posti_esauriti" ? "Posti pieni: alza prima il tetto." : "Non riuscito: " + e.message, true); }
}

$("a-entra").onclick = entra;
$("a-password").onkeydown = (e) => { if (e.key === "Enter") entra(); };
$("a-verifica").onclick = verifica;
$("a-codice").onkeydown = (e) => { if (e.key === "Enter") verifica(); };
$("a-salva-posti").onclick = () => azione({ azione: "imposta", posti_esterni: Number($("a-nuovi-posti").value) }, "Tetto salvato.");
$("a-apri").onclick = async () => {
  msg("");
  try {
    const r = await admin({ azione: "contenuti", studente_id: $("a-profilo").value, motivo: $("a-motivo").value });
    $("a-contenuti").textContent = JSON.stringify(r, null, 2);
    const g = await admin({ azione: "registro" });
    $("a-registro").replaceChildren(...g.righe.map((x) => { const tr = document.createElement("tr"); cella(tr, data(x.creato)); cella(tr, nomi[x.studente_id] || x.studente_id); cella(tr, x.motivo); return tr; }));
  } catch (e) { msg(e.message === "servono profilo e motivo" ? "Scrivi il motivo: viene registrato." : "Non riuscito: " + e.message, true); }
};
$("a-esci").onclick = async () => { await sb.auth.signOut({ scope: "local" }).catch(() => {}); location.reload(); };
