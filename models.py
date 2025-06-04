from app import db
from datetime import datetime
from sqlalchemy import Text, JSON

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
    set_aside_code = db.Column(db.String(50))
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SearchQuery {self.id}: {self.query_text[:50]}>'
