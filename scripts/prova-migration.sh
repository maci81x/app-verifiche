#!/bin/bash
# Prova di una migration nuova su una copia di sicurezza ripristinata in un Postgres 17 locale e temporaneo (issue #30):
# mai sul progetto vero. Ricrea la copia come ripristina-prova.sh, esegue le query di controllo, applica le migration
# indicate, rifà i conteggi e lancia test/db/rls.test.js sul database locale. Stampa solo conteggi, mai dati.
#   bash scripts/prova-migration.sh ~/Backup/app-verifiche/AAAA-MM-GG supabase/migrations/XXXX_nome.sql [altre...]
# Serve: brew install postgresql@17. Il cluster temporaneo vive in una cartella da buttare e si spegne alla fine.
set -euo pipefail
COPIA="${1:?quale copia? per esempio ~/Backup/app-verifiche/2026-11-16}"; shift
[[ $# -gt 0 ]] || { echo "quale migration?"; exit 2; }
PG=/opt/homebrew/opt/postgresql@17/bin
DIR=$(mktemp -d -t prova-migration-10piu)
PORTA=54331
export PGHOST=127.0.0.1 PGPORT=$PORTA PGUSER=postgres PGDATABASE=postgres
unset PGPASSWORD
trap '$PG/pg_ctl -D "$DIR/db" -m fast stop > /dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

$PG/initdb -D "$DIR/db" -U postgres --auth=trust -E UTF8 --locale=C > "$DIR/initdb.log"
$PG/pg_ctl -D "$DIR/db" -o "-p $PORTA -k $DIR" -l "$DIR/pg.log" -w start > /dev/null
q() { $PG/psql -X -q -v ON_ERROR_STOP=1 "$@"; }

# 1-4. Come ripristina-prova.sh: ruoli e schemi di Supabase, poi la copia.
q <<'SQL'
do $$ declare r text; begin
  foreach r in array array['anon','authenticated','service_role','authenticator','supabase_admin','supabase_auth_admin',
    'supabase_storage_admin','dashboard_user','pgbouncer','supabase_replication_admin','supabase_read_only_user'] loop
    if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
  end loop; end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create publication supabase_realtime;
SQL
q -v ON_ERROR_STOP=0 -f "$COPIA/ruoli.sql" > /dev/null 2>&1 || true
# Su Supabase la service role scavalca RLS: in locale va detto.
q -c 'alter role service_role bypassrls'
grep -vE '^CREATE EXTENSION IF NOT EXISTS "(pg_graphql|supabase_vault|pgsodium|pg_net|pg_cron)"' "$COPIA/interno.sql" | q -f - > /dev/null
grep -vE '^CREATE EXTENSION IF NOT EXISTS "(pg_graphql|supabase_vault|pgsodium|pg_net|pg_cron)"' "$COPIA/schema.sql" | q -f - > /dev/null
q -f "$COPIA/dati.sql" > /dev/null
# I permessi che Supabase dà da sé sugli schemi interni (non sono nella copia): storage con le sue policy, auth.uid().
q <<'SQL'
grant usage on schema storage, auth to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key);
SQL

conti() { $PG/psql -XAt -F $'\t' -c "select 'auth.users', count(*) from auth.users union all
  select table_schema || '.' || table_name, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint
    from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"; }

echo "== query di controllo (5.8 del piano)"
$PG/psql -XAt -c "select 'figli con più genitori: ' || count(*) from (select studente_id from public.genitori_studenti group by 1 having count(*) > 1) x"
$PG/psql -XAt -c "select 'nomi doppi: ' || count(*) from (select lower(trim(nome)) from public.studenti group by 1 having count(*) > 1) x"
$PG/psql -XAt -c "select 'figli senza genitore: ' || count(*) from public.studenti s where not exists (select 1 from public.genitori_studenti g where g.studente_id = s.id)"
conti > "$DIR/prima.tsv"

for m in "$@"; do echo "== applico $m"; q -f "$m"; done

echo "== dopo"
conti > "$DIR/dopo.tsv"
join -t $'\t' -a 1 -a 2 -e '-' -o 0,1.2,2.2 "$DIR/prima.tsv" "$DIR/dopo.tsv" | awk -F'\t' '{ s = ($2 == $3) ? "uguale" : (($2 == "-") ? "nuova" : "CAMBIATA"); print s "\t" $1 "\t" $2 " -> " $3 }'
$PG/psql -XAt -c "select 'famiglie: ' || count(*) || ' (esistenti ' || count(*) filter (where not esterna) || ')' from public.famiglie" || true
$PG/psql -XAt -c "select 'profili senza nome utente: ' || count(*) filter (where nome_utente is null) || ', senza famiglia: ' || count(*) filter (where famiglia_id is null) from public.studenti" || true

echo "== test dei permessi sul database locale"
RLS_PSQL="postgresql://postgres@127.0.0.1:$PORTA/postgres" node --test "$(dirname "$0")/../test/db/rls.test.js"
