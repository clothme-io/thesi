#!/usr/bin/env sh
set -e

CLOTHME_DB="$(cd "$(dirname "$0")/../.." && pwd)/clothme-db"

if [ ! -d "$CLOTHME_DB" ]; then
  echo "clothme-db not found at $CLOTHME_DB"
  echo "Clone or place clothme-db next to thesi/ and run migrations from there."
  exit 1
fi

exec "$CLOTHME_DB/scripts/migrate.sh" thesi
