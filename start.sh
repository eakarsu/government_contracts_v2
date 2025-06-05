#!/bin/bash

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! pg_isready -h ${PGHOST:-localhost} -p ${PGPORT:-5432} -U ${PGUSER:-contract_user}; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is up - executing command"

# Initialize database tables
echo "Initializing database tables..."
python -c "
from main import app
from models import db
with app.app_context():
    db.create_all()
    print('Database tables created successfully')
"

# Start the application
echo "Starting application..."
exec gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app