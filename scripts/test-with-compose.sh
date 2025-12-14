#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${ENV_FILE:-.env.test}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.test.yml}"

cleanup() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[test-with-compose] Starting test dependencies..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

wait_healthy() {
  local service="$1"
  local timeout_s="${2:-90}"
  local start
  start="$(date +%s)"

  local cid
  cid="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
  if [[ -z "$cid" ]]; then
    echo "[test-with-compose] ERROR: No container id for service '$service'" >&2
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps >&2 || true
    return 1
  fi

  while true; do
    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid" 2>/dev/null || true)"

    if [[ "$status" == "healthy" || "$status" == "no-healthcheck" ]]; then
      echo "[test-with-compose] $service is $status"
      return 0
    fi

    local now
    now="$(date +%s)"
    if (( now - start > timeout_s )); then
      echo "[test-with-compose] ERROR: Timed out waiting for $service (last status: $status)" >&2
      docker logs "$cid" --tail 200 >&2 || true
      return 1
    fi

    sleep 2
  done
}

wait_healthy redis 90
wait_healthy rabbitmq 120

echo "[test-with-compose] Running unit/integration tests..."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

npm test
