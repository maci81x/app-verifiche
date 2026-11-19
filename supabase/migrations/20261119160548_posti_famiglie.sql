-- Tetto dei posti senza scappatoie (issue #30, dopo la revisione di sicurezza).
--
-- Prima: un'iscrizione esterna non confermata smetteva di occupare il posto dopo 24 ore, ma poteva confermare dopo,
-- portando le famiglie esterne attive oltre il tetto. Ora:
--   * posti_occupati conta tutte le famiglie esterne attive non di prova, confermate o no;
--   * pulisci_iscrizioni cancella (utente e, in cascata, famiglia, consensi e invito) le iscrizioni esterne non di prova
--     mai confermate dopo 24 ore e senza figli, sotto lo stesso lucchetto di iscrivi_famiglia: il posto si libera;
--     la chiamano iscrivi_famiglia, stato_invito e il pannello admin;
--   * un trigger su auth.users rifiuta la conferma della mail dopo 24 ore, anche se la pulizia non è ancora passata.
-- Chi scrive: solo la service role (Edge Function famiglie e admin); GoTrue quando conferma una mail.
-- Dopo la revisione EGM del branch anche: tetto della famiglia che regge a elimina e ricrea (consumi_archiviati,
-- archivia_consumi, prenota_chiamata), scala del blocco che un accesso giusto non azzera (accesso_con_nome), foto caricabili
-- solo da chi studia (policy restrittive sullo storage, limiti del bucket). Solo aggiunte e create or replace.
-- Per annullare: fonti/rollback/20261119160548_posti_famiglie.down.sql.

-- Famiglie esterne che occupano un posto: attive e non di prova, confermate o no.
create or replace function public.posti_occupati() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.famiglie f where f.esterna and not f.prova and f.stato = 'attiva'
$$;

-- Cancella le iscrizioni esterne non di prova mai confermate dopo 24 ore (senza figli: profili non li crea finché la mail
-- non è confermata). Cancellare l'utente porta via in cascata famiglia, consensi e invito personale. Restituisce quante.
create function public.pulisci_iscrizioni() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtext('iscrivi_famiglia'));
  with via as (
    delete from auth.users u using public.famiglie f
     where f.genitore_id = u.id and f.esterna and not f.prova and u.email_confirmed_at is null
       and f.creato < now() - interval '24 hours'
       and not exists (select 1 from public.studenti s where s.famiglia_id = f.id)
    returning u.id)
  select count(*)::int into n from via;
  return n;
end $$;

