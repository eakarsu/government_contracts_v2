import threading
import time
import logging
import requests
import json
import os
import tempfile
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from models import db, Contract, DocumentProcessingQueue
from services.vector_database import VectorDatabase

logger = logging.getLogger(__name__)

class BackgroundDocumentProcessor:
    """Background processor for handling long-running Norshin API document processing"""
    
    def __init__(self):
        self.norshin_api_url = os.environ.get('NORSHIN_API_URL')
        self.norshin_api_key = os.environ.get('NORSHIN_API_KEY')
        self.vector_db = VectorDatabase()
        self.processing_queue = []
        self.is_processing = False
        self.processing_thread = None
        self.queue_enabled = True  # Allow queue to be paused/resumed
        
        # Create queue_documents directory
        self.queue_documents_dir = Path("queue_documents")
        self.queue_documents_dir.mkdir(exist_ok=True)
        
        # Resume processing any pending items from database on startup
        try:
            self._resume_processing_from_db()
        except Exception as e:
            logger.warning(f"Could not resume processing from database: {e}")
    
    def queue_document(self, contract_notice_id: str, document_url: str, description: str = None):
        """Queue a document for background processing"""
        try:
            # Check if document is already queued
            existing = DocumentProcessingQueue.query.filter_by(
                contract_notice_id=contract_notice_id,
                document_url=document_url
            ).first()
            
            if existing and existing.status not in ['failed', 'completed']:
                logger.info(f"Document already queued: {document_url}")
                return existing.to_dict()
            
            # Download document first to queue_documents folder
            local_file_path = self._download_document_to_queue(document_url, contract_notice_id)
            
            # Create new queue entry
            queue_item = DocumentProcessingQueue(
                contract_notice_id=contract_notice_id,
                document_url=document_url,
                description=description,
                local_file_path=local_file_path,
                filename=Path(local_file_path).name if local_file_path else None,
                status='queued'
            )
            
            db.session.add(queue_item)
            db.session.commit()
            
            if local_file_path:
                logger.info(f"Downloaded and queued document for contract {contract_notice_id}: {Path(local_file_path).name}")
            else:
                logger.warning(f"Failed to download document, queued for retry: {document_url}")
            
            # Start processing thread if not already running and queue is enabled
            if not self.is_processing and self.queue_enabled:
                self.start_processing()
            
            return queue_item.to_dict()
            
        except Exception as e:
            logger.error(f"Error queuing document: {e}")
            db.session.rollback()
            return None
    
    def _download_document_to_queue(self, document_url: str, contract_notice_id: str) -> Optional[str]:
        """Download document and save to queue_documents folder before processing"""
        try:
            # Create filename with contract ID and URL hash for uniqueness
            url_hash = hashlib.md5(document_url.encode()).hexdigest()[:8]
            
            # Get file extension from URL
            file_extension = self._get_file_extension(document_url)
            filename = f"{contract_notice_id}_{url_hash}{file_extension}"
            file_path = self.queue_documents_dir / filename
            
            # Check if file already exists
            if file_path.exists():
                logger.info(f"Document already downloaded: {filename}")
                return str(file_path)
            
            # Download the document
            logger.info(f"Downloading document: {document_url}")
            response = requests.get(document_url, timeout=30, stream=True)
            response.raise_for_status()
            
            # Save to queue_documents folder
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            file_size = file_path.stat().st_size
            logger.info(f"Downloaded document: {filename} ({file_size} bytes)")
            
            return str(file_path)
            
        except Exception as e:
            logger.error(f"Error downloading document {document_url}: {e}")
            return None
    
    def _get_file_extension(self, url: str) -> str:
        """Extract file extension from URL"""
        try:
            # Remove query parameters and get extension
            clean_url = url.split('?')[0]
            extension = Path(clean_url).suffix
            
            # Default to .pdf if no extension found
            if not extension:
                extension = '.pdf'
                
            return extension.lower()
        except:
            return '.pdf'
    
    def start_processing(self):
        """Start the background processing thread"""
        if not self.queue_enabled:
            logger.info("Queue is paused, not starting processing")
            return
            
        if self.processing_thread and self.processing_thread.is_alive():
            return
        
        self.is_processing = True
        self.processing_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.processing_thread.start()
        logger.info("Started background document processing thread")
    
    def pause_queue(self):
        """Pause the document processing queue"""
        self.queue_enabled = False
        self.is_processing = False
        logger.info("Document processing queue paused")
        return {"status": "paused", "message": "Queue processing has been paused"}
    
    def resume_queue(self):
        """Resume the document processing queue"""
        self.queue_enabled = True
        
        # Check if there are queued documents to process
        pending_count = DocumentProcessingQueue.query.filter_by(status='queued').count()
        
        if pending_count > 0 and not self.is_processing:
            self.start_processing()
            message = f"Queue resumed and processing {pending_count} pending documents"
        else:
            message = "Queue resumed - no pending documents"
        
        logger.info(message)
        return {"status": "resumed", "message": message}
    
    def stop_processing(self):
        """Stop the current processing thread and reset any processing documents"""
        try:
            # Stop the processing thread
            self.is_processing = False
            self.queue_enabled = False
            
            if self.processing_thread and self.processing_thread.is_alive():
                self.processing_thread.join(timeout=5)
            
            # Reset any documents that were in "processing" state back to "queued"
            processing_docs = DocumentProcessingQueue.query.filter_by(status='processing').all()
            reset_count = 0
            
            for doc in processing_docs:
                doc.status = 'queued'
                doc.started_at = None
                reset_count += 1
            
            if reset_count > 0:
                db.session.commit()
            
            message = f"Document processing stopped. Reset {reset_count} processing documents to queued status."
            logger.info(message)
            
            return {
                "status": "stopped", 
                "message": message,
                "reset_documents": reset_count
            }
            
        except Exception as e:
            logger.error(f"Error stopping processing: {e}")
            return {
                "status": "error",
                "message": f"Error stopping processing: {str(e)}"
            }
    
    def _process_queue(self):
        """Process documents in the queue"""
        while self.processing_queue:
            document = self.processing_queue.pop(0)
            try:
                logger.info(f"Processing document: {document['document_url']}")
                document['status'] = 'processing'
                document['started_at'] = datetime.utcnow().isoformat()
                
                result = self._process_single_document(document)
                
                if result:
                    document['status'] = 'completed'
                    document['completed_at'] = datetime.utcnow().isoformat()
                    logger.info(f"Successfully processed: {document['document_url']}")
                else:
                    document['status'] = 'failed'
                    document['failed_at'] = datetime.utcnow().isoformat()
                    logger.error(f"Failed to process: {document['document_url']}")
                    
            except Exception as e:
                document['status'] = 'error'
                document['error'] = str(e)
                document['failed_at'] = datetime.utcnow().isoformat()
                logger.error(f"Error processing document {document['document_url']}: {e}")
            
            # Small delay between documents
            time.sleep(1)
        
        self.is_processing = False
        logger.info("Background document processing completed")
    
    def _process_single_document(self, document: Dict) -> Optional[Dict]:
        """Process a single document via Norshin API using pre-downloaded file"""
        try:
            contract_notice_id = document['contract_notice_id']
            local_file_path = document.get('local_file_path')
            filename = document.get('filename', f"document_{contract_notice_id}.pdf")
            
            logger.info(f"Processing document: {filename}")
            
            # Check if local file exists, if not try to download
            if not local_file_path or not os.path.exists(local_file_path):
                logger.warning(f"Local file not found, attempting to download: {document['document_url']}")
                local_file_path = self._download_document_to_queue(document['document_url'], contract_notice_id)
                
                if not local_file_path:
                    logger.error(f"Failed to download document: {document['document_url']}")
                    return None
                
                # Update filename from downloaded file
                filename = Path(local_file_path).name
            
            # Read the file from queue_documents folder
            with open(local_file_path, 'rb') as file:
                file_content = file.read()
            
            logger.info(f"Using pre-downloaded document: {filename} ({len(file_content)} bytes)")
            
            # Save document to processed_documents folder
            saved_file_path = None
            try:
                os.makedirs('processed_documents', exist_ok=True)
                safe_filename = f"{contract_notice_id}_{filename}"
                saved_file_path = os.path.join('processed_documents', safe_filename)
                
                with open(saved_file_path, 'wb') as saved_file:
                    saved_file.write(file_content)
                
                logger.info(f"Saved document to processed_documents: {safe_filename}")
                
            except Exception as e:
                logger.warning(f"Failed to save document to processed_documents: {e}")
            
            try:
                # Send to Norshin API using the pre-downloaded file
                with open(local_file_path, 'rb') as file:
                    files = {'document': (filename, file, 'application/octet-stream')}
                    
                    headers = {}
                    if self.norshin_api_key:
                        headers['X-API-Key'] = self.norshin_api_key
                    
                    logger.info(f"Sending to Norshin API: {filename}")
                    
                    # Use longer timeout for background processing
                    norshin_response = requests.post(
                        self.norshin_api_url,
                        files=files,
                        headers=headers,
                        timeout=600  # 10 minutes for background processing
                    )
                
                logger.info(f"Norshin API response status: {norshin_response.status_code}")
                
                if norshin_response.status_code == 200:
                    processed_data = norshin_response.json()
                    
                    # Index in vector database
                    result = {
                        'source_url': document['document_url'],
                        'contract_notice_id': document['contract_notice_id'],
                        'description': document['description'],
                        'processed_data': processed_data,
                        'processing_service': 'norshin_api'
                    }
                    
                    # Index document in vector database
                    self.vector_db.index_document(
                        document_data={
                            'success': True,
                            'text_content': str(processed_data),
                            'url': document['document_url'],
                            'description': document.get('description', ''),
                            'file_type': filename.split('.')[-1] if '.' in filename else 'unknown',
                            'text_length': len(str(processed_data))
                        },
                        contract_notice_id=document['contract_notice_id']
                    )
                    
                    return result
                else:
                    logger.error(f"Norshin API error {norshin_response.status_code}: {norshin_response.text}")
                    return None
                    
            finally:
                # No temporary files to clean up since we use pre-downloaded files
                pass
                    
        except Exception as e:
            logger.error(f"Error processing document via Norshin API: {e}")
            return None
    
    def get_queue_status(self) -> Dict:
        """Get current queue status"""
        queued_count = len([d for d in self.processing_queue if d['status'] == 'queued'])
        processing_count = len([d for d in self.processing_queue if d['status'] == 'processing'])
        
        return {
            'is_processing': self.is_processing,
            'queue_length': len(self.processing_queue),
            'queued': queued_count,
            'processing': processing_count,
            'recent_documents': self.processing_queue[-10:] if self.processing_queue else []
        }
    
    def _resume_processing_from_db(self):
        """Resume processing any pending items from database on startup"""
        logger.info("Checking for pending documents in database queue...")
        # For now, just log that we're checking - will implement database persistence later
        # This prevents startup errors while maintaining functionality

# Global instance
background_processor = BackgroundDocumentProcessor()