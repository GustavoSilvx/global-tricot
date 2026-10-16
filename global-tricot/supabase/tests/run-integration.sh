#!/usr/bin/env bash
# Testes de INTEGRAÇÃO: serviços do app + supabase-js reais contra PostgREST + Postgres (com RLS).
# Requer: Postgres local com superusuário "postgres" acessível via `su postgres`, e o binário do
# PostgREST (https://github.com/PostgREST/postgrest/releases) em $POSTGREST_BIN.
# O Storage do Supabase NÃO é coberto aqui (é simulado nos testes).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB=${IT_DB:-gt_int}
POSTGREST_BIN=${POSTGREST_BIN:-postgrest}
psqlpg() { su postgres -c "psql -q -v ON_ERROR_STOP=1 $*"; }

psqlpg "-c 'drop database if exists $DB' -c 'create database $DB'" 2>/dev/null
for f in tests/00_supabase_stubs.sql migrations/0001_schema.sql migrations/0002_rls.sql migrations/0003_storage.sql migrations/0004_seed.sql; do
  psqlpg "-d $DB -f $ROOT/supabase/$f"
done
psqlpg "-d $DB" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login password 'authpass'; end if;
end $$;
grant anon, authenticated to authenticator;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001','admin@loja.test'), ('bbbbbbbb-0000-0000-0000-000000000002','cliente@loja.test');
insert into public.admin_users (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
SQL

setsid "$POSTGREST_BIN" "$ROOT/supabase/tests/postgrest.conf" >/tmp/pgrst.log 2>&1 </dev/null &
PGRST=$!
setsid node "$ROOT/supabase/tests/rest-proxy.mjs" >/tmp/proxy.log 2>&1 </dev/null &
PROXY=$!
trap 'kill $PGRST $PROXY 2>/dev/null || true' EXIT
sleep 3
cd "$ROOT" && npx vitest run -c vitest.integration.config.ts
