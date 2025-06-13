import asyncio
import aiohttp
import logging
import json
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from models import DocumentProcessingQueue, db
from services.vector_database import VectorDatabase

logger = logging.getLogger(__name__)

class AsyncDocumentProcessor:
    """Async processor for true concurrent Norshin API processing"""
    
    def __init__(self):
        self.norshin_api_url = os.environ.get('NORSHIN_API_URL')
        self.norshin_api_key = os.environ.get('NORSHIN_API_KEY')
        self.vector_db = VectorDatabase()
        self.semaphore = asyncio.Semaphore(10)  # Limit concurrent connections
    
    async def process_all_queued_documents(self):
        """Process all queued documents concurrently using async/await"""
        from app import app
        
        with app.app_context():
            # Get all queued documents
            queued_docs = DocumentProcessingQueue.query.filter_by(status='queued').all()
            
            if not queued_docs:
                logger.info("No documents in queue to process")
                return
            
            # Mark all as processing
            for doc in queued_docs:
                doc.status = 'processing'
                doc.started_at = datetime.utcnow()
            db.session.commit()
            
            logger.info(f"Starting async processing of {len(queued_docs)} documents")
            
            # Create async tasks for all documents
            tasks = []
            for doc in queued_docs:
                task = asyncio.create_task(self._process_document_async(doc))
                tasks.append(task)
            
            logger.info(f"Submitted all {len(tasks)} documents to Norshin API simultaneously")
            
            # Wait for all to complete - database updates happen in real-time
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            logger.info("All documents processed concurrently with real-time database updates")
    
    async def _process_document_async(self, doc: DocumentProcessingQueue) -> Optional[Dict]:
        """Process single document asynchronously and update database immediately"""
        from app import app
        
        async with self.semaphore:
            try:
                # Read local file
                if not doc.local_file_path or not os.path.exists(doc.local_file_path):
                    logger.error(f"Local file not found: {doc.local_file_path}")
                    # Update database immediately on failure
                    with app.app_context():
                        db_doc = DocumentProcessingQueue.query.get(doc.id)
                        if db_doc:
                            db_doc.status = 'failed'
                            db_doc.failed_at = datetime.utcnow()
                            db_doc.error_message = f"Local file not found: {doc.local_file_path}"
                            db_doc.retry_count += 1
                            db.session.commit()
                    return None
                
                with open(doc.local_file_path, 'rb') as file:
                    file_content = file.read()
                
                logger.info(f"Sending document {doc.id} to Norshin API: {doc.filename}")
                
                # Send to Norshin API asynchronously
                async with aiohttp.ClientSession() as session:
                    data = aiohttp.FormData()
                    data.add_field('document', 
                                 file_content,
                                 filename=doc.filename,
                                 content_type='application/octet-stream')
                    
                    headers = {}
                    if self.norshin_api_key:
                        headers['Authorization'] = f'Bearer {self.norshin_api_key}'
                    
                    timeout = aiohttp.ClientTimeout(total=3600)  # 1 hour timeout
                    
                    if not self.norshin_api_url:
                        logger.error("Norshin API URL not configured")
                        with app.app_context():
                            db_doc = DocumentProcessingQueue.query.get(doc.id)
                            if db_doc:
                                db_doc.status = 'failed'
                                db_doc.failed_at = datetime.utcnow()
                                db_doc.error_message = "Norshin API URL not configured"
                                db_doc.retry_count += 1
                                db.session.commit()
                        return None
                    
                    async with session.post(
                        self.norshin_api_url,
                        data=data,
                        headers=headers,
                        timeout=timeout
                    ) as response:
                        
                        if response.status == 200:
                            result = await response.json()
                            logger.info(f"Document {doc.id} processed successfully by Norshin")
                            
                            # Update database immediately on success
                            with app.app_context():
                                db_doc = DocumentProcessingQueue.query.get(doc.id)
                                if db_doc:
                                    db_doc.status = 'completed'
                                    db_doc.completed_at = datetime.utcnow()
                                    db_doc.processed_data = json.dumps(result)
                                    db.session.commit()
                                    
                                    # Index in vector database
                                    try:
                                        self._index_document(db_doc, result)
                                    except Exception as e:
                                        logger.warning(f"Failed to index document {doc.id}: {e}")
                            
                            return result
                        else:
                            error_text = await response.text()
                            
                            # Handle 504 timeouts differently - Norshin may still be processing with internal retries
                            if response.status == 504:
                                logger.warning(f"Document {doc.id} got 504 timeout - Norshin may still be processing with internal retries")
                                # Don't mark as failed immediately - let Norshin's retry mechanism work
                                # This document should be checked later or retried
                                with app.app_context():
                                    db_doc = DocumentProcessingQueue.query.get(doc.id)
                                    if db_doc:
                                        db_doc.status = 'failed'  # Mark as failed for now, but this needs manual review
                                        db_doc.failed_at = datetime.utcnow()
                                        db_doc.error_message = f"Norshin API timeout (504) - document may have been processed successfully by Norshin's retry mechanism"
                                        db_doc.retry_count += 1
                                        db.session.commit()
                            else:
                                logger.error(f"Document {doc.id} failed: {response.status} - {error_text}")
                                
                                # Update database immediately on real failure
                                with app.app_context():
                                    db_doc = DocumentProcessingQueue.query.get(doc.id)
                                    if db_doc:
                                        db_doc.status = 'failed'
                                        db_doc.failed_at = datetime.utcnow()
                                        db_doc.error_message = f"Norshin API error: {response.status} - {error_text}"
                                        db_doc.retry_count += 1
                                        db.session.commit()
                            
                            return None
                            
            except Exception as e:
                logger.error(f"Error processing document {doc.id}: {e}")
                
                # Update database immediately on exception
                with app.app_context():
                    db_doc = DocumentProcessingQueue.query.get(doc.id)
                    if db_doc:
                        db_doc.status = 'failed'
                        db_doc.failed_at = datetime.utcnow()
                        db_doc.error_message = str(e)
                        db_doc.retry_count += 1
                        db.session.commit()
                
                return None
    

    
    def _index_document(self, doc: DocumentProcessingQueue, processed_data: Dict):
        """Index processed document in vector database"""
        try:
            document_data = {
                'success': True,
                'text_content': str(processed_data),
                'url': doc.document_url,
                'description': doc.description or '',
                'file_type': doc.filename.split('.')[-1] if doc.filename and '.' in doc.filename else 'unknown',
                'text_length': len(str(processed_data))
            }
            
            self.vector_db.index_document(document_data, doc.contract_notice_id)
            logger.info(f"Indexed document {doc.id} in vector database")
            
        except Exception as e:
            logger.warning(f"Failed to index document {doc.id}: {e}")

# Global instance
async_processor = AsyncDocumentProcessor()