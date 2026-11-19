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
-- Solo funzioni (nuove o create or replace) e un trigger: nessuna tabella o colonna cambia.
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
