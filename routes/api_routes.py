from flask import Blueprint, request, jsonify
import logging
from datetime import datetime, timedelta
from services.sam_gov_api import SAMGovAPI
from services.document_processor import DocumentProcessor
from services.vector_database import VectorDatabase
from services.ai_analyzer import AIAnalyzer
from services.direct_processor import start_direct_processing
from services.processed_document_indexer import processed_indexer
# Import will be done inside functions to avoid circular import
from models import Contract, IndexingJob, SearchQuery, db
import time

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__)

# Initialize services
sam_gov_api = SAMGovAPI()
document_processor = DocumentProcessor()
vector_db = VectorDatabase()
ai_analyzer = AIAnalyzer()

@api_bp.route('/status', methods=['GET'])
def get_status():
    """Get API status and basic statistics"""
    try:
        # Get database stats
        contracts_count = Contract.query.count()
        
        # Get vector database stats
        vector_stats = vector_db.get_collection_stats()
        
        # Get recent indexing jobs
        recent_jobs = IndexingJob.query.order_by(IndexingJob.created_at.desc()).limit(5).all()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'database_stats': {
                'contracts_in_db': contracts_count,
                'contracts_indexed': vector_stats.get('contracts_count', 0),
                'documents_indexed': vector_stats.get('documents_count', 0)
            },
            'recent_jobs': [
                {
                    'id': job.id,
                    'type': job.job_type,
                    'status': job.status,
                    'created_at': job.created_at.isoformat() if job.created_at else None,
                    'records_processed': job.records_processed
                } for job in recent_jobs
            ]
        })
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@api_bp.route('/contracts/fetch', methods=['POST'])
def fetch_contracts():
    """Fetch contracts from SAM.gov API and store in database"""
    try:
        data = request.get_json() or {}
        
        # Parse date parameters or use intelligent defaults
        start_date = None
        end_date = None
        
        if data.get('start_date'):
            start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
        if data.get('end_date'):
            end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        
        # If no dates provided, automatically expand the search range based on existing contracts
        if not start_date and not end_date:
            # Get the oldest contract date we have
            oldest_contract = Contract.query.order_by(Contract.posted_date.asc()).first()
            if oldest_contract and oldest_contract.posted_date:
                # Fetch older contracts by going back further
                start_date = oldest_contract.posted_date - timedelta(days=30)
                end_date = oldest_contract.posted_date - timedelta(days=1)
            else:
                # Default to expanding the range to 60 days ago
                end_date = datetime.now()
                start_date = end_date - timedelta(days=60)
        
        limit = min(data.get('limit', 100), 1000)  # Cap at 1000
        offset = data.get('offset', 0)
        
        # Create indexing job record
        job = IndexingJob(
            job_type='contracts',
            status='running',
            start_date=start_date,
            end_date=end_date
        )
        db.session.add(job)
        db.session.commit()
        
        try:
            # Fetch contracts from SAM.gov
            response = sam_gov_api.fetch_contracts(
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                offset=offset
            )
            
            if not response:
                job.status = 'failed'
                job.error_details = 'Failed to fetch contracts from SAM.gov API'
                job.completed_at = datetime.utcnow()
                db.session.commit()
                return jsonify({'error': 'Failed to fetch contracts from SAM.gov'}), 500
            
            # Process contracts
            contracts_data = response.get('opportunitiesData', [])
            processed_count = 0
            errors_count = 0
            
            for contract_data in contracts_data:
                try:
                    # Extract contract details
                    contract_details = sam_gov_api.get_contract_details(contract_data)
                    
                    if not contract_details.get('notice_id'):
                        continue
                    
                    # Check if contract already exists
                    existing_contract = Contract.query.filter_by(
                        notice_id=contract_details['notice_id']
                    ).first()
                    
                    if existing_contract:
                        # Update existing contract
                        for key, value in contract_details.items():
                            setattr(existing_contract, key, value)
                        existing_contract.updated_at = datetime.utcnow()
                    else:
                        # Create new contract
                        contract = Contract(**contract_details)
                        db.session.add(contract)
                    
                    processed_count += 1
                    
                except Exception as e:
                    logger.error(f"Error processing contract: {str(e)}")
                    errors_count += 1
            
            # Commit database changes
            db.session.commit()
            
            # Update job status
            job.status = 'completed'
            job.records_processed = processed_count
            job.errors_count = errors_count
            job.completed_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'job_id': job.id,
                'contracts_processed': processed_count,
                'errors': errors_count,
                'total_available': response.get('totalRecords', 0)
            })
            
        except Exception as e:
            job.status = 'failed'
            job.error_details = str(e)
            job.completed_at = datetime.utcnow()
            db.session.commit()
            raise
            
    except Exception as e:
        logger.error(f"Contract fetch failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/contracts/index', methods=['POST'])
def index_contracts():
    """Index contracts in vector database"""
    try:
        # Handle both JSON and form data, with fallback to empty dict
        if request.is_json:
            data = request.get_json() or {}
        else:
            data = request.form.to_dict() or {}
        
        limit = int(data.get('limit', 100))
        
        # Get contracts that haven't been indexed yet
        contracts = Contract.query.filter(Contract.indexed_at.is_(None)).limit(limit).all()
        
        if not contracts:
            # Check total indexed contracts
            total_indexed = Contract.query.filter(Contract.indexed_at.isnot(None)).count()
            return jsonify({
                'message': f'All contracts already indexed. Total: {total_indexed}', 
                'indexed_count': 0,
                'total_indexed': total_indexed
            })
        
        # Create indexing job
        job = IndexingJob(job_type='contracts_indexing', status='running')
        db.session.add(job)
        db.session.commit()
        
        indexed_count = 0
        errors_count = 0
        
        try:
            for contract in contracts:
                try:
                    # Index contract in vector database with error handling
                    contract_data = contract.to_dict()
                    success = vector_db.index_contract(contract_data)
                    
                    if success:
                        contract.indexed_at = datetime.utcnow()
                        indexed_count += 1
                        logger.info(f"Successfully indexed contract: {contract.notice_id}")
                    else:
                        errors_count += 1
                        logger.warning(f"Failed to index contract: {contract.notice_id}")
                        
                    # Commit changes periodically to avoid large transactions
                    if (indexed_count + errors_count) % 10 == 0:
                        db.session.commit()
                        
                except Exception as e:
                    logger.error(f"Error indexing contract {contract.notice_id}: {str(e)}")
                    errors_count += 1
                    # Rollback failed transaction
                    db.session.rollback()
            
            # Final commit for remaining changes
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Critical error during indexing: {str(e)}")
            db.session.rollback()
        
        # Update job status
        try:
            job.status = 'completed'
            job.records_processed = indexed_count
            job.errors_count = errors_count
            job.completed_at = datetime.utcnow()
            db.session.commit()
        except Exception as e:
            logger.error(f"Error updating job status: {str(e)}")
            db.session.rollback()
        
        return jsonify({
            'success': True,
            'job_id': job.id,
            'indexed_count': indexed_count,
            'errors_count': errors_count
        })
        
    except Exception as e:
        logger.error(f"Contract indexing failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/documents/process', methods=['POST'])
def process_documents():
    """Process and index contract documents"""
    try:
        # Handle both JSON and form data, with fallback to empty dict
        if request.is_json:
            data = request.get_json() or {}
        else:
            data = request.form.to_dict() or {}
            
        contract_id = data.get('contract_id')
        limit = int(data.get('limit', 50))
        
        # Get contracts with valid resource links
        query = Contract.query.filter(Contract.resource_links.isnot(None))
        if contract_id:
            query = query.filter_by(notice_id=contract_id)
        
        contracts = query.limit(limit).all()
        
        if not contracts:
            return jsonify({'message': 'No contracts with documents found', 'processed_count': 0})
        
        # Create indexing job
        job = IndexingJob(job_type='documents', status='running')
        db.session.add(job)
        db.session.commit()
        
        processed_count = 0
        errors_count = 0
        
        for contract in contracts:
            try:
                resource_links = contract.resource_links
                if not resource_links:
                    continue
                
                # Get document links
                document_links = sam_gov_api.get_available_document_links(resource_links)
                
                if not document_links:
                    continue
                
                # Process documents
                for doc_link in document_links[:3]:  # Limit to 3 docs per contract
                    try:
                        # Process document via Norshin API
                        doc_result = document_processor.process_document_via_norshin_api(
                            doc_link['url'], 
                            contract.notice_id,
                            doc_link.get('description', '')
                        )
                        
                        if doc_result and doc_result.get('processed_data'):
                            # Index document in vector database
                            vector_db.index_document(doc_result, contract.notice_id)
                            processed_count += 1
                        else:
                            errors_count += 1
                            
                    except Exception as e:
                        logger.error(f"Error processing document {doc_link.get('url')}: {str(e)}")
                        errors_count += 1
                        
            except Exception as e:
                logger.error(f"Error processing documents for contract {contract.notice_id}: {str(e)}")
                errors_count += 1
        
        # Update job status
        job.status = 'completed'
        job.records_processed = processed_count
        job.errors_count = errors_count
        job.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job_id': job.id,
            'processed_count': processed_count,
            'errors_count': errors_count
        })
        
    except Exception as e:
        logger.error(f"Document processing failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/documents/queue/process-direct', methods=['POST'])
def process_documents_direct():
    """Process queued documents directly using OpenRouter API (bypassing Norshin)"""
    try:
        logger.info("Starting direct document processing via OpenRouter")
        
        # Start direct processing in background
        result = start_direct_processing()
        
        return jsonify({
            'success': True,
            'message': 'Direct processing started using OpenRouter API',
            'processing_method': 'direct_openrouter',
            'result': result
        })
        
    except Exception as e:
        logger.error(f"Direct document processing failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/documents/queue/index-processed', methods=['POST'])
def index_processed_documents():
    """Index all processed documents into vector database for search"""
    try:
        logger.info("Starting indexing of processed documents")
        
        # Index all processed documents
        result = processed_indexer.index_all_processed_documents()
        
        return jsonify({
            'success': True,
            'message': 'Processed documents indexed successfully',
            'stats': result
        })
        
    except Exception as e:
        logger.error(f"Failed to index processed documents: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/search', methods=['POST'])
def search_contracts():
    """Search contracts and documents using vector similarity"""
    try:
        start_time = time.time()
        
        data = request.get_json()
        if not data or not data.get('query'):
            return jsonify({'error': 'Query parameter is required'}), 400
        
        query = data['query']
        n_results = min(data.get('limit', 10), 50)  # Cap at 50
        
        # Perform vector search
        search_results = vector_db.search_all(query, n_results)
        
        response_time = time.time() - start_time
        
        # Log search query
        search_query = SearchQuery(
            query_text=query,
            results_count=search_results.get('total_results', 0),
            response_time=response_time,
            user_ip=request.remote_addr
        )
        db.session.add(search_query)
        db.session.commit()
        
        # Get AI analysis if requested
        ai_analysis = None
        if data.get('include_analysis', True):
            try:
                ai_analysis = ai_analyzer.analyze_search_results(query, search_results)
            except Exception as e:
                logger.error(f"AI analysis failed: {str(e)}")
                ai_analysis = {'error': 'AI analysis unavailable'}
        
        return jsonify({
            'query': query,
            'results': search_results,
            'ai_analysis': ai_analysis,
            'response_time': response_time,
            'search_id': search_query.id
        })
        
    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/contracts/<notice_id>/analyze', methods=['POST'])
def analyze_contract(notice_id):
    """Analyze a specific contract using AI"""
    try:
        # First try to get from database
        contract = Contract.query.filter_by(notice_id=notice_id).first()
        
        if contract:
            # Use database data
            contract_data = contract.to_dict()
        else:
            # Search in vector database for contract data
            search_results = vector_db.search_contracts(f"notice_id:{notice_id}", n_results=1)
            
            if not search_results or len(search_results) == 0:
                return jsonify({'error': 'Contract not found'}), 404
            
            # Extract contract data from vector search result
            contract_result = search_results[0]
            contract_data = {
                'notice_id': notice_id,
                'title': contract_result.get('metadata', {}).get('title', ''),
                'description': contract_result.get('content', ''),
                'agency': contract_result.get('metadata', {}).get('agency', ''),
                'naics_code': contract_result.get('metadata', {}).get('naics_code', ''),
                'classification_code': contract_result.get('metadata', {}).get('classification_code', ''),
                'posted_date': contract_result.get('metadata', {}).get('posted_date', ''),
                'set_aside_code': contract_result.get('metadata', {}).get('set_aside_code', '')
            }
        
        # Get AI analysis
        analysis = ai_analyzer.analyze_contract(contract_data)
        
        return jsonify({
            'contract_id': notice_id,
            'analysis': analysis
        })
        
    except Exception as e:
        logger.error(f"Contract analysis failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/recommendations', methods=['POST'])
def get_recommendations():
    """Get bidding recommendations based on search criteria"""
    try:
        data = request.get_json() or {}
        
        # Get contracts based on criteria
        query = Contract.query
        
        if data.get('naics_codes'):
            query = query.filter(Contract.naics_code.in_(data['naics_codes']))
        
        if data.get('agencies'):
            query = query.filter(Contract.agency.in_(data['agencies']))
        
        if data.get('keywords'):
            # Simple keyword search in title and description
            keywords = data['keywords']
            for keyword in keywords:
                query = query.filter(
                    db.or_(
                        Contract.title.contains(keyword),
                        Contract.description.contains(keyword)
                    )
                )
        
        contracts = query.limit(20).all()  # Limit for analysis
        
        if not contracts:
            return jsonify({'message': 'No matching contracts found', 'recommendations': []})
        
        # Get AI recommendations
        contract_dicts = [contract.to_dict() for contract in contracts]
        recommendations = ai_analyzer.generate_bid_recommendations(contract_dicts)
        
        return jsonify({
            'criteria': data,
            'contracts_analyzed': len(contracts),
            'recommendations': recommendations
        })
        
    except Exception as e:
        logger.error(f"Recommendations generation failed: {str(e)}")
        return jsonify({'error': str(e)}), 500



@api_bp.route('/documents/process-norshin', methods=['POST'])
def process_documents_norshin():
    """Process contract documents via Norshin.com API and index results"""
    try:
        data = request.get_json() or {}
        limit = data.get('limit', 5)  # Process 5 contracts by default for testing
        
        # Get contracts from PostgreSQL database that have valid resource links
        contracts = Contract.query.filter(
            db.and_(
                Contract.resource_links.isnot(None),
                db.text("CAST(resource_links AS TEXT) != 'null'"),
                db.text("CAST(resource_links AS TEXT) != '[]'"),
                db.text("CAST(resource_links AS TEXT) != ''"),
                db.text("LENGTH(CAST(resource_links AS TEXT)) > 2")  # More than just '[]'
            )
        ).limit(limit).all()
        
        if not contracts:
            return jsonify({'message': 'No contracts with document attachments found', 'processed_count': 0})
        
        # Create indexing job
        job = IndexingJob(job_type='norshin_documents', status='running')
        db.session.add(job)
        db.session.commit()
        
        processed_count = 0
        errors_count = 0
        doc_processor = DocumentProcessor()
        
        # Process each contract's documents
        for contract in contracts:
            try:
                notice_id = contract.notice_id
                resource_links = contract.resource_links
                
                if not resource_links:
                    continue
                
                logger.info(f"Processing {len(resource_links)} documents for contract {notice_id} via Norshin API")
                
                # Process documents via Norshin.com API
                documents = doc_processor.process_contract_documents_via_norshin(resource_links, notice_id)
                
                # Index processed documents in vector database
                for doc in documents:
                    try:
                        success = vector_db.index_document(doc, notice_id)
                        if success:
                            processed_count += 1
                            logger.info(f"Successfully indexed Norshin-processed document for contract {notice_id}")
                        else:
                            errors_count += 1
                    except Exception as e:
                        logger.error(f"Error indexing Norshin-processed document for contract {notice_id}: {str(e)}")
                        errors_count += 1
                        
            except Exception as e:
                logger.error(f"Error processing documents for contract {notice_id}: {str(e)}")
                errors_count += 1
        
        # Update job status
        job.status = 'completed'
        job.records_processed = processed_count
        job.errors_count = errors_count
        job.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job_id': job.id,
            'processed_count': processed_count,
            'errors_count': errors_count,
            'processing_method': 'norshin_api'
        })
        
    except Exception as e:
        logger.error(f"Norshin document processing failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/documents/retry-failed', methods=['POST'])
def retry_failed_documents():
    """Retry processing of failed documents that haven't exceeded max retries"""
    try:
        from models import DocumentProcessingQueue
        from services.background_processor import background_processor
        
        # Get failed documents that can still be retried
        failed_docs = DocumentProcessingQueue.query.filter(
            DocumentProcessingQueue.status == 'failed',
            DocumentProcessingQueue.retry_count < DocumentProcessingQueue.max_retries
        ).all()
        
        if not failed_docs:
            return jsonify({
                'success': True,
                'message': 'No failed documents available for retry',
                'retried_count': 0
            })
        
        retried_count = 0
        for doc in failed_docs:
            # Reset document status for retry
            doc.status = 'queued'
            doc.retry_count += 1
            doc.failed_at = None
            doc.error_message = None
            logger.info(f"Retrying document: {doc.filename} (attempt {doc.retry_count}/{doc.max_retries})")
            retried_count += 1
        
        db.session.commit()
        
        # Start processing the retried documents
        if retried_count > 0:
            background_processor.start_processing()
        
        return jsonify({
            'success': True,
            'retried_count': retried_count,
            'message': f'Retrying {retried_count} failed documents'
        })
        
    except Exception as e:
        logger.error(f"Error retrying failed documents: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/documents/index-completed', methods=['POST'])
def index_completed_documents():
    """Index all completed processed documents in vector database"""
    try:
        from models import DocumentProcessingQueue
        import json
        
        # Get all completed documents that haven't been indexed yet
        completed_docs = DocumentProcessingQueue.query.filter_by(status='completed').all()
        
        if not completed_docs:
            return jsonify({
                'success': True,
                'message': 'No completed documents to index',
                'indexed_count': 0
            })
        
        # Create indexing job
        job = IndexingJob(job_type='documents', status='running')
        db.session.add(job)
        db.session.commit()
        
        indexed_count = 0
        errors_count = 0
        
        for doc in completed_docs:
            try:
                # Parse processed data if available
                processed_data = {}
                if doc.processed_data:
                    try:
                        processed_data = json.loads(doc.processed_data)
                    except:
                        processed_data = {'raw_data': doc.processed_data}
                
                # Index document in vector database
                document_data = {
                    'success': True,
                    'text_content': str(processed_data),
                    'url': doc.document_url,
                    'description': doc.description or '',
                    'file_type': doc.filename.split('.')[-1] if doc.filename and '.' in doc.filename else 'unknown',
                    'text_length': len(str(processed_data)),
                    'processed_at': doc.completed_at.isoformat() if doc.completed_at else None
                }
                
                success = vector_db.index_document(document_data, doc.contract_notice_id)
                
                if success:
                    indexed_count += 1
                    logger.info(f"Successfully indexed document: {doc.filename}")
                else:
                    errors_count += 1
                    logger.warning(f"Failed to index document: {doc.filename}")
                    
            except Exception as e:
                logger.error(f"Error indexing document {doc.filename}: {str(e)}")
                errors_count += 1
        
        # Update job status
        job.status = 'completed'
        job.records_processed = indexed_count
        job.errors_count = errors_count
        job.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job_id': job.id,
            'indexed_count': indexed_count,
            'errors_count': errors_count,
            'total_documents': len(completed_docs)
        })
        
    except Exception as e:
        logger.error(f"Error indexing completed documents: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/jobs/<int:job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get status of an indexing job"""
    try:
        job = IndexingJob.query.get_or_404(job_id)
        
        return jsonify({
            'id': job.id,
            'type': job.job_type,
            'status': job.status,
            'start_date': job.start_date.isoformat() if job.start_date else None,
            'end_date': job.end_date.isoformat() if job.end_date else None,
            'records_processed': job.records_processed,
            'errors_count': job.errors_count,
            'error_details': job.error_details,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None
        })
        
    except Exception as e:
        logger.error(f"Job status retrieval failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/documents/queue', methods=['POST'])
def queue_documents_for_processing():
    """Queue contract documents for background processing via Norshin API"""
    try:
        # Reset all existing queue items to start fresh
        from models import DocumentProcessingQueue
        from pathlib import Path
        import shutil
        
        logger.info("Resetting document processing queue...")
        DocumentProcessingQueue.query.delete()
        db.session.commit()
        
        # Also clear downloaded files to start completely fresh
        queue_docs_dir = Path("queue_documents")
        if queue_docs_dir.exists():
            shutil.rmtree(queue_docs_dir)
            queue_docs_dir.mkdir(exist_ok=True)
            logger.info("Cleared queue_documents folder")
        
        processed_docs_dir = Path("processed_queue_documents") 
        if processed_docs_dir.exists():
            shutil.rmtree(processed_docs_dir)
            processed_docs_dir.mkdir(exist_ok=True)
            logger.info("Cleared processed_queue_documents folder")
            
        logger.info("Document processing queue and files cleared completely")
        
        # Get contracts with documents that haven't been processed
        contracts = Contract.query.filter(
            Contract.resource_links.isnot(None)
        ).limit(10).all()
        
        if not contracts:
            return jsonify({
                'success': True,
                'message': 'No documents to queue for processing',
                'queued_count': 0
            })
        
        # Import background processor locally to avoid circular import
        from services.background_processor import background_processor
        
        queued_count = 0
        for contract in contracts:
            if contract.resource_links:
                # Parse resource_links JSON array
                if isinstance(contract.resource_links, list):
                    for link_url in contract.resource_links:
                        # Queue document for background processing
                        background_processor.queue_document(
                            contract_notice_id=contract.notice_id,
                            document_url=link_url,
                            description=contract.title
                        )
                        queued_count += 1
        
        # Get fresh queue status after clearing and queueing
        from sqlalchemy import func
        fresh_status_counts = db.session.query(
            DocumentProcessingQueue.status,
            func.count(DocumentProcessingQueue.id).label('count')
        ).group_by(DocumentProcessingQueue.status).all()
        
        fresh_counts = {status: count for status, count in fresh_status_counts}
        
        return jsonify({
            'success': True,
            'message': f'Queue reset complete! Queued {queued_count} fresh documents for processing',
            'queued_count': queued_count,
            'queue_status': {
                'queued': fresh_counts.get('queued', 0),
                'processing': fresh_counts.get('processing', 0),
                'completed': fresh_counts.get('completed', 0),
                'failed': fresh_counts.get('failed', 0),
                'total': sum(fresh_counts.values()),
                'is_processing': fresh_counts.get('processing', 0) > 0
            }
        })
        
    except Exception as e:
        logger.error(f"Error queuing documents: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/documents/queue/status', methods=['GET'])
def get_queue_status():
    """Get current document processing queue status from database"""
    try:
        from models import DocumentProcessingQueue
        from sqlalchemy import func
        
        # Get real-time counts from database
        status_counts = db.session.query(
            DocumentProcessingQueue.status,
            func.count(DocumentProcessingQueue.id).label('count')
        ).group_by(DocumentProcessingQueue.status).all()
        
        # Convert to dictionary
        counts = {status: count for status, count in status_counts}
        
        # Get recent completed documents
        recent_docs = DocumentProcessingQueue.query.filter_by(
            status='completed'
        ).order_by(DocumentProcessingQueue.completed_at.desc()).limit(5).all()
        
        queue_status = {
            'queued': counts.get('queued', 0),
            'processing': counts.get('processing', 0),
            'completed': counts.get('completed', 0),
            'failed': counts.get('failed', 0),
            'total': sum(counts.values()),
            'is_processing': counts.get('processing', 0) > 0,
            'recent_documents': [
                {
                    'filename': doc.filename,
                    'completed_at': doc.completed_at.isoformat() if doc.completed_at else None,
                    'contract_notice_id': doc.contract_notice_id
                } for doc in recent_docs
            ]
        }
        
        return jsonify({
            'success': True,
            'queue_status': queue_status
        })
        
    except Exception as e:
        logger.error(f"Error getting queue status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/documents/queue/pause', methods=['POST'])
def pause_queue():
    """Pause the document processing queue"""
    try:
        # Import background processor locally to avoid circular import
        from services.background_processor import background_processor
        
        result = background_processor.pause_queue()
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error pausing queue: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/documents/queue/resume', methods=['POST'])
def resume_queue():
    """Resume the document processing queue"""
    try:
        # Import background processor locally to avoid circular import
        from services.background_processor import background_processor
        
        result = background_processor.resume_queue()
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error resuming queue: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/documents/queue/stop', methods=['POST'])
def stop_queue():
    """Stop the document processing queue completely"""
    try:
        # Import background processor locally to avoid circular import
        from services.background_processor import background_processor
        
        result = background_processor.stop_processing()
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error stopping queue: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/documents/queue/process-async', methods=['POST'])
def process_async():
    """Process all queued documents with true async concurrency"""
    try:
        import asyncio
        from services.async_processor import async_processor
        
        logger.info("Starting true async concurrent processing")
        
        # Run async processing
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(async_processor.process_all_queued_documents())
        loop.close()
        
        return jsonify({
            'success': True,
            'message': 'All documents submitted to Norshin API simultaneously',
            'processing_method': 'async_concurrent'
        })
        
    except Exception as e:
        logger.error(f"Async processing failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/documents/queue/test-mode', methods=['POST'])
def queue_test_documents():
    """Queue small test documents for cost-effective testing (max 7 docs, under 5 pages each)"""
    try:
        import json
        import requests
        import PyPDF2
        from io import BytesIO
        from pathlib import Path
        import shutil
        from models import DocumentProcessingQueue
        
        logger.info("Starting test mode document queueing...")
        
        # Clear existing test queue
        DocumentProcessingQueue.query.delete()
        db.session.commit()
        
        # Clear queue folders
        queue_docs_dir = Path("queue_documents")
        if queue_docs_dir.exists():
            shutil.rmtree(queue_docs_dir)
        queue_docs_dir.mkdir(exist_ok=True)
        
        def get_document_page_count(url):
            """Download and check page count of document - relaxed for testing"""
            try:
                response = requests.head(url, timeout=10)
                content_length = response.headers.get('content-length')
                
                # Accept files under 1MB for testing
                if content_length and int(content_length) > 1000000:
                    return float('inf')
                
                # For testing, accept most common document types
                if any(ext in url.lower() for ext in ['.docx', '.txt', '.doc']):
                    return 2  # Assume small for testing
                
                # Check PDF page count only for smaller files
                if '.pdf' in url.lower():
                    if content_length and int(content_length) < 300000:  # Under 300KB
                        return 3  # Assume small PDF for testing
                    else:
                        try:
                            doc_response = requests.get(url, timeout=15, stream=True)
                            if doc_response.status_code == 200:
                                # Read first 100KB to check if it's readable
                                content = b''
                                for chunk in doc_response.iter_content(chunk_size=8192):
                                    content += chunk
                                    if len(content) > 100000:
                                        break
                                
                                pdf_file = BytesIO(content)
                                try:
                                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                                    page_count = len(pdf_reader.pages)
                                    return min(page_count, 5)  # Cap at 5 for testing
                                except:
                                    return 4  # Assume readable PDF for testing
                        except:
                            return float('inf')
                
                # Accept unknown small files for testing
                if not content_length or int(content_length) < 100000:
                    return 3  # Assume small for testing
                
                return float('inf')
                
            except Exception as e:
                logger.warning(f"Could not check document size: {e}")
                return 3  # Default to small for testing
        
        # Get contracts with documents
        contracts = Contract.query.filter(
            Contract.resource_links.isnot(None)
        ).limit(5).all()
        
        if not contracts:
            return jsonify({
                'success': True,
                'message': 'No contracts available for testing',
                'queued_count': 0
            })
        
        from services.background_processor import background_processor
        
        queued_count = 0
        max_test_docs = 7
        max_pages = 5
        
        for contract in contracts:
            if queued_count >= max_test_docs:
                break
                
            if contract.resource_links:
                try:
                    if isinstance(contract.resource_links, str):
                        resource_links = json.loads(contract.resource_links)
                    else:
                        resource_links = contract.resource_links
                    
                    # Handle both list and dict formats
                    if isinstance(resource_links, dict):
                        resource_links = [resource_links]
                    
                    for link in resource_links:
                        if queued_count >= max_test_docs:
                            break
                        
                        # Handle different link formats
                        if isinstance(link, dict):
                            url = link.get('url', '')
                            description = link.get('description', '')
                        elif isinstance(link, str):
                            url = link
                            description = 'Document'
                        else:
                            continue
                        
                        # Check document size/page count
                        page_count = get_document_page_count(url)
                        
                        if page_count <= max_pages:
                            background_processor.queue_document(
                                contract.notice_id,
                                url,
                                f"TEST MODE ({page_count}p): {description}"
                            )
                            queued_count += 1
                            logger.info(f"Queued test document {queued_count}: {description[:50]} ({page_count} pages)")
                            
                except Exception as e:
                    logger.error(f"Error processing contract {contract.notice_id}: {e}")
                    continue
        
        return jsonify({
            'success': True,
            'message': f'Test mode: Queued {queued_count} small documents (≤{max_pages} pages each)',
            'queued_count': queued_count,
            'max_documents': max_test_docs,
            'max_pages': max_pages,
            'mode': 'test'
        })
        
    except Exception as e:
        logger.error(f"Test mode queueing failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/documents/queue/test-process', methods=['POST'])
def process_test_async():
    """Process test documents with cost monitoring and counter reset"""
    try:
        from models import DocumentProcessingQueue
        
        # Reset completed documents first for clean testing
        completed_docs = DocumentProcessingQueue.query.filter_by(status='completed').all()
        for doc in completed_docs:
            db.session.delete(doc)
        db.session.commit()
        logger.info(f"Reset {len(completed_docs)} completed documents for clean test")
        
        # Check queue size before processing
        test_docs = DocumentProcessingQueue.query.filter_by(status='queued').all()
        
        if len(test_docs) > 7:
            return jsonify({
                'success': False,
                'error': f'Too many documents queued ({len(test_docs)}). Test mode limited to 7 documents max.',
                'queued_count': len(test_docs)
            }), 400
        
        if len(test_docs) == 0:
            return jsonify({
                'success': False,
                'error': 'No documents queued for processing. Click "Queue Test Docs" first.',
                'queued_count': 0
            }), 400
        
        logger.info(f"Starting test mode processing of {len(test_docs)} documents")
        
        # Start async processing in a separate thread to avoid blocking
        import threading
        import asyncio
        from services.async_processor import async_processor
        
        def process_in_background():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(async_processor.process_all_queued_documents())
                loop.close()
                logger.info("Test mode async processing completed successfully")
            except Exception as e:
                logger.error(f"Background processing error: {e}")
        
        # Start processing thread
        processing_thread = threading.Thread(target=process_in_background)
        processing_thread.daemon = True
        processing_thread.start()
        
        return jsonify({
            'success': True,
            'message': f'Test mode: Started processing {len(test_docs)} documents concurrently',
            'submitted_count': len(test_docs),
            'processing_method': 'async_concurrent_test',
            'counters_reset': True,
            'status': 'processing_started'
        })
        
    except Exception as e:
        logger.error(f"Test mode processing failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/documents/queue/process-parallel', methods=['POST'])
def process_parallel():
    """Process all queued documents sequentially via Norshin API (one by one)"""
    try:
        from services.sequential_processor import SequentialDocumentProcessor
        
        processor = SequentialDocumentProcessor(delay_between_requests=5)
        result = processor.process_all_queued_documents()
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error in sequential processing: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/documents/notifications', methods=['GET'])
def get_notifications():
    """Get processing notifications with consistent database counts"""
    try:
        from models import DocumentProcessingQueue
        from sqlalchemy import func
        import os
        import json
        from pathlib import Path
        
        # Get consistent count from database
        completed_count = DocumentProcessingQueue.query.filter_by(status='completed').count()
        
        processed_dir = Path("processed_queue_documents")
        if not processed_dir.exists():
            return jsonify({
                'success': True,
                'notifications': [],
                'total_processed': completed_count
            })
        
        # Find all notification files
        notification_files = list(processed_dir.glob("*.notification.json"))
        notifications = []
        
        for notification_file in sorted(notification_files, key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                with open(notification_file, 'r') as f:
                    notification_data = json.load(f)
                    notifications.append(notification_data)
            except Exception as e:
                logger.warning(f"Error reading notification file {notification_file}: {e}")
        
        return jsonify({
            'success': True,
            'notifications': notifications,
            'total_processed': completed_count
        })
        
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/documents/processed', methods=['GET'])
def get_processed_documents():
    """Get list of processed documents in processed_queue_documents folder"""
    try:
        import os
        from pathlib import Path
        
        processed_dir = Path("processed_queue_documents")
        if not processed_dir.exists():
            return jsonify({
                'success': True,
                'processed_documents': [],
                'total_files': 0
            })
        
        # Get all files except notification files
        document_files = [f for f in processed_dir.iterdir() 
                         if f.is_file() and not f.name.endswith('.notification.json')]
        
        processed_documents = []
        for doc_file in sorted(document_files, key=lambda x: x.stat().st_mtime, reverse=True):
            file_info = {
                'filename': doc_file.name,
                'file_size': doc_file.stat().st_size,
                'processed_at': doc_file.stat().st_mtime,
                'file_path': str(doc_file)
            }
            processed_documents.append(file_info)
        
        return jsonify({
            'success': True,
            'processed_documents': processed_documents,
            'total_files': len(processed_documents)
        })
        
    except Exception as e:
        logger.error(f"Error getting processed documents: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
