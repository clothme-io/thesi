#!/usr/bin/env sh
set -e

CLOTHME_DB="$(cd "$(dirname "$0")/../.." && pwd)/clothme-db"

if [ ! -d "$CLOTHME_DB" ]; then
  echo "clothme-db not found at $CLOTHME_DB"
  exit 1
fi

exec "$CLOTHME_DB/scripts/info.sh" thesi
