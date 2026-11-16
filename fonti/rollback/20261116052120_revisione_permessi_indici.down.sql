-- Annulla 20261116052120_revisione_permessi_indici.sql (revisione Supabase).
-- Rimette i permessi di prima e toglie i due indici.
begin;
grant truncate on all tables in schema public to authenticated;
grant all on public.pin_profili to authenticated;
grant execute on function public.imposta_pin(text), public.verifica_pin(text) to authenticated;
drop index if exists public.domande_concetto;
drop index if exists public.genitori_studenti_studente;
delete from supabase_migrations.schema_migrations where version = '20261116052120';
commit;
