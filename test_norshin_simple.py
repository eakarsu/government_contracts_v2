#!/usr/bin/env python3
"""
Simple test to verify Norshin API integration
"""
import os
import requests
from pathlib import Path

def test_norshin_api():
    """Test Norshin API with a sample document"""
    
    # Get API credentials
    api_key = os.environ.get('NORSHIN_API_KEY')
    api_url = os.environ.get('NORSHIN_API_URL')
    
    if not api_key or not api_url:
        print("ERROR: Missing Norshin API credentials")
        return False
    
    print(f"Testing Norshin API at: {api_url}")
    print(f"API Key: {api_key[:10]}...")
    
    # Find a document to test
    queue_dir = Path("queue_documents")
    if not queue_dir.exists():
        print("ERROR: queue_documents directory not found")
        return False
    
    # Get first document
    doc_files = [f for f in queue_dir.iterdir() if f.is_file() and not f.name.endswith('.json')]
    if not doc_files:
        print("ERROR: No documents found in queue_documents")
        return False
    
    test_file = doc_files[0]
    print(f"Testing with file: {test_file.name}")
    
    try:
        # Read file
        with open(test_file, 'rb') as f:
            file_content = f.read()
        
        print(f"File size: {len(file_content)} bytes")
        
        # Prepare request - try different parameter name
        files = {
            'document': (test_file.name, file_content, 'application/octet-stream')
        }
        
        headers = {
            'Authorization': f'Bearer {api_key}'
        }
        
        print("Sending request to Norshin API...")
        
        # Make request
        response = requests.post(
            api_url,
            files=files,
            headers=headers,
            timeout=60
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("SUCCESS: Norshin API responded successfully")
            result = response.json()
            print(f"Response keys: {list(result.keys())}")
            return True
        else:
            print(f"ERROR: Norshin API error {response.status_code}")
            print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"ERROR: Exception occurred: {e}")
        return False

if __name__ == "__main__":
    test_norshin_api()