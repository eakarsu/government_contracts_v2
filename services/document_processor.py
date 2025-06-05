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
    """Service for downloading and processing contract documents via Norshin.com API"""
    
    def __init__(self):
        self.rate_limiter = RateLimiter(calls_per_second=5)  # Conservative rate limiting for downloads
        self.max_file_size = 10 * 1024 * 1024  # 10MB limit
        self.supported_types = {'.pdf', '.doc', '.docx', '.txt'}
        self.norshin_api_url = "https://norshin.com/api/process-document"
    
    def process_document_via_norshin_api(self, url: str, contract_notice_id: str, description: str = "") -> Optional[Dict]:
        """Download document and process it via Norshin.com API
        
        Args:
            url: Document URL to download and process
            contract_notice_id: Associated contract notice ID
            description: Description of the document
            
        Returns:
            Dictionary with processed document data from Norshin API, or None if failed
        """
        
        # Apply rate limiting
        self.rate_limiter.wait_if_needed()
        
        try:
            # Download the document first
            logger.info(f"Downloading document from: {url}")
            download_result = self._download_file(url)
            if not download_result:
                return None
            
            content, original_filename = download_result
            
            # Determine file extension from original filename or URL
            if original_filename:
                file_extension = '.' + original_filename.split('.')[-1].lower() if '.' in original_filename else '.unknown'
                filename_to_use = original_filename
            else:
                file_extension = self._get_file_extension(url)
                filename_to_use = f"document{file_extension}"
            
            # Create temporary file for the document
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                temp_file.write(content)
                temp_file_path = temp_file.name
            
            # Save a copy for examination with meaningful name
            import os
            saved_filename = f"test_documents/{filename_to_use}"
            os.makedirs("test_documents", exist_ok=True)
            with open(saved_filename, 'wb') as saved_file:
                saved_file.write(content)
            logger.info(f"Saved test document: {saved_filename}")
            
            try:
                # Send document to Norshin.com API
                logger.info(f"Processing document via Norshin API: {url}")
                logger.info(f"Document size: {len(content)} bytes, extension: {file_extension} file: {temp_file_path}")
                
                with open(temp_file_path, 'rb') as file:
                    logger.info(f"Sending file to Norshin API with filename: {filename_to_use}")
                    
                    # Use correct field name for Norshin API
                    files = {'document': (filename_to_use, file, 'application/octet-stream')}
                    
                    logger.info(f"Sending file to Norshin API: {filename_to_use}")
                    
                    response = requests.post(
                        self.norshin_api_url,
                        files=files,
                        timeout=60
                    )
                
                logger.info(f"Norshin API response status: {response.status_code}")
                logger.info(f"Norshin API response headers: {dict(response.headers)}")
                logger.info(f"Norshin API response text: {response.text[:500]}")
                
                if response.status_code == 200:
                    # Parse the JSON response from Norshin API
                    processed_data = response.json()
                    
                    # Add metadata about the source
                    result = {
                        'source_url': url,
                        'contract_notice_id': contract_notice_id,
                        'description': description,
                        'file_extension': file_extension,
                        'processed_data': processed_data,
                        'processing_service': 'norshin_api'
                    }
                    
                    logger.info(f"Successfully processed document: {url}")
                    return result
                else:
                    logger.error(f"Norshin API error {response.status_code}: {response.text}")
                    return None
                    
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"Error processing document {url}: {str(e)}")
            return None

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
            
            # Download file first to get actual file type
            download_result = self._download_file(url)
            if not download_result:
                return None
            
            content, original_filename_from_download = download_result
            
            # Determine actual file extension from downloaded content
            if original_filename_from_download and '.' in original_filename_from_download:
                file_extension = '.' + original_filename_from_download.split('.')[-1].lower()
            else:
                file_extension = self._get_file_extension(url)
            
            # Check if file type is supported
            if file_extension not in self.supported_types:
                logger.warning(f"Unsupported file type: {file_extension} for file: {original_filename_from_download}")
                return None
            
            # Extract text based on actual file type
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
    
    def _download_file(self, url: str) -> Optional[tuple]:
        """Download file from URL with size and timeout limits"""
        try:
            headers = {
                'User-Agent': 'ContractIndexer/1.0',
                'Accept': '*/*'
            }
            
            # Stream download to check size
            response = requests.get(url, headers=headers, stream=True, timeout=30)
            response.raise_for_status()
            
            # Extract filename from Content-Disposition header
            filename = None
            content_disposition = response.headers.get('content-disposition', '')
            if 'filename=' in content_disposition:
                import re
                filename_match = re.search(r'filename[*]?=(?:["\']?)([^"\';\r\n]+)', content_disposition)
                if filename_match:
                    filename = filename_match.group(1).strip('"\'')
            
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
            logger.info(f"Content-Disposition filename: {filename}")
            return content, filename
            
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
    
    def process_contract_documents_via_norshin(self, resource_links: List[str], contract_notice_id: str) -> List[Dict]:
        """Process all documents for a contract via Norshin.com API"""
        results = []
        
        # Enhanced filtering
        for url in resource_links:
            # Filter out null/None/empty values
            if not url or not isinstance(url, str) or not url.strip():
                continue
                
            url = url.strip()
            
            # Filter out obviously invalid URLs
            if (url.startswith('#') or 
                url.startswith('javascript:') or 
                url.startswith('mailto:') or
                'example.com' in url.lower() or
                url.lower() in ['null', 'undefined', 'none']):
                logger.debug(f"Skipping invalid URL: {url}")
                continue
                
            # Basic URL format check
            if not (url.startswith('http://') or url.startswith('https://')):
                logger.debug(f"Skipping non-HTTP URL: {url}")
                continue
            
            logger.info(f"Processing document {url} for contract {contract_notice_id}")
            result = self.process_document_via_norshin_api(url, contract_notice_id)
            if result:
                results.append(result)
            else:
                logger.warning(f"Failed to process document: {url}")
        
        logger.info(f"Processed {len(results)} documents via Norshin API from {len(resource_links)} links")
        return results
