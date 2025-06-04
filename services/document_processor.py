import requests
import logging
from typing import Dict, List, Optional
import os
import tempfile
from urllib.parse import urlparse
import mimetypes
import io
import PyPDF2
import docx
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Service for downloading and extracting text from contract documents"""
    
    def __init__(self):
        self.rate_limiter = RateLimiter(calls_per_second=5)  # Conservative rate limiting for downloads
        self.max_file_size = 10 * 1024 * 1024  # 10MB limit
        self.supported_types = {'.pdf', '.doc', '.docx', '.txt'}
    
    def download_and_extract_text(self, url: str, description: str = "") -> Optional[Dict]:
        """Download document from URL and extract text content
        
        Args:
            url: Document URL to download
            description: Description of the document
            
        Returns:
            Dictionary with extracted text and metadata, or None if failed
        """
        
        # Apply rate limiting
        self.rate_limiter.wait_if_needed()
        
        try:
            # Validate URL
            parsed_url = urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                logger.error(f"Invalid URL: {url}")
                return None
            
            # Check file extension
            file_extension = self._get_file_extension(url)
            if file_extension not in self.supported_types:
                logger.warning(f"Unsupported file type: {file_extension} for URL: {url}")
                return None
            
            # Download file
            content = self._download_file(url)
            if not content:
                return None
            
            # Extract text based on file type
            text_content = self._extract_text_by_type(content, file_extension)
            if not text_content:
                logger.warning(f"No text extracted from document: {url}")
                return None
            
            return {
                'url': url,
                'description': description,
                'file_type': file_extension,
                'text_content': text_content,
                'text_length': len(text_content),
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Error processing document {url}: {str(e)}")
            return {
                'url': url,
                'description': description,
                'error': str(e),
                'success': False
            }
    
    def _download_file(self, url: str) -> Optional[bytes]:
        """Download file from URL with size and timeout limits"""
        try:
            headers = {
                'User-Agent': 'ContractIndexer/1.0',
                'Accept': '*/*'
            }
            
            # Stream download to check size
            response = requests.get(url, headers=headers, stream=True, timeout=30)
            response.raise_for_status()
            
            # Check content length
            content_length = response.headers.get('content-length')
            if content_length and int(content_length) > self.max_file_size:
                logger.error(f"File too large: {content_length} bytes, max: {self.max_file_size}")
                return None
            
            # Download content with size checking
            content = b''
            for chunk in response.iter_content(chunk_size=8192):
                content += chunk
                if len(content) > self.max_file_size:
                    logger.error(f"File download exceeded size limit: {len(content)} bytes")
                    return None
            
            logger.info(f"Successfully downloaded {len(content)} bytes from {url}")
            return content
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to download file {url}: {str(e)}")
            return None
    
    def _get_file_extension(self, url: str) -> str:
        """Extract file extension from URL"""
        parsed_url = urlparse(url)
        path = parsed_url.path.lower()
        
        # Check for common extensions
        for ext in self.supported_types:
            if path.endswith(ext):
                return ext
        
        # Fallback to mimetype detection if possible
        mime_type, _ = mimetypes.guess_type(url)
        if mime_type:
            if 'pdf' in mime_type:
                return '.pdf'
            elif 'word' in mime_type:
                return '.docx'
            elif 'text' in mime_type:
                return '.txt'
        
        return '.unknown'
    
    def _extract_text_by_type(self, content: bytes, file_extension: str) -> Optional[str]:
        """Extract text content based on file type"""
        try:
            if file_extension == '.pdf':
                return self._extract_pdf_text(content)
            elif file_extension in ['.doc', '.docx']:
                return self._extract_word_text(content)
            elif file_extension == '.txt':
                return self._extract_text_file(content)
            else:
                logger.error(f"Unsupported file type for text extraction: {file_extension}")
                return None
                
        except Exception as e:
            logger.error(f"Error extracting text from {file_extension}: {str(e)}")
            return None
    
    def _extract_pdf_text(self, content: bytes) -> Optional[str]:
        """Extract text from PDF content"""
        try:
            pdf_file = io.BytesIO(content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_content = []
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text_content.append(page.extract_text())
            
            full_text = '\n'.join(text_content).strip()
            return full_text if full_text else None
            
        except Exception as e:
            logger.error(f"Error extracting PDF text: {str(e)}")
            return None
    
    def _extract_word_text(self, content: bytes) -> Optional[str]:
        """Extract text from Word document content"""
        try:
            doc_file = io.BytesIO(content)
            doc = docx.Document(doc_file)
            
            text_content = []
            for paragraph in doc.paragraphs:
                text_content.append(paragraph.text)
            
            full_text = '\n'.join(text_content).strip()
            return full_text if full_text else None
            
        except Exception as e:
            logger.error(f"Error extracting Word text: {str(e)}")
            return None
    
    def _extract_text_file(self, content: bytes) -> Optional[str]:
        """Extract text from plain text file"""
        try:
            # Try different encodings
            encodings = ['utf-8', 'latin-1', 'cp1252']
            
            for encoding in encodings:
                try:
                    text = content.decode(encoding).strip()
                    return text if text else None
                except UnicodeDecodeError:
                    continue
            
            logger.error("Could not decode text file with any supported encoding")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting text file content: {str(e)}")
            return None
    
    def process_contract_documents(self, resource_links: List[Dict]) -> List[Dict]:
        """Process all documents for a contract
        
        Args:
            resource_links: List of document links from contract
            
        Returns:
            List of processed document results
        """
        results = []
        
        for link in resource_links:
            if isinstance(link, dict):
                url = link.get('url', '')
                description = link.get('description', '')
                
                if url:
                    result = self.download_and_extract_text(url, description)
                    if result:
                        results.append(result)
        
        logger.info(f"Processed {len(results)} documents from {len(resource_links)} links")
        return results
    
    def get_text_summary(self, text: str, max_length: int = 500) -> str:
        """Create a summary of text content for indexing"""
        if not text:
            return ""
        
        # Clean and truncate text
        cleaned_text = ' '.join(text.split())  # Normalize whitespace
        
        if len(cleaned_text) <= max_length:
            return cleaned_text
        
        # Truncate at word boundary
        truncated = cleaned_text[:max_length]
        last_space = truncated.rfind(' ')
        if last_space > max_length * 0.8:  # Only truncate at word if close to end
            truncated = truncated[:last_space]
        
        return truncated + "..."
