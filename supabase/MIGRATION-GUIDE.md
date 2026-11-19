# Guida alle migration

Regole per le tabelle nuove (diario, piano, ripasso guidato, "5 cose da sapere" e le prossime).
Lo schema di riferimento è `20261030160000_spiegazioni.sql`: copia quello.

## 1. Il file

- Crealo con `env -u SUPABASE_ACCESS_TOKEN supabase migration new nome_in_snake_case`. Mai inventare il timestamp.
- Solo aggiunte: tabelle, colonne con default, indici, policy, revoke. Niente `drop`, niente rename,
  niente vincoli nuovi su colonne che hanno già righe.
- In testa un commento: issue, cosa salva, chi scrive (app con i permessi di chi studia o Edge Function).
- La migration la applica Roby. Chi scrive codice non fa `db push` e non usa `apply_migration`.

## 2. La tabella

- Nomi in italiano, minuscolo, plurale (`diari`, `piani`, `ripassi`). Colonne come le altre:
  `studente_id`, `argomento_id`, `creato`, `generata`.
- `studente_id uuid not null default auth.uid()`.
- Chiave esterna **composta** verso il genitore: `foreign key (argomento_id, studente_id) references
  public.argomenti (id, studente_id) on delete cascade`. Così il database rifiuta il collegamento
  a un argomento di un altro profilo (le policy controllano solo `studente_id`).
- Se la tabella farà da genitore ad altre: `unique (id, studente_id)`.
- Una riga per argomento o concetto (cache rigenerabile, es. "5 cose da sapere"):
  `unique (argomento_id, studente_id)`; la rigenerazione è un upsert su quel vincolo.
- Un JSON: `check (jsonb_typeof(colonna) = 'object')`.
- Una tabella appesa direttamente a `studenti` (es. un diario non legato a un argomento):
  `references public.studenti (id) on delete cascade`, e vedi il punto 6.

## 3. Indici

- Ogni chiave esterna ha un indice che **parte dalle stesse colonne**, nello stesso ordine:
  `create index diari_argomento on public.diari (argomento_id, studente_id);`.
  Un `unique (argomento_id, studente_id)` vale già come indice.
- Nome: `tabella_scopo` (`domande_sessione`, `sessioni_storico`).
- L'elenco di chi studia: indice su `(studente_id, <colonna di ordinamento> desc)`.
- Niente indici "per sicurezza": ogni indice rallenta le scritture.

## 4. RLS e permessi

Sempre, in quest'ordine:

```sql
alter table public.diari enable row level security;

create policy leggi on public.diari for select to authenticated
  using (app.posso_leggere(studente_id));            -- lei e il genitore collegato
create policy crea on public.diari for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.diari for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.diari for delete to authenticated
  using (studente_id = (select auth.uid()));

revoke all on public.diari from anon;
revoke truncate on public.diari from authenticated;   -- truncate scavalca RLS
grant select, insert, update, delete on public.diari to authenticated;
```

- `auth.uid()` sempre dentro `(select ...)`: si calcola una volta per query, non per riga.
- Sempre `to authenticated` più il confronto con `studente_id`. Mai `auth.role()`, mai
  `user_metadata` (chi studia lo può scrivere). Il ruolo vive in `app_metadata`.
- Update sempre con `using` **e** `with check`.
- Il genitore legge e non scrive: nessuna policy di scrittura per lui.
- Dati solo di chi studia (come le foto in `fonti`): `leggi` con `studente_id = (select auth.uid())`
  invece di `app.posso_leggere`.
- Tabella scritta solo dal server (come `report`): solo la policy `leggi`, nessun grant di scrittura.
- I grant espliciti servono: i default del progetto oggi danno tutto anche ad `anon`, e Supabase
  sta togliendo l'esposizione automatica delle tabelle nuove. Con revoke + grant scritti la
  migration fa la stessa cosa in entrambi i casi.

## 5. Funzioni

- Di default `security invoker` e `set search_path = ''`, con i nomi completi (`public.argomenti`,
  `extensions.crypt`).
- `security definer` solo se serve davvero scavalcare RLS (es. `app.posso_leggere`), e allora:
  schema `app` (non esposto), controllo su `auth.uid()` nel corpo, `search_path = ''`.
- Subito dopo ogni `create function`:
  `revoke all on function ... from public, anon;` e `grant execute ... to authenticated;`
  (o `to service_role` se la chiama solo una Edge Function).
  Le funzioni nuove in `public` nascono eseguibili da tutti, `anon` compreso.
- Trigger che toccano l'argomento: riusa `app.tocca_argomento()`.
- Viste: `with (security_invoker = true)`, altrimenti scavalcano RLS.

## 6. Cosa aggiornare insieme alla migration

- `supabase/functions/profili/index.ts`, costante `TABELLE`: aggiungi la tabella nuova, altrimenti
  il controllo "0 righe dopo l'eliminazione" non la vede.
- `public.svuota_memoria()` cancella sessioni e argomenti, il resto va via a cascata. Una tabella
  appesa direttamente a `studenti` va aggiunta lì (nuova migration con `create or replace`).
- Edge Function `modello`: per leggere usa `comeUtente(req)` (valgono le policy). La service role
  (`amministratore()`, `admin()`) solo per `auth.admin` e per le operazioni del genitore.

## 7. Test dei permessi

In `test/db/rls.test.js` una `prova(...)` per ogni tabella nuova, copiando quella di `spiegazioni`:

- chi studia crea, legge, rigenera (upsert), il check sul JSON blocca un valore sbagliato;
- la sorella: conta 0, insert sull'argomento dell'altra → `foreign_key_violation`,
  insert a nome dell'altra → `insufficient_privilege`, update e delete toccano 0 righe;
- il genitore legge e non modifica; l'anonimo → `insufficient_privilege`;
- cancellare il genitore (argomento o concetto) cancella la riga.

I test girano sul progetto vero, dentro una transazione chiusa da `rollback`, con
`SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node --test test/db/rls.test.js`. Non c'è un
Postgres locale (niente Docker). Senza le due variabili i test vengono saltati. I test nuovi
passano solo dopo che Roby ha applicato la migration.

## 8. Dopo l'applicazione

Advisor di sicurezza e prestazioni (`get_advisors` o dashboard): nessun avviso nuovo.
Avvisi noti e accettati: `pin_profili`, `impostazioni` e `accessi_admin` senza policy (voluto: le
leggono e scrivono solo le Edge Function con la service role, issue #30), le fk composte coperte da un
indice che parte da `argomento_id`, `sessione_id` o `domanda_id` (colonna quasi unica, basta) e gli
indici appena creati segnati come «non usati» finché non arriva traffico.

Prima di applicare una migration: `bash scripts/prova-migration.sh <copia> <migration>` la prova su una
copia ripristinata in locale, con i test dei permessi (issue #30).
