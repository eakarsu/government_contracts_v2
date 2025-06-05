import json
import os
import logging
from typing import Dict, List, Optional
from openai import OpenAI

logger = logging.getLogger(__name__)

class AIAnalyzer:
    """Service for AI-powered contract analysis using OpenRouter"""
    
    def __init__(self):
        # Using OpenRouter API for better model access
        openrouter_key = os.environ.get("OPENROUTER_API_KEY")
        if openrouter_key:
            self.client = OpenAI(
                api_key=openrouter_key,
                base_url="https://openrouter.ai/api/v1"
            )
            self.model = "anthropic/claude-3.5-sonnet"
            logger.info("Using OpenRouter API for AI analysis")
        else:
            # Fallback to OpenAI if OpenRouter key not available
            openai_key = os.environ.get("OPENAI_API_KEY")
            if openai_key:
                self.client = OpenAI(api_key=openai_key)
                self.model = "gpt-4o"
                logger.info("Using OpenAI API for AI analysis")
            else:
                self.client = None
                self.model = None
                logger.warning("No AI API key found (OPENROUTER_API_KEY or OPENAI_API_KEY)")
    
    def analyze_search_results(self, query: str, search_results: Dict) -> Dict:
        """Analyze search results and provide AI-powered recommendations
        
        Args:
            query: Original search query
            search_results: Dictionary containing contracts and documents results
            
        Returns:
            Dictionary with analysis and recommendations
        """
        try:
            # Check if AI client is available
            if not self.client or not self.model:
                return {
                    'error': 'AI analysis unavailable - no API key configured',
                    'success': False,
                    'message': 'Please configure OPENROUTER_API_KEY or OPENAI_API_KEY environment variable'
                }
            
            # Prepare context from search results
            context = self._prepare_search_context(search_results)
            
            # Create analysis prompt
            prompt = self._create_analysis_prompt(query, context)
            
            # Get AI analysis
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a government contracting expert. Analyze search results and provide actionable insights and recommendations for businesses interested in government contracts. Always respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3  # Lower temperature for more consistent analysis
            )
            
            # Parse the response
            content = response.choices[0].message.content or "{}"
            analysis = json.loads(content)
            
            # Add metadata
            analysis['query'] = query
            analysis['total_contracts'] = len(search_results.get('contracts', []))
            analysis['total_documents'] = len(search_results.get('documents', []))
            analysis['model_used'] = self.model
            
            logger.info(f"AI analysis completed for query: {query}")
            return analysis
            
        except Exception as e:
            logger.error(f"Failed to analyze search results: {str(e)}")
            return {
                'error': f'Analysis failed: {str(e)}',
                'query': query,
                'recommendations': [],
                'summary': 'Unable to provide analysis due to technical error.'
            }
    
    def analyze_contract(self, contract_data: Dict) -> Dict:
        """Analyze a single contract for opportunities and insights
        
        Args:
            contract_data: Contract information dictionary
            
        Returns:
            Dictionary with contract analysis
        """
        try:
            # Check if AI client is available
            if not self.client or not self.model:
                return {
                    'error': 'AI analysis unavailable - no API key configured',
                    'success': False,
                    'message': 'Please configure OPENROUTER_API_KEY or OPENAI_API_KEY environment variable'
                }
            
            prompt = self._create_contract_analysis_prompt(contract_data)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a government contracting expert. Analyze this contract opportunity and provide insights for potential bidders. Respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            content = response.choices[0].message.content or "{}"
            analysis = json.loads(content)
            analysis['contract_id'] = contract_data.get('notice_id')
            analysis['model_used'] = self.model
            
            logger.info(f"Contract analysis completed for: {contract_data.get('notice_id')}")
            return analysis
            
        except Exception as e:
            logger.error(f"Failed to analyze contract: {str(e)}")
            return {
                'error': f'Contract analysis failed: {str(e)}',
                'contract_id': contract_data.get('notice_id'),
                'recommendations': [],
                'summary': 'Unable to provide analysis due to technical error.'
            }
    
    def generate_bid_recommendations(self, contracts: List[Dict]) -> Dict:
        """Generate bidding recommendations based on multiple contracts
        
        Args:
            contracts: List of contract dictionaries
            
        Returns:
            Dictionary with bidding strategy recommendations
        """
        try:
            # Check if AI client is available
            if not self.client or not self.model:
                return {
                    'error': 'AI analysis unavailable - no API key configured',
                    'success': False,
                    'message': 'Please configure OPENROUTER_API_KEY or OPENAI_API_KEY environment variable'
                }
            
            prompt = self._create_bid_recommendations_prompt(contracts)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a government contracting strategist. Analyze these contracts and provide strategic bidding recommendations. Respond with valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.4
            )
            
            recommendations = json.loads(response.choices[0].message.content or "{}")
            recommendations['contracts_analyzed'] = len(contracts)
            recommendations['model_used'] = self.model
            
            logger.info(f"Bid recommendations generated for {len(contracts)} contracts")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate bid recommendations: {str(e)}")
            return {
                'error': f'Recommendation generation failed: {str(e)}',
                'contracts_analyzed': len(contracts),
                'recommendations': [],
                'summary': 'Unable to provide recommendations due to technical error.'
            }
    
    def _prepare_search_context(self, search_results: Dict) -> str:
        """Prepare context string from search results"""
        context_parts = []
        
        # Add contract summaries
        contracts = search_results.get('contracts', [])[:5]  # Limit to top 5
        if contracts:
            context_parts.append("TOP MATCHING CONTRACTS:")
            for i, contract in enumerate(contracts, 1):
                metadata = contract.get('metadata', {})
                context_parts.append(f"{i}. {metadata.get('title', 'Untitled')} - {metadata.get('agency', 'Unknown Agency')}")
                context_parts.append(f"   NAICS: {metadata.get('naics_code', 'N/A')} | Posted: {metadata.get('posted_date', 'N/A')}")
        
        # Add document summaries
        documents = search_results.get('documents', [])[:3]  # Limit to top 3
        if documents:
            context_parts.append("\nRELEVANT DOCUMENT EXCERPTS:")
            for i, doc in enumerate(documents, 1):
                metadata = doc.get('metadata', {})
                content = doc.get('content', '')[:200]  # First 200 chars
                context_parts.append(f"{i}. Document from contract {metadata.get('contract_notice_id', 'Unknown')}")
                context_parts.append(f"   Content preview: {content}...")
        
        return "\n".join(context_parts)
    
    def _create_analysis_prompt(self, query: str, context: str) -> str:
        """Create prompt for search results analysis"""
        return f"""
Analyze the following government contracting search results for the query: "{query}"

SEARCH RESULTS CONTEXT:
{context}

Please provide a comprehensive analysis in JSON format with the following structure:
{{
    "summary": "Brief overview of the search results and their relevance",
    "key_opportunities": ["List of 3-5 key opportunities identified"],
    "market_insights": ["List of 3-5 market insights from the results"],
    "recommendations": [
        {{
            "title": "Recommendation title",
            "description": "Detailed recommendation",
            "priority": "high|medium|low",
            "action_items": ["List of specific action items"]
        }}
    ],
    "agencies_to_watch": ["List of agencies with multiple opportunities"],
    "naics_codes_trending": ["List of trending NAICS codes"],
    "next_steps": "Suggested next steps for businesses interested in these opportunities"
}}

Focus on actionable insights that would help businesses identify and pursue relevant government contracting opportunities.
"""
    
    def _create_contract_analysis_prompt(self, contract_data: Dict) -> str:
        """Create prompt for individual contract analysis"""
        return f"""
Analyze this government contract opportunity:

TITLE: {contract_data.get('title', 'N/A')}
AGENCY: {contract_data.get('agency', 'N/A')}
NAICS CODE: {contract_data.get('naics_code', 'N/A')}
DESCRIPTION: {contract_data.get('description', 'N/A')[:500]}
SET ASIDE: {contract_data.get('set_aside_code', 'N/A')}
LOCATION: {contract_data.get('place_of_performance', 'N/A')}
RESPONSE DEADLINE: {contract_data.get('response_date', 'N/A')}

Provide analysis in JSON format:
{{
    "opportunity_assessment": "Assessment of the opportunity (high/medium/low potential)",
    "key_requirements": ["List of key requirements or qualifications needed"],
    "competition_level": "Expected competition level (high/medium/low)",
    "bid_complexity": "Complexity of bidding process (high/medium/low)",
    "recommendations": [
        {{
            "category": "preparation|qualification|strategy|timeline",
            "action": "Specific recommended action",
            "importance": "high|medium|low"
        }}
    ],
    "red_flags": ["Any concerning aspects or challenges"],
    "success_factors": ["Key factors for winning this contract"],
    "estimated_effort": "Rough estimate of effort required to bid"
}}
"""
    
    def _create_bid_recommendations_prompt(self, contracts: List[Dict]) -> str:
        """Create prompt for bidding strategy recommendations"""
        contract_summaries = []
        for contract in contracts[:10]:  # Limit to 10 contracts
            summary = f"- {contract.get('title', 'Untitled')} ({contract.get('agency', 'Unknown Agency')}) - NAICS: {contract.get('naics_code', 'N/A')}"
            contract_summaries.append(summary)
        
        contracts_text = "\n".join(contract_summaries)
        
        return f"""
Based on these government contract opportunities, provide strategic bidding recommendations:

CONTRACTS TO ANALYZE:
{contracts_text}

Provide strategic recommendations in JSON format:
{{
    "overall_strategy": "High-level strategic approach for these opportunities",
    "priority_contracts": [
        {{
            "title": "Contract title",
            "reason": "Why this should be prioritized",
            "timeline": "Recommended timeline for action"
        }}
    ],
    "capability_gaps": ["Areas where additional capabilities may be needed"],
    "partnership_opportunities": ["Potential teaming or partnership opportunities"],
    "market_positioning": "How to position for these types of contracts",
    "resource_allocation": "Recommendations for resource allocation",
    "risk_assessment": "Key risks and mitigation strategies",
    "success_metrics": ["How to measure success in pursuing these opportunities"]
}}
"""
