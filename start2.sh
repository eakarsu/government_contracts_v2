#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

if [ ! -d node_modules ]; then
  echo "Installing locked server dependencies..."
  PUPPETEER_SKIP_DOWNLOAD=true npm ci
fi

if [ -d client ] && [ ! -d client/node_modules ]; then
  echo "Installing locked client dependencies..."
  (cd client && npm ci)
fi

echo "Generating Prisma client and applying committed migrations..."
npx prisma generate
npx prisma migrate deploy

mkdir -p logs uploads documents vector_indexes/contracts vector_indexes/documents

echo "Starting API and client development servers..."
exec npm run dev-full
