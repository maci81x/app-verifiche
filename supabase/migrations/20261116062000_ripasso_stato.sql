-- Ripetizione dilazionata per il piano del giorno (issue #20).
--
-- Una riga per concetto e per profilo: quando ripassarlo (prossima), ogni quanti giorni
-- (intervallo_giorni), quanto è facile (facilita) e com'è andata l'ultima risposta
-- (ultimo_esito 0-10, ultima_sicurezza «Ci prendo» / «Forse» / «A caso»).
-- La scrive l'app con i permessi di chi studia dopo ogni prova (ripasso, verifica,
-- interrogazione, prova lampo), con un upsert su (concetto_id, studente_id); la regola sta in
-- piano.js (nuovoStatoRipasso). Cancellare il concetto cancella la riga.
--
-- Solo aggiunte: una tabella nuova con le policy delle altre tabelle per profilo
-- (chi studia legge e scrive le sue, il genitore legge).

create table public.ripasso_stato (
  studente_id       uuid not null default auth.uid(),
  concetto_id       uuid not null,
  prossima          date not null,
  intervallo_giorni int not null default 1 check (intervallo_giorni between 1 and 365),
  facilita          numeric(3,2) not null default 2.5 check (facilita between 1.3 and 3),
  ultima_sicurezza  text check (ultima_sicurezza in ('ci', 'forse', 'caso')),
  ultimo_esito      numeric(3,1) check (ultimo_esito between 0 and 10),
  aggiornato        timestamptz not null default now(),
  primary key (concetto_id, studente_id),
  foreign key (concetto_id, studente_id) references public.concetti (id, studente_id) on delete cascade
);
-- Il piano legge le righe di chi studia in ordine di scadenza.
create index ripasso_stato_prossima on public.ripasso_stato (studente_id, prossima);

alter table public.ripasso_stato enable row level security;

create policy leggi on public.ripasso_stato for select to authenticated
  using (app.posso_leggere(studente_id));
create policy crea on public.ripasso_stato for insert to authenticated
  with check (studente_id = (select auth.uid()));
create policy modifica on public.ripasso_stato for update to authenticated
  using (studente_id = (select auth.uid()))
  with check (studente_id = (select auth.uid()));
create policy elimina on public.ripasso_stato for delete to authenticated
  using (studente_id = (select auth.uid()));

revoke all on public.ripasso_stato from anon;
revoke truncate on public.ripasso_stato from authenticated;
grant select, insert, update, delete on public.ripasso_stato to authenticated;
