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

# Check database state and initialize if needed
echo "Checking database state and initializing if needed..."
python -c "
import psycopg2
import os
import sys

try:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    # Check if database has any tables
    cur.execute(\"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\")
    table_count = cur.fetchone()[0]
    
    if table_count == 0:
        print('Empty database detected, will let Flask create tables then restore data')
        # Don't create tables here, let Flask handle it to avoid conflicts
    else:
        print(f'Found {table_count} existing tables, checking if data restoration is needed')
        cur.execute(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contract');\")
        contract_table_exists = cur.fetchone()[0]
        
        if contract_table_exists:
            cur.execute(\"SELECT COUNT(*) FROM contract;\")
            contract_count = cur.fetchone()[0]
            print(f'Found {contract_count} contracts in database')
            
            if contract_count == 0:
                print('Contract table exists but is empty, restoring data...')
                sys.path.append('/app')
                from restore_db_snapshot import restore_database_snapshot
                restore_database_snapshot()
                print('Database restoration completed')
            else:
                print('Database already contains data, skipping restoration')
        
    cur.close()
    conn.close()
    
except Exception as e:
    print(f'Database check error: {e}')
    print('Continuing with Flask startup...')
"

echo "Starting Flask application..."
exec gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app

