-- Schema iniziale dell'app verifiche.
--
-- Separazione dei profili: ogni studentessa è un utente auth distinto, anche se
-- usano lo stesso iPhone. Ogni tabella porta studente_id e le chiavi esterne
-- sono composte (id, studente_id): il database rifiuta di collegare una riga
-- a un genitore che appartiene a un'altra studentessa. Le policy RLS quindi
-- devono solo confrontare studente_id con auth.uid().
--
-- Il genitore è un terzo utente auth, collegato alle figlie in
-- genitori_studenti: legge tutto tranne le foto, non scrive niente.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
grant usage on schema app to authenticated;

-- ---------------------------------------------------------------- profili

create table public.studenti (
  id      uuid primary key references auth.users (id) on delete cascade,
  nome    text not null check (length(trim(nome)) > 0),
  classe  text,
  avatar  text,
  -- ultime scelte prima della prova, riproposte la volta dopo
  scelte  jsonb not null default '{"livello":"medio","tipo":"miste","modalita":"scritta"}',
  creato  timestamptz not null default now()
);

create table public.genitori_studenti (
  genitore_id  uuid not null references auth.users (id) on delete cascade,
  studente_id  uuid not null references public.studenti (id) on delete cascade,
  email_report text not null,
  primary key (genitore_id, studente_id)
);

-- PIN dei profili e della vista genitore. Nessuna policy: si legge e si
-- scrive solo con le funzioni qui sotto, così l'hash non esce mai.
create table public.pin_profili (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null
);

-- ---------------------------------------------------------------- materiale

create table public.argomenti (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid() references public.studenti (id) on delete cascade,
  materia      text not null check (length(trim(materia)) > 0),
  titolo       text not null check (length(trim(titolo)) > 0),
  trascrizione text not null default '',
  origine      text not null default 'foto' check (origine in ('foto', 'testo', 'misto')),
  creato       timestamptz not null default now(),
  aggiornato   timestamptz not null default now(),
  unique (id, studente_id)
);
create index argomenti_libreria on public.argomenti (studente_id, aggiornato desc);
create index argomenti_materia on public.argomenti (studente_id, lower(materia));

create table public.fonti (
  id                 uuid primary key default gen_random_uuid(),
  studente_id        uuid not null default auth.uid(),
  argomento_id       uuid not null,
  tipo               text not null default 'foto' check (tipo in ('foto', 'testo')),
  storage_path       text unique,
  riferimento_pagina int,
  creato             timestamptz not null default now(),
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id) on delete cascade,
  -- la foto vive nella cartella della sua proprietaria
  check (storage_path is null or storage_path like studente_id::text || '/%')
);
create index fonti_argomento on public.fonti (argomento_id);

create table public.concetti (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid(),
  argomento_id uuid not null,
  titolo       text not null,
  descrizione  text not null default '',
  ancora       text not null,
  peso         smallint not null default 2 check (peso between 1 and 3),
  stato        text not null default 'mai' check (stato in ('mai', 'verde', 'giallo', 'rosso')),
  media        numeric(3,1) check (media between 0 and 10),
  tentativi    int not null default 0 check (tentativi >= 0),
  ordine       int not null default 0,
  creato       timestamptz not null default now(),
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id) on delete cascade,
  unique (id, studente_id)
);
create index concetti_argomento on public.concetti (argomento_id, ordine);

-- ---------------------------------------------------------------- prove

-- Cancellare un argomento non cancella le sue prove: restano nello storico
-- con titolo e materia copiati qui. Le cancella solo "svuota tutta la memoria".
create table public.sessioni (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid() references public.studenti (id) on delete cascade,
  argomento_id uuid, -- null per il ripasso su più argomenti
  titolo       text not null,
  materia      text not null,
  data         timestamptz not null default now(),
  livello      text not null check (livello in ('semplice', 'medio', 'difficile')),
  tipo         text not null check (tipo in ('miste', 'chiuse', 'aperte')),
  modalita     text not null check (modalita in ('scritta', 'orale')),
  indice       smallint check (indice between 0 and 100),
  voto         numeric(3,1) check (voto between 3 and 10 and voto * 2 = round(voto * 2)),
  n_domande    int not null default 0,
  n_errori     int not null default 0,
  scartate     int not null default 0, -- domande tolte dal filtro di ancoraggio
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id)
    on delete set null (argomento_id),
  unique (id, studente_id)
);
create index sessioni_storico on public.sessioni (studente_id, data desc);
create index sessioni_argomento on public.sessioni (argomento_id, data desc);

