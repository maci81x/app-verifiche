-- Annulla 20261116062000_ripasso_stato.sql (issue #20).
-- ATTENZIONE: cancella lo stato della ripetizione dilazionata di tutti i profili.
begin;
drop table if exists public.ripasso_stato;
delete from supabase_migrations.schema_migrations where version = '20261116062000';
commit;
