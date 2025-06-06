#!/usr/bin/env python3
"""
Script to download all documents from JSON metadata files in queue_documents folder
and then remove the JSON files after successful downloads.
"""

import os
import json
import requests
import hashlib
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def determine_file_extension(content: bytes, content_type: str, content_disposition: str, url: str) -> str:
    """Determine correct file extension based on content analysis and headers"""
    try:
        # Check content-disposition header for filename (most reliable)
        if 'filename=' in content_disposition:
            filename = content_disposition.split('filename=')[1].strip('"\'')
            extension = Path(filename).suffix
            if extension:
                return extension.lower()
        
        # Check magic numbers/file signatures
        if content.startswith(b'%PDF'):
            return '.pdf'
        elif content.startswith(b'PK\x03\x04'):
            # Check if it's an Office document by looking deeper into content
            if b'word/' in content[:2000]:
                return '.docx'
            elif b'xl/' in content[:2000]:
                return '.xlsx'
            elif b'ppt/' in content[:2000]:
                return '.pptx'
            else:
                return '.zip'
        elif content.startswith(b'\xd0\xcf\x11\xe0'):
            # Microsoft Office legacy format
            if 'word' in content_type:
                return '.doc'
            elif 'excel' in content_type or 'sheet' in content_type:
                return '.xls'
            else:
                return '.doc'
        
        # Check content-type header
        if 'pdf' in content_type:
            return '.pdf'
        elif 'word' in content_type or 'officedocument.wordprocessingml' in content_type:
            return '.docx'
        elif 'excel' in content_type or 'officedocument.spreadsheetml' in content_type:
            return '.xlsx'
        elif 'powerpoint' in content_type or 'officedocument.presentationml' in content_type:
            return '.pptx'
        elif 'text/plain' in content_type:
            return '.txt'
        
        # Fallback to URL-based extension
        clean_url = url.split('?')[0]
        extension = Path(clean_url).suffix
        if extension:
            return extension.lower()
        
        # Default fallback
        return '.pdf'
        
    except Exception as e:
        logger.warning(f"Error determining file extension: {e}")
        return '.pdf'

def download_document_from_json(json_file_path: Path):
    """Download document from JSON metadata file"""
    try:
        with open(json_file_path, 'r') as f:
            metadata = json.load(f)
        
        document_url = metadata['document_url']
        logger.info(f"Downloading from JSON: {json_file_path.name}")
        
        # Extract contract ID from existing filename pattern
        base_filename = json_file_path.stem
        if '_' in base_filename:
            contract_id = base_filename.split('_')[0]
            url_hash = base_filename.split('_')[1]
        else:
            # Fallback: generate new hash
            contract_id = 'unknown'
            url_hash = hashlib.md5(document_url.encode()).hexdigest()[:8]
        
        # Download the document
        response = requests.get(document_url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Get content and headers
        content = b''
        for chunk in response.iter_content(chunk_size=8192):
            content += chunk
        
        content_type = response.headers.get('content-type', '').lower()
        content_disposition = response.headers.get('content-disposition', '')
        
        # Determine correct file extension
        file_extension = determine_file_extension(content, content_type, content_disposition, document_url)
        filename = f"{contract_id}_{url_hash}{file_extension}"
        file_path = json_file_path.parent / filename
        
        # Save the document
        with open(file_path, 'wb') as f:
            f.write(content)
        
        file_size = file_path.stat().st_size
        logger.info(f"Downloaded: {filename} ({file_size} bytes)")
        
        # Remove the JSON file after successful download
        json_file_path.unlink()
        logger.info(f"Removed JSON file: {json_file_path.name}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error downloading from {json_file_path.name}: {e}")
        return False

def main():
    """Main function to process all JSON files in queue_documents"""
    queue_dir = Path("queue_documents")
    
    if not queue_dir.exists():
        logger.error("queue_documents directory not found")
        return
    
    # Find all JSON files
    json_files = list(queue_dir.glob("*.json"))
    
    if not json_files:
        logger.info("No JSON files found in queue_documents")
        return
    
    logger.info(f"Found {len(json_files)} JSON files to process")
    
    success_count = 0
    for json_file in json_files:
        if download_document_from_json(json_file):
            success_count += 1
    
    logger.info(f"Successfully processed {success_count}/{len(json_files)} JSON files")

if __name__ == "__main__":
    main()