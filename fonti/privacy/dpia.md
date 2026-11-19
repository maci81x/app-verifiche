# Valutazione d'impatto (DPIA) · nota preliminare · 10+ (issue #30)

> Nota tecnica per il legale, non una DPIA completa. Una DPIA è consigliata: dati di minori trattati con un sistema di intelligenza artificiale, anche se su piccola scala (al massimo 2 famiglie esterne oltre a quella del titolare).

## Descrizione

10+ è una PWA per ragazze e ragazzi della scuola media (10-14 anni). Fotografano gli appunti; un modello di IA (Anthropic) li trascrive e prepara verifiche, correzioni e spiegazioni. Il genitore crea i profili, vede i risultati in sola lettura, può esportare e cancellare tutto. Dati su Supabase (UE, Francoforte).

## Necessità e proporzionalità

- Dati minimi: nessun telefono (né del genitore né del figlio), nessuna data di nascita, nessuna geolocalizzazione.
- Nome utente generato (nome + 3 caratteri), codice a 4 cifre cifrato.
- Consenso del genitore registrato con versione dei testi; spunte non preselezionate.
- Portabilità (export JSON) e cancellazione self-service.

## Rischi e misure

| Rischio | Probabilità / gravità (prima) | Misure | Rischio residuo |
|---|---|---|---|
| Una famiglia vede i dati di un'altra | Media / alta | RLS per profilo e famiglia; test dei permessi tra famiglie diverse sul database vero (32 su 32 il 19/11) | Basso |
| Accesso al profilo di un minore indovinando il codice | Media / alta | Blocco dopo 5 errori, attesa fino a 24 ore che non si azzera aspettando (~1,75% in 30 giorni al ritmo massimo); avviso al genitore; nuovo nome utente | Basso-medio: valutare codici più lunghi per le famiglie esterne |
| Errori dell'IA presentati come veri | Alta / media | Domande solo dagli appunti con filtro di ancoraggio; conti ricontrollati sul server; avviso esplicito che l'IA può sbagliare | Medio |
| Trasferimento extra-UE (Anthropic) | Certa / media | Clausole contrattuali standard; dati via API non usati per l'addestramento; solo il testo necessario | Medio: da documentare con il DPA |
| Accesso dell'amministratore ai contenuti | Bassa / alta | Pannello con TOTP; motivo obbligatorio; registro scritto prima di mostrare i dati | Basso; resta l'accesso tecnico diretto dalla dashboard, dichiarato |
| Abuso delle iscrizioni (costi, posti) | Media / bassa | Inviti; tetto con lucchetto; codici di prova monouso; limiti giornalieri; tetto delle chiamate atomico | Basso |
| Perdita di dati | Bassa / alta | Copie settimanali sul Mac (4 settimane), prova di ripristino, migration provate su copia | Basso |

## Da fare prima dell'apertura

1. Dati del titolare e mail dedicata (punto aperto sulla #30).
2. Revisione legale di informativa, condizioni, registro e di questa nota.
3. Account Resend, SMTP in Supabase Auth, prova di una mail vera, poi `MAIL_PRONTA = si`.
4. Decisioni su conservazione dei consensi e del registro admin.
