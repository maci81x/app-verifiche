-- Cestino e gestione dal pannello admin (issue #35).
--
-- Cosa aggiunge:
--   studenti.cestino, famiglie.cestino   null = attivo; data = nel cestino da allora (cancellazione definitiva dopo 30 giorni,
--                                        la fa la Edge Function `pulizia`); famiglie.protetta (la famiglia di prova del
--                                        controllo mattutino: nessuna azione che modifica dal pannello, la imposta una query
--                                        fuori dal repo); accessi_admin.famiglia_id (azioni sulla famiglia: in studente_id
--                                        va l'id dell'account genitore); impostazioni.pulizia_fino (lucchetto della pulizia).
--   app.profilo_attivo(studente)         unico predicato: profilo presente, non nel cestino, famiglia non nel cestino.
-- Cosa cambia (create or replace, versioni attuali dalla migration 20261119160548 e 20261119144921):
--   app.posso_leggere   falso per i profili non attivi (chi studia e genitore): chiude le letture col token ancora valido;
--   posti_occupati      una famiglia nel cestino non occupa il posto;
--   prenota_chiamata    nessuna chiamata al modello per i profili non attivi;
--   accesso_con_nome    profilo non attivo = come sospeso, solo dopo il codice giusto.
-- Più due policy restrittive sulle foto (solo profili attivi caricano o modificano) e il lucchetto della pulizia.
-- Il ban degli account (niente nuovo accesso né rinnovo della sessione) lo fa la funzione `admin`, dopo queste colonne.
-- Chi scrive le colonne nuove: solo la service role (funzioni `admin` e `pulizia`). Solo aggiunte e create or replace.
-- Per annullare: fonti/rollback/20261119181656_cestino_admin.down.sql.

alter table public.studenti add column cestino timestamptz;
alter table public.famiglie add column cestino timestamptz, add column protetta boolean not null default false;
alter table public.accessi_admin add column famiglia_id uuid; -- senza chiave esterna, come studente_id: il registro resta
alter table public.impostazioni add column pulizia_fino timestamptz;

-- Profilo presente, non nel cestino, famiglia (se c'è) non nel cestino. Security definer: chi studia non legge la riga
-- della sua famiglia. Eseguibile da authenticated perché la usa la policy delle foto.
create function app.profilo_attivo(studente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.studenti s left join public.famiglie f on f.id = s.famiglia_id
                  where s.id = studente and s.cestino is null and f.cestino is null)
$$;
revoke all on function app.profilo_attivo(uuid) from public, anon;
grant execute on function app.profilo_attivo(uuid) to authenticated, service_role;

create or replace function app.posso_leggere(studente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- ponytail: request.headers si legge a ogni riga; con questi volumi non conta.
  select app.profilo_attivo(studente) and (studente = auth.uid()
      or (exists (select 1 from public.genitori_studenti g
                   where g.genitore_id = auth.uid() and g.studente_id = studente)
          and coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-figlio', studente::text) = studente::text))
$$;

create or replace function public.posti_occupati() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.famiglie f where f.esterna and not f.prova and f.stato = 'attiva' and f.cestino is null
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
  -- nel cestino (il profilo o la sua famiglia): nessuna chiamata, nemmeno con un token ancora valido (issue #35)
  if not app.profilo_attivo(studente) then return jsonb_build_object('ok', false, 'errore', 'famiglia_sospesa'); end if;
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
revoke all on function public.prenota_chiamata(uuid, date, text) from public, anon, authenticated;
grant execute on function public.prenota_chiamata(uuid, date, text) to service_role;

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
    -- sospesa o nel cestino (issue #35): stessa risposta, solo dopo il codice giusto
    if coalesce(sospesa, false) or not app.profilo_attivo(sid) then return jsonb_build_object('ok', false, 'sospesa', true, 'attendi', 0); end if;
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
revoke all on function public.accesso_con_nome(text, text) from public, anon, authenticated;
grant execute on function public.accesso_con_nome(text, text) to service_role;

-- Foto: solo i profili attivi caricano o modificano (si aggiunge alle policy che già chiedono il ruolo «studente»).
create policy "fonti: solo profili attivi caricano" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'fonti' or app.profilo_attivo((select auth.uid())));
create policy "fonti: solo profili attivi modificano" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'fonti' or app.profilo_attivo((select auth.uid())))
  with check (bucket_id <> 'fonti' or app.profilo_attivo((select auth.uid())));

-- Lucchetto della pulizia: un giro alla volta (workflow del mattino e pulizia «pigra» del pannello). Scade da solo.
create function public.prendi_pulizia(minuti int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.impostazioni set pulizia_fino = now() + make_interval(mins => greatest(1, least(minuti, 60)))
   where id and (pulizia_fino is null or pulizia_fino < now());
  return found;
end $$;
create function public.lascia_pulizia() returns void
language sql security definer set search_path = '' as $$
  update public.impostazioni set pulizia_fino = null where id
$$;
revoke all on function public.prendi_pulizia(int), public.lascia_pulizia() from public, anon, authenticated;
grant execute on function public.prendi_pulizia(int), public.lascia_pulizia() to service_role;
