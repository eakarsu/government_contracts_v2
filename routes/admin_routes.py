"""
Admin routes for managing document processing issues
"""
from flask import Blueprint, jsonify, request
from models import DocumentProcessingQueue, db
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/documents/stuck', methods=['GET'])
def get_stuck_documents():
    """Identify documents that have been processing for too long"""
    try:
        # Documents processing for more than 20 minutes are considered stuck
        cutoff_time = datetime.utcnow() - timedelta(minutes=20)
        
        stuck_docs = DocumentProcessingQueue.query.filter(
            DocumentProcessingQueue.status == 'processing',
            DocumentProcessingQueue.started_at < cutoff_time
        ).all()
        
        stuck_list = []
        for doc in stuck_docs:
            processing_time = (datetime.utcnow() - doc.started_at).total_seconds() if doc.started_at else 0
            stuck_list.append({
                'id': doc.id,
                'filename': doc.filename,
                'contract_notice_id': doc.contract_notice_id,
                'started_at': doc.started_at.isoformat() if doc.started_at else None,
                'processing_time_minutes': round(processing_time / 60, 1),
                'retry_count': doc.retry_count
            })
        
        return jsonify({
            'success': True,
            'stuck_documents': stuck_list,
            'count': len(stuck_list)
        })
        
    except Exception as e:
        logger.error(f"Error getting stuck documents: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/documents/reset/<int:doc_id>', methods=['POST'])
def reset_document(doc_id):
    """Reset a stuck document back to queued status"""
    try:
        doc = DocumentProcessingQueue.query.get_or_404(doc_id)
        
        doc.status = 'queued'
        doc.started_at = None
        doc.retry_count += 1
        doc.error_message = f"Reset due to timeout after {doc.retry_count} attempts"
        doc.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"Reset document {doc.filename} back to queued status")
        
        return jsonify({
            'success': True,
            'message': f'Document {doc.filename} reset to queued status',
            'retry_count': doc.retry_count
        })
        
    except Exception as e:
        logger.error(f"Error resetting document {doc_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/documents/reset-all-stuck', methods=['POST'])
def reset_all_stuck_documents():
    """Reset all stuck documents back to queued status"""
    try:
        # Documents processing for more than 20 minutes
        cutoff_time = datetime.utcnow() - timedelta(minutes=20)
        
        stuck_docs = DocumentProcessingQueue.query.filter(
            DocumentProcessingQueue.status == 'processing',
            DocumentProcessingQueue.started_at < cutoff_time
        ).all()
        
        reset_count = 0
        for doc in stuck_docs:
            doc.status = 'queued'
            doc.started_at = None
            doc.retry_count += 1
            doc.error_message = f"Auto-reset due to timeout after {doc.retry_count} attempts"
            doc.updated_at = datetime.utcnow()
            reset_count += 1
        
        db.session.commit()
        
        logger.info(f"Reset {reset_count} stuck documents back to queued status")
        
        return jsonify({
            'success': True,
            'message': f'Reset {reset_count} stuck documents back to queued status',
            'reset_count': reset_count
        })
        
    except Exception as e:
        logger.error(f"Error resetting stuck documents: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500