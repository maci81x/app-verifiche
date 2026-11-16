-- «Le 5 cose da sapere» (issue #22).
--
-- Una riga per argomento e per studentessa: è la cache della pagina con i 5 punti, la catena
-- causa-effetto, le parole tecniche e la domanda della prof. La prepara la Edge Function
-- `modello` (azione punti_chiave, ogni elemento già passato dal filtro di ancoraggio) e l'app
-- la salva con i permessi della ragazza; «Rifalle da capo» la sovrascrive (upsert). Cancellare
-- l'argomento cancella la sua riga.
--
-- Solo aggiunte: una tabella nuova con le policy delle altre tabelle per studentessa (la
-- ragazza legge e scrive le sue, il genitore legge), come da MIGRATION-GUIDE.md.

create table public.punti_chiave (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid(),
  argomento_id uuid not null,
  contenuto    jsonb not null check (jsonb_typeof(contenuto) = 'object'),
  generata     timestamptz not null default now(),
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id) on delete cascade,
  unique (argomento_id, studente_id) -- vale anche come indice della chiave esterna
);

alter table public.punti_chiave enable row level security;

create policy leggi on public.punti_chiave for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.punti_chiave for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.punti_chiave for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.punti_chiave for delete to authenticated
  using (studente_id = (select auth.uid()));

revoke all on public.punti_chiave from anon;
revoke truncate on public.punti_chiave from authenticated; -- truncate scavalca RLS
grant select, insert, update, delete on public.punti_chiave to authenticated;
