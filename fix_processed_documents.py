#!/usr/bin/env python3
"""
Fix processed documents that are stuck in 'processing' status
This checks the processed_documents folder and updates database status accordingly
"""

import os
import json
from pathlib import Path
from datetime import datetime
from app import app, db
from models import DocumentProcessingQueue

def fix_processed_documents():
    """Update database status for documents that were actually processed"""
    
    with app.app_context():
        # Get all documents stuck in processing status
        processing_docs = DocumentProcessingQueue.query.filter_by(status='processing').all()
        
        print(f"Found {len(processing_docs)} documents stuck in 'processing' status")
        
        updated_count = 0
        failed_count = 0
        
        # Check processed_documents folder for completed files
        processed_dir = Path("processed_documents")
        if not processed_dir.exists():
            print("No processed_documents folder found")
            return
        
        # Get all processed files
        processed_files = list(processed_dir.glob("*"))
        print(f"Found {len(processed_files)} files in processed_documents folder")
        
        for doc in processing_docs:
            try:
                # Look for processed file with this contract notice ID
                contract_files = [f for f in processed_files if doc.contract_notice_id in f.name]
                
                if contract_files:
                    # Document was processed, mark as completed
                    doc.status = 'completed'
                    doc.completed_at = datetime.utcnow()
                    doc.processed_data = json.dumps({
                        "processed": True,
                        "file_found": str(contract_files[0]),
                        "processed_by_norshin": True
                    })
                    updated_count += 1
                    print(f"✓ Marked document {doc.id} ({doc.contract_notice_id}) as completed")
                else:
                    # No processed file found, mark as failed
                    doc.status = 'failed'
                    doc.failed_at = datetime.utcnow()
                    doc.error_message = "No processed file found after Norshin processing"
                    doc.retry_count += 1
                    failed_count += 1
                    print(f"✗ Marked document {doc.id} ({doc.contract_notice_id}) as failed")
                    
            except Exception as e:
                print(f"Error processing document {doc.id}: {e}")
                failed_count += 1
        
        # Commit all changes
        db.session.commit()
        
        print(f"\nSummary:")
        print(f"- Updated to completed: {updated_count}")
        print(f"- Updated to failed: {failed_count}")
        print(f"- Total processed: {updated_count + failed_count}")

if __name__ == "__main__":
    fix_processed_documents()