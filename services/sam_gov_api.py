import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import os
import time
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

class SAMGovAPI:
    """Service for interacting with SAM.gov API"""
    
    def __init__(self):
        self.api_key = os.environ.get("SAM_GOV_API_KEY")
        self.base_url = "https://api.sam.gov/opportunities/v2/search"
        self.rate_limiter = RateLimiter(calls_per_second=10)  # SAM.gov rate limit
        
        if not self.api_key:
            logger.warning("SAM_GOV_API_KEY not found in environment variables")
    
    def _make_request(self, params: Dict) -> Optional[Dict]:
        """Make authenticated request to SAM.gov API with rate limiting"""
        if not self.api_key:
            logger.error("No API key available for SAM.gov")
            return None
            
        # Apply rate limiting
        self.rate_limiter.wait_if_needed()
        
        headers = {
            'X-Api-Key': self.api_key,
            'Accept': 'application/json',
            'User-Agent': 'ContractIndexer/1.0'
        }
        
        try:
            response = requests.get(self.base_url, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Log successful request
            logger.info(f"SAM.gov API request successful: {response.status_code}")
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"SAM.gov API request failed: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response text: {e.response.text}")
            return None
    
    def fetch_contracts(self, 
                       start_date: Optional[datetime] = None, 
                       end_date: Optional[datetime] = None,
                       limit: int = 100,
                       offset: int = 0) -> Optional[Dict]:
        """Fetch government contracts from SAM.gov API
        
        Args:
            start_date: Start date for contract search (defaults to 30 days ago)
            end_date: End date for contract search (defaults to today)
            limit: Maximum number of contracts to fetch per request
            offset: Offset for pagination
            
        Returns:
            Dictionary containing contract data and pagination info
        """
        
        # Set default date range if not provided
        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Format dates for API
        start_date_str = start_date.strftime("%m/%d/%Y")
        end_date_str = end_date.strftime("%m/%d/%Y")
        
        params = {
            'api_key': self.api_key,
            'postedFrom': start_date_str,
            'postedTo': end_date_str,
            'limit': min(limit, 1000),  # SAM.gov max limit is 1000
            'offset': offset,
            'format': 'json'
        }
        
        logger.info(f"Fetching contracts from {start_date_str} to {end_date_str}, limit: {limit}, offset: {offset}")
        
        data = self._make_request(params)
        if data:
            logger.info(f"Successfully fetched {len(data.get('opportunitiesData', []))} contracts")
        
        return data
    
    def fetch_contract_by_id(self, notice_id: str) -> Optional[Dict]:
        """Fetch a specific contract by its notice ID"""
        params = {
            'api_key': self.api_key,
            'noticeId': notice_id,
            'format': 'json'
        }
        
        logger.info(f"Fetching contract with notice ID: {notice_id}")
        return self._make_request(params)
    
    def search_contracts(self, 
                        keyword: str,
                        naics: Optional[str] = None,
                        state: Optional[str] = None,
                        limit: int = 100) -> Optional[Dict]:
        """Search contracts by keyword and filters"""
        params = {
            'api_key': self.api_key,
            'keyword': keyword,
            'limit': min(limit, 1000),
            'format': 'json'
        }
        
        if naics:
            params['naics'] = naics
        if state:
            params['state'] = state
        
        logger.info(f"Searching contracts with keyword: {keyword}")
        return self._make_request(params)
    
    def get_contract_details(self, opportunity_data: Dict) -> Dict:
        """Extract and normalize contract details from SAM.gov response"""
        try:
            # Extract core fields with safe access
            details = {
                'notice_id': opportunity_data.get('noticeId', ''),
                'title': opportunity_data.get('title', ''),
                'description': opportunity_data.get('description', ''),
                'agency': opportunity_data.get('department', ''),
                'office': opportunity_data.get('subAgency', ''),
                'naics_code': opportunity_data.get('naicsCode', ''),
                'classification_code': opportunity_data.get('classificationCode', ''),
                'set_aside_code': opportunity_data.get('typeOfSetAsideDescription', ''),
                'place_of_performance': opportunity_data.get('placeOfPerformance', {}).get('city', {}).get('name', ''),
                'award_amount': opportunity_data.get('awardAmount', ''),
                'resource_links': opportunity_data.get('resourceLinks', [])
            }
            
            # Parse dates safely
            posted_date_str = opportunity_data.get('postedDate')
            if posted_date_str:
                try:
                    details['posted_date'] = datetime.strptime(posted_date_str, "%m-%d-%Y")
                except ValueError:
                    logger.warning(f"Could not parse posted date: {posted_date_str}")
                    details['posted_date'] = None
            else:
                details['posted_date'] = None
            
            response_date_str = opportunity_data.get('responseDeadLine')
            if response_date_str:
                try:
                    details['response_date'] = datetime.strptime(response_date_str, "%m-%d-%Y %H:%M:%S %Z")
                except ValueError:
                    try:
                        details['response_date'] = datetime.strptime(response_date_str, "%m-%d-%Y")
                    except ValueError:
                        logger.warning(f"Could not parse response date: {response_date_str}")
                        details['response_date'] = None
            else:
                details['response_date'] = None
            
            award_date_str = opportunity_data.get('awardDate')
            if award_date_str:
                try:
                    details['award_date'] = datetime.strptime(award_date_str, "%m-%d-%Y")
                except ValueError:
                    logger.warning(f"Could not parse award date: {award_date_str}")
                    details['award_date'] = None
            else:
                details['award_date'] = None
            
            return details
            
        except Exception as e:
            logger.error(f"Error extracting contract details: {str(e)}")
            return {}
    
    def get_available_document_links(self, resource_links: List[Dict]) -> List[Dict]:
        """Extract downloadable document links from resource links"""
        document_links = []
        
        for link in resource_links:
            if isinstance(link, dict):
                url = link.get('url', '')
                description = link.get('description', '')
                
                # Filter for document types we can process
                if any(ext in url.lower() for ext in ['.pdf', '.doc', '.docx', '.txt']):
                    document_links.append({
                        'url': url,
                        'description': description,
                        'type': self._get_document_type(url)
                    })
        
        return document_links
    
    def _get_document_type(self, url: str) -> str:
        """Determine document type from URL"""
        url_lower = url.lower()
        if '.pdf' in url_lower:
            return 'pdf'
        elif '.doc' in url_lower:
            return 'doc'
        elif '.txt' in url_lower:
            return 'txt'
        else:
            return 'unknown'
