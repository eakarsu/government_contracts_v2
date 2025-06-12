#!/usr/bin/env python3
"""
Service to index processed documents from Norshin API into vector database
"""

import os
import json
import logging
from pathlib import Path
from datetime import datetime
from services.vector_database import VectorDatabase
from app import app, db
from models import DocumentProcessingQueue

logger = logging.getLogger(__name__)

class ProcessedDocumentIndexer:
    """Index processed documents from Norshin API results into vector database"""
    
    def __init__(self):
        self.vector_db = VectorDatabase()
        self.processed_dir = Path("processed_queue_documents")
    
    def extract_searchable_content(self, norshin_data):
        """Extract searchable text from Norshin API results"""
        searchable_content = []
        
        if not norshin_data.get("success") or not norshin_data.get("results"):
            return ""
        
        for result in norshin_data["results"]:
            page_data = result.get("data", {})
            
            # Extract all text content from the page
            for key, value in page_data.items():
                if isinstance(value, str) and value.strip():
                    searchable_content.append(f"{key}: {value}")
        
        return "\n".join(searchable_content)
    
    def create_structured_metadata(self, filename, contract_id, norshin_data):
        """Create structured metadata from Norshin analysis"""
        metadata = {
            'contract_notice_id': contract_id,
            'filename': filename,
            'document_type': 'government_contract',
            'processor': 'norshin_api',
            'total_pages': str(norshin_data.get("totalPages", 0)),
            'processing_method': norshin_data.get("processingMethod", "unknown"),
            'indexed_at': datetime.utcnow().isoformat()
        }
        
        # Extract key contract information if available
        if norshin_data.get("success") and norshin_data.get("results"):
            first_page = norshin_data["results"][0].get("data", {})
            
            # Common contract fields
            if "solicitation_number" in first_page:
                metadata['solicitation_number'] = first_page["solicitation_number"]
            if "subject" in first_page:
                metadata['subject'] = first_page["subject"][:100]  # Limit length
            if "naics_code" in first_page:
                metadata['naics_code'] = first_page["naics_code"]
            if "set_aside" in first_page:
                metadata['set_aside'] = first_page["set_aside"]
            if "response_date_time_zone" in first_page:
                metadata['response_date'] = first_page["response_date_time_zone"][:50]
        
        # Ensure all values are strings and remove None values
        return {k: str(v) for k, v in metadata.items() if v is not None and str(v).strip()}
    
    def index_processed_document(self, json_file_path):
        """Index a single processed document"""
        try:
            with open(json_file_path, 'r') as f:
                norshin_data = json.load(f)
            
            # Extract contract ID from filename (format: contractid_filename.json)
            filename_parts = json_file_path.stem.split('_')
            if len(filename_parts) < 2:
                logger.warning(f"Cannot extract contract ID from filename: {json_file_path}")
                return False
            
            contract_id = filename_parts[0]
            filename = json_file_path.name
            
            # Check if this is valid Norshin data
            if not norshin_data.get("success") or not norshin_data.get("results"):
                logger.warning(f"Skipping {json_file_path} - invalid Norshin data")
                return False
            
            # Extract searchable content
            searchable_text = self.extract_searchable_content(norshin_data)
            
            if not searchable_text.strip():
                logger.warning(f"No searchable content found in {filename}")
                return False
            
            # Create metadata
            metadata = self.create_structured_metadata(filename, contract_id, norshin_data)
            
            # Generate unique document ID
            doc_id = f"processed_{contract_id}_{Path(filename).stem}"
            
            # Index in vector database
            self.vector_db.documents_collection.add(
                documents=[searchable_text],
                metadatas=[metadata],
                ids=[doc_id]
            )
            
            logger.info(f"Successfully indexed processed document: {filename}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to index processed document {json_file_path}: {e}")
            return False
    
    def index_all_processed_documents(self):
        """Index all processed documents in the processed_queue_documents directory"""
        if not self.processed_dir.exists():
            logger.warning("No processed documents directory found")
            return {"indexed": 0, "errors": 0}
        
        indexed_count = 0
        error_count = 0
        
        # Find all processed JSON files (excluding notification files)
        json_files = [
            f for f in self.processed_dir.glob("*.json") 
            if not f.name.endswith(".notification.json")
        ]
        
        logger.info(f"Found {len(json_files)} processed documents to index")
        
        for json_file in json_files:
            try:
                success = self.index_processed_document(json_file)
                if success:
                    indexed_count += 1
                else:
                    error_count += 1
            except Exception as e:
                logger.error(f"Error processing {json_file}: {e}")
                error_count += 1
        
        result = {
            "indexed": indexed_count,
            "errors": error_count,
            "total_files": len(json_files)
        }
        
        logger.info(f"Indexing completed: {result}")
        return result
    
    def get_indexing_stats(self):
        """Get statistics about indexed documents"""
        try:
            collection_count = self.vector_db.documents_collection.count()
            return {
                "total_documents_indexed": collection_count,
                "collection_name": "contract_documents"
            }
        except Exception as e:
            logger.error(f"Error getting indexing stats: {e}")
            return {"error": str(e)}

# Global indexer instance
processed_indexer = ProcessedDocumentIndexer()