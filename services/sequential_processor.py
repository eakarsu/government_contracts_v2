#!/usr/bin/env python3
"""
Sequential document processor for processing documents one by one via Norshin API
This approach prevents API overload and provides better control over processing flow
"""
import os
import json
import logging
import requests
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from models import DocumentProcessingQueue, db

logger = logging.getLogger(__name__)

class SequentialDocumentProcessor:
    """Process documents one by one via Norshin API"""
    
    def __init__(self, delay_between_requests=5):
        self.norshin_api_key = os.environ.get('NORSHIN_API_KEY')
        self.norshin_api_url = os.environ.get('NORSHIN_API_URL')
        self.delay_between_requests = delay_between_requests  # seconds between requests
        
        if not self.norshin_api_key or not self.norshin_api_url:
            logger.error("Missing Norshin API credentials")
            raise ValueError("Norshin API credentials not configured")
    
    def process_all_queued_documents(self) -> Dict:
        """Process all queued documents sequentially"""
        from main import app
        
        with app.app_context():
            # Get all queued documents and sort by file size (smaller first)
            queued_docs = DocumentProcessingQueue.query.filter_by(status='queued').all()
            
            if not queued_docs:
                return {"success": True, "message": "No documents in queue", "processed": 0}
            
            # Sort documents by file size to process smaller ones first
            docs_with_size = []
            for doc in queued_docs:
                if doc.local_file_path and Path(doc.local_file_path).exists():
                    file_size = Path(doc.local_file_path).stat().st_size
                    docs_with_size.append((doc, file_size))
            
            # Sort by size (smallest first) for faster completion of smaller files
            docs_with_size.sort(key=lambda x: x[1])
            queued_docs = [doc for doc, _ in docs_with_size]
            
            logger.info(f"Starting sequential processing of {len(queued_docs)} documents")
            
            # Process documents one by one
            results = []
            for i, doc in enumerate(queued_docs, 1):
                try:
                    logger.info(f"Processing document {i}/{len(queued_docs)}: {doc.filename}")
                    result = self._process_single_document(doc)
                    results.append(result)
                    
                    # Add delay between requests (except for the last one)
                    if i < len(queued_docs):
                        logger.info(f"Waiting {self.delay_between_requests} seconds before next document...")
                        time.sleep(self.delay_between_requests)
                        
                except Exception as e:
                    logger.error(f"Failed processing {doc.filename}: {e}")
                    results.append({
                        "success": False,
                        "document_id": doc.id,
                        "filename": doc.filename,
                        "error": str(e)
                    })
            
            # Summary
            successful = len([r for r in results if r.get('success')])
            failed = len(results) - successful
            
            return {
                "success": True,
                "total_processed": len(results),
                "successful": successful,
                "failed": failed,
                "results": results
            }
    
    def _process_single_document(self, doc: DocumentProcessingQueue) -> Dict:
        """Process a single document"""
        from main import app
        
        try:
            # Update status to processing
            with app.app_context():
                from sqlalchemy import text
                db.session.execute(
                    text("UPDATE document_processing_queue SET status = 'processing', started_at = :started_at WHERE id = :doc_id"),
                    {"started_at": datetime.utcnow(), "doc_id": doc.id}
                )
                db.session.commit()
            
            # Check if file exists
            if not doc.local_file_path or not Path(doc.local_file_path).exists():
                raise FileNotFoundError(f"Document file not found: {doc.local_file_path}")
            
            file_path = Path(doc.local_file_path)
            
            # Send to Norshin API
            with open(file_path, 'rb') as f:
                files = {'document': (file_path.name, f, 'application/octet-stream')}
                headers = {'Authorization': f'Bearer {self.norshin_api_key}'}
                
                # Get file size to adjust timeout
                file_size_mb = file_path.stat().st_size / (1024 * 1024)
                
                # Dynamic timeout based on file size: 5 minutes base + 2 minutes per 10MB
                timeout = 300 + int(file_size_mb / 10) * 120
                timeout = min(timeout, 1800)  # Max 30 minutes
                
                logger.info(f"Processing {file_path.name} ({file_size_mb:.1f}MB) with {timeout}s timeout...")
                
                response = requests.post(
                    self.norshin_api_url,
                    files=files,
                    headers=headers,
                    timeout=timeout
                )
            
            # Handle response
            with app.app_context():
                if response.status_code == 200:
                    # Success
                    result_data = response.json()
                    
                    # Save processed document to processed_queue_documents
                    processed_dir = Path("processed_queue_documents")
                    processed_dir.mkdir(exist_ok=True)
                    
                    # Save the processed JSON data
                    processed_filename = f"{doc.contract_notice_id}_{file_path.stem}.json"
                    processed_file_path = processed_dir / processed_filename
                    
                    with open(processed_file_path, 'w') as f:
                        json.dump(result_data, f, indent=2)
                    
                    # Create notification file
                    notification_data = {
                        "filename": processed_filename,
                        "contract_notice_id": doc.contract_notice_id,
                        "processed_at": datetime.utcnow().isoformat(),
                        "success": True,
                        "pages_processed": len(result_data.get('pages', [])) if 'pages' in result_data else 0
                    }
                    
                    notification_file = processed_dir / f"{processed_filename}.notification.json"
                    with open(notification_file, 'w') as f:
                        json.dump(notification_data, f, indent=2)
                    
                    # Update database
                    from sqlalchemy import text
                    db.session.execute(
                        text("""UPDATE document_processing_queue 
                             SET status = 'completed', 
                                 completed_at = :completed_at,
                                 processed_data = :processed_data,
                                 saved_file_path = :saved_file_path,
                                 updated_at = :updated_at
                             WHERE id = :doc_id"""),
                        {
                            "completed_at": datetime.utcnow(),
                            "processed_data": json.dumps(result_data),
                            "saved_file_path": str(processed_file_path),
                            "updated_at": datetime.utcnow(),
                            "doc_id": doc.id
                        }
                    )
                    db.session.commit()
                    
                    logger.info(f"Successfully processed {doc.filename}")
                    
                    return {
                        "success": True,
                        "document_id": doc.id,
                        "filename": doc.filename,
                        "processed_file": str(processed_file_path),
                        "pages_processed": notification_data["pages_processed"]
                    }
                    
                else:
                    # Error response
                    error_msg = f"Norshin API error {response.status_code}: {response.text}"
                    logger.error(error_msg)
                    
                    # Update database with error
                    from sqlalchemy import text
                    db.session.execute(
                        text("""UPDATE document_processing_queue 
                             SET status = 'failed', 
                                 failed_at = :failed_at,
                                 error_message = :error_message,
                                 retry_count = retry_count + 1,
                                 updated_at = :updated_at
                             WHERE id = :doc_id"""),
                        {
                            "failed_at": datetime.utcnow(),
                            "error_message": error_msg,
                            "updated_at": datetime.utcnow(),
                            "doc_id": doc.id
                        }
                    )
                    db.session.commit()
                    
                    return {
                        "success": False,
                        "document_id": doc.id,
                        "filename": doc.filename,
                        "error": error_msg
                    }
                    
        except Exception as e:
            logger.error(f"Error processing {doc.filename}: {e}")
            
            # Update database with error
            with app.app_context():
                from sqlalchemy import text
                db.session.execute(
                    text("""UPDATE document_processing_queue 
                         SET status = 'failed', 
                             failed_at = :failed_at,
                             error_message = :error_message,
                             retry_count = retry_count + 1,
                             updated_at = :updated_at
                         WHERE id = :doc_id"""),
                    {
                        "failed_at": datetime.utcnow(),
                        "error_message": str(e),
                        "updated_at": datetime.utcnow(),
                        "doc_id": doc.id
                    }
                )
                db.session.commit()
            
            return {
                "success": False,
                "document_id": doc.id,
                "filename": doc.filename,
                "error": str(e)
            }