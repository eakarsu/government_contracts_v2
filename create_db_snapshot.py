#!/usr/bin/env python3
"""
Create PostgreSQL database snapshot using Python
"""
import os
import json
import psycopg2
from datetime import datetime

def create_database_snapshot():
    """Create complete database snapshot"""
    
    # Connect to database
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    snapshot_data = {
        "created_at": datetime.now().isoformat(),
        "description": "Complete database snapshot for government contracts processing",
        "tables": {}
    }
    
    # Tables to snapshot
    tables = [
        'contract', 'document_processing_queue', 'indexing_job', 
        'search_query', 'user', 'company', 'contract_application', 'ai_template'
    ]
    
    for table in tables:
        print(f"Snapshotting table: {table}")
        
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
        
        # Get table structure
        cur.execute(f"""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = '{table}'
            ORDER BY ordinal_position;
        """)
        columns = cur.fetchall()
        
        # Get row count
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        row_count = cur.fetchone()[0]
        
        # Get all data
        if row_count > 0:
            cur.execute(f"SELECT * FROM {table}")
            rows = cur.fetchall()
            column_names = [desc[0] for desc in cur.description]
            
            # Convert rows to dictionaries
            table_data = []
            for row in rows:
                row_dict = {}
                for i, value in enumerate(row):
                    if isinstance(value, datetime):
                        row_dict[column_names[i]] = value.isoformat()
                    else:
                        row_dict[column_names[i]] = value
                table_data.append(row_dict)
        else:
            table_data = []
        
        snapshot_data["tables"][table] = {
            "columns": [{"name": col[0], "type": col[1], "nullable": col[2], "default": col[3]} for col in columns],
            "row_count": row_count,
            "data": table_data
        }
    
    # Save complete snapshot
    with open('database_snapshots/complete_snapshot.json', 'w') as f:
        json.dump(snapshot_data, f, indent=2, default=str)
    
    # Create processed documents snapshot
    processed_docs = snapshot_data["tables"].get("document_processing_queue", {}).get("data", [])
    completed_docs = [doc for doc in processed_docs if doc.get("status") == "completed"]
    
    with open('database_snapshots/processed_documents_snapshot.json', 'w') as f:
        json.dump({
            "created_at": datetime.now().isoformat(),
            "description": "Snapshot of successfully processed documents",
            "document_count": len(completed_docs),
            "documents": completed_docs
        }, f, indent=2, default=str)
    
    # Create contracts snapshot
    contracts = snapshot_data["tables"].get("contract", {}).get("data", [])
    contracts_with_docs = [c for c in contracts if c.get("resource_links")]
    
    with open('database_snapshots/contracts_snapshot.json', 'w') as f:
        json.dump({
            "created_at": datetime.now().isoformat(),
            "description": "Snapshot of contracts with document attachments",
            "contract_count": len(contracts_with_docs),
            "contracts": contracts_with_docs[:100]  # First 100 contracts
        }, f, indent=2, default=str)
    
    cur.close()
    conn.close()
    
    print(f"Database snapshot created successfully:")
    print(f"- Complete snapshot: database_snapshots/complete_snapshot.json")
    print(f"- Processed documents: database_snapshots/processed_documents_snapshot.json")
    print(f"- Contracts: database_snapshots/contracts_snapshot.json")
    
    return snapshot_data

if __name__ == "__main__":
    create_database_snapshot()