#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLOTHME_DB="$(cd "$ROOT/.." && pwd)/clothme-db"
SQL_DIR="$CLOTHME_DB/databases/thesi/sql"

cd "$ROOT"

if [ ! -d "$SQL_DIR" ]; then
  echo "clothme-db migrations not found at $SQL_DIR"
  echo "Clone clothme-db next to thesi/ so Flyway can migrate the thesi database."
  exit 1
fi

if [ ! -f "$ROOT/thesi-api/.env" ]; then
  cp "$ROOT/thesi-api/.env.example" "$ROOT/thesi-api/.env"
  echo "Created thesi-api/.env from .env.example"
fi

if [ ! -f "$ROOT/thesi-web/.env.local" ]; then
  cp "$ROOT/thesi-web/.env.example" "$ROOT/thesi-web/.env.local"
  echo "Created thesi-web/.env.local from .env.example"
fi

export THESI_MIGRATIONS_DIR="$SQL_DIR"

echo "Starting Postgres (:5436), Flyway, API (:5010), and web (:3010)..."
exec docker compose up --build --remove-orphans "$@"
