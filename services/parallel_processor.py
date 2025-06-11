#!/usr/bin/env python3
"""
Parallel document processor for sending multiple documents to Norshin API simultaneously
"""
import os
import json
import logging
import requests
import threading
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Optional
from models import DocumentProcessingQueue, db

logger = logging.getLogger(__name__)

class ParallelDocumentProcessor:
    """Process multiple documents in parallel via Norshin API"""
    
    def __init__(self, max_workers=5):
        self.norshin_api_key = os.environ.get('NORSHIN_API_KEY')
        self.norshin_api_url = os.environ.get('NORSHIN_API_URL')
        self.max_workers = max_workers
        self.results = []
        
        if not self.norshin_api_key or not self.norshin_api_url:
            logger.error("Missing Norshin API credentials")
            raise ValueError("Norshin API credentials not configured")
    
    def process_all_queued_documents(self) -> Dict:
        """Process all queued documents in parallel"""
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
            
            logger.info(f"Starting parallel processing of {len(queued_docs)} documents (prioritizing smaller files)")
            
            # Process documents in parallel
            results = []
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # Submit all documents for processing
                future_to_doc = {}
                for doc in queued_docs:
                    future = executor.submit(self._process_single_document, doc)
                    future_to_doc[future] = doc
                
                # Collect results as they complete
                for future in as_completed(future_to_doc):
                    doc = future_to_doc[future]
                    try:
                        result = future.result()
                        results.append(result)
                        logger.info(f"Completed processing: {doc.filename}")
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
                
                logger.info(f"Sending {file_path.name} to Norshin API...")
                
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
                    
                    # Move file to processed folder
                    processed_path = self._move_to_processed_folder(file_path, result_data)
                    
                    # Update database with SQL to ensure proper commit
                    from sqlalchemy import text
                    db.session.execute(
                        text("UPDATE document_processing_queue SET status = 'completed', completed_at = :completed_at, processed_data = :processed_data, saved_file_path = :saved_file_path WHERE id = :doc_id"),
                        {
                            "completed_at": datetime.utcnow(),
                            "processed_data": json.dumps(result_data),
                            "saved_file_path": processed_path,
                            "doc_id": doc.id
                        }
                    )
                    db.session.commit()
                    
                    return {
                        "success": True,
                        "document_id": doc.id,
                        "filename": doc.filename,
                        "status_code": response.status_code,
                        "processed_data": result_data
                    }
                else:
                    # API Error
                    doc.status = 'failed'
                    doc.failed_at = datetime.utcnow()
                    doc.error_message = f"API Error: {response.status_code} - {response.text}"
                    doc.retry_count += 1
                    db.session.commit()
                    
                    return {
                        "success": False,
                        "document_id": doc.id,
                        "filename": doc.filename,
                        "status_code": response.status_code,
                        "error": response.text
                    }
        
        except requests.exceptions.Timeout:
            # Timeout handling
            with app.app_context():
                doc.status = 'failed'
                doc.failed_at = datetime.utcnow()
                doc.error_message = "Request timeout after 3 minutes"
                doc.retry_count += 1
                db.session.commit()
            
            return {
                "success": False,
                "document_id": doc.id,
                "filename": doc.filename,
                "error": "Request timeout"
            }
        
        except Exception as e:
            # General error handling
            with app.app_context():
                doc.status = 'failed'
                doc.failed_at = datetime.utcnow()
                doc.error_message = str(e)
                doc.retry_count += 1
                db.session.commit()
            
            return {
                "success": False,
                "document_id": doc.id,
                "filename": doc.filename,
                "error": str(e)
            }
    
    def _move_to_processed_folder(self, original_path: Path, processed_data: dict) -> str:
        """Move processed document to processed_queue_documents folder"""
        try:
            processed_dir = Path("processed_queue_documents")
            processed_dir.mkdir(exist_ok=True)
            
            # Create new filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            new_filename = f"{timestamp}_{original_path.name}"
            processed_path = processed_dir / new_filename
            
            # Copy file to processed folder
            import shutil
            shutil.copy2(original_path, processed_path)
            
            # Create metadata file
            metadata = {
                "original_filename": original_path.name,
                "processed_at": datetime.now().isoformat(),
                "norshin_response": processed_data,
                "original_path": str(original_path)
            }
            
            metadata_path = processed_dir / f"{timestamp}_{original_path.stem}_metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Moved processed document to: {processed_path}")
            return str(processed_path)
            
        except Exception as e:
            logger.error(f"Failed to move document to processed folder: {e}")
            return ""