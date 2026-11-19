# Registro dei trattamenti · 10+ (bozza, issue #30)

> Bozza tecnica da completare con il legale prima dell'apertura alle famiglie esterne. Segnaposto in **[QUADRE]**.

- **Titolare:** [TITOLARE], [EMAIL DEL TITOLARE]
- **Responsabile della protezione dei dati:** non previsto a questa scala, da valutare con il legale.
- **Data della bozza:** 2026-11-19 · testi accettati alla versione 2026-11-19 (`supabase/functions/_shared/consensi.js`).

| # | Trattamento | Interessati | Dati | Finalità | Base giuridica | Destinatari / responsabili | Trasferimenti extra-UE | Conservazione | Misure di sicurezza |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Account del genitore | Genitori | Nome, cognome, email, password cifrata, data di iscrizione, chi ha invitato | Gestire l'iscrizione su invito e l'accesso | Contratto (art. 6.1.b GDPR) | Supabase (UE, Francoforte) | No | Finché l'account è attivo; cancellazione entro 30 giorni dalla richiesta | Password cifrata da Supabase Auth, conferma email, RLS per famiglia |
| 2 | Profili dei figli | Minori 10-14 anni | Nome, cognome, classe, nome utente, codice a 4 cifre cifrato (bcrypt) | Far usare l'app a chi studia | Consenso del genitore (art. 8 GDPR, art. 2-quinquies Codice privacy) | Supabase | No | Come 1 | Codice cifrato, blocco crescente dopo 5 errori, RLS per profilo |
| 3 | Materiale di studio | Minori | Foto di appunti e compiti, trascrizioni, argomenti, domande, risposte, risultati, scadenze | Preparare verifiche, ripasso e spiegazioni | Consenso del genitore; contratto | Supabase; Anthropic (elaborazione con IA) | Sì, Anthropic (USA): clausole contrattuali standard; dati via API non usati per l'addestramento | Come 1; copie di sicurezza a rotazione di 4 settimane | Foto visibili solo a chi studia; RLS; nessuna decisione automatica con effetti giuridici |
| 4 | Consumi | Minori | Azione, modello, token, costo stimato per ogni richiesta all'IA | Limiti giornalieri, costi, futura tariffazione | Legittimo interesse (sostenibilità del servizio) | Supabase | No | Come 1 | Scritti solo dal server, letti dal genitore e dall'amministratore |
| 5 | Consensi | Genitori | Documento, versione, data e ora | Dimostrare il consenso (accountability) | Obbligo legale / art. 7.1 GDPR | Supabase | No | Oggi cancellati con l'account: **[da decidere con il legale se conservarne una traccia]** | Solo inserimento, mai modifica |
| 6 | Registro accessi dell'amministratore | Minori, amministratore | Chi, quando, quale profilo, motivo | Trasparenza degli accessi per assistenza | Legittimo interesse; accountability | Supabase | No | 12 mesi **[da confermare]** | Scritto prima di mostrare i contenuti; nessun contenuto nel registro |
| 7 | Mail di conferma | Genitori | Email | Confermare l'iscrizione | Contratto | Resend (SMTP di Supabase Auth) **[verificare regione e DPA]** | **[da verificare]** | Secondo la policy di Resend | Solo mail di servizio |

## Da completare con il legale

- Accordi sul trattamento (DPA) di Supabase, Anthropic, Resend: link e date di firma o accettazione.
- Conservazione dei consensi dopo la cancellazione dell'account.
- Durata del registro degli accessi dell'amministratore (oggi 12 mesi, da confermare).
- Pulizia automatica del registro dopo 12 mesi: oggi non c'è, va prevista (ticket da aprire).
- Accesso tecnico diretto del titolare al database (dashboard Supabase): dichiarato nell'informativa, va valutato.
