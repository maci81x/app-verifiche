-- Annulla 20261119144921_famiglie_esterne.sql (issue #30).
-- Cancella famiglie, inviti, consensi, consumi, impostazioni e registro admin, e le colonne nuove di studenti e pin_profili.
-- I dati di studio non si toccano. Prima va ripubblicata la versione precedente delle funzioni (accedi, profili, modello)
-- e dell'app (v34): quelle nuove usano queste tabelle.
begin;

-- funzioni nuove
drop function if exists public.prenota_chiamata(uuid, date, text);
drop function if exists public.iscrivi_famiglia(uuid, text, text, text, jsonb);
drop function if exists public.stato_invito(text);
drop function if exists public.invito_valido(text);
drop function if exists public.posti_occupati();
drop function if exists public.accesso_con_nome(text, text);

-- funzioni cambiate: com'erano prima
create or replace function app.posso_leggere(studente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select studente = auth.uid()
      or exists (select 1 from public.genitori_studenti g
                  where g.genitore_id = auth.uid() and g.studente_id = studente)
$$;

create or replace function public.imposta_pin_di(studente uuid, pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.studenti s where s.id = studente) then
    raise exception 'profilo inesistente';
  end if;
  if coalesce(pin, '') !~ '^\d{4,6}$' then raise exception 'il PIN deve avere da 4 a 6 cifre'; end if;
  insert into public.pin_profili (user_id, pin_hash)
  values (studente, extensions.crypt(pin, extensions.gen_salt('bf')))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, errori = 0, bloccato_fino = null;
end $$;

-- permessi di studenti com'erano
revoke update (scelte) on public.studenti from authenticated;
grant insert, update on public.studenti to authenticated;

-- tabelle e colonne nuove (prima quelle che puntano a famiglie)
drop table if exists public.accessi_admin;
drop table if exists public.impostazioni;
drop table if exists public.consumi;
drop table if exists public.consensi;
drop table if exists public.inviti;
alter table public.pin_profili drop column if exists ultimo_blocco, drop column if exists blocchi;
alter table public.studenti drop column if exists famiglia_id, drop column if exists cognome, drop column if exists nome_utente;
drop table if exists public.famiglie;

delete from supabase_migrations.schema_migrations where version = '20261119144921';
commit;
