#!/usr/bin/env python3
"""
Test single document processing with corrected Norshin API format
"""
import os
import requests
from pathlib import Path
import json

def test_single_document():
    """Test processing one document with corrected API format"""
    
    api_key = os.environ.get('NORSHIN_API_KEY')
    api_url = os.environ.get('NORSHIN_API_URL')
    
    if not api_key or not api_url:
        print("Missing API credentials")
        return False
    
    # Find a document to test
    queue_dir = Path("queue_documents")
    doc_files = [f for f in queue_dir.iterdir() if f.is_file() and not f.name.endswith('.json')]
    
    if not doc_files:
        print("No documents found")
        return False
    
    test_file = doc_files[0]
    print(f"Testing: {test_file.name}")
    
    try:
        with open(test_file, 'rb') as f:
            files = {'document': (test_file.name, f, 'application/octet-stream')}
            
            headers = {
                'Authorization': f'Bearer {api_key}'
            }
            
            print("Sending to Norshin API...")
            response = requests.post(
                api_url,
                files=files,
                headers=headers,
                timeout=120  # 2 minute timeout
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print("SUCCESS! Response:")
                print(json.dumps(result, indent=2))
                return True
            else:
                print(f"Error: {response.text}")
                return False
                
    except requests.exceptions.Timeout:
        print("Request timed out - this may indicate processing is working but slow")
        return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

if __name__ == "__main__":
    test_single_document()