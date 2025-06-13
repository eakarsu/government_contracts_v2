#!/usr/bin/env python3
"""
Quick vector database restoration for immediate search improvement
"""
import os
import psycopg2
from services.vector_database import VectorDatabase

def quick_restore_vector_db():
    """Quickly restore vector database with essential contracts"""
    
    print("Starting quick vector database restoration...")
    
    # Initialize vector database
    vector_db = VectorDatabase()
    
    # Connect to PostgreSQL
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    # Get the first 100 contracts with most recent posting dates for better relevance
    cur.execute("""
        SELECT notice_id, title, description, agency, naics_code, 
               classification_code, posted_date 
        FROM contract 
        WHERE indexed_at IS NOT NULL
        ORDER BY posted_date DESC NULLS LAST
        LIMIT 100
    """)
    
    contracts = cur.fetchall()
    print(f"Indexing {len(contracts)} recent contracts...")
    
    indexed_count = 0
    for contract in contracts:
        notice_id, title, description, agency, naics_code, classification_code, posted_date = contract
        
        # Create contract data for indexing
        contract_data = {
            'notice_id': notice_id,
            'title': title or '',
            'description': description or '',
            'agency': agency or '',
            'naics_code': naics_code or '',
            'classification_code': classification_code or '',
            'posted_date': posted_date.isoformat() if posted_date else ''
        }
        
        # Index contract in vector database
        try:
            if vector_db.index_contract(contract_data):
                indexed_count += 1
                if indexed_count % 20 == 0:
                    print(f"Indexed {indexed_count} contracts...")
        except Exception as e:
            print(f"Error indexing contract {notice_id}: {e}")
            continue
    
    print(f"Successfully indexed {indexed_count} contracts")
    
    # Verify restoration
    try:
        contracts_count = vector_db.contracts_collection.count()
        docs_count = vector_db.documents_collection.count()
        print(f"Vector database now contains:")
        print(f"  Contracts: {contracts_count}")
        print(f"  Document chunks: {docs_count}")
    except Exception as e:
        print(f"Error checking final counts: {e}")
    
    cur.close()
    conn.close()
    
    return indexed_count

if __name__ == "__main__":
    quick_restore_vector_db()