from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
import logging
from datetime import datetime, timedelta
from models import Contract, IndexingJob, SearchQuery
from services.vector_database import VectorDatabase

logger = logging.getLogger(__name__)

web_bp = Blueprint('web', __name__)

# Initialize services
vector_db = VectorDatabase()

@web_bp.route('/')
def index():
    """Main dashboard page"""
    try:
        # Get basic statistics
        contracts_count = Contract.query.count()
        vector_stats = vector_db.get_collection_stats()
        
        # Get recent indexing jobs
        recent_jobs = IndexingJob.query.order_by(IndexingJob.created_at.desc()).limit(5).all()
        
        # Get recent searches
        recent_searches = SearchQuery.query.order_by(SearchQuery.created_at.desc()).limit(10).all()
        
        return render_template('index.html',
                             contracts_count=contracts_count,
                             vector_stats=vector_stats,
                             recent_jobs=recent_jobs,
                             recent_searches=recent_searches)
    except Exception as e:
        logger.error(f"Dashboard loading failed: {str(e)}")
        flash(f'Error loading dashboard: {str(e)}', 'error')
        return render_template('index.html',
                             contracts_count=0,
                             vector_stats={},
                             recent_jobs=[],
                             recent_searches=[])

@web_bp.route('/search')
def search():
    """Search interface page"""
    return render_template('search.html')

@web_bp.route('/contracts')
def contracts():
    """Contracts listing page"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 20
        
        # Get contracts with pagination
        contracts = Contract.query.order_by(Contract.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return render_template('contracts.html', contracts=contracts)
    except Exception as e:
        logger.error(f"Contracts listing failed: {str(e)}")
        flash(f'Error loading contracts: {str(e)}', 'error')
        return render_template('contracts.html', contracts=None)

@web_bp.route('/contracts/<notice_id>')
def contract_detail(notice_id):
    """Individual contract detail page"""
    try:
        contract = Contract.query.filter_by(notice_id=notice_id).first_or_404()
        
        # Get related documents from vector database
        related_docs = vector_db.search_documents("", n_results=5, contract_id=notice_id)
        
        return render_template('contract_detail.html', 
                             contract=contract,
                             related_docs=related_docs)
    except Exception as e:
        logger.error(f"Contract detail loading failed: {str(e)}")
        flash(f'Error loading contract details: {str(e)}', 'error')
        return redirect(url_for('web.contracts'))

@web_bp.route('/jobs')
def jobs():
    """Indexing jobs status page"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 20
        
        jobs = IndexingJob.query.order_by(IndexingJob.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return render_template('jobs.html', jobs=jobs)
    except Exception as e:
        logger.error(f"Jobs listing failed: {str(e)}")
        flash(f'Error loading jobs: {str(e)}', 'error')
        return render_template('jobs.html', jobs=None)

@web_bp.route('/api-docs')
def api_docs():
    """API documentation page"""
    return render_template('api_docs.html')

@web_bp.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@web_bp.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return render_template('500.html'), 500
