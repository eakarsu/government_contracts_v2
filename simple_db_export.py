#!/usr/bin/env python3
"""
Simple database export for key tables
"""
import os
import json
from models import Contract, DocumentProcessingQueue, db
from main import app

def export_key_data():
    """Export essential data to JSON files"""
    
    with app.app_context():
        # Export processed documents (most important for search functionality)
        processed_docs = DocumentProcessingQueue.query.filter_by(status='completed').all()
        
        docs_data = []
        for doc in processed_docs:
            docs_data.append({
                'contract_notice_id': doc.contract_notice_id,
                'document_url': doc.document_url,
                'description': doc.description,
                'filename': doc.filename,
                'processed_data': doc.processed_data,
                'status': doc.status,
                'completed_at': doc.completed_at.isoformat() if doc.completed_at else None
            })
        
        # Export sample contracts with documents
        contracts_with_docs = Contract.query.filter(
            Contract.resource_links.isnot(None)
        ).limit(100).all()
        
        contracts_data = []
        for contract in contracts_with_docs:
            contracts_data.append({
                'notice_id': contract.notice_id,
                'title': contract.title,
                'description': contract.description,
                'agency': contract.agency,
                'office': contract.office,
                'posted_date': contract.posted_date.isoformat() if contract.posted_date else None,
                'response_date': contract.response_date.isoformat() if contract.response_date else None,
                'naics_code': contract.naics_code,
                'classification_code': contract.classification_code,
                'set_aside_code': contract.set_aside_code,
                'place_of_performance': contract.place_of_performance,
                'resource_links': contract.resource_links,
                'award_amount': contract.award_amount
            })
        
        # Write to JSON files
        with open('processed_documents.json', 'w') as f:
            json.dump(docs_data, f, indent=2)
        
        with open('contracts_sample.json', 'w') as f:
            json.dump(contracts_data, f, indent=2)
        
        print(f"Exported {len(docs_data)} processed documents")
        print(f"Exported {len(contracts_data)} contracts")
        print("Files created: processed_documents.json, contracts_sample.json")

if __name__ == "__main__":
    export_key_data()