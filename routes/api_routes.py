from flask import Blueprint, request, jsonify
import logging
from datetime import datetime, timedelta
from services.sam_gov_api import SAMGovAPI
from services.document_processor import DocumentProcessor
from services.vector_database import VectorDatabase
from services.ai_analyzer import AIAnalyzer
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
            return jsonify({'message': 'No contracts to index', 'indexed_count': 0})
        
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
        
        # Get contracts with valid resource links (not null, not empty array, not empty string)
        query = Contract.query.filter(
            db.and_(
                Contract.resource_links.isnot(None),
                db.text("CAST(resource_links AS TEXT) != 'null'"),
                db.text("CAST(resource_links AS TEXT) != '[]'"),
                db.text("CAST(resource_links AS TEXT) != ''"),
                db.text("LENGTH(CAST(resource_links AS TEXT)) > 2")  # More than just '[]'
            )
        )
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
