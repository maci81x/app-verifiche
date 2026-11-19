-- Annulla 20261119160548_posti_famiglie.sql (issue #30): torna al conteggio dei posti della migration famiglie_esterne.
begin;
drop trigger if exists famiglie_conferma_entro_24_ore on auth.users;
drop function if exists app.conferma_entro_24_ore();

-- funzioni com'erano in 20261119144921_famiglie_esterne.sql
create or replace function public.posti_occupati() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from public.famiglie f join auth.users u on u.id = f.genitore_id
   where f.esterna and not f.prova and f.stato = 'attiva'
     and (u.email_confirmed_at is not null or f.creato > now() - interval '24 hours')
$$;

create or replace function public.stato_invito(codice text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.inviti;
begin
  inv := public.invito_valido(codice);
  if inv.codice is null then return jsonb_build_object('valido', false); end if;
  return jsonb_build_object('valido', true, 'prova', inv.prova,
    'posti_liberi', inv.prova or public.posti_occupati() < (select posti_esterni from public.impostazioni));
end $$;

create or replace function public.iscrivi_famiglia(genitore uuid, nome text, cognome text, codice text, versioni jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.inviti;
  fid uuid;
begin
  perform pg_advisory_xact_lock(hashtext('iscrivi_famiglia'));
  inv := public.invito_valido(iscrivi_famiglia.codice);
  if inv.codice is null then return jsonb_build_object('ok', false, 'errore', 'invito_non_valido'); end if;
  if not inv.prova then
    if public.posti_occupati() >= (select posti_esterni from public.impostazioni) then
      return jsonb_build_object('ok', false, 'errore', 'posti_esauriti');
    end if;
  else
    update public.inviti set usato = now() where inviti.codice = inv.codice; -- monouso
  end if;

  insert into public.famiglie (genitore_id, nome, cognome, esterna, prova, invitata_da, codice_invito_usato)
  values (genitore, iscrivi_famiglia.nome, iscrivi_famiglia.cognome, true, inv.prova,
          inv.titolare_id, inv.codice)
  returning id into fid;

  insert into public.consensi (genitore_id, documento, versione)
  select genitore, d, versioni ->> d from unnest(array['privacy', 'condizioni', 'dati_figlio']) d;

  return jsonb_build_object('ok', true, 'famiglia_id', fid);
end $$;

drop function if exists public.pulisci_iscrizioni();

delete from supabase_migrations.schema_migrations where version = '20261119160548';
commit;
