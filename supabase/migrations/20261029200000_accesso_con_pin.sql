-- Accesso con nome + codice da qualsiasi dispositivo (issue #1).
--
-- Il codice ora si controlla sul server senza la sessione della ragazza: lo fa
-- la Edge Function `accedi` con la service role, e il blocco dopo tre errori
-- vive qui, non più nel browser dove bastava cancellare i dati per aggirarlo.
--
-- Le due funzioni stanno in public perché PostgREST espone solo quello schema
-- (config.toml → api.schemas), ma l'esecuzione è concessa solo a service_role:
-- anon e authenticated non possono chiamarle. Nessuna policy nuova: l'anonimo
-- continua a non leggere niente direttamente dal database.

alter table public.pin_profili
  add column errori        int not null default 0 check (errori >= 0),
  add column bloccato_fino timestamptz;

-- { ok: true } se il codice è giusto; { ok: false, attendi: secondi } altrimenti.
-- attendi = 0 per un codice sbagliato, 60 al terzo errore di fila.
-- Profilo senza PIN = nessun accesso. Diverso da verifica_pin, che girava con la
-- sessione della ragazza già aperta: qui chi chiama è anonimo, e un profilo senza
-- codice darebbe la sessione a chiunque. Il genitore lo sistema con "Cambia codice".
create function public.accesso_con_pin(studente uuid, pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.pin_profili%rowtype;
begin
  if not exists (select 1 from public.studenti s where s.id = studente) then
    return jsonb_build_object('ok', false, 'attendi', 0);
  end if;

  -- for update: due tentativi in parallelo non possono saltare il conteggio
  select * into r from public.pin_profili p where p.user_id = studente for update;
  if not found then
    return jsonb_build_object('ok', false, 'attendi', 0);
  end if;

  if r.bloccato_fino > now() then
    return jsonb_build_object('ok', false,
      'attendi', ceil(extract(epoch from r.bloccato_fino - now()))::int);
  end if;

  if coalesce(pin, '') ~ '^\d{4,6}$' and r.pin_hash = extensions.crypt(pin, r.pin_hash) then
    update public.pin_profili set errori = 0, bloccato_fino = null where user_id = studente;
    return jsonb_build_object('ok', true);
  end if;

  if r.errori + 1 >= 3 then
    update public.pin_profili set errori = 0, bloccato_fino = now() + interval '60 seconds'
     where user_id = studente;
    return jsonb_build_object('ok', false, 'attendi', 60);
  end if;

  update public.pin_profili set errori = r.errori + 1 where user_id = studente;
  return jsonb_build_object('ok', false, 'attendi', 0);
end $$;

-- Il genitore fissa o cambia il codice di una figlia senza avere la sua sessione.
-- Che il genitore sia collegato a quella figlia lo controlla la Edge Function.
create function public.imposta_pin_di(studente uuid, pin text) returns void
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

revoke all on function public.accesso_con_pin(uuid, text), public.imposta_pin_di(uuid, text)
  from public, anon, authenticated;
grant execute on function public.accesso_con_pin(uuid, text), public.imposta_pin_di(uuid, text)
  to service_role;