create table public.domande (
  id              uuid primary key default gen_random_uuid(),
  studente_id     uuid not null default auth.uid(),
  sessione_id     uuid not null,
  argomento_id    uuid,
  concetto_id     uuid,
  concetto_titolo text not null, -- copia: lo storico regge anche se il concetto sparisce
  ordine          int not null,
  tipo            text not null check (tipo in ('chiusa', 'aperta')),
  livello         text not null check (livello in ('semplice', 'medio', 'difficile')),
  testo           text not null,
  opzioni         jsonb check (opzioni is null or jsonb_typeof(opzioni) = 'array'),
  corretta        smallint,
  risposta_attesa text,
  elementi        jsonb not null default '[]',
  ancora          text not null,
  foreign key (sessione_id, studente_id) references public.sessioni (id, studente_id) on delete cascade,
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id)
    on delete set null (argomento_id),
  foreign key (concetto_id, studente_id) references public.concetti (id, studente_id)
    on delete set null (concetto_id),
  check (tipo = 'aperta' or (opzioni is not null and corretta is not null
                             and jsonb_array_length(opzioni) >= 2
                             and corretta between 0 and jsonb_array_length(opzioni) - 1)),
  check (tipo = 'chiusa' or risposta_attesa is not null),
  unique (id, sessione_id, studente_id)
);
create index domande_sessione on public.domande (sessione_id, ordine);
-- per passare al modello le ultime domande già fatte sull'argomento
create index domande_gia_fatte on public.domande (argomento_id, sessione_id);

create table public.risposte (
  id                uuid primary key default gen_random_uuid(),
  studente_id       uuid not null default auth.uid(),
  sessione_id       uuid not null,
  domanda_id        uuid not null unique,
  testo             text,     -- aperta, scritta o trascritta dalla voce
  scelta            smallint, -- chiusa: indice nell'array opzioni originale
  punteggio         numeric(3,1) not null check (punteggio between 0 and 10),
  dettaglio_rubrica jsonb,    -- {completezza, correttezza, linguaggio}
  commento          text,
  secondi           int check (secondi >= 0),
  guidata           boolean not null default false,
  -- la risposta appartiene a una domanda della stessa prova e della stessa studentessa
  foreign key (domanda_id, sessione_id, studente_id)
    references public.domande (id, sessione_id, studente_id) on delete cascade
);
create index risposte_sessione on public.risposte (sessione_id);

-- ---------------------------------------------------------------- genitore

create table public.report (
  id          uuid primary key default gen_random_uuid(),
  studente_id uuid not null references public.studenti (id) on delete cascade,
  dal         date not null,
  al          date not null check (al >= dal),
  contenuto   jsonb not null,
  canale      text not null default 'email' check (canale in ('email')),
  inviato_il  timestamptz
);
create index report_studente on public.report (studente_id, al desc);

-- ---------------------------------------------------------------- aggiornato

-- La libreria è ordinata per aggiornamento: toccare concetti o foto
-- sposta in alto l'argomento.
create function app.tocca_argomento() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'argomenti' then
    new.aggiornato := now();
    return new;
  end if;
  update public.argomenti set aggiornato = now()
   where id = coalesce(new.argomento_id, old.argomento_id);
  return null;
end $$;

create trigger tocca before update on public.argomenti
  for each row execute function app.tocca_argomento();
create trigger tocca after insert or update or delete on public.concetti
  for each row execute function app.tocca_argomento();
create trigger tocca after insert or delete on public.fonti
  for each row execute function app.tocca_argomento();

-- ---------------------------------------------------------------- RLS

