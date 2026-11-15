-- Il diario di ogni giorno (issue #19).
--
-- scadenze: verifiche e interrogazioni, segnate a mano dalla ragazza o lette sul diario
-- fotografato (azione `smista` della Edge Function `modello`, che propone e non salva:
-- l'app salva con i permessi della ragazza dopo il suo «Sì, segnala»). L'argomento è
-- facoltativo; se l'argomento si cancella, la scadenza resta senza.
--
-- giorni_diario: un giorno con almeno una foto caricata, per la serie «giorni di fila».
-- L'app fa upsert su (studente_id, data) con il nuovo totale di foto del giorno.
--
-- Solo aggiunte: due tabelle nuove con le stesse policy delle altre tabelle per
-- studentessa (la ragazza legge e scrive le sue, il genitore legge).

create table public.scadenze (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid() references public.studenti (id) on delete cascade,
  argomento_id uuid,
  materia      text not null check (length(trim(materia)) > 0),
  tipo         text not null check (tipo in ('scritta', 'orale')),
  data         date not null,
  fonte        text not null default 'manuale' check (fonte in ('manuale', 'diario')),
  creata       timestamptz not null default now(),
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id)
    on delete set null (argomento_id)
);
create index scadenze_studente_data on public.scadenze (studente_id, data);

create table public.giorni_diario (
  studente_id uuid not null default auth.uid() references public.studenti (id) on delete cascade,
  data        date not null,
  n_foto      int not null check (n_foto > 0),
  primary key (studente_id, data)
);

alter table public.scadenze enable row level security;
alter table public.giorni_diario enable row level security;

create policy leggi on public.scadenze for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.scadenze for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.scadenze for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.scadenze for delete to authenticated
  using (studente_id = (select auth.uid()));

create policy leggi on public.giorni_diario for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.giorni_diario for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.giorni_diario for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.giorni_diario for delete to authenticated
  using (studente_id = (select auth.uid()));

-- Le tabelle nuove in public ricevono i permessi di default anche per anon:
-- come per le altre, l'anonimo non legge niente.
revoke all on public.scadenze from anon;
revoke all on public.giorni_diario from anon;
