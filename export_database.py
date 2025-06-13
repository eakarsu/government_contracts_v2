#!/usr/bin/env python3
"""
Export database content to SQL dump file
"""
import os
import psycopg2
from datetime import datetime

def export_database():
    """Export database tables to SQL dump"""
    
    # Connect to database
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    dump_content = []
    dump_content.append("-- Database dump created: " + datetime.now().isoformat())
    dump_content.append("-- Contains contracts and processed documents from government contract analysis")
    dump_content.append("")
    
    # Get table schemas and data
    tables_to_export = [
        'contract', 'document_processing_queue', 'indexing_job', 
        'search_query', 'user', 'company', 'contract_application', 'ai_template'
    ]
    
    for table in tables_to_export:
        print(f"Exporting table: {table}")
        
        # Check if table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = %s
            );
        """, (table,))
        
        if not cur.fetchone()[0]:
            print(f"Table {table} does not exist, skipping...")
            continue
            
        # Get table schema
        cur.execute(f"""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = '{table}'
            ORDER BY ordinal_position;
        """)
        
        columns = cur.fetchall()
        
        # Add DROP and CREATE statements
        dump_content.append(f"-- Table: {table}")
        dump_content.append(f"DROP TABLE IF EXISTS {table} CASCADE;")
        
        # Get CREATE TABLE statement
        cur.execute(f"""
            SELECT pg_get_ddl('TABLE', '{table}'::regclass);
        """)
        
        try:
            create_stmt = cur.fetchone()[0]
            dump_content.append(create_stmt + ";")
        except:
            # Fallback if pg_get_ddl doesn't work
            print(f"Could not get DDL for {table}, getting row count only...")
            
        # Get row count
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        row_count = cur.fetchone()[0]
        dump_content.append(f"-- {table}: {row_count} rows")
        
        # Export data for smaller tables, or sample for large tables
        if row_count > 0:
            if table == 'contract' and row_count > 100:
                # Export sample of contracts
                cur.execute(f"SELECT * FROM {table} LIMIT 50")
                dump_content.append(f"-- Exporting sample of 50 rows from {table}")
            elif table == 'document_processing_queue':
                # Export all processed documents
                cur.execute(f"SELECT * FROM {table} WHERE status = 'completed'")
                dump_content.append(f"-- Exporting completed documents from {table}")
            else:
                cur.execute(f"SELECT * FROM {table}")
                
            rows = cur.fetchall()
            
            if rows:
                # Get column names
                column_names = [desc[0] for desc in cur.description]
                
                # Create INSERT statements
                for row in rows:
                    values = []
                    for val in row:
                        if val is None:
                            values.append('NULL')
                        elif isinstance(val, str):
                            # Escape single quotes
                            escaped = val.replace("'", "''")
                            values.append(f"'{escaped}'")
                        elif isinstance(val, datetime):
                            values.append(f"'{val.isoformat()}'")
                        else:
                            values.append(str(val))
                    
                    insert_stmt = f"INSERT INTO {table} ({', '.join(column_names)}) VALUES ({', '.join(values)});"
                    dump_content.append(insert_stmt)
        
        dump_content.append("")
    
    # Write to file
    with open('database_dump.sql', 'w') as f:
        f.write('\n'.join(dump_content))
    
    cur.close()
    conn.close()
    
    print("Database export completed: database_dump.sql")

if __name__ == "__main__":
    export_database()