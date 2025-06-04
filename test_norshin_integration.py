#!/usr/bin/env python3
"""
Test script to verify Norshin.com API integration with government contract documents
"""

import requests
import json
import tempfile
import os

def test_single_document_processing():
    """Test processing a single document through Norshin.com API"""
    
    # Test with a specific contract document URL
    document_url = "https://sam.gov/api/prod/opps/v3/opportunities/resources/files/af4db6cbfab34e749d8ace7a82ccd2c0/download"
    norshin_api_url = "https://norshin.com/api/process-document"
    
    try:
        print(f"Downloading document from: {document_url}")
        
        # Download the document
        response = requests.get(document_url, timeout=30)
        if response.status_code != 200:
            print(f"Failed to download document: {response.status_code}")
            return False
        
        print(f"Downloaded {len(response.content)} bytes")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_file.write(response.content)
            temp_file_path = temp_file.name
        
        try:
            print(f"Sending to Norshin API: {norshin_api_url}")
            
            # Send to Norshin.com API
            with open(temp_file_path, 'rb') as file:
                files = {'document': file}
                norshin_response = requests.post(
                    norshin_api_url,
                    files=files,
                    timeout=60
                )
            
            print(f"Norshin API response: {norshin_response.status_code}")
            
            if norshin_response.status_code == 200:
                result = norshin_response.json()
                print("Successfully processed document via Norshin API")
                print(f"Response keys: {list(result.keys())}")
                return True
            else:
                print(f"Norshin API error: {norshin_response.text}")
                return False
                
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_single_document_processing()
    print(f"Test result: {'SUCCESS' if success else 'FAILED'}")