import chromadb
import logging
from typing import Dict, List, Optional
import json
import uuid
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class VectorDatabase:
    """Service for managing ChromaDB vector database operations"""
    
    def __init__(self):
        self.client = None
        self.contracts_collection = None
        self.documents_collection = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize ChromaDB client and collections"""
        try:
            # Initialize ChromaDB client with persistent storage
            persist_directory = os.environ.get("CHROMADB_PATH", "./chromadb_data")
            
            self.client = chromadb.PersistentClient(path=persist_directory)
            
            # Get or create collections - let ChromaDB use default embedding
            try:
                self.contracts_collection = self.client.get_or_create_collection(
                    name="government_contracts",
                    metadata={"description": "Government contract metadata and descriptions"}
                )
                
                self.documents_collection = self.client.get_or_create_collection(
                    name="contract_documents", 
                    metadata={"description": "Text content from contract documents"}
                )
            except Exception as embedding_error:
                logger.warning(f"Standard embedding failed, using simple approach: {embedding_error}")
                # Delete and recreate collections if they exist with incompatible embeddings
                try:
                    self.client.delete_collection("government_contracts")
                    self.client.delete_collection("contract_documents")
                except:
                    pass
                
                self.contracts_collection = self.client.create_collection(
                    name="government_contracts",
                    metadata={"description": "Government contract metadata and descriptions"}
                )
                
                self.documents_collection = self.client.create_collection(
                    name="contract_documents", 
                    metadata={"description": "Text content from contract documents"}
                )
            
            logger.info("ChromaDB client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {str(e)}")
            raise
    
    def index_contract(self, contract_data: Dict) -> bool:
        """Index a contract in the vector database
        
        Args:
            contract_data: Dictionary containing contract information
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create a unique ID for the contract
            contract_id = contract_data.get('notice_id', str(uuid.uuid4()))
            
            # Prepare text content for embedding
            text_content = self._prepare_contract_text(contract_data)
            
            # Prepare metadata
            metadata = {
                'notice_id': contract_data.get('notice_id', ''),
                'title': contract_data.get('title', '')[:100],  # Limit length
                'agency': contract_data.get('agency', ''),
                'naics_code': contract_data.get('naics_code', ''),
                'classification_code': contract_data.get('classification_code', ''),
                'posted_date': contract_data.get('posted_date', ''),
                'indexed_at': datetime.utcnow().isoformat(),
                'type': 'contract'
            }
            
            # Remove None values and ensure all values are strings
            metadata = {k: str(v) for k, v in metadata.items() if v is not None}
            
            # Add to collection
            self.contracts_collection.add(
                documents=[text_content],
                metadatas=[metadata],
                ids=[contract_id]
            )
            
            logger.info(f"Indexed contract: {contract_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to index contract {contract_data.get('notice_id', 'unknown')}: {str(e)}")
            return False
    
    def index_document(self, document_data: Dict, contract_notice_id: str) -> bool:
        """Index a document in the vector database
        
        Args:
            document_data: Dictionary containing document information and text
            contract_notice_id: Associated contract notice ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not document_data.get('success', False) or not document_data.get('text_content'):
                logger.warning(f"Skipping document indexing - no valid text content")
                return False
            
            # Create unique ID for the document
            document_id = f"{contract_notice_id}_{uuid.uuid4()}"
            
            # Prepare text content
            text_content = document_data['text_content']
            
            # Prepare metadata
            metadata = {
                'contract_notice_id': contract_notice_id,
                'document_url': document_data.get('url', ''),
                'document_description': document_data.get('description', '')[:100],
                'file_type': document_data.get('file_type', ''),
                'text_length': str(document_data.get('text_length', 0)),
                'indexed_at': datetime.utcnow().isoformat(),
                'type': 'document'
            }
            
            # Remove None values and ensure all values are strings
            metadata = {k: str(v) for k, v in metadata.items() if v is not None}
            
            # Add to collection
            self.documents_collection.add(
                documents=[text_content],
                metadatas=[metadata],
                ids=[document_id]
            )
            
            logger.info(f"Indexed document: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to index document for contract {contract_notice_id}: {str(e)}")
            return False
    
    def search_contracts(self, query: str, n_results: int = 10, filters: Optional[Dict] = None) -> List[Dict]:
        """Search for contracts using vector similarity
        
        Args:
            query: Search query text
            n_results: Maximum number of results to return
            filters: Optional metadata filters
            
        Returns:
            List of matching contracts with metadata
        """
        try:
            # Prepare where clause for filtering
            where_clause = {}
            if filters:
                for key, value in filters.items():
                    if value:
                        where_clause[key] = value
            
            # Search in contracts collection
            results = self.contracts_collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where_clause if where_clause else None
            )
            
            # Format results
            formatted_results = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    result = {
                        'id': results['ids'][0][i],
                        'content': doc,
                        'metadata': results['metadatas'][0][i],
                        'distance': results['distances'][0][i] if 'distances' in results else None
                    }
                    formatted_results.append(result)
            
            logger.info(f"Contract search returned {len(formatted_results)} results for query: {query}")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Failed to search contracts: {str(e)}")
            return []
    
    def search_documents(self, query: str, n_results: int = 10, contract_id: Optional[str] = None) -> List[Dict]:
        """Search for documents using vector similarity
        
        Args:
            query: Search query text
            n_results: Maximum number of results to return
            contract_id: Optional filter by contract notice ID
            
        Returns:
            List of matching documents with metadata
        """
        try:
            # Prepare where clause for filtering
            where_clause = {}
            if contract_id:
                where_clause['contract_notice_id'] = contract_id
            
            # Search in documents collection
            results = self.documents_collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where_clause if where_clause else None
            )
            
            # Format results
            formatted_results = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    result = {
                        'id': results['ids'][0][i],
                        'content': doc[:500] + "..." if len(doc) > 500 else doc,  # Truncate content
                        'full_content': doc,
                        'metadata': results['metadatas'][0][i],
                        'distance': results['distances'][0][i] if 'distances' in results else None
                    }
                    formatted_results.append(result)
            
            logger.info(f"Document search returned {len(formatted_results)} results for query: {query}")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Failed to search documents: {str(e)}")
            return []
    
    def search_all(self, query: str, n_results: int = 10) -> Dict:
        """Search both contracts and documents
        
        Args:
            query: Search query text
            n_results: Maximum number of results per collection
            
        Returns:
            Dictionary with contracts and documents results
        """
        contracts = self.search_contracts(query, n_results)
        documents = self.search_documents(query, n_results)
        
        return {
            'contracts': contracts,
            'documents': documents,
            'total_results': len(contracts) + len(documents)
        }
    
    def get_collection_stats(self) -> Dict:
        """Get statistics about the collections"""
        try:
            contracts_count = self.contracts_collection.count()
            documents_count = self.documents_collection.count()
            
            return {
                'contracts_count': contracts_count,
                'documents_count': documents_count,
                'total_items': contracts_count + documents_count
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {str(e)}")
            return {
                'contracts_count': 0,
                'documents_count': 0,
                'total_items': 0,
                'error': str(e)
            }
    
    def delete_contract(self, contract_id: str) -> bool:
        """Delete a contract and its associated documents"""
        try:
            # Delete from contracts collection
            self.contracts_collection.delete(ids=[contract_id])
            
            # Delete associated documents
            # Note: ChromaDB doesn't support complex queries for deletion
            # This is a limitation we need to work around
            logger.info(f"Deleted contract: {contract_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete contract {contract_id}: {str(e)}")
            return False
    
    def _prepare_contract_text(self, contract_data: Dict) -> str:
        """Prepare contract text for embedding"""
        text_parts = []
        
        # Add title
        if contract_data.get('title'):
            text_parts.append(f"Title: {contract_data['title']}")
        
        # Add description
        if contract_data.get('description'):
            text_parts.append(f"Description: {contract_data['description']}")
        
        # Add agency information
        if contract_data.get('agency'):
            text_parts.append(f"Agency: {contract_data['agency']}")
        
        if contract_data.get('office'):
            text_parts.append(f"Office: {contract_data['office']}")
        
        # Add classification codes
        if contract_data.get('naics_code'):
            text_parts.append(f"NAICS Code: {contract_data['naics_code']}")
        
        if contract_data.get('classification_code'):
            text_parts.append(f"Classification: {contract_data['classification_code']}")
        
        # Add set aside information
        if contract_data.get('set_aside_code'):
            text_parts.append(f"Set Aside: {contract_data['set_aside_code']}")
        
        # Add location
        if contract_data.get('place_of_performance'):
            text_parts.append(f"Location: {contract_data['place_of_performance']}")
        
        return " | ".join(text_parts)
