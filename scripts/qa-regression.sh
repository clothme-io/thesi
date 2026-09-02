#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Web: unit tests =="
cd "$ROOT/thesi-web"
npm test

echo "== Web: lint =="
npm run lint

echo "== Web: production build =="
npm run build

echo "== API: unit tests =="
cd "$ROOT/thesi-api"
npm test

echo "QA regression gate passed."
