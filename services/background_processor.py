import threading
import time
import logging
import requests
import json
import os
import tempfile
from datetime import datetime
from typing import Dict, List, Optional
from models import db, Contract
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
    
    def queue_document(self, contract_notice_id: str, document_url: str, description: str = None):
        """Queue a document for background processing"""
        document_info = {
            'contract_notice_id': contract_notice_id,
            'document_url': document_url,
            'description': description,
            'queued_at': datetime.utcnow().isoformat(),
            'status': 'queued'
        }
        
        self.processing_queue.append(document_info)
        logger.info(f"Queued document for processing: {document_url}")
        
        # Start processing thread if not already running
        if not self.is_processing:
            self.start_processing()
        
        return document_info
    
    def start_processing(self):
        """Start the background processing thread"""
        if self.processing_thread and self.processing_thread.is_alive():
            return
        
        self.is_processing = True
        self.processing_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.processing_thread.start()
        logger.info("Started background document processing thread")
    
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
        """Process a single document via Norshin API"""
        try:
            # Download the document
            response = requests.get(document['document_url'], timeout=30)
            if response.status_code != 200:
                logger.error(f"Failed to download document: {response.status_code}")
                return None
            
            # Determine filename and content type
            filename = document['document_url'].split('/')[-1]
            if '?' in filename:
                filename = filename.split('?')[0]
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
                temp_file.write(response.content)
                temp_file_path = temp_file.name
            
            try:
                # Send to Norshin API
                with open(temp_file_path, 'rb') as file:
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
                        document_id=f"{document['contract_notice_id']}_doc",
                        content=str(processed_data),
                        metadata=result
                    )
                    
                    return result
                else:
                    logger.error(f"Norshin API error {norshin_response.status_code}: {norshin_response.text}")
                    return None
                    
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
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

# Global instance
background_processor = BackgroundDocumentProcessor()