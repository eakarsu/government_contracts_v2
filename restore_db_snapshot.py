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
    
    # Note: Skip foreign key disable for regular users (requires superuser privileges)
    
    for table_name, table_data in snapshot['tables'].items():
        if not table_data['data']:
            print(f"Skipping empty table: {table_name}")
            continue
            
        print(f"Restoring table: {table_name} ({table_data['row_count']} rows)")
        
        # Clear existing data and reset sequences (handle reserved words)
        cur.execute(f'DELETE FROM "{table_name}"')
        
        # Reset sequence for tables with id columns
        try:
            cur.execute(f'SELECT setval(\'{table_name}_id_seq\', 1, false)')
        except Exception:
            # Sequence doesn't exist, continue
            pass
        
        # Insert data
        for row in table_data['data']:
            # Skip invalid entries that don't match table structure
            if table_name == 'user' and 'user' in row and 'email' not in row:
                print(f"Skipping invalid user entry: {row}")
                continue
                
            columns = list(row.keys())
            values = list(row.values())
            
            # Validate that we have proper columns for this table
            if not columns or not values:
                print(f"Skipping empty row in {table_name}")
                continue
            
            # Prepare placeholders (handle reserved words with quotes)
            placeholders = ', '.join(['%s'] * len(values))
            column_names = ', '.join([f'"{col}"' for col in columns])
            
            # Convert None values and handle special types
            processed_values = []
            for i, val in enumerate(values):
                column_name = columns[i]
                
                if val is None:
                    processed_values.append(None)
                elif isinstance(val, str) and val.endswith('Z'):
                    # Handle ISO datetime strings
                    try:
                        processed_values.append(datetime.fromisoformat(val.replace('Z', '+00:00')))
                    except:
                        processed_values.append(val)
                elif column_name == 'resource_links' and isinstance(val, list):
                    # Handle JSON columns - convert lists to JSON strings
                    processed_values.append(json.dumps(val))
                elif isinstance(val, list) and column_name in ['naics_codes', 'set_aside_types', 'capabilities', 'certifications', 'team_composition', 'ai_generated_sections', 'ai_recommendations', 'documents', 'variables']:
                    # Handle other JSON array columns
                    processed_values.append(json.dumps(val))
                else:
                    processed_values.append(val)
            
            try:
                cur.execute(
                    f'INSERT INTO "{table_name}" ({column_names}) VALUES ({placeholders})',
                    processed_values
                )
            except Exception as e:
                print(f"Error inserting row in {table_name}: {e}")
                # Rollback the failed transaction and continue
                conn.rollback()
                continue
        
        # Update sequence to max ID value after inserting data
        try:
            cur.execute(f'SELECT MAX("id") FROM "{table_name}"')
            max_id = cur.fetchone()
            if max_id and max_id[0]:
                cur.execute(f"SELECT setval('{table_name}_id_seq', {max_id[0]})")
                print(f"Updated {table_name}_id_seq to {max_id[0]}")
        except Exception as seq_error:
            print(f"Could not update sequence for {table_name}: {seq_error}")
    
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