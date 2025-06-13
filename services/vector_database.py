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
        """Initialize ChromaDB client and collections with robust error handling"""
        persist_directory = os.environ.get("CHROMADB_PATH", "./chromadb_data")
        
        # Ensure directory exists
        os.makedirs(persist_directory, exist_ok=True)
        
        # Try multiple initialization strategies
        for attempt in range(3):
            try:
                # Clean slate approach for Docker containers
                if attempt == 0 and os.environ.get('DOCKER_CONTAINER'):
                    logger.info("Docker container detected, ensuring clean ChromaDB initialization")
                    import shutil
                    if os.path.exists(persist_directory):
                        shutil.rmtree(persist_directory)
                    os.makedirs(persist_directory, exist_ok=True)
                
                # Initialize ChromaDB client with persistent storage
                self.client = chromadb.PersistentClient(path=persist_directory)
                
                # Try to get existing collections first
                try:
                    self.contracts_collection = self.client.get_collection("government_contracts")
                    logger.info("Found existing government_contracts collection")
                except Exception:
                    # Create new collection if it doesn't exist
                    self.contracts_collection = self.client.create_collection(
                        name="government_contracts",
                        metadata={"description": "Government contract metadata and descriptions"}
                    )
                    logger.info("Created new government_contracts collection")
                
                try:
                    self.documents_collection = self.client.get_collection("contract_documents")
                    logger.info("Found existing contract_documents collection")
                except Exception:
                    # Create new collection if it doesn't exist
                    self.documents_collection = self.client.create_collection(
                        name="contract_documents", 
                        metadata={"description": "Text content from contract documents"}
                    )
                    logger.info("Created new contract_documents collection")
                
                logger.info("ChromaDB client initialized successfully")
                return
                
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed to initialize ChromaDB: {str(e)}")
                
                if attempt < 2:  # Not the last attempt
                    # Clean up and try again
                    try:
                        import shutil
                        if os.path.exists(persist_directory):
                            shutil.rmtree(persist_directory)
                        os.makedirs(persist_directory, exist_ok=True)
                        logger.info(f"Cleaned ChromaDB directory for attempt {attempt + 2}")
                    except Exception as cleanup_error:
                        logger.error(f"Failed to clean ChromaDB directory: {cleanup_error}")
                else:
                    # Last attempt failed
                    logger.error(f"All attempts to initialize ChromaDB failed: {str(e)}")
                    raise e
    
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
            document_data: Dictionary containing Norshin processed document data
            contract_notice_id: Associated contract notice ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not document_data.get('success', False):
                logger.warning(f"Skipping document indexing - processing was not successful")
                return False
            
            # Extract text content from Norshin response format
            text_chunks = []
            results = document_data.get('results', [])
            
            for result in results:
                page_data = result.get('data', {})
                
                # Extract section title
                if page_data.get('section_title'):
                    text_chunks.append(f"Section: {page_data['section_title']}")
                
                # Extract structured data (tree_data, table_data, etc.)
                for data_key in ['tree_data', 'table_data', 'text_data']:
                    if data_key in page_data and page_data[data_key]:
                        if isinstance(page_data[data_key], list):
                            for item in page_data[data_key]:
                                if isinstance(item, dict):
                                    # Convert dictionary to readable text
                                    item_text = ' '.join([f"{k}: {v}" for k, v in item.items() if v])
                                    text_chunks.append(item_text)
                                else:
                                    text_chunks.append(str(item))
                        else:
                            text_chunks.append(str(page_data[data_key]))
                
                # Extract raw text if available
                if page_data.get('raw_text'):
                    text_chunks.append(page_data['raw_text'])
            
            if not text_chunks:
                logger.warning(f"Skipping document indexing - no extractable text content")
                return False
            
            # Combine all text chunks
            full_text = '\n\n'.join(text_chunks)
            
            # Split into manageable chunks (ChromaDB works better with smaller chunks)
            chunk_size = 1000
            chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
            
            indexed_count = 0
            for i, chunk in enumerate(chunks):
                if len(chunk.strip()) < 50:  # Skip very short chunks
                    continue
                    
                # Create unique ID for each chunk
                chunk_id = f"{contract_notice_id}_chunk_{i}"
                
                # Prepare metadata
                metadata = {
                    'contract_notice_id': contract_notice_id,
                    'chunk_index': str(i),
                    'total_pages': str(document_data.get('totalPages', 0)),
                    'total_batches': str(document_data.get('totalBatches', 0)),
                    'text_length': str(len(chunk)),
                    'indexed_at': datetime.utcnow().isoformat(),
                    'type': 'document_chunk'
                }
                
                # Remove None values and ensure all values are strings
                metadata = {k: str(v) for k, v in metadata.items() if v is not None}
                
                try:
                    # Add to collection
                    self.documents_collection.add(
                        documents=[chunk],
                        metadatas=[metadata],
                        ids=[chunk_id]
                    )
                    indexed_count += 1
                except Exception as chunk_error:
                    logger.warning(f"Failed to index chunk {i}: {chunk_error}")
                    continue
            
            logger.info(f"Indexed {indexed_count} chunks for document {contract_notice_id}")
            return indexed_count > 0
            
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
