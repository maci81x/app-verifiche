-- Spiegazioni "Spiegamelo meglio" (issue #4).
--
-- Una riga per concetto e per studentessa: è la cache della spiegazione con
-- esempio, analogia e fonti dal web. "Rigenera" la sovrascrive. La prepara la
-- Edge Function `modello` (azione spiega) e l'app la salva con i permessi della
-- ragazza, come mappe e prove. Cancellare il concetto cancella la sua spiegazione.
--
-- Solo aggiunte: una tabella nuova con le stesse policy delle altre tabelle per
-- studentessa (la ragazza legge e scrive le sue, il genitore legge).

create table public.spiegazioni (
  id          uuid primary key default gen_random_uuid(),
  studente_id uuid not null default auth.uid(),
  concetto_id uuid not null,
  contenuto   jsonb not null check (jsonb_typeof(contenuto) = 'object'),
  generata    timestamptz not null default now(),
  foreign key (concetto_id, studente_id) references public.concetti (id, studente_id) on delete cascade,
  unique (concetto_id, studente_id)
);

alter table public.spiegazioni enable row level security;

create policy leggi on public.spiegazioni for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.spiegazioni for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.spiegazioni for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.spiegazioni for delete to authenticated
  using (studente_id = (select auth.uid()));

-- Le tabelle nuove in public ricevono i permessi di default anche per anon:
-- come per le altre, l'anonimo non legge niente.
revoke all on public.spiegazioni from anon;
