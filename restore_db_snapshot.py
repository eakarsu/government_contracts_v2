#!/usr/bin/env python3
"""
Restore PostgreSQL database from snapshot
"""
import os
import json
import psycopg2
from datetime import datetime

def restore_database_snapshot(snapshot_file='database_snapshots/complete_snapshot.json'):
    """Restore database from JSON snapshot"""
    
    # Connect to database
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    # Load snapshot
    with open(snapshot_file, 'r') as f:
        snapshot = json.load(f)
    
    print(f"Restoring database snapshot from {snapshot['created_at']}")
    
    # Disable foreign key checks temporarily
    cur.execute("SET session_replication_role = replica;")
    
    for table_name, table_data in snapshot['tables'].items():
        if not table_data['data']:
            print(f"Skipping empty table: {table_name}")
            continue
            
        print(f"Restoring table: {table_name} ({table_data['row_count']} rows)")
        
        # Clear existing data
        cur.execute(f"DELETE FROM {table_name}")
        
        # Insert data
        for row in table_data['data']:
            columns = list(row.keys())
            values = list(row.values())
            
            # Prepare placeholders
            placeholders = ', '.join(['%s'] * len(values))
            column_names = ', '.join(columns)
            
            # Convert None values and handle special types
            processed_values = []
            for val in values:
                if val is None:
                    processed_values.append(None)
                elif isinstance(val, str) and val.endswith('Z'):
                    # Handle ISO datetime strings
                    try:
                        processed_values.append(datetime.fromisoformat(val.replace('Z', '+00:00')))
                    except:
                        processed_values.append(val)
                else:
                    processed_values.append(val)
            
            try:
                cur.execute(
                    f"INSERT INTO {table_name} ({column_names}) VALUES ({placeholders})",
                    processed_values
                )
            except Exception as e:
                print(f"Error inserting row in {table_name}: {e}")
                continue
    
    # Re-enable foreign key checks
    cur.execute("SET session_replication_role = DEFAULT;")
    
    # Commit changes
    conn.commit()
    cur.close()
    conn.close()
    
    print("Database snapshot restored successfully!")

def restore_processed_docs_only():
    """Restore only processed documents for search functionality"""
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    # Load processed documents snapshot
    with open('database_snapshots/processed_documents_snapshot.json', 'r') as f:
        snapshot = json.load(f)
    
    print(f"Restoring {snapshot['document_count']} processed documents")
    
    # Clear existing processed documents
    cur.execute("DELETE FROM document_processing_queue WHERE status = 'completed'")
    
    # Insert processed documents
    for doc in snapshot['documents']:
        columns = list(doc.keys())
        values = list(doc.values())
        
        # Process datetime values
        processed_values = []
        for val in values:
            if val and isinstance(val, str) and ('T' in val or 'Z' in val):
                try:
                    processed_values.append(datetime.fromisoformat(val.replace('Z', '+00:00')))
                except:
                    processed_values.append(val)
            else:
                processed_values.append(val)
        
        placeholders = ', '.join(['%s'] * len(values))
        column_names = ', '.join(columns)
        
        try:
            cur.execute(
                f"INSERT INTO document_processing_queue ({column_names}) VALUES ({placeholders})",
                processed_values
            )
        except Exception as e:
            print(f"Error inserting document: {e}")
            continue
    
    conn.commit()
    cur.close()
    conn.close()
    
    print("Processed documents restored successfully!")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--docs-only":
        restore_processed_docs_only()
    else:
        restore_database_snapshot()