#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$TASK_ROOT"
if [[ -n "${COMPOSE_BIN:-}" ]]; then
  COMPOSE_CMD=("$COMPOSE_BIN")
else
  COMPOSE_CMD=(docker compose)
fi
(cd thesi-api && npm run build)
(cd ../customer-api && npm run build)
"${COMPOSE_CMD[@]}" -f docker-compose.payments-demo.yml up -d --wait
node scripts/local-payments/server.mjs &
API_PID=$!
WEB_PID=""
cleanup() {
  kill "$API_PID" 2>/dev/null || true
  if [[ -n "$WEB_PID" ]]; then kill "$WEB_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM
for ((i=0;i<30;i++)); do
  if curl --fail --silent http://127.0.0.1:5011/v1/local-demo >/dev/null; then break; fi
  if ! kill -0 "$API_PID" 2>/dev/null; then exit 1; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:5011/v1/local-demo >/dev/null
cd thesi-web
THESI_LOCAL_PAYMENTS_DEMO=true THESI_API_URL=http://127.0.0.1:5011 NEXT_PUBLIC_API_URL=http://127.0.0.1:5011 NEXT_PUBLIC_AUTH_DEV_MODE=false node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3011 &
WEB_PID=$!
printf '%s\n' 'Local simulated payments: http://127.0.0.1:3011/local-payments'
wait "$WEB_PID"
