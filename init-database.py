#!/usr/bin/env python3
"""
Initialize database with snapshot data after Flask creates tables
"""
import os
import sys
import time
import psycopg2
from main import app
from restore_db_snapshot import restore_database_snapshot

def wait_for_flask_tables():
    """Wait for Flask to create the database tables"""
    max_attempts = 30
    for attempt in range(max_attempts):
        try:
            with app.app_context():
                conn = psycopg2.connect(os.environ['DATABASE_URL'])
                cur = conn.cursor()
                
                # Check if contract table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'contract'
                    );
                """)
                
                if cur.fetchone()[0]:
                    # Check if table is empty
                    cur.execute("SELECT COUNT(*) FROM contract;")
                    count = cur.fetchone()[0]
                    
                    cur.close()
                    conn.close()
                    
                    if count == 0:
                        print("Flask tables created, restoring database snapshot...")
                        restore_database_snapshot()
                        print("Database restoration completed successfully")
                    else:
                        print(f"Database already contains {count} contracts, skipping restore")
                    
                    return True
                
                cur.close()
                conn.close()
                
        except Exception as e:
            print(f"Attempt {attempt + 1}: Waiting for Flask to initialize... ({e})")
            time.sleep(2)
    
    print("Flask tables not found after waiting, continuing without restore")
    return False

if __name__ == "__main__":
    print("Waiting for Flask application to create database tables...")
    wait_for_flask_tables()