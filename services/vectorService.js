const { ChromaClient } = require('chromadb');
const config = require('../config/env');

class VectorService {
  constructor() {
    this.client = new ChromaClient({
      path: config.chromaUrl,
      auth: config.chromaApiKey ? { provider: 'token', credentials: config.chromaApiKey } : undefined
    });
    this.contractsCollection = null;
    this.documentsCollection = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // Create or get collections
      this.contractsCollection = await this.client.getOrCreateCollection({
        name: 'contracts',
        metadata: { description: 'Government contracts collection' }
      });

      this.documentsCollection = await this.client.getOrCreateCollection({
        name: 'documents',
        metadata: { description: 'Contract documents collection' }
      });

      console.log('✅ Vector database (ChromaDB) initialized');
      this.isConnected = true;
    } catch (error) {
      console.warn('⚠️ Vector database initialization failed:', error.message);
      console.warn('⚠️ ChromaDB is not available. Vector search features will be disabled.');
      console.warn('⚠️ To enable vector search, start ChromaDB server: docker run -p 8000:8000 chromadb/chroma');
      this.isConnected = false;
      // Don't throw error - allow server to start without vector DB
    }
  }

  async indexContract(contract) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - skipping contract indexing');
      return false;
    }

    try {
      const text = `${contract.title || ''} ${contract.description || ''} ${contract.agency || ''}`.trim();
      
      if (!text) {
        console.warn(`Skipping contract ${contract.noticeId} - no text content`);
        return false;
      }

      await this.contractsCollection.add({
        ids: [contract.noticeId],
        documents: [text],
        metadatas: [{
          title: contract.title,
          agency: contract.agency,
          naicsCode: contract.naicsCode,
          postedDate: contract.postedDate?.toISOString(),
          setAsideCode: contract.setAsideCode
        }]
      });

      console.log(`Indexed contract: ${contract.noticeId}`);
      return true;
    } catch (error) {
      console.error(`Error indexing contract ${contract.noticeId}:`, error);
      return false;
    }
  }

  async indexDocument(document, contractId) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - skipping document indexing');
      return false;
    }

    try {
      const documentId = `${contractId}_${document.filename}`;
      
      await this.documentsCollection.add({
        ids: [documentId],
        documents: [document.content || document.processedData || ''],
        metadatas: [{
          contractId,
          filename: document.filename,
          processedAt: new Date().toISOString()
        }]
      });

      console.log(`Indexed document: ${documentId}`);
      return true;
    } catch (error) {
      console.error(`Error indexing document ${documentId}:`, error);
      return false;
    }
  }

  async searchContracts(query, limit = 10) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - cannot perform vector search');
      return [];
    }

    try {
      const results = await this.contractsCollection.query({
        queryTexts: [query],
        nResults: limit
      });

      return results.ids[0].map((id, index) => ({
        id,
        score: results.distances[0][index],
        metadata: results.metadatas[0][index],
        document: results.documents[0][index]
      }));
    } catch (error) {
      console.error('Error searching contracts:', error);
      return [];
    }
  }

  async searchDocuments(query, limit = 10) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - cannot perform vector search');
      return [];
    }

    try {
      const results = await this.documentsCollection.query({
        queryTexts: [query],
        nResults: limit
      });

      return results.ids[0].map((id, index) => ({
        id,
        score: results.distances[0][index],
        metadata: results.metadatas[0][index],
        document: results.documents[0][index]
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  async getCollectionStats() {
    if (!this.isConnected) {
      return { 
        contracts: 0, 
        documents: 0,
        status: 'disconnected'
      };
    }

    try {
      const contractsCount = await this.contractsCollection.count();
      const documentsCount = await this.documentsCollection.count();

      return {
        contracts: contractsCount,
        documents: documentsCount,
        status: 'connected'
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { 
        contracts: 0, 
        documents: 0,
        status: 'error'
      };
    }
  }
}

module.exports = new VectorService();
