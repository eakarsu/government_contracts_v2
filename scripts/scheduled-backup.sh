#!/usr/bin/env bash
set -euo pipefail

interval_seconds="${BACKUP_INTERVAL_SECONDS:-86400}"
if [[ ! "$interval_seconds" =~ ^[0-9]+$ || "$interval_seconds" -lt 3600 ]]; then
  echo "BACKUP_INTERVAL_SECONDS must be an integer of at least 3600" >&2
  exit 1
fi

while true; do
  backup_file="$(bash /app/scripts/backup-production.sh)"
  if [[ "${BACKUP_RESTORE_TEST_ENABLED:-true}" == "true" ]]; then
    bash /app/scripts/test-backup-restore.sh "$backup_file"
  fi
  sleep "$interval_seconds"
done
