-- Annulla 20261119181656_cestino_admin.sql (issue #35). Prima ripubblicare le funzioni `admin`, `profili` e `pulizia`
-- della versione precedente (o spegnerle): quelle nuove usano le colonne tolte qui. I dati nel cestino tornano attivi.
begin;
drop policy if exists "fonti: solo profili attivi caricano" on storage.objects;
drop policy if exists "fonti: solo profili attivi modificano" on storage.objects;
drop function if exists public.prendi_pulizia(int);
drop function if exists public.lascia_pulizia();

-- funzioni com'erano prima (copiate pari pari da 20261119144921 e 20261119160548)
create or replace function app.posso_leggere(studente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- ponytail: request.headers si legge a ogni riga; con questi volumi non conta.
  select studente = auth.uid()
      or (exists (select 1 from public.genitori_studenti g
                   where g.genitore_id = auth.uid() and g.studente_id = studente)
          and coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-figlio', studente::text) = studente::text)
$$;

create or replace function public.posti_occupati() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.famiglie f where f.esterna and not f.prova and f.stato = 'attiva'
$$;

create or replace function public.prenota_chiamata(studente uuid, oggi date, azione text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  f public.famiglie%rowtype;
  tetto int;
  usate int;
  della_famiglia int;
  rid bigint;
begin
  perform pg_advisory_xact_lock(hashtext('chiamate:' || studente::text));
  if not exists (select 1 from public.studenti s where s.id = studente) then raise exception 'profilo inesistente'; end if;
  select fa.* into f from public.studenti s join public.famiglie fa on fa.id = s.famiglia_id where s.id = studente;
  if found and f.stato = 'sospesa' then return jsonb_build_object('ok', false, 'errore', 'famiglia_sospesa'); end if;
  if f.id is not null then
    -- Tetto della famiglia (limite per figlio × 4, il massimo di figli: MAX_FIGLI in _shared/famiglie.js), con le chiamate
    -- di oggi dei figli eliminati (consumi_archiviati): eliminare e ricreare un figlio non azzera la spesa del giorno.
    perform pg_advisory_xact_lock(hashtext('famiglia:' || f.id::text));
    select (select count(*) from public.consumi c join public.studenti s on s.id = c.studente_id
             where s.famiglia_id = f.id and c.giorno = oggi)
         + coalesce((select sum(a.chiamate) from public.consumi_archiviati a where a.famiglia_id = f.id and a.giorno = oggi), 0)
      into della_famiglia;
    if della_famiglia >= f.limite_chiamate * 4 then
      return jsonb_build_object('ok', false, 'errore', 'tetto_giornaliero', 'tetto', f.limite_chiamate * 4);
    end if;
  end if;
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
  nome_n text := left(lower(trim(coalesce(utente, ''))), 40);
  sid uuid;
  hash text;
  e int; b int; fino timestamptz; ultimo timestamptz;
  attesa int;
  sospesa boolean;
begin
  if nome_n = '' then return jsonb_build_object('ok', false, 'attendi', 0); end if;
  select s.id into sid from public.studenti s where s.nome_utente = nome_n;
  if sid is not null then
    -- for update: due tentativi in parallelo non saltano il conteggio
    select p.pin_hash, p.errori, p.blocchi, p.bloccato_fino, p.ultimo_blocco into hash, e, b, fino, ultimo
      from public.pin_profili p where p.user_id = sid for update;
    if not found then sid := null; end if; -- profilo senza codice: nessun accesso, conta come nome sconosciuto
  end if;
  if sid is null then
    delete from public.tentativi_nome t where t.aggiornato < now() - interval '8 days';
    insert into public.tentativi_nome (nome) values (nome_n) on conflict (nome) do nothing;
    select t.errori, t.blocchi, t.bloccato_fino, t.ultimo_blocco into e, b, fino, ultimo
      from public.tentativi_nome t where t.nome = nome_n for update;
  end if;

  if b > 0 and ultimo < now() - interval '7 days' and coalesce(fino, now()) <= now() then b := 0; end if; -- 7 giorni senza blocchi

  if fino > now() then
    attesa := ceil(extract(epoch from fino - now()))::int;
  elsif sid is not null and coalesce(pin, '') ~ '^\d{4}$' and hash = extensions.crypt(pin, hash) then
    update public.pin_profili set errori = 0, bloccato_fino = null, blocchi = greatest(b - 1, 0) where user_id = sid;
    select f.stato = 'sospesa' into sospesa
      from public.studenti s join public.famiglie f on f.id = s.famiglia_id where s.id = sid;
    if coalesce(sospesa, false) then return jsonb_build_object('ok', false, 'sospesa', true, 'attendi', 0); end if;
    return jsonb_build_object('ok', true, 'studente_id', sid);
  elsif e + 1 >= 5 then
    b := b + 1; e := 0; ultimo := now();
    attesa := case b when 1 then 60 when 2 then 300 when 3 then 900 when 4 then 3600 when 5 then 14400 else 86400 end;
    fino := now() + make_interval(secs => attesa);
  else
    e := e + 1; attesa := 0;
  end if;

  if sid is not null then
    update public.pin_profili set errori = e, blocchi = b, bloccato_fino = fino, ultimo_blocco = ultimo where user_id = sid;
  else
    update public.tentativi_nome set errori = e, blocchi = b, bloccato_fino = fino, ultimo_blocco = ultimo, aggiornato = now()
     where nome = nome_n;
  end if;
  return jsonb_build_object('ok', false, 'attendi', attesa);
end $$;

drop function if exists app.profilo_attivo(uuid);
alter table public.impostazioni drop column if exists pulizia_fino;
alter table public.accessi_admin drop column if exists famiglia_id;
alter table public.famiglie drop column if exists protetta, drop column if exists cestino;
alter table public.studenti drop column if exists cestino;
delete from supabase_migrations.schema_migrations where version = '20261119181656';
commit;