-- Vero se chi chiama è la studentessa stessa o un suo genitore.
-- security definer per leggere genitori_studenti senza ricorsione di policy.
create function app.posso_leggere(studente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select studente = auth.uid()
      or exists (select 1 from public.genitori_studenti g
                  where g.genitore_id = auth.uid() and g.studente_id = studente)
$$;
revoke all on function app.posso_leggere(uuid) from public;
grant execute on function app.posso_leggere(uuid) to authenticated;

alter table public.studenti          enable row level security;
alter table public.genitori_studenti enable row level security;
alter table public.pin_profili       enable row level security;
alter table public.argomenti         enable row level security;
alter table public.fonti             enable row level security;
alter table public.concetti          enable row level security;
alter table public.sessioni          enable row level security;
alter table public.domande           enable row level security;
alter table public.risposte          enable row level security;
alter table public.report            enable row level security;

create policy leggi on public.studenti for select to authenticated
  using (app.posso_leggere(id));
create policy crea on public.studenti for insert to authenticated
  with check (id = (select auth.uid()));
create policy modifica on public.studenti for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy leggi on public.genitori_studenti for select to authenticated
  using (genitore_id = (select auth.uid()) or studente_id = (select auth.uid()));

-- Il genitore legge materiale e prove ma non le foto: fonti è solo della studentessa.
create policy propri on public.fonti for all to authenticated
  using (studente_id = (select auth.uid())) with check (studente_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['argomenti', 'concetti', 'sessioni', 'domande', 'risposte'] loop
    execute format('create policy leggi on public.%I for select to authenticated
                      using (app.posso_leggere(studente_id))', t);
    execute format('create policy crea on public.%I for insert to authenticated
                      with check (studente_id = (select auth.uid()))', t);
    execute format('create policy modifica on public.%I for update to authenticated
                      using (studente_id = (select auth.uid()))
                      with check (studente_id = (select auth.uid()))', t);
    execute format('create policy elimina on public.%I for delete to authenticated
                      using (studente_id = (select auth.uid()))', t);
  end loop;
end $$;

-- I report li scrive solo la funzione server con la service role.
create policy leggi on public.report for select to authenticated
  using (app.posso_leggere(studente_id));

revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------- PIN

create function public.imposta_pin(pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if pin !~ '^\d{4,6}$' then raise exception 'il PIN deve avere da 4 a 6 cifre'; end if;
  insert into public.pin_profili (user_id, pin_hash)
  values (auth.uid(), extensions.crypt(pin, extensions.gen_salt('bf')))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash;
end $$;

-- Vero anche se il PIN non è mai stato impostato: profilo senza blocco.
create function public.verifica_pin(pin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.pin_hash = extensions.crypt(pin, p.pin_hash)
       from public.pin_profili p where p.user_id = auth.uid()),
    true)
$$;

revoke all on function public.imposta_pin(text), public.verifica_pin(text) from public, anon;
grant execute on function public.imposta_pin(text), public.verifica_pin(text) to authenticated;

-- ---------------------------------------------------------------- svuota

-- Cancella tutta la memoria della studentessa che chiama. Le foto nello
-- storage vanno rimosse dal client prima di chiamarla (Supabase non permette
-- di cancellare oggetti dello storage da SQL): l'app elenca la cartella
-- <studente_id>/ del bucket e la svuota, poi chiama questa funzione.
create function public.svuota_memoria() returns void
language sql security invoker set search_path = '' as $$
  delete from public.sessioni  where studente_id = auth.uid();
  delete from public.argomenti where studente_id = auth.uid();
$$;
revoke all on function public.svuota_memoria() from public, anon;
grant execute on function public.svuota_memoria() to authenticated;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public)
values ('fonti', 'fonti', false)
on conflict (id) do nothing;

-- Percorso: <studente_id>/<argomento_id>/<uuid>.jpg
create policy "fonti: solo la proprietaria" on storage.objects for all to authenticated
  using (bucket_id = 'fonti' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fonti' and (storage.foldername(name))[1] = (select auth.uid())::text);
