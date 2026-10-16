#!/usr/bin/env bash
# Roda migrations + testes de RLS em um Postgres LOCAL (com stubs do Supabase).
# Uso: ./supabase/tests/run-local.sh   (requer psql e um servidor Postgres acessível)
set -euo pipefail
DB=${DB:-gt_test}
HERE="$(cd "$(dirname "$0")/.." && pwd)"
psql -q -c "drop database if exists $DB" -c "create database $DB" postgres
for f in tests/00_supabase_stubs.sql migrations/0001_schema.sql migrations/0002_rls.sql migrations/0003_storage.sql migrations/0004_seed.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/$f"
done
psql -q -d "$DB" -f "$HERE/tests/rls_test.sql" 2>&1 | grep -E "PASS|FAIL|ERROR" | sed 's/^psql:[^ ]* //'
