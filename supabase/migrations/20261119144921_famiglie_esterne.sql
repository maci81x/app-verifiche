-- Famiglie esterne su invito (issue #30).
--
-- Cosa salva:
--   famiglie       una riga per famiglia (genitore, esterna o di casa, stato, limiti al giorno per figlio, chi l'ha invitata);
--   inviti         i codici invito (uno personale per utente, più i codici di prova monouso);
--   consensi       i testi accettati dal genitore, con versione e ora;
--   consumi        una riga per ogni chiamata al modello (token e costo stimato);
--   impostazioni   una sola riga: quante famiglie esterne possono iscriversi;
--   accessi_admin  il registro di quando l'amministratore apre i contenuti di un profilo.
-- Colonne nuove: studenti.nome_utente, studenti.cognome, studenti.famiglia_id, pin_profili.blocchi, pin_profili.ultimo_blocco.
--
-- Chi scrive: solo le Edge Function con la service role (`famiglie`, `profili`, `admin`, `modello`, `accedi`).
-- Il genitore legge la sua famiglia, i suoi consensi, il suo invito e i consumi dei figli; nessuno scrive dall'app.
--
-- Solo aggiunte, più tre cambi ammessi dalla guida:
--   * `create or replace` di imposta_pin_di (azzera anche i blocchi) e di app.posso_leggere (header x-figlio, può solo restringere);
--   * una stretta di permessi su studenti: chi studia aggiorna solo `scelte` (prima poteva cambiare ogni colonna della sua
--     riga, e con famiglia_id avrebbe potuto spostarsi in una famiglia con limiti più alti).
-- Per annullare: fonti/rollback/20261119144921_famiglie_esterne.down.sql.

-- ---------------------------------------------------------------- famiglie

create table public.famiglie (
  id               uuid primary key default gen_random_uuid(),
  genitore_id      uuid not null unique references auth.users (id) on delete cascade, -- unico per ora: un genitore per famiglia
  nome             text check (nome is null or length(nome) between 1 and 40),
  cognome          text check (cognome is null or length(cognome) between 1 and 40),
  esterna          boolean not null default false,
  prova            boolean not null default false, -- famiglia di prova: mail confermata subito, non occupa un posto
  stato            text not null default 'attiva' check (stato in ('attiva', 'sospesa')),
  limite_aiuti     int not null default 10 check (limite_aiuti >= 0),    -- predefiniti: quelli delle famiglie esterne
  limite_chiamate  int not null default 60 check (limite_chiamate >= 0),
  invitata_da      uuid references auth.users (id) on delete set null, -- titolare del codice usato
  codice_invito_usato text,
  creato           timestamptz not null default now()
);
create index famiglie_invitata_da on public.famiglie (invitata_da);

alter table public.studenti
  add column nome_utente text check (nome_utente is null or (nome_utente = lower(nome_utente) and length(nome_utente) between 1 and 40)),
  add column cognome     text check (cognome is null or length(cognome) between 1 and 40),
  -- restrict: una famiglia (e l'account del genitore) non si cancella finché ha figli, nemmeno dalla dashboard
  add column famiglia_id uuid references public.famiglie (id) on delete restrict;
create unique index studenti_nome_utente on public.studenti (nome_utente);
create index studenti_famiglia on public.studenti (famiglia_id);

alter table public.pin_profili
  add column blocchi       int not null default 0 check (blocchi >= 0),
  add column ultimo_blocco timestamptz;

-- ---------------------------------------------------------------- inviti, consensi

create table public.inviti (
  codice      text primary key check (codice ~ '^[a-hjkmnp-z2-9]{8}$'), -- l'alfabeto di _shared/famiglie.js: niente 0 1 o l i
  titolare_id uuid not null references auth.users (id) on delete cascade,
  prova       boolean not null default false,
  usato       timestamptz,            -- solo i codici di prova: valgono una volta
  creato      timestamptz not null default now(),
  check (prova or usato is null)
);
create unique index inviti_personale on public.inviti (titolare_id) where not prova; -- un solo codice personale per utente
create index inviti_titolare on public.inviti (titolare_id);

create table public.consensi (
  id          uuid primary key default gen_random_uuid(),
  genitore_id uuid not null references auth.users (id) on delete cascade,
  documento   text not null check (documento in ('privacy', 'condizioni', 'dati_figlio')),
  versione    text not null check (length(versione) between 1 and 20),
  accettato   timestamptz not null default now()
);
create index consensi_genitore on public.consensi (genitore_id);

-- ---------------------------------------------------------------- consumi

create table public.consumi (
  id            bigint generated always as identity primary key,
  studente_id   uuid not null references public.studenti (id) on delete cascade,
  giorno        date not null, -- giorno di Roma, calcolato dalla funzione
  azione        text not null,
  modello       text not null,
  input         int not null default 0 check (input >= 0),
  output        int not null default 0 check (output >= 0),
  cache_scritti int not null default 0 check (cache_scritti >= 0),
  cache_letti   int not null default 0 check (cache_letti >= 0),
  costo         numeric(12, 6) not null default 0 check (costo >= 0), -- dollari, tariffe di _shared/modelli.js
  creato        timestamptz not null default now()
);
create index consumi_giorno on public.consumi (studente_id, giorno); -- tetto del giorno e chiave esterna

-- ---------------------------------------------------------------- solo server

create table public.impostazioni (
  id            boolean primary key default true check (id), -- una sola riga
  posti_esterni int not null default 2 check (posti_esterni >= 0)
);
insert into public.impostazioni default values;

-- Senza chiavi esterne: il registro resta anche dopo la cancellazione del profilo o dell'account.
create table public.accessi_admin (
  id          bigint generated always as identity primary key,
  admin_id    uuid not null,
  studente_id uuid not null,
  azione      text not null,
  motivo      text not null check (length(trim(motivo)) between 1 and 300),
  creato      timestamptz not null default now()
);
create index accessi_admin_recenti on public.accessi_admin (creato desc);

-- ---------------------------------------------------------------- famiglie esistenti

-- Una famiglia «di casa» per ogni genitore che ha già figli, con i limiti di prima (30 aiuti, 150 chiamate).
insert into public.famiglie (genitore_id, limite_aiuti, limite_chiamate)
select distinct g.genitore_id, 30, 150 from public.genitori_studenti g;

update public.studenti s
   set famiglia_id = (select f.id from public.genitori_studenti g join public.famiglie f on f.genitore_id = g.genitore_id
                        join auth.users u on u.id = g.genitore_id
                       where g.studente_id = s.id order by u.created_at, g.genitore_id limit 1); -- con più genitori: l'account più vecchio

-- I profili nati prima della #30 entrano con il loro nome (in minuscolo) come nome utente.
-- Se due profili hanno lo stesso nome, l'indice unico fa fallire la migration e non cambia niente.
update public.studenti set nome_utente = lower(trim(nome));

-- ---------------------------------------------------------------- RLS e permessi

alter table public.famiglie      enable row level security;
alter table public.inviti        enable row level security;
alter table public.consensi      enable row level security;
alter table public.consumi       enable row level security;
alter table public.impostazioni  enable row level security;
alter table public.accessi_admin enable row level security;

create policy leggi on public.famiglie for select to authenticated using (genitore_id = (select auth.uid()));
create policy leggi on public.consensi for select to authenticated using (genitore_id = (select auth.uid()));
create policy leggi on public.inviti   for select to authenticated using (titolare_id = (select auth.uid()));
create policy leggi on public.consumi  for select to authenticated using (app.posso_leggere(studente_id));
-- impostazioni e accessi_admin: nessuna policy, solo la service role.

revoke all on public.famiglie, public.inviti, public.consensi, public.consumi, public.impostazioni, public.accessi_admin
  from anon, authenticated;
grant select on public.famiglie, public.inviti, public.consensi, public.consumi to authenticated;
-- Le Edge Function scrivono con la service role: grant scritti, non affidati ai default del progetto (guida §4).
grant select, insert, update, delete on public.famiglie, public.inviti, public.consensi, public.consumi, public.impostazioni,
  public.accessi_admin to service_role;

-- Chi studia aggiorna solo le sue ultime scelte (app.js, «scelte»); il resto della riga lo scrive il server.
revoke insert, update on public.studenti from authenticated;
grant update (scelte) on public.studenti to authenticated;

-- ---------------------------------------------------------------- funzioni cambiate

-- Il genitore cambia il codice: toglie anche il blocco e riporta l'attesa al minimo. Solo 4 cifre, come accesso_con_nome
-- e il tastierino (prima ne accettava fino a 6).
create or replace function public.imposta_pin_di(studente uuid, pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.studenti s where s.id = studente) then
    raise exception 'profilo inesistente';
  end if;
  if coalesce(pin, '') !~ '^\d{4}$' then raise exception 'il PIN deve avere 4 cifre'; end if;
  insert into public.pin_profili (user_id, pin_hash)
  values (studente, extensions.crypt(pin, extensions.gen_salt('bf')))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, errori = 0, bloccato_fino = null, blocchi = 0, ultimo_blocco = null;
end $$;

-- Vero se chi chiama è chi studia o un suo genitore. Novità (issue #30): se la richiesta porta l'header
-- `x-figlio` («Guarda come lo vede»), il genitore legge solo le righe di quel figlio. L'header compare solo
-- come condizione in più nel ramo del genitore: può togliere righe, mai aggiungerne. Fuori da PostgREST
-- (SQL editor, service role) request.headers non c'è e vale tutto come prima.
create or replace function app.posso_leggere(studente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- ponytail: request.headers si legge a ogni riga; con questi volumi non conta.
  select studente = auth.uid()
      or (exists (select 1 from public.genitori_studenti g
                   where g.genitore_id = auth.uid() and g.studente_id = studente)
          and coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-figlio', studente::text) = studente::text)
$$;

-- ---------------------------------------------------------------- funzioni nuove (solo service role)

-- Accesso con nome utente + codice (sostituisce accesso_con_pin, che resta ma non si usa più).
-- { ok: true, studente_id } | { ok: false, attendi: secondi } | { ok: false, sospesa: true }.
-- 5 errori di fila = blocco; l'attesa cresce a ogni blocco (1, 5, 15, 60 minuti, 4 ore, poi 24 ore) e riparte
-- da 1 minuto solo dopo un accesso giusto o un cambio di codice del genitore: aspettare non azzera la scala, così chi
-- prova a indovinare non supera circa 5 codici al giorno dopo le prime ore. La sospensione si dice solo dopo il
-- codice giusto, così non rivela che il nome esiste. Solo 4 cifre, come il tastierino dell'app e imposta_pin_di. Un nome sconosciuto risponde senza bcrypt: dai tempi si può capire se esiste (accettato,
-- il nome utente non è un segreto).
create function public.accesso_con_nome(utente text, pin text) returns jsonb
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

-- Famiglie esterne che occupano un posto: attive, non di prova, con la mail confermata o iscritte da meno di 24 ore.
create function public.posti_occupati() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from public.famiglie f join auth.users u on u.id = f.genitore_id
   where f.esterna and not f.prova and f.stato = 'attiva'
     and (u.email_confirmed_at is not null or f.creato > now() - interval '24 hours')
$$;

-- Un codice è valido se esiste e, se di prova, non è ancora stato usato.
create function public.invito_valido(codice text) returns public.inviti
language sql stable security definer set search_path = '' as $$
  select i.* from public.inviti i
   where i.codice = lower(trim(coalesce($1, '')))
     and (not i.prova or i.usato is null)
$$;

-- Prima del modulo: { valido, prova, posti_liberi }.
create function public.stato_invito(codice text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.inviti;
begin
  inv := public.invito_valido(codice);
  if inv.codice is null then return jsonb_build_object('valido', false); end if;
  return jsonb_build_object('valido', true, 'prova', inv.prova,
    'posti_liberi', inv.prova or public.posti_occupati() < (select posti_esterni from public.impostazioni));
end $$;

-- Iscrizione: un lucchetto serializza le iscrizioni, così due genitori nello stesso istante non superano il tetto.
-- L'utente lo crea prima la Edge Function `famiglie` (e lo cancella se qui si rifiuta).
-- versioni: { privacy, condizioni, dati_figlio } già controllate contro _shared/consensi.js.
create function public.iscrivi_famiglia(genitore uuid, nome text, cognome text, codice text, versioni jsonb)
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

-- Per ogni richiesta al modello, sotto un lucchetto per profilo: stato della famiglia e tetto delle chiamate di oggi; se si può, prenota subito una riga in `consumi` (la Edge Function la completa a fine richiesta o la
-- cancella se il modello non è stato chiamato). Richieste parallele vedono le prenotazioni delle altre: il tetto non si
-- supera (al massimo l'ultima richiesta accettata lo passa delle sue chiamate). Senza famiglia valgono i limiti delle
-- famiglie esterne (10 aiuti, 60 chiamate). La mail non confermata la ferma `profili`: senza figli non ci sono chiamate.
-- { ok: true, id, limite_aiuti, tetto } | { ok: false, errore: famiglia_sospesa | tetto_giornaliero, tetto }
create function public.prenota_chiamata(studente uuid, oggi date, azione text) returns jsonb
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

revoke all on function public.accesso_con_nome(text, text), public.posti_occupati(), public.stato_invito(text),
  public.invito_valido(text),
  public.iscrivi_famiglia(uuid, text, text, text, jsonb), public.prenota_chiamata(uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.accesso_con_nome(text, text), public.posti_occupati(), public.stato_invito(text),
  public.invito_valido(text),
  public.iscrivi_famiglia(uuid, text, text, text, jsonb), public.prenota_chiamata(uuid, date, text)
  to service_role;
