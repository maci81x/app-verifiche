-- Tipi di esercizio di matematica (issue #5, fetta #6).
--
-- Per le materie di matematica la ragazza sceglie "Teoria" (percorso di sempre, con i
-- concetti) o "Esercizi". Con "Esercizi" la Edge Function `modello` (azione esercizi_tipi)
-- riconosce i tipi di esercizio nelle foto, ognuno con un esercizio vero come ancora;
-- la ragazza toglie quelli sbagliati e l'app salva gli altri qui, con i suoi permessi.
-- media, stato e tentativi li aggiorna l'esito delle prove di esercizi (fetta #8).
--
-- Solo aggiunte: una colonna nuova con default su argomenti (le righe di oggi restano
-- "teoria") e una tabella nuova con le stesse policy delle altre tabelle per studentessa.

alter table public.argomenti
  add column percorso text not null default 'teoria' check (percorso in ('teoria', 'esercizi'));

create table public.esercizi_tipi (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid(),
  argomento_id uuid not null,
  titolo       text not null check (length(trim(titolo)) > 0),
  ancora       text not null check (length(trim(ancora)) > 0), -- un esercizio vero fotografato
  difficolta   smallint not null default 2 check (difficolta between 1 and 3),
  figura       boolean not null default false,
  ordine       int not null default 0,
  stato        text not null default 'mai' check (stato in ('mai', 'verde', 'giallo', 'rosso')),
  media        numeric(3,1) check (media between 0 and 10),
  tentativi    int not null default 0 check (tentativi >= 0),
  creato       timestamptz not null default now(),
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id) on delete cascade,
  unique (id, studente_id)
);
create index esercizi_tipi_argomento on public.esercizi_tipi (argomento_id, ordine);

-- Come i concetti: toccare i tipi sposta in alto l'argomento in libreria.
create trigger tocca after insert or update or delete on public.esercizi_tipi
  for each row execute function app.tocca_argomento();

alter table public.esercizi_tipi enable row level security;

create policy leggi on public.esercizi_tipi for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.esercizi_tipi for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.esercizi_tipi for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.esercizi_tipi for delete to authenticated
  using (studente_id = (select auth.uid()));

-- Le tabelle nuove in public ricevono i permessi di default anche per anon:
-- come per le altre, l'anonimo non legge niente.
revoke all on public.esercizi_tipi from anon;
