-- Sblocco dal telefono del genitore.
--
-- Il telefono della studentessa non vede mai email o password, né quelle del
-- genitore né quelle del profilo. Chiede l'accesso (funzione `accesso`) e
-- mostra un codice di 6 caratteri; il genitore, sul SUO telefono, scrive quel
-- codice e dà l'ok (funzione `profili`). Solo allora il server prepara le
-- credenziali del profilo, che il telefono della studentessa ritira una volta
-- sola con un segreto che conosce solo lui, e poi vengono cancellate.
--
-- La tabella la toccano solo le Edge Function con la service role: nessuna
-- policy e nessun permesso per anon e authenticated.

create table public.richieste_accesso (
  id           uuid primary key default gen_random_uuid(),
  codice       text not null unique check (codice ~ '^[A-Z0-9]{6}$'),
  segreto_hash text not null,           -- sha256 del segreto del telefono che chiede
  dispositivo  text,                    -- "iPhone", "Android"… da mostrare al genitore
  stato        text not null default 'attesa'
               check (stato in ('attesa', 'approvata', 'rifiutata', 'consegnata')),
  genitore_id  uuid references auth.users (id) on delete cascade,
  studente_id  uuid references public.studenti (id) on delete cascade,
  -- credenziali del profilo: esistono solo fra l'ok del genitore e il ritiro
  email        text,
  password     text,
  creato       timestamptz not null default now(),
  scade        timestamptz not null default now() + interval '10 minutes',
  check (stato <> 'approvata' or (studente_id is not null and email is not null and password is not null)),
  check (stato = 'approvata' or (email is null and password is null))
);
create index richieste_accesso_scade on public.richieste_accesso (scade);

alter table public.richieste_accesso enable row level security;
revoke all on public.richieste_accesso from public, anon, authenticated;
grant select, insert, update, delete on public.richieste_accesso to service_role;

-- Il genitore imposta il codice a 4 cifre di una figlia dal suo telefono.
-- La chiama solo la funzione `profili` (service role), dopo aver controllato
-- che quella studentessa sia davvero sua.
create function public.imposta_pin_studente(studente uuid, pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if pin !~ '^\d{4,6}$' then raise exception 'il PIN deve avere da 4 a 6 cifre'; end if;
  insert into public.pin_profili (user_id, pin_hash)
  values (studente, extensions.crypt(pin, extensions.gen_salt('bf')))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash;
end $$;
revoke all on function public.imposta_pin_studente(uuid, text) from public, anon, authenticated;
grant execute on function public.imposta_pin_studente(uuid, text) to service_role;
