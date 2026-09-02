#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE_NAME="${IMAGE_NAME:-thesi-web-qa-preview}"
CONTAINER_NAME="${CONTAINER_NAME:-thesi-web-qa-preview}"
PORT="${PORT:-3002}"
API_URL="${NEXT_PUBLIC_API_URL:-http://host.docker.internal:5010}"

cd "$ROOT"

echo "Building web preview image: $IMAGE_NAME"
docker build \
  --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
  --build-arg NEXT_PUBLIC_AUTH_DEV_MODE=true \
  -t "$IMAGE_NAME" \
  thesi-web

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Replacing existing container: $CONTAINER_NAME"
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

echo "Starting web preview on http://localhost:$PORT"
docker run \
  --name "$CONTAINER_NAME" \
  -p "$PORT:3000" \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  -d "$IMAGE_NAME" >/dev/null

echo "Preview ready: http://localhost:$PORT"
echo "Dev auth mode is enabled for local QA."
