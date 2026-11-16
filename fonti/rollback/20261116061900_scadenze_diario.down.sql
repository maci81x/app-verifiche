-- Annulla 20261116061900_scadenze_diario.sql (issue #19).
-- ATTENZIONE: cancella tutte le scadenze e la serie dei giorni del diario.
-- Prima di eseguirlo, salva i dati se servono.
begin;
create or replace function public.svuota_memoria() returns void
language sql set search_path = '' as $$
  delete from public.sessioni  where studente_id = auth.uid();
  delete from public.argomenti where studente_id = auth.uid();
$$;
revoke all on function public.svuota_memoria() from public, anon;
grant execute on function public.svuota_memoria() to authenticated;
drop table if exists public.giorni_diario;
drop table if exists public.scadenze;
delete from supabase_migrations.schema_migrations where version = '20261116061900';
commit;
