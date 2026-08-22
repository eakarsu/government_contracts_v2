#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$project_dir/.env"
set +a
mode="${1:-start}"

case "$mode" in
  check) npm --prefix "$project_dir" run ci; npm --prefix "$project_dir/client" run build; exit ;;
  migrate) npm --prefix "$project_dir" run prisma:generate; "$project_dir/node_modules/.bin/prisma" migrate deploy; exit ;;
  start) ;;
  *) echo 'usage: ./start.sh check|migrate|start' >&2; exit 2 ;;
esac

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
: "${OPENROUTER_BASE_URL:?OPENROUTER_BASE_URL is required}"
case "$DATABASE_URL" in
  *connect_timeout=*) ;;
  *\?*) export DATABASE_URL="${DATABASE_URL}&connect_timeout=30" ;;
  *) export DATABASE_URL="${DATABASE_URL}?connect_timeout=30" ;;
esac
api_port="${BACKEND_PORT:-${PORT:?BACKEND_PORT or PORT is required}}"
ui_port="${FRONTEND_PORT:-${CLIENT_PORT:?FRONTEND_PORT or CLIENT_PORT is required}}"
frontend_host="${FRONTEND_HOST:-127.0.0.1}"
frontend_public_origin="${FRONTEND_PUBLIC_ORIGIN:-http://127.0.0.1:$ui_port}"
frontend_public_host="${frontend_public_origin#*://}"
frontend_public_host="${frontend_public_host%%:*}"
[[ "$api_port" != "$ui_port" ]] || { echo 'API and UI ports must differ' >&2; exit 1; }
for port in "$api_port" "$ui_port"; do
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || { echo "Port $port is occupied" >&2; exit 1; }
done

export PORT="$api_port" AUTH_MODE=local DATABASE_SSL=false
export CORS_ORIGINS="http://127.0.0.1:$ui_port,$frontend_public_origin" ALLOWED_HOSTS="127.0.0.1,localhost,$frontend_public_host"
export BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin
export PROVISION_ADMIN_EMAIL="${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
export PROVISION_ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
export PROVISION_ADMIN_NAME="${PROVISION_ADMIN_NAME:-Runtime Administrator}"
# Browser API calls must stay on the UI origin. This lets Vite proxy them to
# the loopback-only backend without making mobile clients call themselves.
export VITE_API_URL="/api"
export VITE_BACKEND_URL="http://127.0.0.1:$api_port"
"$project_dir/node_modules/.bin/prisma" generate
"$project_dir/node_modules/.bin/prisma" migrate deploy
npm --prefix "$project_dir" run create-admin
npm --prefix "$project_dir" run seed:ai-opportunities

cleanup() {
  trap - INT TERM EXIT
  [[ -z "${ui_pid:-}" ]] || kill "$ui_pid" 2>/dev/null || true
  [[ -z "${api_pid:-}" ]] || kill "$api_pid" 2>/dev/null || true
  [[ -z "${ui_pid:-}" ]] || wait "$ui_pid" 2>/dev/null || true
  [[ -z "${api_pid:-}" ]] || wait "$api_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd "$project_dir" && exec ./node_modules/.bin/nodemon --config nodemon.json server.js) &
api_pid=$!
for ((attempt=0; attempt<180; attempt++)); do
  curl -fsS "http://127.0.0.1:$api_port/api/health" >/dev/null 2>&1 && break
  kill -0 "$api_pid" 2>/dev/null || { wait "$api_pid"; exit $?; }
  sleep 0.5
done
curl -fsS "http://127.0.0.1:$api_port/api/health" >/dev/null
(cd "$project_dir/client" && exec ./node_modules/.bin/vite --host "$frontend_host" --port "$ui_port") &
ui_pid=$!
echo "Frontend: $frontend_public_origin"
echo "Backend auto-reload: enabled"
wait "$api_pid" "$ui_pid"
