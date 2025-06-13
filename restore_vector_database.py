#!/usr/bin/env python3
"""
Restore vector database from PostgreSQL contracts and processed documents
"""
import os
import json
import psycopg2
from services.vector_database import VectorDatabase

def restore_vector_database():
    """Restore ChromaDB vector database from PostgreSQL data"""
    
    print("=== Restoring Vector Database ===")
    
    # Initialize vector database
    vector_db = VectorDatabase()
    
    # Connect to PostgreSQL
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    # Get contracts that should be indexed
    cur.execute("""
        SELECT notice_id, title, description, agency, naics_code, 
               classification_code, posted_date 
        FROM contract 
        WHERE indexed_at IS NOT NULL
        LIMIT 50
    """)
    
    contracts = cur.fetchall()
    print(f"Found {len(contracts)} indexed contracts to restore")
    
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
                if indexed_count % 10 == 0:
                    print(f"Indexed {indexed_count} contracts...")
        except Exception as e:
            print(f"Error indexing contract {notice_id}: {e}")
            continue
    
    print(f"Successfully indexed {indexed_count} contracts")
    
    # Restore document chunks from processed documents
    cur.execute("""
        SELECT contract_notice_id, processed_data, saved_file_path
        FROM document_processing_queue 
        WHERE status = 'completed' AND processed_data IS NOT NULL
        LIMIT 20
    """)
    
    processed_docs = cur.fetchall()
    print(f"Found {len(processed_docs)} processed documents to restore")
    
    doc_chunks_count = 0
    for doc in processed_docs:
        contract_notice_id, processed_data_str, file_path = doc
        
        try:
            # Parse the Norshin processed data
            processed_data = json.loads(processed_data_str)
            
            # Index document chunks
            if vector_db.index_document(processed_data, contract_notice_id):
                doc_chunks_count += 1
                print(f"Indexed document chunks for contract {contract_notice_id}")
                
        except Exception as e:
            print(f"Error indexing document for {contract_notice_id}: {e}")
            continue
    
    print(f"Successfully indexed {doc_chunks_count} document sets")
    
    # Verify restoration
    try:
        contracts_count = vector_db.contracts_collection.count()
        docs_count = vector_db.documents_collection.count()
        print(f"\n=== Vector Database Restored ===")
        print(f"Contracts in vector DB: {contracts_count}")
        print(f"Document chunks in vector DB: {docs_count}")
    except Exception as e:
        print(f"Error checking final counts: {e}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    restore_vector_database()