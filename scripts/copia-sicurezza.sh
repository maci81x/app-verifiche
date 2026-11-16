#!/bin/bash
# Copia di sicurezza settimanale di 10+ sul Mac (mai su GitHub: il repo è pubblico).
# Parte da launchd (scripts/installa-copia.sh): all'accensione e poi ogni ora, ma lavora solo se manca la
# copia della domenica più recente. Così la copia si fa ogni domenica, e se il Mac era spento alla prima accensione dopo.
# Scrive ~/Backup/app-verifiche/AAAA-MM-GG/ con:
#   ruoli.sql, schema.sql, dati.sql    come `supabase db dump` (per ripristinare su un progetto Supabase nuovo)
#   interno.sql                         schema di auth e storage (per ripristinare anche su un Postgres vuoto)
#   foto/                               il bucket `fonti` dello storage
#   MANIFESTO.txt                       conteggi e impronte sha256
# Tiene le ultime 4 copie. Come si ripristina: CLAUDE.md, sezione «Copia di sicurezza».
#   FORZA=1 bash copia-sicurezza.sh   fa la copia anche se quella della settimana c'è già
set -euo pipefail
REF="nnzkmjpylwtinplepxgz"
DEST="${COPIA_DEST:-$HOME/Backup/app-verifiche}" # COPIA_DEST solo per le prove: un nome generico come DEST esportato nella shell farebbe danni
TIENI=4
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/libpq/bin:/usr/local/bin:/usr/bin:/bin"
# Nella shell ci sono variabili di un altro progetto: la CLI deve usare solo il suo login.
sb() { env -u SUPABASE_ACCESS_TOKEN -u SUPABASE_PROJECT_REF supabase "$@"; }
avviso() { osascript -e "display notification \"$1\" with title \"Copia di sicurezza 10+\"" 2>/dev/null || true; }

mkdir -p "$DEST"
domenica=$(date -v-"$(date +%w)"d +%Y-%m-%d) # la domenica più recente (oggi, se è domenica)
ultima=$(ls -d "$DEST"/20??-??-?? 2>/dev/null | sort | tail -1 | xargs -n1 basename 2>/dev/null || true)
if [[ -z "${FORZA:-}" && -n "$ultima" && ! "$ultima" < "$domenica" ]]; then [[ -n "${SOLO_CONTROLLO:-}" ]] && echo "c'è già"; exit 0; fi
if [[ -n "${SOLO_CONTROLLO:-}" ]]; then echo "da fare (ultima: ${ultima:-nessuna}, domenica: $domenica)"; exit 0; fi

echo "== $(date '+%Y-%m-%d %H:%M') copia di sicurezza"
lavoro="$DEST/.collegamento"   # cartella collegata al progetto per la CLI (solo il riferimento, nessuna password)
mkdir -p "$lavoro/supabase/.temp"
echo "$REF" > "$lavoro/supabase/.temp/project-ref"
# Connessione IPv4 dal pooler (come dopo `supabase link`); l'utente e la password li crea la CLI a ogni copia.
echo "postgresql://postgres.$REF@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" > "$lavoro/supabase/.temp/pooler-url"
[[ -f "$lavoro/supabase/config.toml" ]] || echo 'project_id = "app-verifiche"' > "$lavoro/supabase/config.toml"
tmp="$DEST/.in-corso"
rm -rf "$tmp"; mkdir -p "$tmp"
trap 'avviso "Non riuscita: guarda $DEST/copia.log"; echo "NON RIUSCITA"' ERR
cd "$lavoro"

# Database: gli script di `supabase db dump --dry-run` (pg_dump con un utente temporaneo della CLI).
sb db dump --linked --role-only --dry-run 2>/dev/null | bash > "$tmp/ruoli.sql"
sb db dump --linked --dry-run 2>/dev/null | bash > "$tmp/schema.sql"
sb db dump --linked --data-only --dry-run 2>/dev/null | bash > "$tmp/dati.sql"
# Schema di auth e storage, con la stessa connessione temporanea (le righe export dello script).
eval "$(sb db dump --linked --dry-run 2>/dev/null | grep '^export PG')"
pg_dump --role postgres --schema-only --no-owner --no-privileges --schema auth --schema storage > "$tmp/interno.sql"
attese=$(psql -XAtc "set role postgres" -c "select count(*) from storage.objects where bucket_id = 'fonti'" | tail -1)
# Per la prova di ripristino: le righe di ogni tabella e l'elenco delle foto con la dimensione, presi dal database vero.
psql -XAt -F $'\t' -v ON_ERROR_STOP=1 <<'SQL' | grep -v '^SET$' > "$tmp/conteggi.tsv"
set role postgres;
select format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind = 'r' and (n.nspname = 'public' or (n.nspname, c.relname) in (('auth', 'users'), ('storage', 'objects')))
 order by 1 \gexec
SQL
psql -XAt -F $'\t' -c "set role postgres" -c "select name, metadata->>'size' from storage.objects where bucket_id = 'fonti' order by name" | tail -n +2 > "$tmp/foto.tsv"
unset PGPASSWORD

# Foto: tutto il bucket fonti.
sb storage cp -r ss:///fonti "$tmp/foto" --experimental --linked > /dev/null 2> "$DEST/.foto.err" || { grep -v '^Downloading' "$DEST/.foto.err"; false; }

# Controlli: niente file vuoti, tutte le foto.
grep -q 'CREATE TABLE IF NOT EXISTS "public"."argomenti"' "$tmp/schema.sql"
grep -q 'INSERT INTO "public"."studenti"' "$tmp/dati.sql"
grep -q 'CREATE TABLE auth.users' "$tmp/interno.sql"
foto=$(find "$tmp/foto" -type f | wc -l | tr -d ' ')
if [[ "$foto" != "$attese" ]]; then echo "foto scaricate $foto, attese $attese"; false; fi
{
  echo "Copia di sicurezza 10+ del $(date '+%Y-%m-%d %H:%M'), progetto $REF"
  echo "foto: $foto (attese $attese), $(du -sh "$tmp/foto" | cut -f1)"
  for f in ruoli schema dati interno; do echo "$f.sql: $(wc -l < "$tmp/$f.sql" | tr -d ' ') righe, sha256 $(shasum -a 256 "$tmp/$f.sql" | cut -d' ' -f1)"; done
  echo "righe per tabella nel database al momento della copia:"
  sed 's/^/  /' "$tmp/conteggi.tsv"
} > "$tmp/MANIFESTO.txt"
chmod -R go-rwx "$tmp"

oggi=$(date +%Y-%m-%d)
rm -rf "${DEST:?}/$oggi"
mv "$tmp" "$DEST/$oggi"
# Le ultime TIENI copie, le altre si cancellano.
ls -d "$DEST"/20??-??-?? | sort | sed -e :a -e '$d;N;2,'"$TIENI"'ba' -e 'P;D' | while read -r vecchia; do rm -rf "$vecchia"; echo "tolta $vecchia"; done
echo "fatta: $DEST/$oggi ($foto foto)"
avviso "Fatta: $oggi, $foto foto"
