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

## Controllo mattutino (avviso guasti)
- Il workflow `.github/workflows/controllo-mattutino.yml` gira ogni mattina alle 5:30 UTC ed esegue `scripts/sentinella.mjs`. Lo script fa chiamate di prova a:
  - il sito;
  - `accedi` (elenco);
  - `modello` (uno smistamento, che non consuma aiuti);
  - `profili` (consumo, con il genitore di prova).
- Se una chiamata risponde male o supera il suo tempo, il workflow fallisce e GitHub manda la mail.
- Le credenziali dei profili di prova stanno solo nei **Secrets** del repo, mai nel codice né nei log.
- Per provare che la mail arriva: Actions → Controllo mattutino → Run workflow → «Fai fallire apposta».
- GitHub spegne i workflow pianificati dopo 60 giorni senza commit nel repo, avvisando per mail: in quel caso va riattivato da Actions.

## Copia di sicurezza
**Dove e quando.** La copia si fa sul Mac, **mai su GitHub** (il repo è pubblico), in `~/Backup/app-verifiche/AAAA-MM-GG/`.
- La fa launchd ogni domenica. Se il Mac era spento, la fa alla prima accensione dopo.
- Si tengono le ultime 4 copie. La copia `prima-delle-migration-2026-11-16` non si tocca mai.
- Installazione o aggiornamento: `bash scripts/installa-copia.sh` (`--togli` per disinstallarla).
- Log: `~/Backup/app-verifiche/copia.log`.
- Per farla subito: `FORZA=1 bash ~/Backup/app-verifiche/.bin/copia-sicurezza.sh`.

**Contenuto di ogni copia:**
- `ruoli.sql`, `schema.sql`, `dati.sql`: come `supabase db dump`;
- `interno.sql`: schema di auth e storage;
- `foto/`: il bucket `fonti`;
- `conteggi.tsv` e `foto.tsv`: righe per tabella ed elenco delle foto al momento della copia;
- `MANIFESTO.txt`.

**Prova di ripristino, su una copia e mai sul progetto vero.** Serve `brew install postgresql@17`, poi:
```
bash scripts/ripristina-prova.sh ~/Backup/app-verifiche/AAAA-MM-GG
```
Lo script ricrea tutto in un Postgres locale temporaneo, confronta le righe di ogni tabella e le foto, e deve finire con «RIPRISTINO RIUSCITO».

**Ripristino vero, su un progetto Supabase nuovo.** È irreversibile per il progetto di destinazione: si fa solo dopo l'ok del proprietario. Usa `env -u SUPABASE_ACCESS_TOKEN -u SUPABASE_PROJECT_REF` per ogni comando `supabase`.
1. Crea il progetto e prendi la stringa di connessione (Settings → Database). Poi:
   ```
   psql "$URL" -f ruoli.sql
   psql "$URL" -f schema.sql
   psql "$URL" -c 'SET session_replication_role = replica' -f dati.sql
   ```
   `interno.sql` non serve: auth e storage li ha già il progetto nuovo.
2. Ricarica le foto, dalla cartella della copia, in un progetto collegato a quello nuovo (`supabase link --project-ref <nuovo>`):
   ```
   supabase storage cp -r foto/ ss:///fonti --experimental --linked
   ```
3. Ripubblica le funzioni (`modello`, `profili`, `accedi`), rimetti i segreti (`ANTHROPIC_API_KEY`) e aggiorna URL e chiave pubblica in `index.html` e nei Secrets del repo.
