#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

echo "Generating Prisma client..."
npx prisma generate

echo "Applying committed database migrations..."
npx prisma migrate deploy

mkdir -p \
  vector_indexes/contracts \
  vector_indexes/documents \
  uploads/rfp-documents \
  uploads/documents \
  logs

chmod -R 755 vector_indexes uploads logs
echo "Database initialization completed without destructive schema synchronization."
