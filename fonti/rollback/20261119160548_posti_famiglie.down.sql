-- Annulla 20261119160548_posti_famiglie.sql (issue #30): torna al conteggio dei posti della migration famiglie_esterne.
begin;
drop policy if exists "fonti: solo chi studia carica" on storage.objects;
drop policy if exists "fonti: solo chi studia modifica" on storage.objects;
update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'fonti';
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
drop function if exists public.archivia_consumi(uuid);
drop table if exists public.consumi_archiviati;

create or replace function public.prenota_chiamata(studente uuid, oggi date, azione text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.famiglie%rowtype;
  tetto int;
  usate int;
  rid bigint;
begin
  perform pg_advisory_xact_lock(hashtext('chiamate:' || studente::text));
  if not exists (select 1 from public.studenti s where s.id = studente) then raise exception 'profilo inesistente'; end if;
  select fa.* into f from public.studenti s join public.famiglie fa on fa.id = s.famiglia_id where s.id = studente;
  if found and f.stato = 'sospesa' then return jsonb_build_object('ok', false, 'errore', 'famiglia_sospesa'); end if;
  tetto := coalesce(f.limite_chiamate, 60);
  select count(*) into usate from public.consumi c where c.studente_id = studente and c.giorno = oggi;
  if usate >= tetto then return jsonb_build_object('ok', false, 'errore', 'tetto_giornaliero', 'tetto', tetto); end if;
  insert into public.consumi (studente_id, giorno, azione, modello)
  values (studente, oggi, left(coalesce(prenota_chiamata.azione, ''), 40), 'prenotata')
  returning id into rid;
  return jsonb_build_object('ok', true, 'id', rid, 'limite_aiuti', coalesce(f.limite_aiuti, 10), 'tetto', tetto);
end $$;

create or replace function public.accesso_con_nome(utente text, pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid;
  r public.pin_profili%rowtype;
  n int;
  attesa int;
  sospesa boolean;
begin
  select s.id into sid from public.studenti s where s.nome_utente = lower(trim(coalesce(utente, '')));
  if sid is null then return jsonb_build_object('ok', false, 'attendi', 0); end if;

  -- for update: due tentativi in parallelo non saltano il conteggio
  select * into r from public.pin_profili p where p.user_id = sid for update;
  if not found then return jsonb_build_object('ok', false, 'attendi', 0); end if;

  if r.bloccato_fino > now() then
    return jsonb_build_object('ok', false, 'attendi', ceil(extract(epoch from r.bloccato_fino - now()))::int);
  end if;

  if coalesce(pin, '') ~ '^\d{4}$' and r.pin_hash = extensions.crypt(pin, r.pin_hash) then
    update public.pin_profili set errori = 0, bloccato_fino = null, blocchi = 0 where user_id = sid;
    select f.stato = 'sospesa' into sospesa
      from public.studenti s join public.famiglie f on f.id = s.famiglia_id where s.id = sid;
    if coalesce(sospesa, false) then return jsonb_build_object('ok', false, 'sospesa', true, 'attendi', 0); end if;
    return jsonb_build_object('ok', true, 'studente_id', sid);
  end if;

  if r.errori + 1 >= 5 then
    n := r.blocchi + 1;
    attesa := case n when 1 then 60 when 2 then 300 when 3 then 900 when 4 then 3600 when 5 then 14400 else 86400 end;
    update public.pin_profili
       set errori = 0, blocchi = n, bloccato_fino = now() + make_interval(secs => attesa), ultimo_blocco = now()
     where user_id = sid;
    return jsonb_build_object('ok', false, 'attendi', attesa);
  end if;

  update public.pin_profili set errori = r.errori + 1 where user_id = sid;
  return jsonb_build_object('ok', false, 'attendi', 0);
end $$;


delete from supabase_migrations.schema_migrations where version = '20261119160548';
commit;
