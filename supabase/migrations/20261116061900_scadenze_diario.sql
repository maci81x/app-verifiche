-- Il diario di ogni giorno (issue #19).
--
-- scadenze: verifiche e interrogazioni, segnate a mano o lette sul diario fotografato.
-- L'azione `smista` della Edge Function `modello` propone e non salva: scrive l'app, con i
-- permessi di chi studia, dopo il «Sì, segnala». L'argomento è facoltativo; se l'argomento
-- si cancella, la scadenza resta senza.
--
-- giorni_diario: un giorno con almeno una foto caricata, per la serie «giorni di fila».
-- Scrive l'app: upsert su (studente_id, data) con il nuovo totale di foto del giorno.
--
-- Solo aggiunte: due tabelle nuove con le policy di sempre (chi studia legge e scrive le sue
-- righe, il genitore legge) e svuota_memoria che ora pulisce anche queste due tabelle,
-- appese direttamente a studenti.

create table public.scadenze (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid() references public.studenti (id) on delete cascade,
  argomento_id uuid,
  materia      text not null check (length(trim(materia)) > 0),
  tipo         text not null check (tipo in ('scritta', 'orale')),
  data         date not null,
  fonte        text not null default 'manuale' check (fonte in ('manuale', 'diario')),
  creata       timestamptz not null default now(),
  -- Composta: il database rifiuta l'argomento di un altro profilo.
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id)
    on delete set null (argomento_id)
);
-- L'elenco delle prossime date; copre anche la fk su studente_id.
create index scadenze_studente_data on public.scadenze (studente_id, data);
-- Fk composta verso argomenti.
create index scadenze_argomento on public.scadenze (argomento_id, studente_id);

create table public.giorni_diario (
  studente_id uuid not null default auth.uid() references public.studenti (id) on delete cascade,
  data        date not null,
  n_foto      int not null check (n_foto > 0),
  -- Copre anche la fk su studente_id e l'elenco dei giorni.
  primary key (studente_id, data)
);

alter table public.scadenze enable row level security;

create policy leggi on public.scadenze for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.scadenze for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.scadenze for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.scadenze for delete to authenticated
  using (studente_id = (select auth.uid()));

revoke all on public.scadenze from anon;
revoke truncate on public.scadenze from authenticated;   -- truncate scavalca RLS
grant select, insert, update, delete on public.scadenze to authenticated;

alter table public.giorni_diario enable row level security;

create policy leggi on public.giorni_diario for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.giorni_diario for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.giorni_diario for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.giorni_diario for delete to authenticated
  using (studente_id = (select auth.uid()));

revoke all on public.giorni_diario from anon;
revoke truncate on public.giorni_diario from authenticated;
grant select, insert, update, delete on public.giorni_diario to authenticated;

-- Svuota la memoria: come prima, più le due tabelle appese direttamente a studenti.
create or replace function public.svuota_memoria() returns void
language sql security invoker set search_path = '' as $$
  delete from public.sessioni      where studente_id = auth.uid();
  delete from public.argomenti     where studente_id = auth.uid();
  delete from public.scadenze      where studente_id = auth.uid();
  delete from public.giorni_diario where studente_id = auth.uid();
$$;
revoke all on function public.svuota_memoria() from public, anon;
grant execute on function public.svuota_memoria() to authenticated;
