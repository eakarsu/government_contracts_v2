#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
if [[ -z "${BACKUP_ENCRYPTION_KEY_FILE:-}" || ! -f "$BACKUP_ENCRYPTION_KEY_FILE" ]]; then
  echo "BACKUP_ENCRYPTION_KEY_FILE must point to a mounted secret file" >&2
  exit 1
fi

backup_directory="${BACKUP_DIRECTORY:-}"
if [[ -z "$backup_directory" || "$backup_directory" == "/" ]]; then
  echo "Set BACKUP_DIRECTORY to a dedicated backup directory" >&2
  exit 1
fi

mkdir -p "$backup_directory"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_directory/government-contracts-$timestamp.dump.enc"
pg_dump --format=custom --no-owner "$DATABASE_URL" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BACKUP_ENCRYPTION_KEY_FILE" -out "$destination"
sha256sum "$destination" > "$destination.sha256"

find "$backup_directory" -type f -name 'government-contracts-*.dump.enc' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
find "$backup_directory" -type f -name 'government-contracts-*.dump.enc.sha256' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
echo "$destination"
