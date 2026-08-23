#!/usr/bin/env bash
set -euo pipefail
umask 077

backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" || "$backup_file" != *.dump.enc ]]; then
  echo "Usage: $0 /explicit/path/government-contracts-*.dump.enc" >&2
  exit 1
fi
if [[ -z "${BACKUP_ENCRYPTION_KEY_FILE:-}" || ! -f "$BACKUP_ENCRYPTION_KEY_FILE" ]]; then
  echo "BACKUP_ENCRYPTION_KEY_FILE must point to a mounted secret file" >&2
  exit 1
fi

temporary_directory="$(mktemp -d)"
trap 'rm -rf -- "$temporary_directory"' EXIT
archive="$temporary_directory/restore-test.dump"
openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$BACKUP_ENCRYPTION_KEY_FILE" -in "$backup_file" -out "$archive"
pg_restore --list "$archive" >/dev/null

if [[ -n "${RESTORE_TEST_DATABASE_URL:-}" ]]; then
  database_name="$(node -e 'console.log(new URL(process.argv[1]).pathname.replace(/^\//, ""))' "$RESTORE_TEST_DATABASE_URL")"
  if [[ ! "$database_name" =~ (^|[_-])restore[_-]test($|[_-]) ]]; then
    echo "RESTORE_TEST_DATABASE_URL must name an isolated restore_test database" >&2
    exit 1
  fi
  pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_TEST_DATABASE_URL" "$archive"
fi
echo "Backup restore validation passed: $backup_file"
