-- Annulla 20261116062100_sessioni_ripasso.sql (issue #21).
-- Il vincolo vecchio non ammette tipo 'ripasso': le sessioni di ripasso guidato vanno tolte prima
-- (con le loro domande e risposte, in cascata). Salvale prima se servono.
begin;
delete from public.sessioni where tipo = 'ripasso';
alter table public.sessioni drop constraint sessioni_tipo_check;
alter table public.sessioni add constraint sessioni_tipo_check check (tipo in ('miste', 'chiuse', 'aperte'));
delete from supabase_migrations.schema_migrations where version = '20261116062100';
commit;
