#!/usr/bin/env python3
"""
Direct document processor that bypasses Norshin and uses OpenRouter directly
"""

import os
import json
import time
import logging
import requests
import threading
from pathlib import Path
from datetime import datetime
from app import app, db
from models import DocumentProcessingQueue
import pdfplumber
import docx
from docx import Document

logger = logging.getLogger(__name__)

class DirectDocumentProcessor:
    """Process documents directly using OpenRouter API"""
    
    def __init__(self):
        self.openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
        self.openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
        self.is_processing = False
        
    def extract_text_from_file(self, file_path):
        """Extract text content from various file types"""
        file_path = Path(file_path)
        
        try:
            if file_path.suffix.lower() == '.pdf':
                return self._extract_pdf_text(file_path)
            elif file_path.suffix.lower() in ['.docx', '.doc']:
                return self._extract_docx_text(file_path)
            else:
                logger.warning(f"Unsupported file type: {file_path.suffix}")
                return ""
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {e}")
            return ""
    
    def _extract_pdf_text(self, file_path):
        """Extract text from PDF files"""
        text = ""
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            logger.error(f"Error reading PDF {file_path}: {e}")
        return text
    
    def _extract_docx_text(self, file_path):
        """Extract text from DOCX files"""
        text = ""
        try:
            doc = Document(file_path)
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
        except Exception as e:
            logger.error(f"Error reading DOCX {file_path}: {e}")
        return text
    
    def analyze_document_with_openrouter(self, text_content, filename):
        """Analyze document content using OpenRouter API"""
        
        prompt = f"""
Analyze this government contract document and extract key information in JSON format:

Document: {filename}

Content:
{text_content[:8000]}  # Limit to first 8000 characters

Please extract and return the following information in valid JSON format:
{{
    "title": "Document title or main subject",
    "document_type": "Type of document (RFP, RFQ, Notice, etc.)",
    "agency": "Government agency name",
    "contract_number": "Contract or solicitation number if available",
    "due_date": "Response deadline date if mentioned",
    "description": "Brief description of requirements",
    "key_requirements": ["List of main requirements"],
    "estimated_value": "Contract value if mentioned",
    "naics_codes": ["Relevant NAICS codes if mentioned"],
    "set_aside": "Set-aside type if applicable",
    "location": "Place of performance if mentioned",
    "contact_info": "Contact information if available",
    "summary": "2-3 sentence summary of the opportunity"
}}

Return only valid JSON, no additional text.
"""

        try:
            response = requests.post(
                self.openrouter_url,
                headers={
                    "Authorization": f"Bearer {self.openrouter_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "anthropic/claude-3.5-sonnet",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2000
                },
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # Try to parse as JSON
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # If not valid JSON, wrap in a structure
                    return {
                        "analysis": content,
                        "raw_response": True
                    }
            else:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return {"error": f"API error: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"Error calling OpenRouter API: {e}")
            return {"error": str(e)}
    
    def process_single_document(self, doc):
        """Process a single document from the queue"""
        
        with app.app_context():
            # Mark as processing
            doc.status = 'processing'
            doc.started_at = datetime.utcnow()
            db.session.commit()
            
            try:
                file_path = Path("queue_documents") / doc.filename
                
                if not file_path.exists():
                    raise Exception(f"File not found: {file_path}")
                
                logger.info(f"Processing {doc.filename} directly with OpenRouter...")
                
                # Extract text from document
                text_content = self.extract_text_from_file(file_path)
                
                if not text_content.strip():
                    raise Exception("No text content extracted from document")
                
                # Analyze with OpenRouter
                analysis_result = self.analyze_document_with_openrouter(text_content, doc.filename)
                
                # Save processed data
                processed_data = {
                    "filename": doc.filename,
                    "contract_notice_id": doc.contract_notice_id,
                    "text_content": text_content[:2000],  # First 2000 chars for reference
                    "analysis": analysis_result,
                    "processed_at": datetime.utcnow().isoformat(),
                    "processor": "direct_openrouter"
                }
                
                # Save to processed_queue_documents
                processed_dir = Path("processed_queue_documents")
                processed_dir.mkdir(exist_ok=True)
                
                processed_filename = f"{doc.contract_notice_id}_{Path(doc.filename).stem}.json"
                processed_path = processed_dir / processed_filename
                
                with open(processed_path, 'w') as f:
                    json.dump(processed_data, f, indent=2)
                
                # Update database
                doc.status = 'completed'
                doc.completed_at = datetime.utcnow()
                doc.processed_data = json.dumps(processed_data)
                doc.saved_file_path = str(processed_path)
                
                db.session.commit()
                
                logger.info(f"Successfully processed {doc.filename}")
                return True
                
            except Exception as e:
                logger.error(f"Error processing {doc.filename}: {e}")
                
                # Mark as failed
                doc.status = 'failed'
                doc.failed_at = datetime.utcnow()
                doc.error_message = str(e)
                doc.retry_count += 1
                
                db.session.commit()
                return False
    
    def process_all_queued_documents(self):
        """Process all queued documents sequentially"""
        
        if self.is_processing:
            logger.warning("Processing already in progress")
            return {"error": "Processing already in progress"}
        
        self.is_processing = True
        
        try:
            with app.app_context():
                # Get all queued documents
                queued_docs = DocumentProcessingQueue.query.filter_by(status='queued').all()
                
                if not queued_docs:
                    logger.info("No documents in queue")
                    return {"message": "No documents to process", "total_processed": 0}
                
                logger.info(f"Starting direct processing of {len(queued_docs)} documents")
                
                processed_count = 0
                
                for i, doc in enumerate(queued_docs, 1):
                    logger.info(f"Processing document {i}/{len(queued_docs)}: {doc.filename}")
                    
                    success = self.process_single_document(doc)
                    if success:
                        processed_count += 1
                    
                    # Add delay between documents to prevent API rate limiting
                    if i < len(queued_docs):  # Don't delay after the last document
                        time.sleep(3)  # 3 second delay
                
                logger.info(f"Completed processing {processed_count}/{len(queued_docs)} documents")
                
                return {
                    "message": f"Processing completed",
                    "total_processed": processed_count,
                    "total_queued": len(queued_docs),
                    "success_rate": f"{(processed_count/len(queued_docs)*100):.1f}%"
                }
                
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            return {"error": str(e)}
        finally:
            self.is_processing = False

# Global processor instance
direct_processor = DirectDocumentProcessor()

def start_direct_processing():
    """Start direct processing in a background thread"""
    
    def process_in_background():
        result = direct_processor.process_all_queued_documents()
        logger.info(f"Background processing completed: {result}")
    
    thread = threading.Thread(target=process_in_background)
    thread.daemon = True
    thread.start()
    
    return {"message": "Direct processing started in background"}