#!/bin/bash
set -e

echo "Starting PostgreSQL..."
service postgresql start

# Wait for PostgreSQL to be ready
until pg_isready -U postgres -h localhost; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

echo "PostgreSQL is ready"

# Start database initialization in background
python /app/init-database.py &

echo "Starting Flask application..."
exec gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app

