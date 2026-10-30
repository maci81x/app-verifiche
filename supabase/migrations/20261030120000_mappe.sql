-- Mappa concettuale di un argomento (issue #2).
--
-- Una riga per argomento e per studentessa, sovrascritta da "Rigenera". L'albero
-- lo prepara la Edge Function `modello` (azione mappa) e l'app lo salva con i
-- permessi della ragazza, come concetti e prove. Cancellare l'argomento cancella
-- la sua mappa.
--
-- Solo aggiunte: una tabella nuova con le stesse policy delle altre tabelle per
-- studentessa (la ragazza legge e scrive le sue, il genitore legge).

create table public.mappe (
  id           uuid primary key default gen_random_uuid(),
  studente_id  uuid not null default auth.uid(),
  argomento_id uuid not null,
  albero       jsonb not null check (jsonb_typeof(albero) = 'object'),
  generata     timestamptz not null default now(),
  scartati     int not null default 0 check (scartati >= 0), -- nodi tolti dal filtro di ancoraggio
  foreign key (argomento_id, studente_id) references public.argomenti (id, studente_id) on delete cascade,
  unique (argomento_id, studente_id)
);

alter table public.mappe enable row level security;

create policy leggi on public.mappe for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.mappe for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.mappe for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.mappe for delete to authenticated
  using (studente_id = (select auth.uid()));

-- Le tabelle nuove in public ricevono i permessi di default anche per anon:
-- come per le altre, l'anonimo non legge niente.
revoke all on public.mappe from anon;
