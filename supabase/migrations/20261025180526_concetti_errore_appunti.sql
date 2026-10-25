-- Quando quaderno e libro si contraddicono vale il libro: qui resta scritto
-- cosa riportano di sbagliato gli appunti, da mostrare all'alunna.
alter table public.concetti add column errore_appunti text;
