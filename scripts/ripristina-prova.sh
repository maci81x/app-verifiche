#!/bin/bash
# Prova di ripristino di una copia di sicurezza su un Postgres 17 locale e temporaneo: mai sul progetto vero.
# Ricrea ruoli, schemi interni (auth, storage), schema e dati, poi confronta le righe di ogni tabella con quelle
# del database al momento della copia (conteggi.tsv) e le foto con l'elenco dello storage (foto.tsv).
#   bash scripts/ripristina-prova.sh ~/Backup/app-verifiche/AAAA-MM-GG
# Serve: brew install postgresql@17. Il cluster temporaneo vive in una cartella da buttare e si spegne alla fine.
set -euo pipefail
COPIA="${1:?quale copia? per esempio ~/Backup/app-verifiche/2026-11-16}"
PG=/opt/homebrew/opt/postgresql@17/bin
DIR=$(mktemp -d -t ripristino-10piu)
PORTA=54329
export PGHOST=127.0.0.1 PGPORT=$PORTA PGUSER=postgres PGDATABASE=postgres
unset PGPASSWORD
trap '$PG/pg_ctl -D "$DIR/db" -m fast stop > /dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

$PG/initdb -D "$DIR/db" -U postgres --auth=trust -E UTF8 --locale=C > "$DIR/initdb.log"
$PG/pg_ctl -D "$DIR/db" -o "-p $PORTA -k $DIR" -l "$DIR/pg.log" -w start > /dev/null
q() { $PG/psql -X -q -v ON_ERROR_STOP=1 "$@"; }

# 1. Quello che su Supabase c'è già: i ruoli di sistema e gli schemi delle estensioni.
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
# 2. I ruoli della copia (quelli già creati sopra danno solo un avviso).
q -v ON_ERROR_STOP=0 -f "$COPIA/ruoli.sql" > /dev/null 2>&1 || true
# 3. Auth e storage, poi lo schema dell'app. Le estensioni che esistono solo su Supabase (pg_graphql, vault…)
#    si saltano: non servono ai dati.
# Policy e trigger di auth/storage possono usare tabelle e funzioni dell'app (issue #30, #35): si creano dopo lo
# schema dell'app. Il dump interno si divide in due: prima tutto il resto, poi le CREATE POLICY e i trigger verso app.
python3 -I -c '
import sys
dentro, prima, dopo = None, [], []
for riga in open(sys.argv[1], encoding="utf-8"):
    if dentro is None and (riga.startswith("CREATE POLICY ") or (riga.startswith("CREATE TRIGGER ") and "app." in riga)):
        dentro = []
    if dentro is not None:
        dentro.append(riga)
        if riga.rstrip().endswith(";"):
            dopo.extend(dentro); dentro = None
    else:
        prima.append(riga)
open(sys.argv[2], "w").writelines(prima); open(sys.argv[3], "w").writelines(dopo)
' "$COPIA/interno.sql" "$DIR/interno-prima.sql" "$DIR/interno-dopo.sql"
grep -vE '^CREATE EXTENSION IF NOT EXISTS "(pg_graphql|supabase_vault|pgsodium|pg_net|pg_cron)"' "$DIR/interno-prima.sql" | q -f - > /dev/null
grep -vE '^CREATE EXTENSION IF NOT EXISTS "(pg_graphql|supabase_vault|pgsodium|pg_net|pg_cron)"' "$COPIA/schema.sql" | q -f - > /dev/null
q -f "$DIR/interno-dopo.sql" > /dev/null
# 4. I dati (dati.sql mette già session_replication_role = replica: niente trigger durante il caricamento).
q -f "$COPIA/dati.sql" > /dev/null

# 5. Confronto delle righe tabella per tabella.
diversi=0
while IFS=$'\t' read -r tabella attese; do
  trovate=$($PG/psql -XAtc "select count(*) from $tabella")
  if [[ "$trovate" == "$attese" ]]; then echo "ok  $tabella: $trovate righe"; else echo "NO  $tabella: $trovate righe, attese $attese"; diversi=$((diversi + 1)); fi
done < "$COPIA/conteggi.tsv"

# 6. Le foto: ogni file dell'elenco dello storage c'è, con la stessa dimensione, ed è un'immagine (JPEG, PNG o HEIC dell'iPhone).
foto_no=0; foto_ok=0
while IFS=$'\t' read -r nome dimensione; do
  f="$COPIA/foto/$nome"
  if [[ -f "$f" && "$(stat -f %z "$f")" == "$dimensione" ]] && head -c 12 "$f" | xxd -p | grep -qE '^(ffd8ff|89504e47|.{8}66747970)'; then foto_ok=$((foto_ok + 1))
  else echo "NO  foto $nome"; foto_no=$((foto_no + 1)); fi
done < "$COPIA/foto.tsv"
echo "foto: $foto_ok uguali all'elenco dello storage, $foto_no diverse o mancanti"
# Una prova sui dati ripristinati: ogni foto nel database ha il suo file nella copia.
mancano=$($PG/psql -XAtc "select name from storage.objects where bucket_id = 'fonti'" | while read -r nome; do [[ -f "$COPIA/foto/$nome" ]] || echo "$nome"; done | wc -l | tr -d ' ')
[[ "$mancano" == "0" ]] || { echo "NO  $mancano foto del database senza file nella copia"; foto_no=$((foto_no + mancano)); }

if [[ $diversi -eq 0 && $foto_no -eq 0 ]]; then echo "RIPRISTINO RIUSCITO"; else echo "RIPRISTINO CON DIFFERENZE: $diversi tabelle, $foto_no foto"; exit 1; fi
