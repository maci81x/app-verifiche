# 10+ · regole per chi lavora sul repo

PWA per ragazz* di scuola media (10-14 anni):
- JavaScript vanilla: script classici con scope globale, caricati in ordine da `index.html`;
- ospitata su GitHub Pages;
- backend Supabase con la Edge Function `modello` (Claude) e le funzioni pure in `supabase/functions/_shared/`.

Le regole comuni di prodotto (voce, design, accuratezza) sono nella issue #17. Valgono sempre.

## Sicurezza e dati
- Questo repo è **pubblico**:
  - niente nomi reali, email, codici, password o foto vere;
  - nei test e nelle fixture solo nomi inventati (Anna, Bea…);
  - le credenziali di prova stanno in `.env.local`, che non entra nel repo.
- `docs/` e `prototipo/` sono **privati**: restano in `.gitignore` e non si committano mai. Il materiale da pubblicare va in `fonti/` (per esempio la tabella dei dati verificati e gli SQL per annullare le migration).
- Prima di ogni commit: `git status`, perché non devono entrare `docs/`, `SPEC.md`, screenshot o dati personali.
- Niente dati personali verso servizi esterni.

## Supabase
- **Ogni comando `supabase`** si lancia con `env -u SUPABASE_ACCESS_TOKEN -u SUPABASE_PROJECT_REF`: nella shell ci sono variabili di un altro progetto.
  - Prima di pubblicare, controlla che `supabase projects list` mostri il progetto giusto.
  - Pubblicazione: `env -u SUPABASE_ACCESS_TOKEN -u SUPABASE_PROJECT_REF supabase functions deploy modello --project-ref <ref> --use-api`.
- `test/db/rls.test.js` usa le stesse due variabili e, se ci sono, gira sul database remoto. Per i test normali: `env -u SUPABASE_ACCESS_TOKEN -u SUPABASE_PROJECT_REF node --test test/*.test.js`.
- **Stop prima delle migration**:
  1. solo aggiunte;
  2. RLS come in `supabase/MIGRATION-GUIDE.md`;
  3. il SQL completo e il prima/dopo delle tabelle vanno mostrati al proprietario, aspettando l'ok;
  4. prima di applicare, copia di sicurezza (`db dump`) fuori dal repo e SQL per annullare in `fonti/rollback/`;
  5. dopo, controllo con query e test dei permessi.
- Le funzioni che contano le righe di una tabella nuova (per esempio `profili`) si pubblicano solo dopo la migration.

## Metodo
- Un branch per ticket (`ticket-N`), mai lavoro diretto su main.
- TDD: prima il test che fallisce, poi il codice.
- **Esito vero dei test**: si legge il codice di uscita (`echo $?`), non il riassunto. Si pubblica solo con i test verdi.
- Deploy della funzione `modello` solo con i test verdi e `deno check index.ts` a 0.
- A ogni rilascio si alza la cache in `sw.js` (`app-verifiche-vN` e tutti i `?v=N`) insieme ai `?v=N` di `index.html`: un test controlla che coincidano. Dopo il push, controlla che il sito online serva la versione nuova.
- Revisione di un agente indipendente prima del merge.
- Prova con il modello vero.
- Screenshot a 390×844 in chiaro e in scuro.
- Rapporto sulla issue, in italiano.

## Voce e contenuti (10-14 anni)
- Frasi corte, seconda persona, tono da compagno più grande.
- **Forme neutre di genere**: mai «sicura/pronta/stanca/brava», «alunna», «ragazza» nei testi e nei prompt. Si gira la frase («Ci sei», «chi studia»).
- «Non ancora» al posto di «Sbagliato». Complimenti solo precisi e veri.
- Niente numeri inventati: minuti, conteggi e percentuali vengono dai dati. Senza misure si mostrano i punti, non i minuti.

## Accuratezza
- **I conti si ricontrollano sul server**: un esercizio, un esempio o una scheda con un conto che non torna si scarta.
- Le frasi «del tuo quaderno» sono frasi vere della trascrizione e passano il filtro di ancoraggio (`_shared/ancoraggio.js`).
- Il web aiuta a spiegare (etichetta «dal web»), non genera domande.
- La ricerca web di Anthropic non raggiunge tutti i siti: raiplay.it, per esempio, risponde 400.
- I dati di geografia e storia vanno verificati su fonti affidabili (`fonti/da-verificare.md`).
- Le azioni che costano (compito, gemelli, poesia, INVALSI, esame, lezione, video, strumento) passano dal limite giornaliero degli aiuti: `prenotaAiuto`, poi `try/finally`, poi `restituisciAiuto`.
