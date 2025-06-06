#!/usr/bin/env python3
"""
Simulate document processing to demonstrate the notification system
This creates sample processed documents and notifications for testing
"""
import os
import json
import shutil
from datetime import datetime
from pathlib import Path

def simulate_document_processing():
    """Simulate processing of queued documents to demonstrate notification system"""
    
    # Create directories
    queue_dir = Path("queue_documents")
    processed_dir = Path("processed_queue_documents")
    processed_dir.mkdir(exist_ok=True)
    
    if not queue_dir.exists():
        print("No queue_documents directory found")
        return
    
    # Find documents to simulate processing
    doc_files = [f for f in queue_dir.iterdir() if f.is_file() and not f.name.endswith('.json')]
    
    if not doc_files:
        print("No documents found to process")
        return
    
    # Process first 3 documents for demonstration
    processed_count = 0
    for doc_file in doc_files[:3]:
        try:
            # Move document to processed folder
            dest_path = processed_dir / doc_file.name
            shutil.copy2(doc_file, dest_path)
            
            # Create mock Norshin response data
            mock_norshin_data = {
                "status": "success",
                "content": f"Processed content from {doc_file.name}",
                "summary": f"Document summary for {doc_file.name}",
                "metadata": {
                    "pages": 5,
                    "words": 1250,
                    "language": "en"
                },
                "processing_time": 2.5,
                "extracted_text": f"Sample extracted text from {doc_file.name} containing government contract information..."
            }
            
            # Create notification file
            notification_data = {
                "original_file": str(doc_file),
                "processed_file": str(dest_path),
                "processed_timestamp": datetime.utcnow().isoformat(),
                "processing_status": "completed",
                "norshin_data_available": True,
                "file_size": dest_path.stat().st_size,
                "norshin_response": mock_norshin_data
            }
            
            # Save notification file
            notification_path = dest_path.with_suffix('.notification.json')
            with open(notification_path, 'w') as f:
                json.dump(notification_data, f, indent=2)
            
            print(f"Simulated processing: {doc_file.name} -> {dest_path.name}")
            processed_count += 1
            
        except Exception as e:
            print(f"Error simulating processing for {doc_file.name}: {e}")
    
    print(f"Simulated processing of {processed_count} documents")
    print("Check the notifications page to see the results!")

if __name__ == "__main__":
    simulate_document_processing()