-- Prima del modulo: { valido, prova, posti_liberi }. Prima pulisce, così un posto scaduto risulta libero.
create or replace function public.stato_invito(codice text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  inv public.inviti;
begin
  perform public.pulisci_iscrizioni();
  inv := public.invito_valido(codice);
  if inv.codice is null then return jsonb_build_object('valido', false); end if;
  return jsonb_build_object('valido', true, 'prova', inv.prova,
    'posti_liberi', inv.prova or public.posti_occupati() < (select posti_esterni from public.impostazioni));
end $$;

-- Come prima, più la pulizia sotto lo stesso lucchetto prima di contare i posti.
create or replace function public.iscrivi_famiglia(genitore uuid, nome text, cognome text, codice text, versioni jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.inviti;
  fid uuid;
begin
  perform pg_advisory_xact_lock(hashtext('iscrivi_famiglia'));
  perform public.pulisci_iscrizioni();
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

revoke all on function public.pulisci_iscrizioni() from public, anon, authenticated;
grant execute on function public.pulisci_iscrizioni() to service_role;

-- La conferma della mail di un'iscrizione esterna non di prova si rifiuta dopo 24 ore: il posto non torna occupato.
create function app.conferma_entro_24_ore() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null and exists (
       select 1 from public.famiglie f
        where f.genitore_id = new.id and f.esterna and not f.prova and f.creato < now() - interval '24 hours') then
    raise exception 'iscrizione scaduta: sono passate più di 24 ore' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function app.conferma_entro_24_ore() from public, anon, authenticated;

create trigger famiglie_conferma_entro_24_ore before update of email_confirmed_at on auth.users
  for each row execute function app.conferma_entro_24_ore();

-- ---------------------------------------------------------------- dopo la revisione EGM del branch

-- Chiamate dei figli eliminati, per famiglia e per giorno, senza dati personali: reggono il tetto della famiglia e
-- il costo resta nel pannello admin. Vanno via con la famiglia («Elimina la famiglia»). Solo server.
create table public.consumi_archiviati (
  id          bigint generated always as identity primary key,
  famiglia_id uuid not null references public.famiglie (id) on delete cascade,
  giorno      date not null,
  chiamate    int not null check (chiamate >= 0),
  costo       numeric(12, 6) not null default 0 check (costo >= 0),
  creato      timestamptz not null default now()
);
create index consumi_archiviati_giorno on public.consumi_archiviati (famiglia_id, giorno);
alter table public.consumi_archiviati enable row level security;
-- Policy che non apre niente: la tabella è solo del server (service role), ma senza policy l'advisor la segnala.
create policy nessuno on public.consumi_archiviati for select to authenticated using (false);
revoke all on public.consumi_archiviati from anon, authenticated;
grant select, insert, update, delete on public.consumi_archiviati to service_role;

-- Prima di eliminare un figlio (funzione profili): nella stessa transazione toglie le sue righe di consumi e ne
-- aggiunge la somma per giorno alla famiglia. Ripeterla non archivia due volte (le righe non ci sono più).
create function public.archivia_consumi(studente uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  with via as (delete from public.consumi c where c.studente_id = archivia_consumi.studente returning c.giorno, c.costo),
       fam as (select s.famiglia_id from public.studenti s where s.id = archivia_consumi.studente)
  insert into public.consumi_archiviati (famiglia_id, giorno, chiamate, costo)
  select fam.famiglia_id, via.giorno, count(*), coalesce(sum(via.costo), 0)
    from via cross join fam where fam.famiglia_id is not null
   group by fam.famiglia_id, via.giorno;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.archivia_consumi(uuid) from public, anon, authenticated;
grant execute on function public.archivia_consumi(uuid) to service_role;

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

revoke all on function public.prenota_chiamata(uuid, date, text) from public, anon, authenticated;
grant execute on function public.prenota_chiamata(uuid, date, text) to service_role;

-- Tentativi su nomi utente che non esistono: stesso conteggio e stessi blocchi di un profilo vero, così dalla risposta non
-- si capisce se un nome esiste. Solo server; le righe ferme da 8 giorni si cancellano a ogni tentativo sconosciuto.
create table public.tentativi_nome (
  nome          text primary key check (length(nome) between 1 and 40),
  errori        int not null default 0 check (errori >= 0),
  blocchi       int not null default 0 check (blocchi >= 0),
  bloccato_fino timestamptz,
  ultimo_blocco timestamptz,
  aggiornato    timestamptz not null default now()
);
create index tentativi_nome_aggiornato on public.tentativi_nome (aggiornato);
alter table public.tentativi_nome enable row level security;
create policy nessuno on public.tentativi_nome for select to authenticated using (false); -- solo server, come sopra
revoke all on public.tentativi_nome from anon, authenticated;
grant select, insert, update, delete on public.tentativi_nome to service_role;

-- Accesso con nome utente + codice. Rispetto alla prima versione:
--   * un accesso giusto scende di un solo gradino della scala (prima la azzerava): chi prova a indovinare non riparte da
--     1 minuto ogni volta che il figlio entra, e chi sbaglia ogni tanto non arriva alle 24 ore;
--   * la scala riparte da zero con «Cambia il codice» del genitore o dopo 7 giorni senza blocchi;
--   * un nome che non esiste si conta e si blocca come uno vero (tentativi_nome).
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

revoke all on function public.accesso_con_nome(text, text) from public, anon, authenticated;
grant execute on function public.accesso_con_nome(text, text) to service_role;

-- Foto: nel bucket `fonti` carica solo chi studia (ruolo in app_metadata, scritto solo dal server). Prima ogni account
-- autenticato poteva caricare nella sua cartella, genitori e admin compresi. Policy restrittiva: si aggiunge alle altre.
-- Il profilo deve esistere ancora: dopo l'eliminazione il token del figlio vale fino a un'ora e non deve lasciare foto orfane.
create policy "fonti: solo chi studia carica" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'fonti' or ((select auth.jwt()) -> 'app_metadata' ->> 'ruolo' = 'studente'
              and exists (select 1 from public.studenti s where s.id = (select auth.uid()))));
create policy "fonti: solo chi studia modifica" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'fonti' or (select auth.jwt()) -> 'app_metadata' ->> 'ruolo' = 'studente')
  with check (bucket_id <> 'fonti' or ((select auth.jwt()) -> 'app_metadata' ->> 'ruolo' = 'studente'
              and exists (select 1 from public.studenti s where s.id = (select auth.uid()))));
-- L'app carica solo JPEG ridimensionati (1568 px, 0,92): bastano 10 MB a foto.
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg'] where id = 'fonti';
