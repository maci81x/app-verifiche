// Pagina admin (issue #34): logica pura di admin.js, caricata con vm senza DOM, e regole di sicurezza sul sorgente.
//   node --test test/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const leggi = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const ctx = vm.createContext({ console, Date, JSON, Math, setTimeout, clearTimeout });
vm.runInContext(leggi("soldi.js"), ctx);
vm.runInContext(leggi("admin.js"), ctx); // senza #a-entra la pagina non parte
const run = (e) => vm.runInContext(e, ctx);

const RIEPILOGO = {
  posti_esterni: 2, posti_occupati: 1, invito: "abcd2345",
  famiglie: [
    { id: "f1", genitore_id: "g1", nome: "Rita", cognome: "Rossi", email: "rita@example.org", esterna: false, prova: false, stato: "attiva", limite_aiuti: 30, limite_chiamate: 150, creato: "2026-10-25T10:00:00Z", mail_confermata: true, invitata_da_email: null },
    { id: "f2", genitore_id: "g2", nome: "Carla", cognome: "Verdi", email: "carla@example.org", esterna: true, prova: false, stato: "sospesa", limite_aiuti: 10, limite_chiamate: 60, creato: "2026-11-19T10:00:00Z", mail_confermata: false, invitata_da_email: "rita@example.org" },
  ],
  figli: [
    { id: "s1", nome: "Anna", nome_utente: "anna", classe: "3", famiglia_id: "f1", ultimo_accesso: null },
    { id: "s2", nome: "Bea", nome_utente: "bea-k7m", classe: "2", famiglia_id: "f1", ultimo_accesso: "2026-11-19T08:00:00Z" },
    { id: "s3", nome: "Leo", nome_utente: "leo-x2z", classe: "1", famiglia_id: "f2", ultimo_accesso: null },
    { id: "s4", nome: "Orfano", nome_utente: "orf-abc", classe: null, famiglia_id: null, ultimo_accesso: null },
  ],
};

test("fascia dei numeri: posti occupati su tetto, richieste di oggi, costo del mese in dollari", () => {
  const f = JSON.parse(run(`JSON.stringify(fasciaNumeri(${JSON.stringify(RIEPILOGO)}, { oggi: { chiamate: 4, costo: 0.000668 }, mese: { chiamate: 30, costo: 0.000668 } }))`));
  assert.deepEqual(f, { posti: "1 / 2", oggi: "4", mese: "0,0007 $" });
  const vuota = JSON.parse(run(`JSON.stringify(fasciaNumeri({ posti_esterni: 2, posti_occupati: 0 }, null))`));
  assert.deepEqual(vuota, { posti: "0 / 2", oggi: "0", mese: "0,00 $" });
});

test("famiglie con i figli annidati; i profili senza famiglia restano visibili a parte", () => {
  const r = JSON.parse(run(`JSON.stringify(righeFamiglie(${JSON.stringify(RIEPILOGO)}))`));
  assert.deepEqual(r.famiglie.map((f) => [f.id, f.figli.map((s) => s.nome)]), [["f1", ["Anna", "Bea"]], ["f2", ["Leo"]]]);
  assert.deepEqual(r.senzaFamiglia.map((s) => s.nome), ["Orfano"]);
  assert.equal(r.famiglie[1].tipo, "esterna");
  assert.equal(r.famiglie[0].tipo, "esistente");
});

test("conferma scritta nella pagina: il primo tocco chiede conferma, il secondo esegue, dopo 4 secondi si torna indietro", async () => {
  const b = { textContent: "Sospendi", dataset: {}, attivo: false };
  run("chiamate = 0");
  ctx.btn = b;
  run(`confermaInPagina(btn, "Tocca ancora per sospendere", () => { chiamate++; }, 30)`);
  assert.equal(b.textContent, "Tocca ancora per sospendere");
  assert.equal(run("chiamate"), 0);
  run(`confermaInPagina(btn, "Tocca ancora per sospendere", () => { chiamate++; }, 30)`);
  assert.equal(run("chiamate"), 1);
  assert.equal(b.textContent, "Sospendi");
  run(`confermaInPagina(btn, "Tocca ancora per sospendere", () => { chiamate++; }, 30)`);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(b.textContent, "Sospendi", "scaduta la conferma, il testo torna com'era");
  run(`confermaInPagina(btn, "Tocca ancora per sospendere", () => { chiamate++; }, 30)`);
  assert.equal(run("chiamate"), 1, "dopo la scadenza serve di nuovo il doppio tocco");
});

test("sicurezza della pagina: niente salvato sul dispositivo, niente popup, stesso QR dell'app, fuori dalla cache", () => {
  const js = leggi("admin.js"), html = leggi("admin.html");
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB/);
  assert.match(js, /persistSession: false/);
  assert.doesNotMatch(js, /\b(confirm|alert|prompt)\(/);
  const qr = /src: "(https:\/\/cdnjs[^"]+qrcode[^"]+)",\s*integrity: "(sha384-[^"]+)"/;
  const app = qr.exec(leggi("famiglia.js")), admin = qr.exec(js);
  assert.ok(app && admin, "manca il QR");
  assert.deepEqual(admin.slice(1), app.slice(1), "il QR dell'admin deve essere lo stesso dell'app (URL e SRI)");
  assert.match(leggi("sw.js"), /\/admin\\\.\(html\|js\)\$\/\.test\(url\.pathname\)\) return;/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /soldi\.js\?v=\d+/);
  assert.match(html, /Nessun accesso ai contenuti finora/);
});

test("testi della pagina admin: forme neutre, niente asterischi, niente «Sbagliato»", () => {
  const testi = leggi("admin.js") + leggi("admin.html");
  for (const p of [/\bsicura\b/i, /\bpronta\b/i, /\bbrava\b/i, /\bragazza\b/i, /\bSbagliato\b/, /[a-zà]\*(?=[\s.,;:!?"])/i])
    assert.doesNotMatch(testi, p, String(p));
});
