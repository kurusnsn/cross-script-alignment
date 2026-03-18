#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_REPLICAS="${API_REPLICAS:-3}"
TTS_REPLICAS="${TTS_REPLICAS:-2}"
UI_REPLICAS="${UI_REPLICAS:-2}"

COMPOSE_ARGS=(-f docker-compose.yml)

echo "Building updated images..."
docker compose "${COMPOSE_ARGS[@]}" build api tts

echo "Rolling out scaled services (api=${API_REPLICAS}, tts=${TTS_REPLICAS}, ui=${UI_REPLICAS})..."
docker compose "${COMPOSE_ARGS[@]}" up -d \
  --scale "api=${API_REPLICAS}" \
  --scale "tts=${TTS_REPLICAS}" \
  --scale "ui=${UI_REPLICAS}" \
  api tts ui caddy redis postgres otel-collector

echo "Waiting for service health..."
sleep 8
docker compose "${COMPOSE_ARGS[@]}" ps api tts ui redis caddy

echo "Validating API through caddy..."
curl -fsS -H 'Host: api.alignai.com' http://localhost/healthz >/dev/null
echo "API health check passed."

echo "Validating UI through caddy..."
curl -fsS -H 'Host: alignai.com' http://localhost/ >/dev/null
echo "UI health check passed."

echo "Done."
