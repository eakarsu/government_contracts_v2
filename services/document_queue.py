import json
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from models import db
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean

logger = logging.getLogger(__name__)

class DocumentQueue(db.Model):
    """Model for queuing documents to be processed"""
    __tablename__ = 'document_queue'
    
    id = Column(Integer, primary_key=True)
    contract_notice_id = Column(String(100), nullable=False, index=True)
    document_url = Column(Text, nullable=False)
    document_filename = Column(String(500))
    status = Column(String(20), default='pending')  # pending, processing, completed, failed
    priority = Column(Integer, default=0)  # Higher numbers = higher priority
    
    # Processing details
    norshin_request_sent_at = Column(DateTime)
    norshin_response_received_at = Column(DateTime)
    processing_time_seconds = Column(Integer)
    
    # Results
    processed_data = Column(Text)  # JSON string of Norshin response
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<DocumentQueue {self.contract_notice_id}: {self.status}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'contract_notice_id': self.contract_notice_id,
            'document_url': self.document_url,
            'document_filename': self.document_filename,
            'status': self.status,
            'priority': self.priority,
            'processing_time_seconds': self.processing_time_seconds,
            'retry_count': self.retry_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class DocumentQueueManager:
    """Manager for handling document processing queue"""
    
    def __init__(self):
        self.max_concurrent_requests = 3
        self.processing_timeout = 300  # 5 minutes
    
    def add_document_to_queue(self, contract_notice_id: str, document_url: str, 
                             document_filename: str = None, priority: int = 0) -> DocumentQueue:
        """Add a document to the processing queue"""
        
        # Check if document already exists in queue
        existing = DocumentQueue.query.filter_by(
            contract_notice_id=contract_notice_id,
            document_url=document_url
        ).first()
        
        if existing:
            logger.info(f"Document already in queue: {document_url}")
            return existing
        
        # Create new queue entry
        queue_item = DocumentQueue(
            contract_notice_id=contract_notice_id,
            document_url=document_url,
            document_filename=document_filename,
            priority=priority
        )
        
        db.session.add(queue_item)
        db.session.commit()
        
        logger.info(f"Added document to queue: {document_url}")
        return queue_item
    
    def get_next_pending_document(self) -> Optional[DocumentQueue]:
        """Get the next document to process (highest priority, oldest first)"""
        return DocumentQueue.query.filter_by(status='pending').order_by(
            DocumentQueue.priority.desc(),
            DocumentQueue.created_at.asc()
        ).first()
    
    def get_processing_count(self) -> int:
        """Get number of documents currently being processed"""
        return DocumentQueue.query.filter_by(status='processing').count()
    
    def mark_processing(self, queue_item: DocumentQueue) -> None:
        """Mark a document as being processed"""
        queue_item.status = 'processing'
        queue_item.norshin_request_sent_at = datetime.utcnow()
        queue_item.updated_at = datetime.utcnow()
        db.session.commit()
    
    
    def mark_completed(self, queue_item: DocumentQueue, processed_data: Dict) -> None:
        """Mark a document as completed with results"""
        queue_item.status = 'completed'
        queue_item.norshin_response_received_at = datetime.utcnow()
        queue_item.processed_data = json.dumps(processed_data)
        
        if queue_item.norshin_request_sent_at:
            processing_time = (queue_item.norshin_response_received_at - queue_item.norshin_request_sent_at).total_seconds()
            queue_item.processing_time_seconds = int(processing_time)
        
        queue_item.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Document processing completed: {queue_item.document_url}")
    
    def mark_failed(self, queue_item: DocumentQueue, error_message: str, retry: bool = True) -> None:
        """Mark a document as failed"""
        queue_item.retry_count += 1
        queue_item.error_message = error_message
        queue_item.updated_at = datetime.utcnow()
        
        if retry and queue_item.retry_count < queue_item.max_retries:
            queue_item.status = 'pending'  # Retry
            logger.warning(f"Document processing failed, will retry ({queue_item.retry_count}/{queue_item.max_retries}): {error_message}")
        else:
            queue_item.status = 'failed'
            logger.error(f"Document processing permanently failed: {error_message}")
        
        db.session.commit()
    
    def get_queue_stats(self) -> Dict:
        """Get statistics about the document queue"""
        stats = {
            'pending': DocumentQueue.query.filter_by(status='pending').count(),
            'processing': DocumentQueue.query.filter_by(status='processing').count(),
            'completed': DocumentQueue.query.filter_by(status='completed').count(),
            'failed': DocumentQueue.query.filter_by(status='failed').count(),
            'total': DocumentQueue.query.count()
        }
        return stats
    
    def cleanup_stale_processing(self) -> int:
        """Clean up documents that have been processing too long"""
        cutoff_time = datetime.utcnow() - timedelta(seconds=self.processing_timeout)
        
        stale_items = DocumentQueue.query.filter(
            DocumentQueue.status == 'processing',
            DocumentQueue.norshin_request_sent_at < cutoff_time
        ).all()
        
        count = 0
        for item in stale_items:
            self.mark_failed(item, "Processing timeout - marking as failed for retry", retry=True)
            count += 1
        
        if count > 0:
            logger.warning(f"Cleaned up {count} stale processing documents")
        
        return count
