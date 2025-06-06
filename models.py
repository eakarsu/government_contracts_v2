from app import db
from datetime import datetime
from sqlalchemy import Text, JSON
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class Contract(db.Model):
    """Model for storing government contract metadata"""
    id = db.Column(db.Integer, primary_key=True)
    notice_id = db.Column(db.String(100), unique=True, nullable=False, index=True)
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(Text)
    agency = db.Column(db.String(200))
    office = db.Column(db.String(200))
    posted_date = db.Column(db.DateTime)
    response_date = db.Column(db.DateTime)
    naics_code = db.Column(db.String(20))
    classification_code = db.Column(db.String(20))
    set_aside_code = db.Column(db.String(200))
    place_of_performance = db.Column(db.String(200))
    resource_links = db.Column(JSON)  # Store document links as JSON
    award_amount = db.Column(db.String(100))
    award_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    indexed_at = db.Column(db.DateTime)  # When it was indexed in vector DB
    
    def __repr__(self):
        return f'<Contract {self.notice_id}: {self.title[:50]}>'
    
    def to_dict(self):
        """Convert contract to dictionary for API responses"""
        return {
            'id': self.id,
            'notice_id': self.notice_id,
            'title': self.title,
            'description': self.description,
            'agency': self.agency,
            'office': self.office,
            'posted_date': self.posted_date.isoformat() if self.posted_date else None,
            'response_date': self.response_date.isoformat() if self.response_date else None,
            'naics_code': self.naics_code,
            'classification_code': self.classification_code,
            'set_aside_code': self.set_aside_code,
            'place_of_performance': self.place_of_performance,
            'resource_links': self.resource_links,
            'award_amount': self.award_amount,
            'award_date': self.award_date.isoformat() if self.award_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class IndexingJob(db.Model):
    """Model for tracking indexing jobs and their status"""
    id = db.Column(db.Integer, primary_key=True)
    job_type = db.Column(db.String(50), nullable=False)  # 'contracts', 'documents'
    status = db.Column(db.String(20), default='pending')  # pending, running, completed, failed
    start_date = db.Column(db.DateTime)
    end_date = db.Column(db.DateTime)
    records_processed = db.Column(db.Integer, default=0)
    errors_count = db.Column(db.Integer, default=0)
    error_details = db.Column(Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    def __repr__(self):
        return f'<IndexingJob {self.id}: {self.job_type} - {self.status}>'

class SearchQuery(db.Model):
    """Model for tracking search queries and analytics"""
    id = db.Column(db.Integer, primary_key=True)
    query_text = db.Column(Text, nullable=False)
    results_count = db.Column(db.Integer)
    response_time = db.Column(db.Float)  # in seconds
    user_ip = db.Column(db.String(45))  # Support IPv6
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SearchQuery {self.id}: {self.query_text[:50]}>'

class User(UserMixin, db.Model):
    """Model for user accounts"""
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=True)
    role = db.Column(db.String(20), default='user')  # user, admin, company_admin
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    company = db.relationship('Company', backref='users')
    contract_applications = db.relationship('ContractApplication', backref='user')
    search_queries = db.relationship('SearchQuery', backref='user')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    def __repr__(self):
        return f'<User {self.email}>'

class Company(db.Model):
    """Model for company profiles"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    legal_name = db.Column(db.String(200), nullable=True)
    duns_number = db.Column(db.String(20), unique=True, nullable=True)
    cage_code = db.Column(db.String(10), nullable=True)
    ein = db.Column(db.String(20), nullable=True)
    
    # Company details
    description = db.Column(Text)
    website = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    
    # Address
    address_line1 = db.Column(db.String(200))
    address_line2 = db.Column(db.String(200))
    city = db.Column(db.String(100))
    state = db.Column(db.String(50))
    zip_code = db.Column(db.String(20))
    country = db.Column(db.String(50), default='USA')
    
    # Business classifications
    naics_codes = db.Column(JSON)  # List of NAICS codes company works with
    set_aside_types = db.Column(JSON)  # Set-aside certifications
    capabilities = db.Column(JSON)  # List of company capabilities/services
    
    # Company size and type
    employee_count = db.Column(db.String(20))  # Small, Medium, Large, etc.
    annual_revenue = db.Column(db.String(50))
    business_type = db.Column(db.String(50))  # Corporation, LLC, Partnership, etc.
    
    # Certifications
    certifications = db.Column(JSON)  # List of certifications (8(a), HUBZone, etc.)
    
    # System fields
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    contract_applications = db.relationship('ContractApplication', backref='company')
    
    def __repr__(self):
        return f'<Company {self.name}>'

class ContractApplication(db.Model):
    """Model for tracking contract applications"""
    id = db.Column(db.Integer, primary_key=True)
    contract_notice_id = db.Column(db.String(100), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    
    # Application status
    status = db.Column(db.String(20), default='draft')  # draft, submitted, awarded, rejected
    submission_date = db.Column(db.DateTime)
    
    # Application data
    proposal_summary = db.Column(Text)
    technical_approach = db.Column(Text)
    past_performance = db.Column(Text)
    pricing_strategy = db.Column(Text)
    team_composition = db.Column(JSON)
    
    # AI-generated content
    ai_generated_sections = db.Column(JSON)  # Track which sections were AI-generated
    ai_recommendations = db.Column(JSON)  # Store AI recommendations for the application
    
    # Documents
    documents = db.Column(JSON)  # List of document URLs/paths
    
    # System fields
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<ContractApplication {self.id}: {self.contract_notice_id}>'

class AITemplate(db.Model):
    """Model for storing AI-generated document templates"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(Text)
    template_type = db.Column(db.String(50), nullable=False)  # proposal, capability_statement, etc.
    
    # Template content
    template_content = db.Column(Text, nullable=False)
    variables = db.Column(JSON)  # Template variables that can be filled
    
    # Usage tracking
    usage_count = db.Column(db.Integer, default=0)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=True)  # Company-specific templates
    
    # System fields
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = db.relationship('Company', backref='ai_templates')
    
    def __repr__(self):
        return f'<AITemplate {self.name}>'


class DocumentProcessingQueue(db.Model):
    """Model for persistent document processing queue"""
    __tablename__ = 'document_processing_queue'
    
    id = db.Column(db.Integer, primary_key=True)
    contract_notice_id = db.Column(db.String(100), nullable=False, index=True)
    document_url = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    filename = db.Column(db.String(500))
    local_file_path = db.Column(db.String(500))  # Path to downloaded file in queue_documents
    status = db.Column(db.String(20), default='queued')  # queued, processing, completed, failed
    priority = db.Column(db.Integer, default=0)
    
    # Processing tracking
    queued_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    failed_at = db.Column(db.DateTime)
    
    # Results
    processed_data = db.Column(db.Text)  # JSON string of Norshin response
    saved_file_path = db.Column(db.String(500))
    error_message = db.Column(db.Text)
    retry_count = db.Column(db.Integer, default=0)
    max_retries = db.Column(db.Integer, default=3)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<DocumentProcessingQueue {self.contract_notice_id}: {self.status}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'contract_notice_id': self.contract_notice_id,
            'document_url': self.document_url,
            'description': self.description,
            'filename': self.filename,
            'status': self.status,
            'priority': self.priority,
            'queued_at': self.queued_at.isoformat() if self.queued_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'failed_at': self.failed_at.isoformat() if self.failed_at else None,
            'saved_file_path': self.saved_file_path,
            'retry_count': self.retry_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
