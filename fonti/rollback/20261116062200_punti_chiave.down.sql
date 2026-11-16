-- Annulla 20261116062200_punti_chiave.sql (issue #22).
-- Cancella solo la cache delle «5 cose da sapere»: l'app le rigenera quando servono.
begin;
drop table if exists public.punti_chiave;
delete from supabase_migrations.schema_migrations where version = '20261116062200';
commit;
