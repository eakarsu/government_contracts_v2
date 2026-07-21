#!/usr/bin/env bash
set -euo pipefail

source_dir="$(cd "$(dirname "$0")" && pwd)"
if [[ -n "${RUNTIME_PROJECT_SOURCE:-}" && -d "$RUNTIME_PROJECT_SOURCE" ]]; then source_dir="$RUNTIME_PROJECT_SOURCE"; fi
: "${PORT:?PORT must be set explicitly}"
: "${DATABASE_URL:?DATABASE_URL must be set explicitly}"

if [[ "${NODE_ENV:-}" != "production" && "${BOOTSTRAP_ACKNOWLEDGEMENT:-}" == "create-initial-admin" ]]; then
  : "${CLIENT_PORT:?CLIENT_PORT must be set for runtime acceptance}"
  export AUTH_MODE=local
  export CORS_ORIGINS="http://127.0.0.1:${CLIENT_PORT}"
  export ALLOWED_HOSTS="127.0.0.1,localhost"
fi

exec npm --prefix "$source_dir" start
